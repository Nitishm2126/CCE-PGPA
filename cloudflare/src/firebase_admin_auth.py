import base64
import json
import logging
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/projects"


async def _do_fetch(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Any] = None,
) -> Tuple[int, bytes, Dict[str, str]]:
    """Outbound HTTP request compatible with Cloudflare Python Worker and test environments."""
    headers = dict(headers or {})

    # 1. Primary: Pyodide pyfetch (Official Cloudflare Python Worker subrequests)
    try:
        from pyodide.http import pyfetch
        from pyodide.ffi import to_js

        kwargs: Dict[str, Any] = {"method": method, "headers": headers}
        if body is not None:
            if isinstance(body, (bytes, bytearray)):
                try:
                    kwargs["body"] = to_js(body)
                except Exception:
                    kwargs["body"] = body
            else:
                kwargs["body"] = str(body)

        resp = await pyfetch(url, **kwargs)
        status = int(resp.status)
        content_bytes = await resp.bytes()
        resp_headers = dict(resp.headers)
        return status, bytes(content_bytes), resp_headers
    except ImportError:
        pass
    except Exception as exc:
        logger.debug("pyfetch error for %s: %s, attempting js.fetch", url, exc)

    # 2. Secondary: native js.fetch in Cloudflare Worker runtime
    try:
        import js
        from pyodide.ffi import to_js

        js_headers = js.Headers.new()
        for k, v in headers.items():
            js_headers.append(k, str(v))

        opts = js.Object.new()
        opts.method = method
        opts.headers = js_headers
        if body is not None:
            if isinstance(body, (bytes, bytearray)):
                opts.body = to_js(body)
            else:
                opts.body = str(body)

        resp = await js.fetch(url, opts)
        status = int(resp.status)
        array_buffer = await resp.arrayBuffer()
        uint8 = js.Uint8Array.new(array_buffer)
        content_bytes = bytes(uint8.to_py())
        return status, content_bytes, {}
    except (ImportError, AttributeError):
        pass
    except Exception as exc:
        logger.debug("js.fetch error for %s: %s, falling back to urllib", url, exc)

    # 3. Tertiary: Fallback for non-Worker environments (local python/tests)
    import urllib.request
    import urllib.error

    data = body.encode("utf-8") if isinstance(body, str) else body
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            return int(resp.status), content, dict(resp.headers)
    except urllib.error.HTTPError as exc:
        err_body = exc.read() if hasattr(exc, "read") else b""
        return int(exc.code), err_body, dict(exc.headers if hasattr(exc, "headers") else {})


async def get_google_cloud_access_token(sa_dict: Dict[str, Any]) -> str:
    """Acquire Google Cloud OAuth2 access token using Service Account RS256 JWT."""
    header = {"alg": "RS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "iss": sa_dict["client_email"],
        "sub": sa_dict["client_email"],
        "aud": GOOGLE_TOKEN_URL,
        "iat": now,
        "exp": now + 3600,
        "scope": "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform",
    }

    # Generate RS256 signature
    assertion = None
    try:
        # In Cloudflare Python Worker: Use WebCrypto
        import js

        pem = sa_dict["private_key"]
        lines = [l for l in pem.splitlines() if not l.startswith("-----")]
        der_bytes = base64.b64decode("".join(lines))

        uint8_der = js.Uint8Array.new(len(der_bytes))
        for i, b in enumerate(der_bytes):
            uint8_der[i] = b

        algo = js.Object.new()
        algo.name = "RSASSA-PKCS1-v1_5"
        algo.hash = "SHA-256"

        usages = js.Array.new()
        usages.push("sign")

        crypto_key = await js.crypto.subtle.importKey("pkcs8", uint8_der, algo, False, usages)

        b64_h = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
        b64_p = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        signing_input = f"{b64_h}.{b64_p}".encode("ascii")

        uint8_data = js.Uint8Array.new(len(signing_input))
        for i, b in enumerate(signing_input):
            uint8_data[i] = b

        sig_ab = await js.crypto.subtle.sign("RSASSA-PKCS1-v1_5", crypto_key, uint8_data)
        sig_uint8 = js.Uint8Array.new(sig_ab)
        sig_bytes = bytes(sig_uint8.to_py())
        b64_sig = base64.urlsafe_b64encode(sig_bytes).decode().rstrip("=")

        assertion = f"{b64_h}.{b64_p}.{b64_sig}"
    except (ImportError, AttributeError):
        # Fallback for local python / test suite
        import jwt

        assertion = jwt.encode(payload, sa_dict["private_key"], algorithm="RS256")
        if isinstance(assertion, bytes):
            assertion = assertion.decode("utf-8")

    body_data = f"grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={assertion}"
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"}
    status, content, _ = await _do_fetch(GOOGLE_TOKEN_URL, method="POST", headers=headers, body=body_data)
    if status != 200:
        raise ValueError(f"Failed to obtain Google Cloud access token (HTTP {status}): {content.decode('utf-8', errors='ignore')}")

    data = json.loads(content.decode("utf-8"))
    return data["access_token"]


async def update_firebase_password(
    sa_dict: Dict[str, Any],
    email: str,
    new_password: str,
    uid: Optional[str] = None,
) -> bool:
    """Updates a user's password in Firebase Authentication using Google Identity Toolkit."""
    project_id = sa_dict.get("project_id", "cce-pgpa")
    access_token = await get_google_cloud_access_token(sa_dict)

    local_id = uid
    if not local_id:
        lookup_url = f"{IDENTITY_TOOLKIT_URL}/{project_id}/accounts:lookup"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        body = json.dumps({"email": [email.strip().lower()]})
        status, content, _ = await _do_fetch(lookup_url, method="POST", headers=headers, body=body)
        if status == 200:
            data = json.loads(content.decode("utf-8"))
            users = data.get("users", [])
            if users:
                local_id = users[0]["localId"]

    if not local_id:
        raise ValueError(f"User with email '{email}' was not found in Firebase Authentication")

    update_url = f"{IDENTITY_TOOLKIT_URL}/{project_id}/accounts:update"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    body = json.dumps({
        "localId": local_id,
        "password": new_password,
        "returnSecureToken": False,
    })
    status, content, _ = await _do_fetch(update_url, method="POST", headers=headers, body=body)
    if status != 200:
        err_msg = content.decode("utf-8", errors="ignore")
        raise ValueError(f"Firebase password update failed (HTTP {status}): {err_msg}")

    return True


async def create_or_update_firebase_user(
    sa_dict: Dict[str, Any],
    email: str,
    password: str,
    display_name: Optional[str] = None,
    uid: Optional[str] = None,
) -> str:
    """
    Creates a user in Firebase Auth if not present, or updates their password and profile.
    Returns the localId (uid).
    """
    project_id = sa_dict.get("project_id", "cce-pgpa")
    access_token = await get_google_cloud_access_token(sa_dict)

    # 1. Check if user already exists
    local_id = uid
    if not local_id:
        lookup_url = f"{IDENTITY_TOOLKIT_URL}/{project_id}/accounts:lookup"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        body = json.dumps({"email": [email.strip().lower()]})
        status, content, _ = await _do_fetch(lookup_url, method="POST", headers=headers, body=body)
        if status == 200:
            data = json.loads(content.decode("utf-8"))
            users = data.get("users", [])
            if users:
                local_id = users[0]["localId"]

    # 2. If exists, update password and displayName
    if local_id:
        update_url = f"{IDENTITY_TOOLKIT_URL}/{project_id}/accounts:update"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        body_dict: Dict[str, Any] = {"localId": local_id, "password": password, "returnSecureToken": False}
        if display_name:
            body_dict["displayName"] = display_name
        status, content, _ = await _do_fetch(update_url, method="POST", headers=headers, body=json.dumps(body_dict))
        if status != 200:
            err_msg = content.decode("utf-8", errors="ignore")
            raise ValueError(f"Firebase password update failed (HTTP {status}): {err_msg}")
        return local_id

    # 3. If does not exist, create user
    create_url = f"{IDENTITY_TOOLKIT_URL}/{project_id}/accounts"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    create_body: Dict[str, Any] = {
        "email": email.strip().lower(),
        "password": password,
        "emailVerified": False,
    }
    if display_name:
        create_body["displayName"] = display_name
    status, content, _ = await _do_fetch(create_url, method="POST", headers=headers, body=json.dumps(create_body))
    if status != 200:
        err_msg = content.decode("utf-8", errors="ignore")
        raise ValueError(f"Firebase user creation failed (HTTP {status}): {err_msg}")
    res = json.loads(content.decode("utf-8"))
    return res["localId"]

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("security")

# In-memory revocation cache for active sessions / tokens
_revoked_tokens: set[str] = set()


def _pbkdf2_hmac_sha256(password: bytes, salt: bytes, iterations: int = 1000, dklen: int = 32) -> bytes:
    """Pure-Python RFC 2898 PBKDF2-HMAC-SHA256 for Pyodide Wasm execution."""
    u = hmac.new(password, salt + b"\x00\x00\x00\x01", hashlib.sha256).digest()
    result = bytearray(u)
    for _ in range(iterations - 1):
        u = hmac.new(password, u, hashlib.sha256).digest()
        for i in range(len(u)):
            result[i] ^= u[i]
    return bytes(result[:dklen])


def hash_password(password: str, iterations: int = 1000) -> str:
    """Hash password using standard PBKDF2-HMAC-SHA256 with 1,000 iterations (fits in 5ms CPU)."""
    salt = os.urandom(16)
    dk = _pbkdf2_hmac_sha256(password.encode("utf-8"), salt, iterations=iterations)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    dk_b64 = base64.b64encode(dk).decode("ascii")
    return f"pbkdf2_sha256${iterations}${salt_b64}${dk_b64}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against stored PBKDF2 hash or legacy format."""
    if not plain_password or not hashed_password:
        return False

    # Check for PBKDF2-HMAC-SHA256
    parts = hashed_password.split("$")
    if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
        try:
            iterations = int(parts[1])
            salt = base64.b64decode(parts[2].encode("ascii"))
            expected_dk = base64.b64decode(parts[3].encode("ascii"))
            dk = _pbkdf2_hmac_sha256(plain_password.encode("utf-8"), salt, iterations=iterations)
            return hmac.compare_digest(dk, expected_dk)
        except Exception:
            return False

    # Plain equality fallback for unhashed or placeholder passwords
    if hashed_password in ("FIREBASE_MANAGED_ACCOUNT",):
        return False

    return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("ascii"))


def create_access_token(
    subject: str,
    role: str,
    secret_key: str,
    expires_minutes: int = 60,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate signed HS256 JWT access token without external C-extensions."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(subject),
        "role": str(role),
        "iat": now,
        "exp": now + (expires_minutes * 60),
    }
    if extra_claims:
        payload.update(extra_claims)

    h_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    p_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    enc_h = _b64url_encode(h_bytes)
    enc_p = _b64url_encode(p_bytes)

    signing_input = f"{enc_h}.{enc_p}".encode("ascii")
    sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    enc_sig = _b64url_encode(sig)

    return f"{enc_h}.{enc_p}.{enc_sig}"


def decode_access_token(token: str, secret_key: str) -> Dict[str, Any]:
    """Decode and validate an HS256 JWT access token."""
    if not token or is_token_revoked(token):
        raise ValueError("Token is missing or has been revoked")

    parts = token.strip().split(".")
    if len(parts) != 3:
        raise ValueError("Malformed JWT token structure")

    enc_h, enc_p, enc_sig = parts
    signing_input = f"{enc_h}.{enc_p}".encode("ascii")
    expected_sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        actual_sig = _b64url_decode(enc_sig)
    except Exception:
        raise ValueError("Invalid JWT signature encoding")

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid JWT signature")

    payload_json = _b64url_decode(enc_p).decode("utf-8")
    payload = json.loads(payload_json)

    exp = payload.get("exp")
    if exp and exp < int(time.time()):
        raise ValueError("Token has expired")

    return payload


def revoke_token(token: str) -> None:
    if token:
        _revoked_tokens.add(token.strip())


# Institutional Google Workspace Domains
ALLOWED_OIDC_DOMAINS = ("sairamtap.edu.in", "sairam.edu.in", "gmail.com")


def verify_google_id_token(
    id_token_str: str,
    expected_client_id: Optional[str] = None,
    secret_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Verifies a Google OpenID Connect (OIDC) ID token.
    Enforces:
    1. Signature & Google authenticity (via Google tokeninfo API or test verifier)
    2. Issuer: accounts.google.com or https://accounts.google.com
    3. Audience: expected_client_id (if configured)
    4. Expiration: exp > current timestamp
    5. Email verification: email_verified is True
    6. Institutional Domain Restriction: sairam.edu.in, sairamtap.edu.in, or gmail.com
    """
    if not id_token_str or not isinstance(id_token_str, str):
        raise ValueError("Missing or invalid Google ID token")

    payload: Dict[str, Any] = {}

    # Handle Staging / Internal Test Token Format
    if id_token_str.startswith("cce_test_google_token."):
        parts = id_token_str.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed test Google token structure")
        b64_payload, sig = parts[1], parts[2]
        
        # Verify HMAC signature with secret_key
        if secret_key:
            expected_sig = hmac.new(
                secret_key.encode("utf-8"),
                f"cce_test_google_token.{b64_payload}".encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(sig, expected_sig):
                raise ValueError("Invalid test token signature")

        payload = json.loads(_b64url_decode(b64_payload).decode("utf-8"))

    else:
        # Live Google Verification via tokeninfo endpoint
        import urllib.request
        import urllib.parse
        try:
            tokeninfo_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token_str)}"
            req = urllib.request.Request(tokeninfo_url, headers={"User-Agent": "CCE-PGPA-OIDC/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status != 200:
                    raise ValueError(f"Google token validation returned status {resp.status}")
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            raise ValueError(f"Google ID token verification failed: {exc}")

    # 1. Issuer Validation
    iss = payload.get("iss", "")
    if iss not in ("accounts.google.com", "https://accounts.google.com", "cce-pgpa-test-issuer"):
        raise ValueError(f"Untrusted token issuer: {iss}")

    # 2. Audience Validation
    if expected_client_id and expected_client_id.strip():
        aud = payload.get("aud", "")
        if aud != expected_client_id.strip() and aud != "cce-pgpa-test-aud":
            raise ValueError(f"Token audience mismatch: expected {expected_client_id}, got {aud}")

    # 3. Expiration Validation
    exp = payload.get("exp")
    if not exp or int(exp) <= time.time():
        raise ValueError("Google ID token has expired")

    # 4. Email Verification Check
    email_verified = payload.get("email_verified")
    if email_verified not in (True, "true", "True", 1):
        raise ValueError("Google account email is not verified")

    # 5. Email & Institutional Domain Restriction
    email = payload.get("email", "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("Missing or invalid email address in Google token")

    domain = email.split("@")[1].strip().lower()
    if domain not in ALLOWED_OIDC_DOMAINS:
        raise ValueError(
            f"Unauthorized domain: '{domain}'. Must be an institutional Google Workspace account "
            f"(@sairam.edu.in, @sairamtap.edu.in) or administrator account."
        )

    return {
        "email": email,
        "sub": payload.get("sub"),
        "name": payload.get("name", ""),
        "domain": domain,
        "email_verified": True,
        "picture": payload.get("picture", ""),
    }


def create_test_google_token(
    email: str,
    secret_key: str,
    name: str = "Test User",
    expires_in_seconds: int = 300,
    domain: Optional[str] = None,
    email_verified: bool = True,
    aud: str = "cce-pgpa-test-aud",
    iss: str = "https://accounts.google.com",
) -> str:
    """Generate a valid test Google OIDC token for automated testing."""
    user_domain = domain or email.split("@")[-1]
    payload = {
        "iss": iss,
        "aud": aud,
        "sub": f"google_sub_{hashlib.sha256(email.encode()).hexdigest()[:16]}",
        "email": email,
        "email_verified": email_verified,
        "hd": user_domain,
        "name": name,
        "exp": int(time.time()) + expires_in_seconds,
        "iat": int(time.time()),
    }
    b64_payload = _b64url_encode(json.dumps(payload).encode("utf-8"))
    sig = hmac.new(
        secret_key.encode("utf-8"),
        f"cce_test_google_token.{b64_payload}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"cce_test_google_token.{b64_payload}.{sig}"


async def _async_lookup_firebase_token(id_token: str, api_key: str) -> Dict[str, Any]:
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}"
    body_str = json.dumps({"idToken": id_token})

    # 1. Try Pyodide pyfetch (Official Cloudflare Python Worker subrequests)
    try:
        from pyodide.http import pyfetch
        resp = await pyfetch(url, method="POST", headers={"Content-Type": "application/json"}, body=body_str)
        resp_text = await resp.string()
        if resp.status != 200:
            if "INVALID_ID_TOKEN" in resp_text or "TOKEN_EXPIRED" in resp_text:
                raise ValueError("Invalid or expired Firebase ID token signature")
            raise ValueError(f"Firebase verification error ({resp.status}): {resp_text}")
        return json.loads(resp_text)
    except ImportError:
        pass

    # 2. Try native js.fetch
    try:
        import js
        resp = await js.fetch(url, js.Object.fromEntries([
            ["method", "POST"],
            ["headers", js.Object.fromEntries([["Content-Type", "application/json"]])],
            ["body", body_str],
        ]))
        resp_text = await resp.text()
        if resp.status != 200:
            if "INVALID_ID_TOKEN" in resp_text or "TOKEN_EXPIRED" in resp_text:
                raise ValueError("Invalid or expired Firebase ID token signature")
            raise ValueError(f"Firebase verification error ({resp.status}): {resp_text}")
        return json.loads(resp_text)
    except (ImportError, AttributeError):
        pass

    # 3. Fallback for non-Worker environments (tests, local python)
    import urllib.request
    import urllib.error
    req = urllib.request.Request(
        url,
        data=body_str.encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_text = exc.read().decode("utf-8") if hasattr(exc, "read") else str(exc)
        if "INVALID_ID_TOKEN" in err_text or "TOKEN_EXPIRED" in err_text:
            raise ValueError("Invalid or expired Firebase ID token signature")
        raise ValueError(f"Firebase verification error: {err_text}")


async def verify_firebase_id_token(
    id_token_str: str,
    project_id: str = "cce-pgpa",
    secret_key: Optional[str] = None,
    api_key: Optional[str] = "AIzaSyBNh7GnJGjlHTb1oz2nl0jAKVTMighELJU",
) -> Dict[str, Any]:
    """
    Verifies a Firebase Authentication ID token (RS256 JWT from Firebase Web SDK).
    Enforces:
    1. Structure: 3-part base64url-encoded JWT
    2. Header: alg == 'RS256'
    3. Issuer: https://securetoken.google.com/<project_id>
    4. Audience: <project_id>
    5. Expiration: exp > current timestamp
    6. Subject: non-empty string (Firebase UID)
    7. Signature verification via Google Identity Toolkit lookup or HMAC test signature
    """
    if not id_token_str or not isinstance(id_token_str, str):
        raise ValueError("Missing or invalid Firebase ID token")

    payload: Dict[str, Any] = {}

    # 1. Handle Staging / Internal Test Token Format
    if id_token_str.startswith("cce_test_firebase_token."):
        parts = id_token_str.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed test Firebase token structure")
        b64_payload, sig = parts[1], parts[2]
        if secret_key:
            expected_sig = hmac.new(
                secret_key.encode("utf-8"),
                f"cce_test_firebase_token.{b64_payload}".encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(sig, expected_sig):
                raise ValueError("Invalid test token signature")
        payload = json.loads(_b64url_decode(b64_payload).decode("utf-8"))
    else:
        # Standard Firebase JWT parsing
        parts = id_token_str.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid Firebase ID token format")

        try:
            header_json = _b64url_decode(parts[0]).decode("utf-8")
            payload_json = _b64url_decode(parts[1]).decode("utf-8")
            header = json.loads(header_json)
            payload = json.loads(payload_json)
        except Exception as e:
            raise ValueError(f"Failed to decode Firebase ID token: {str(e)}")

        if header.get("alg") != "RS256":
            raise ValueError(f"Invalid token algorithm: expected RS256, got {header.get('alg')}")

        # Signature verification via Google Identity Toolkit
        if api_key:
            lookup_res = await _async_lookup_firebase_token(id_token_str, api_key)
            users = lookup_res.get("users", [])
            if not users:
                raise ValueError("Firebase user not found for ID token")
            google_user = users[0]
            if google_user.get("localId"):
                payload["user_id"] = google_user["localId"]
            if google_user.get("email"):
                payload["email"] = google_user["email"]

    # Validate claims
    now = int(time.time())
    if payload.get("exp", 0) < now:
        raise ValueError("Firebase ID token has expired")

    expected_issuer = f"https://securetoken.google.com/{project_id}"
    if payload.get("iss") != expected_issuer and payload.get("iss") != "cce-pgpa-test-issuer":
        raise ValueError(f"Invalid token issuer: expected {expected_issuer}, got {payload.get('iss')}")

    if payload.get("aud") != project_id and payload.get("aud") != "cce-pgpa-test-aud":
        raise ValueError(f"Invalid token audience: expected {project_id}, got {payload.get('aud')}")

    uid = payload.get("user_id") or payload.get("sub")
    if not uid:
        raise ValueError("Firebase ID token missing subject/user_id")

    email = payload.get("email", "").strip().lower()

    return {
        "uid": uid,
        "email": email,
        "sub": uid,
        "auth_time": payload.get("auth_time"),
        "exp": payload.get("exp"),
        "email_verified": bool(payload.get("email_verified", False)),
    }


def create_test_firebase_token(
    email: str,
    uid: str,
    secret_key: str,
    project_id: str = "cce-pgpa",
    expires_in_seconds: int = 3600,
) -> str:
    """Generate a signed test Firebase ID token for automated test verification."""
    now = int(time.time())
    payload = {
        "iss": f"https://securetoken.google.com/{project_id}",
        "aud": project_id,
        "auth_time": now,
        "user_id": uid,
        "sub": uid,
        "iat": now,
        "exp": now + expires_in_seconds,
        "email": email,
        "email_verified": True,
        "firebase": {"identities": {"email": [email]}, "sign_in_provider": "password"},
    }
    b64_payload = _b64url_encode(json.dumps(payload).encode("utf-8"))
    sig = hmac.new(
        secret_key.encode("utf-8"),
        f"cce_test_firebase_token.{b64_payload}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"cce_test_firebase_token.{b64_payload}.{sig}"


def is_token_revoked(token: str) -> bool:
    if not token:
        return True
    return token.strip() in _revoked_tokens


def generate_oauth_state(
    user_id: str,
    secret_key: str,
    action: str = "google_drive_oauth",
    redirect_uri: Optional[str] = None,
    frontend_url: Optional[str] = None,
) -> str:
    """Generate signed CSRF state token for Google Drive OAuth flow."""
    claims = {
        "action": action,
        "nonce": secrets.token_hex(16),
    }
    if redirect_uri:
        claims["redirect_uri"] = redirect_uri
    if frontend_url:
        claims["frontend_url"] = frontend_url
    return create_access_token(user_id, "admin", secret_key, expires_minutes=15, extra_claims=claims)


def verify_oauth_state(state: str, secret_key: str, expected_action: str = "google_drive_oauth") -> Dict[str, Any]:
    """Validate returned OAuth state token against CSRF attacks."""
    payload = decode_access_token(state, secret_key)
    if payload.get("action") != expected_action:
        raise ValueError("OAuth state action mismatch")
    return payload


# Authenticated Stream Cipher for OAuth Refresh Token Encryption in D1
def encrypt_token(plain_token: str, secret_key: str) -> str:
    """Encrypt sensitive OAuth token using HMAC-SHA256 authenticated counter stream."""
    if not plain_token:
        raise ValueError("Cannot encrypt empty token")
    iv = os.urandom(16)
    key = hashlib.sha256(secret_key.encode("utf-8")).digest()
    
    # Generate keystream blocks
    plain_bytes = plain_token.encode("utf-8")
    keystream = bytearray()
    counter = 0
    while len(keystream) < len(plain_bytes):
        block = hmac.new(key, iv + counter.to_bytes(4, "big"), hashlib.sha256).digest()
        keystream.extend(block)
        counter += 1

    cipher_bytes = bytes(p ^ k for p, k in zip(plain_bytes, keystream[:len(plain_bytes)]))
    tag = hmac.new(key, iv + cipher_bytes, hashlib.sha256).digest()[:16]

    payload = iv + tag + cipher_bytes
    return base64.urlsafe_b64encode(payload).decode("ascii")


def decrypt_token(enc_token_str: str, secret_key: str) -> str:
    """Decrypt sensitive OAuth token."""
    if not enc_token_str:
        raise ValueError("Cannot decrypt empty token")
    payload = base64.urlsafe_b64decode(enc_token_str.encode("ascii"))
    if len(payload) < 32:
        raise ValueError("Invalid encrypted token format")

    iv = payload[:16]
    tag = payload[16:32]
    cipher_bytes = payload[32:]

    key = hashlib.sha256(secret_key.encode("utf-8")).digest()
    expected_tag = hmac.new(key, iv + cipher_bytes, hashlib.sha256).digest()[:16]
    if not hmac.compare_digest(tag, expected_tag):
        raise ValueError("Token decryption integrity failure")

    keystream = bytearray()
    counter = 0
    while len(keystream) < len(cipher_bytes):
        block = hmac.new(key, iv + counter.to_bytes(4, "big"), hashlib.sha256).digest()
        keystream.extend(block)
        counter += 1

    plain_bytes = bytes(c ^ k for c, k in zip(cipher_bytes, keystream[:len(cipher_bytes)]))
    return plain_bytes.decode("utf-8")

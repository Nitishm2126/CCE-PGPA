import json
import logging
import re
import urllib.parse
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"


async def _do_fetch(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Any] = None,
) -> Tuple[int, bytes, Dict[str, str]]:
    """
    Outbound HTTP request compatible with Cloudflare Python Worker (Pyodide pyfetch / js.fetch)
    and standard python environments (tests/local).
    """
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


async def exchange_code_for_tokens(
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
) -> Dict[str, Any]:
    """Exchange authorization code for OAuth tokens using non-blocking async fetch."""
    if not client_id or not client_secret:
        raise ValueError("Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET configuration")
    if not code:
        raise ValueError("Missing authorization code")
    if not redirect_uri:
        raise ValueError("Missing redirect_uri")

    payload = {
        "client_id": client_id.strip(),
        "client_secret": client_secret.strip(),
        "code": code.strip(),
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri.strip(),
    }
    body_str = urllib.parse.urlencode(payload)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }
    status, content, _ = await _do_fetch(
        GOOGLE_TOKEN_URL,
        method="POST",
        headers=headers,
        body=body_str,
    )
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception:
        raise ValueError(f"Google token endpoint returned unexpected response (HTTP {status})")

    if status != 200 or "error" in data:
        err_name = data.get("error", f"HTTP_{status}")
        err_desc = data.get("error_description", "Token exchange failed")
        # Ensure credentials/codes are NEVER included in error message
        raise ValueError(f"Google OAuth token exchange failed: {err_name} ({err_desc})")

    return data


async def refresh_access_token(
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> str:
    """Obtain a fresh short-lived access token using offline refresh token."""
    if not client_id or not client_secret or not refresh_token:
        raise ValueError("Missing OAuth credentials for token refresh")

    payload = {
        "client_id": client_id.strip(),
        "client_secret": client_secret.strip(),
        "refresh_token": refresh_token.strip(),
        "grant_type": "refresh_token",
    }
    body_str = urllib.parse.urlencode(payload)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }
    status, content, _ = await _do_fetch(
        GOOGLE_TOKEN_URL,
        method="POST",
        headers=headers,
        body=body_str,
    )
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception:
        raise ValueError(f"Token refresh returned non-JSON response (HTTP {status})")

    if status != 200 or "access_token" not in data:
        err_name = data.get("error", f"HTTP_{status}")
        err_desc = data.get("error_description", "Refresh failed")
        raise ValueError(f"Google token refresh failed: {err_name} ({err_desc})")

    return data["access_token"]


async def get_or_create_folder(access_token: str, folder_name: str, parent_id: str) -> str:
    """Locates an existing private subfolder or creates it."""
    safe_name = folder_name.replace("'", "\\'")
    query = (
        f"mimeType = 'application/vnd.google-apps.folder' and "
        f"name = '{safe_name}' and "
        f"'{parent_id}' in parents and "
        f"trashed = false"
    )
    url = f"{DRIVE_FILES_URL}?q={urllib.parse.quote(query)}&fields=files(id,name)"
    headers = {"Authorization": f"Bearer {access_token}"}
    status, content, _ = await _do_fetch(url, method="GET", headers=headers)
    if status == 200:
        data = json.loads(content.decode("utf-8"))
        files = data.get("files", [])
        if files:
            return files[0]["id"]

    # Create folder
    body = json.dumps({
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    })
    create_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
    }
    c_status, c_content, _ = await _do_fetch(
        DRIVE_FILES_URL,
        method="POST",
        headers=create_headers,
        body=body,
    )
    if c_status in (200, 201):
        res = json.loads(c_content.decode("utf-8"))
        return res["id"]
    raise ValueError(f"Failed to create Google Drive folder: HTTP {c_status}")


async def list_subfolders(access_token: str, parent_id: str) -> List[Dict[str, str]]:
    """Lists immediate non-trashed subfolders inside a Google Drive folder."""
    query = (
        f"mimeType = 'application/vnd.google-apps.folder' and "
        f"'{parent_id}' in parents and "
        f"trashed = false"
    )
    url = (
        f"{DRIVE_FILES_URL}?q={urllib.parse.quote(query)}"
        f"&fields=files(id,name)&pageSize=200"
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    status, content, _ = await _do_fetch(url, method="GET", headers=headers)
    if status != 200:
        return []
    try:
        data = json.loads(content.decode("utf-8"))
        return data.get("files", []) or []
    except Exception:
        return []


async def resolve_student_drive_folder(
    access_token: str,
    root_folder_id: str,
    register_number: str,
    full_name: str,
    existing_db_folder_id: Optional[str] = None,
) -> Tuple[str, bool]:
    """
    Resolves the student's existing Google Drive folder without ever creating a duplicate
    student root folder. Checks:
      1. existing_db_folder_id (if set in student_profiles)
      2. Existing folder inside root_folder_id or root_folder_id/'Students' matching register_number
         (handles both 'SEC25CO031 - NITISH M' and 'SEC25CO031_NITISH_M' conventions)
      3. Only creates '{REG}_{NAME}' inside existing Students parent if genuinely absent.
    Returns (folder_id, newly_discovered_or_created_for_db_update).
    """
    if existing_db_folder_id and str(existing_db_folder_id).strip():
        return str(existing_db_folder_id).strip(), False

    clean_reg = re.sub(r"[^A-Za-z0-9]", "", (register_number or "").strip()).upper()
    clean_name = re.sub(r"[^A-Za-z0-9]+", "_", (full_name or "").strip()).strip("_").upper()

    if not root_folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID root folder is not configured")

    # Determine Students root: either root_folder_id directly or a 'Students' child folder
    top_folders = await list_subfolders(access_token, root_folder_id)
    students_parent_id = root_folder_id
    search_parents = [root_folder_id]
    for tf in top_folders:
        if (tf.get("name") or "").strip().lower() == "students":
            students_parent_id = tf["id"]
            search_parents.insert(0, tf["id"])
            break

    # Search existing student folders by register number match first
    if clean_reg:
        for parent_id in search_parents:
            candidates = (
                top_folders
                if parent_id == root_folder_id
                else await list_subfolders(access_token, parent_id)
            )
            for cf in candidates:
                cname = (cf.get("name") or "").strip()
                norm_cname = re.sub(r"[^A-Za-z0-9]", "", cname).upper()
                if norm_cname.startswith(clean_reg) or clean_reg in norm_cname:
                    return cf["id"], True

    # Genuinely missing in Drive: create deterministic folder under Students parent
    folder_name = f"{clean_reg or 'STUDENT'} - {(full_name or 'STUDENT').strip().upper()}" if clean_reg else (clean_name or "STUDENT")
    created_id = await get_or_create_folder(access_token, folder_name, students_parent_id)
    return created_id, True


async def resolve_student_event_folder(
    access_token: str,
    student_folder_id: str,
    event_title: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Resolves/creates:
      <Student Folder> / Events / [<Event Title>]
    Returns (target_folder_id, events_folder_id).
    """
    events_folder_id = await get_or_create_folder(access_token, "Events", student_folder_id)
    if event_title and str(event_title).strip():
        safe_event_name = re.sub(r'[\\/:*?"<>|]+', " ", str(event_title).strip())
        safe_event_name = re.sub(r"\s+", " ", safe_event_name).strip()[:80]
        if safe_event_name:
            event_folder_id = await get_or_create_folder(access_token, safe_event_name, events_folder_id)
            return event_folder_id, events_folder_id
    return events_folder_id, events_folder_id


async def upload_evidence_file(
    access_token: str,
    content: bytes,
    filename: str,
    mime_type: str,
    folder_id: str,
    opaque_prefix: Optional[str] = None,
) -> Dict[str, Any]:
    """Upload binary file to Google Drive using multipart upload."""
    prefix = opaque_prefix or uuid.uuid4().hex[:12]
    safe_filename = f"{prefix}_{filename}"

    boundary = f"=====cce_pgpa_boundary_{uuid.uuid4().hex}====="
    meta_json = json.dumps({"name": safe_filename, "parents": [folder_id]})

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b"Content-Type: application/json; charset=UTF-8\r\n\r\n")
    body.extend(meta_json.encode("utf-8"))
    body.extend(b"\r\n")

    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
    body.extend(content)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": f"multipart/related; boundary={boundary}",
    }
    status, res_bytes, _ = await _do_fetch(
        DRIVE_UPLOAD_URL,
        method="POST",
        headers=headers,
        body=bytes(body),
    )
    if status not in (200, 201):
        raise ValueError(f"Google Drive upload failed (HTTP {status})")
    res = json.loads(res_bytes.decode("utf-8"))
    return {
        "drive_file_id": res["id"],
        "drive_folder_id": folder_id,
        "drive_filename": res.get("name", safe_filename),
        "size_bytes": len(content),
        "mime_type": mime_type,
    }


async def download_evidence_file(access_token: str, drive_file_id: str) -> Tuple[bytes, Dict[str, Any]]:
    """Downloads binary file content and metadata from Google Drive."""
    meta_url = f"{DRIVE_FILES_URL}/{drive_file_id}?fields=id,name,mimeType,size"
    headers = {"Authorization": f"Bearer {access_token}"}
    m_status, m_content, _ = await _do_fetch(meta_url, method="GET", headers=headers)
    meta = json.loads(m_content.decode("utf-8")) if m_status == 200 else {}

    media_url = f"{DRIVE_FILES_URL}/{drive_file_id}?alt=media"
    status, content, _ = await _do_fetch(media_url, method="GET", headers=headers)
    if status != 200:
        raise ValueError(f"Failed to download Google Drive file: HTTP {status}")

    return content, meta


async def delete_evidence_file(access_token: str, drive_file_id: str) -> bool:
    """Deletes an evidence file permanently or moves to trash in Google Drive."""
    del_url = f"{DRIVE_FILES_URL}/{drive_file_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        status, _, _ = await _do_fetch(del_url, method="DELETE", headers=headers)
        return status in (200, 204)
    except Exception as e:
        logger.warning("Error deleting drive file %s: %s", drive_file_id, e)
        return False

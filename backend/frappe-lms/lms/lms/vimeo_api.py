"""
Vimeo API Proxy for Delta SPMU Academy LMS.

Server-side proxy that keeps the Vimeo access token hidden from the frontend.
All endpoints require authentication and System Manager role.
"""

import json
import frappe
import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VIMEO_API_BASE = "https://api.vimeo.com"
DEFAULT_TAG = "deltaspmu-lms"
DEFAULT_EMBED_DOMAINS = [
    "deltaspmu.com",
    "learn.deltaspmu.com",
    "admin.deltaspmu.com",
    "api.deltaspmu.com",
    "staging-learn.deltaspmu.com",
    "staging-admin.deltaspmu.com",
    "staging-api.deltaspmu.com",
    "localhost",
]

# Player chrome stripped from every managed video for a clean training-video
# look: no Vimeo logo, no like / watch-later / share / embed buttons.
DEFAULT_EMBED_SETTINGS = {
    "logos": {"vimeo": False},
    "buttons": {
        "like": False,
        "watchlater": False,
        "share": False,
        "embed": False,
    },
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _check_admin():
    """Verify the current user holds the System Manager role.

    Raises:
        frappe.PermissionError: If the user is not a System Manager.
    """
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw(
            "Only System Managers can access Vimeo administration.",
            frappe.PermissionError,
        )


def _get_vimeo_token():
    """Retrieve the Vimeo access token from site configuration.

    The token is expected under ``vimeo_access_token`` in the site's
    ``site_config.json`` (accessible via ``frappe.conf``).

    Returns:
        str: The Vimeo bearer token.

    Raises:
        frappe.ValidationError: If the token is not configured.
    """
    token = getattr(frappe.conf, "vimeo_access_token", None)
    if not token:
        frappe.throw(
            "Vimeo access token is not configured. "
            "Set 'vimeo_access_token' in site_config.json.",
            frappe.ValidationError,
        )
    return token


def _vimeo_request(method, path, data=None, params=None):
    """Central HTTP helper for all Vimeo API calls.

    Args:
        method (str): HTTP method — GET, POST, PATCH, PUT, DELETE.
        path (str): API path relative to ``VIMEO_API_BASE``
                     (e.g. ``/me/videos``).
        data (dict | None): JSON body payload.
        params (dict | None): Query-string parameters.

    Returns:
        dict | None: Parsed JSON response, or ``None`` for 204 responses.

    Raises:
        frappe.ValidationError: On HTTP or network errors.
    """
    token = _get_vimeo_token()
    url = f"{VIMEO_API_BASE}{path}"

    headers = {
        "Authorization": f"bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/vnd.vimeo.*+json;version=3.4",
    }

    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            headers=headers,
            json=data,
            params=params,
            timeout=30,
        )
    except requests.exceptions.RequestException as exc:
        frappe.log_error(
            title="Vimeo API request failed",
            message=f"{method.upper()} {url} — {exc}",
        )
        frappe.throw(
            f"Failed to connect to Vimeo API: {exc}",
            frappe.ValidationError,
        )

    # 204 No Content (e.g. successful DELETE)
    if response.status_code == 204:
        return None

    # Try to parse JSON even on error status for a better message
    try:
        result = response.json()
    except (json.JSONDecodeError, ValueError):
        result = None

    if not response.ok:
        error_msg = "Unknown error"
        if result and isinstance(result, dict):
            error_msg = result.get("developer_message") or result.get("error") or error_msg
        frappe.log_error(
            title="Vimeo API error",
            message=f"{method.upper()} {url} [{response.status_code}]: {error_msg}",
        )
        frappe.throw(
            f"Vimeo API error ({response.status_code}): {error_msg}",
            frappe.ValidationError,
        )

    return result


def _extract_video_id(uri):
    """Extract the numeric video ID from a Vimeo URI like ``/videos/12345``.

    Args:
        uri (str): Vimeo resource URI.

    Returns:
        str: The numeric video ID.
    """
    if not uri:
        return None
    return uri.strip("/").split("/")[-1]


def _format_video(video):
    """Return a slim, frontend-friendly representation of a Vimeo video.

    Args:
        video (dict): Raw Vimeo video object.

    Returns:
        dict: Formatted video dict.
    """
    pictures = video.get("pictures", {})
    sizes = pictures.get("sizes", []) if pictures else []
    thumbnail = sizes[-1].get("link") if sizes else None

    privacy = video.get("privacy", {})

    # Vimeo's unlisted "privacy hash" is the path segment after the video ID in
    # the share link (https://vimeo.com/<id>/<hash>). It is required to embed
    # unlisted videos. Public videos have no hash. The frontend stores videos
    # as "id/hash" so the player can reference unlisted videos.
    vid = _extract_video_id(video.get("uri"))
    link = video.get("link") or ""
    video_hash = None
    if vid and f"/{vid}/" in link:
        video_hash = link.split(f"/{vid}/", 1)[1].strip("/").split("/")[0] or None

    return {
        "id": vid,
        "hash": video_hash,
        "uri": video.get("uri"),
        "name": video.get("name"),
        "description": video.get("description"),
        "duration": video.get("duration"),
        "thumbnail": thumbnail,
        # Pass the raw pictures structure through too — the admin grid reads
        # ``pictures.sizes`` to render thumbnails.
        "pictures": video.get("pictures"),
        "status": video.get("status"),
        "privacy": privacy.get("view") if privacy else None,
        "created_time": video.get("created_time"),
        "modified_time": video.get("modified_time"),
        "link": video.get("link"),
        "embed_html": (video.get("embed", {}) or {}).get("html"),
    }


# ---------------------------------------------------------------------------
# Whitelisted endpoints — all require System Manager
# ---------------------------------------------------------------------------


@frappe.whitelist()
def vimeo_list_videos(page=1, per_page=25, query=None):
    """List Vimeo videos tagged with ``deltaspmu-lms``.

    Args:
        page (int): Page number (default 1).
        per_page (int): Results per page (default 25, max 100).
        query (str | None): Optional search string to filter videos.

    Returns:
        dict: ``{"videos": [...], "total": int, "page": int, "per_page": int}``
    """
    _check_admin()

    page = int(page)
    per_page = min(int(per_page), 100)

    params = {
        "page": page,
        "per_page": per_page,
        "fields": "uri,name,description,duration,pictures,status,privacy,created_time,modified_time,link,embed,tags.tag",
        "sort": "date",
        "direction": "desc",
    }

    # Use search endpoint when query is provided, otherwise list with tag filter
    if query:
        params["query"] = query

    result = _vimeo_request("GET", "/me/videos", params=params)

    # Filter by tag client-side (Vimeo search API does not support tag filter
    # combined with query in a single call).
    videos_raw = result.get("data", [])
    videos = []
    for v in videos_raw:
        tags = [t.get("tag", "").lower() for t in (v.get("tags") or [])]
        # When a query is active we include all results; otherwise filter by tag
        if query or DEFAULT_TAG.lower() in tags:
            videos.append(_format_video(v))

    paging = result.get("paging", {})
    total = result.get("total", len(videos))

    return {
        # ``data`` is what the admin portal reads (VimeoListResponse.data);
        # ``videos`` is kept as an alias for any other consumer.
        "data": videos,
        "videos": videos,
        "total": total,
        "page": page,
        "per_page": per_page,
        "paging": paging,
    }


@frappe.whitelist()
def vimeo_get_video(video_id):
    """Fetch full details for a single Vimeo video.

    Args:
        video_id (str): Numeric Vimeo video ID.

    Returns:
        dict: Formatted video details.
    """
    _check_admin()

    if not video_id:
        frappe.throw("video_id is required.", frappe.ValidationError)

    video_id = str(video_id).strip()
    result = _vimeo_request("GET", f"/videos/{video_id}")
    return _format_video(result)


@frappe.whitelist()
def vimeo_create_upload(name, description=None, size=None):
    """Create a new video placeholder and return a TUS upload link.

    The video is created with *unlisted* privacy and the ``deltaspmu-lms``
    tag so it can be identified later.

    Args:
        name (str): Video title.
        description (str | None): Video description.
        size (int | None): File size in bytes (required by TUS).

    Returns:
        dict: ``{"video_uri": str, "upload_link": str, "video_id": str}``
    """
    _check_admin()

    if not name:
        frappe.throw("Video name is required.", frappe.ValidationError)

    payload = {
        "name": name,
        "privacy": {
            "view": "unlisted",
            "embed": "whitelist",
            "download": False,
        },
        "upload": {
            "approach": "tus",
        },
    }

    if description:
        payload["description"] = description

    if size:
        payload["upload"]["size"] = int(size)

    result = _vimeo_request("POST", "/me/videos", data=payload)

    video_uri = result.get("uri", "")
    video_id = _extract_video_id(video_uri)
    upload_link = result.get("upload", {}).get("upload_link")

    # Tag the video immediately
    try:
        _vimeo_request("PUT", f"/videos/{video_id}/tags/{DEFAULT_TAG}")
    except Exception:
        frappe.log_error(
            title="Vimeo tag failed",
            message=f"Could not tag video {video_id} with '{DEFAULT_TAG}'.",
        )

    return {
        "video_uri": video_uri,
        "upload_link": upload_link,
        "video_id": video_id,
    }


@frappe.whitelist()
def vimeo_complete_upload(video_id):
    """Post-upload housekeeping: set embed domain whitelist and ensure tag.

    Should be called by the frontend after TUS upload finishes.

    Args:
        video_id (str): Numeric Vimeo video ID.

    Returns:
        dict: ``{"success": True, "video_id": str}``
    """
    _check_admin()

    if not video_id:
        frappe.throw("video_id is required.", frappe.ValidationError)

    video_id = str(video_id).strip()

    # Set embed domain whitelist
    _set_embed_domains_internal(video_id, DEFAULT_EMBED_DOMAINS)

    # Strip the Vimeo logo and social buttons for a clean player.
    try:
        _vimeo_request(
            "PATCH",
            f"/videos/{video_id}",
            data={"embed": DEFAULT_EMBED_SETTINGS},
        )
    except Exception:
        frappe.log_error(
            title="Vimeo embed appearance failed",
            message=f"Could not set embed appearance for video {video_id}.",
        )

    # Ensure tag exists
    try:
        _vimeo_request("PUT", f"/videos/{video_id}/tags/{DEFAULT_TAG}")
    except Exception:
        frappe.log_error(
            title="Vimeo tag failed on complete",
            message=f"Could not tag video {video_id} with '{DEFAULT_TAG}'.",
        )

    return {"success": True, "video_id": video_id}


@frappe.whitelist()
def vimeo_update_video(video_id, name=None, description=None, privacy=None):
    """Update metadata for an existing Vimeo video.

    Args:
        video_id (str): Numeric Vimeo video ID.
        name (str | None): New title.
        description (str | None): New description.
        privacy (str | None): Privacy setting — ``unlisted``, ``anybody``,
                               ``nobody``, ``password``, ``disable``.

    Returns:
        dict: Formatted updated video details.
    """
    _check_admin()

    if not video_id:
        frappe.throw("video_id is required.", frappe.ValidationError)

    video_id = str(video_id).strip()

    payload = {}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if privacy is not None:
        payload["privacy"] = {"view": privacy}

    if not payload:
        frappe.throw("No fields to update.", frappe.ValidationError)

    result = _vimeo_request("PATCH", f"/videos/{video_id}", data=payload)
    return _format_video(result)


@frappe.whitelist()
def vimeo_delete_video(video_id):
    """Permanently delete a Vimeo video.

    Args:
        video_id (str): Numeric Vimeo video ID.

    Returns:
        dict: ``{"success": True, "video_id": str}``
    """
    _check_admin()

    if not video_id:
        frappe.throw("video_id is required.", frappe.ValidationError)

    video_id = str(video_id).strip()
    _vimeo_request("DELETE", f"/videos/{video_id}")

    return {"success": True, "video_id": video_id}


@frappe.whitelist()
def vimeo_set_embed_domains(video_id, domains=None):
    """Set the embed domain whitelist for a video.

    Args:
        video_id (str): Numeric Vimeo video ID.
        domains (list[str] | str | None): List of allowed domains.
            Accepts a JSON-encoded string or a Python list.
            Defaults to ``DEFAULT_EMBED_DOMAINS``.

    Returns:
        dict: ``{"success": True, "video_id": str, "domains": list}``
    """
    _check_admin()

    if not video_id:
        frappe.throw("video_id is required.", frappe.ValidationError)

    video_id = str(video_id).strip()

    # Normalise domains argument
    if domains is None:
        domain_list = DEFAULT_EMBED_DOMAINS
    elif isinstance(domains, str):
        try:
            domain_list = json.loads(domains)
        except (json.JSONDecodeError, ValueError):
            domain_list = [d.strip() for d in domains.split(",") if d.strip()]
    else:
        domain_list = list(domains)

    _set_embed_domains_internal(video_id, domain_list)

    return {"success": True, "video_id": video_id, "domains": domain_list}


# ---------------------------------------------------------------------------
# Internal domain-whitelist helper (not whitelisted)
# ---------------------------------------------------------------------------


def _set_embed_domains_internal(video_id, domain_list):
    """Apply a list of embed domains to a Vimeo video.

    Vimeo's API requires each domain to be added individually via
    ``PUT /videos/{id}/privacy/domains/{domain}``.

    Args:
        video_id (str): Numeric Vimeo video ID.
        domain_list (list[str]): Domains to whitelist.
    """
    # First, ensure the video's embed privacy is set to "whitelist"
    _vimeo_request(
        "PATCH",
        f"/videos/{video_id}",
        data={"privacy": {"embed": "whitelist"}},
    )

    # Retrieve existing domains and remove any not in the new list
    try:
        existing = _vimeo_request("GET", f"/videos/{video_id}/privacy/domains")
        existing_domains = [
            d.get("domain") for d in (existing.get("data") or [])
        ]
        for domain in existing_domains:
            if domain and domain not in domain_list:
                try:
                    _vimeo_request(
                        "DELETE",
                        f"/videos/{video_id}/privacy/domains/{domain}",
                    )
                except Exception:
                    pass  # best-effort removal
    except Exception:
        existing_domains = []

    # Add each new domain
    for domain in domain_list:
        domain = domain.strip()
        if not domain:
            continue
        if domain in existing_domains:
            continue
        try:
            _vimeo_request(
                "PUT",
                f"/videos/{video_id}/privacy/domains/{domain}",
            )
        except Exception:
            frappe.log_error(
                title="Vimeo embed domain error",
                message=f"Could not add domain '{domain}' to video {video_id}.",
            )

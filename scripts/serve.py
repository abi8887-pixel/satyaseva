#!/usr/bin/env python3
"""
serve.py — Local Server, Portable SQLite Data Layer & Photo Upload API for Satyaseva Sisters
Serves the site/ directory and provides full REST endpoints backed by a portable SQLite database (sscs.db)
to store and manage data uploaded by sisters from each station (communities, reports, chronicles, photos, memorial records).
"""

import os
import sys
import json
import cgi
import time
import hashlib
import secrets
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from sync_images import sync, get_paths, IMAGE_EXTENSIONS

# Import portable SQLite database layer
import db

PORT = 8000
MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB max POST body

# ── Allowed origins for CORS (restrict to production + local dev) ──
ALLOWED_ORIGINS = [
    'https://satyasevasisters.org',
    'https://www.satyasevasisters.org',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://localhost:8443',
    'https://127.0.0.1:8443',
]

# ── Server-side password hash (bcrypt-style with SHA-256 + salt) ──
# The admin password is verified server-side only; the hash is never sent to the client.
# To change the password, run: python3 -c "import serve; serve.set_admin_password('newpass')"
ADMIN_HASH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', '.admin_hash')

# ── Active session tokens (in-memory; cleared on restart) ──
_active_sessions = {}  # token -> expiry timestamp
SESSION_TTL = 3600 * 8  # 8 hours

# ── Rate limiting ──
_rate_limits = {}  # ip -> {endpoint: [timestamps]}
RATE_LIMITS = {
    '/api/auth/login': (5, 60),       # 5 attempts per 60 seconds
    '/api/contact': (10, 60),         # 10 per 60 seconds
    '/api/newsletter': (5, 60),       # 5 per 60 seconds
    '/api/prayers': (10, 60),         # 10 per 60 seconds
    '/api/station-uploads': (10, 60), # 10 per 60 seconds
}

def _check_rate_limit(ip, endpoint):
    """Returns True if the request is allowed, False if rate-limited."""
    limits = RATE_LIMITS.get(endpoint)
    if not limits:
        return True
    max_requests, window_seconds = limits
    now = time.time()
    key = f"{ip}:{endpoint}"
    if key not in _rate_limits:
        _rate_limits[key] = []
    # Prune old entries
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window_seconds]
    if len(_rate_limits[key]) >= max_requests:
        return False
    _rate_limits[key].append(now)
    return True

def set_admin_password(plaintext):
    """Hash and store the admin password to disk. Run once to set up."""
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + plaintext).encode()).hexdigest()
    os.makedirs(os.path.dirname(ADMIN_HASH_FILE), exist_ok=True)
    with open(ADMIN_HASH_FILE, 'w') as f:
        f.write(f"{salt}:{h}")
    print(f"Admin password hash saved to {ADMIN_HASH_FILE}")

def _verify_admin_password(plaintext):
    """Verify a plaintext password against the stored salted hash."""
    if not os.path.exists(ADMIN_HASH_FILE):
        # Fallback: accept the legacy hardcoded hash for migration
        h = hashlib.sha256(plaintext.encode()).hexdigest()
        return h == '3da9d3db181afc4921f55f9c0e6fb27172af8514621131a549bb6e89362b85f9'
    with open(ADMIN_HASH_FILE, 'r') as f:
        stored = f.read().strip()
    if ':' not in stored:
        return False
    salt, stored_hash = stored.split(':', 1)
    h = hashlib.sha256((salt + plaintext).encode()).hexdigest()
    return secrets.compare_digest(h, stored_hash)

def _create_session():
    """Create a new session token."""
    token = secrets.token_hex(32)
    _active_sessions[token] = time.time() + SESSION_TTL
    # Prune expired sessions
    now = time.time()
    expired = [k for k, v in _active_sessions.items() if v < now]
    for k in expired:
        del _active_sessions[k]
    return token

def _validate_session(token):
    """Validate a session token."""
    if not token:
        return False
    expiry = _active_sessions.get(token)
    if expiry is None or expiry < time.time():
        if token in _active_sessions:
            del _active_sessions[token]
        return False
    return True

class SistersHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        _, site_dir, _, _, _ = get_paths()
        super().__init__(*args, directory=site_dir, **kwargs)

    def _get_cors_origin(self):
        """Return the allowed CORS origin for the request, or None."""
        origin = self.headers.get('Origin', '')
        if origin in ALLOWED_ORIGINS:
            return origin
        return None

    def end_headers(self):
        cors_origin = self._get_cors_origin()
        if cors_origin:
            self.send_header('Access-Control-Allow-Origin', cors_origin)
            self.send_header('Vary', 'Origin')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        cors_origin = self._get_cors_origin()
        if cors_origin:
            self.send_header('Access-Control-Allow-Origin', cors_origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        super().end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/api/communities':
            self.handle_get_communities()
        elif path == '/api/memorial':
            self.handle_get_memorial()
        elif path == '/api/station-uploads':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_get_station_uploads(query)
        elif path == '/api/db/status':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_get_db_status()
        elif path == '/api/db/download':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_download_db()
        elif path == '/api/events':
            self.send_json_response(200, db.get_events())
        elif path == '/api/news':
            self.send_json_response(200, db.get_news())
        elif path == '/api/contact':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.send_json_response(200, db.get_contact_messages())
        elif path == '/api/newsletter':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.send_json_response(200, db.get_newsletter_subscribers())
        elif path == '/api/prayers':
            self.send_json_response(200, db.get_prayer_requests(query.get('status', [None])[0]))
        else:
            # Block direct access to the database file or backup directory even if lingering in site/
            if path.endswith('.db') or '/backups/' in path:
                self.send_error(403, 'Forbidden')
                return
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Rate limiting check
        client_ip = self.client_address[0]
        if not _check_rate_limit(client_ip, path):
            self.send_json_response(429, {"error": "Too many requests. Please try again later."})
            return

        # Body size limit check (except file uploads which use multipart)
        content_length = int(self.headers.get('Content-Length', 0))
        content_type = self.headers.get('Content-Type', '')
        if content_length > MAX_BODY_SIZE and not content_type.startswith('multipart/form-data'):
            self.send_json_response(413, {"error": "Request body too large"})
            return

        # ── Auth endpoint (server-side login) ──
        if path == '/api/auth/login':
            self.handle_login()
            return
        elif path == '/api/auth/logout':
            self.handle_logout()
            return

        if path == '/api/upload':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_upload()
        elif path == '/api/communities':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_post_communities()
        elif path == '/api/communities/delete':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_delete_community()
        elif path == '/api/memorial':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_post_memorial()
        elif path == '/api/memorial/delete':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_delete_memorial()
        elif path == '/api/station-uploads':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_post_station_upload()
        elif path == '/api/station-uploads/delete':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_delete_station_upload()
        elif path == '/api/db/sync':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_db_sync()
        elif path == '/api/delete-photo':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_delete_photo()
        elif path == '/api/events':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_post_event()
        elif path == '/api/events/delete':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_delete_event()
        elif path == '/api/news':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_post_news()
        elif path == '/api/news/delete':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_delete_news()
        elif path == '/api/contact':
            self.handle_post_contact()
        elif path == '/api/contact/status':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_update_contact_status()
        elif path == '/api/newsletter':
            self.handle_post_newsletter()
        elif path == '/api/prayers':
            self.handle_post_prayer()
        elif path == '/api/prayers/status':
            if not self.is_authorized(): return self.send_error(401, "Unauthorized")
            self.handle_update_prayer_status()
        else:
            self.send_error(404, "Endpoint not found")

    # ── Communities / Stations ──
    def handle_get_communities(self):
        try:
            # Query SQLite primary source of truth
            stations = db.get_all_stations()
            if not stations:
                # Fallback to JSON if DB returned empty
                _, _, _, comm_json_path, _ = get_paths()
                if os.path.exists(comm_json_path):
                    with open(comm_json_path, 'r', encoding='utf-8') as f:
                        stations = json.load(f)
            self.send_json_response(200, stations)
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_communities(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}

            community_id = data.get('id') or data.get('communityId')
            if not community_id:
                name = data.get('name', '')
                community_id = "".join(c.lower() for c in name if c.isalnum() or c in "_-").strip()

            if not community_id:
                self.send_json_response(400, {"error": "Missing community id or name"})
                return

            data['id'] = community_id

            _, site_dir, comm_images_dir, _, _ = get_paths()

            # Ensure image folder exists
            target_folder = os.path.join(comm_images_dir, community_id)
            os.makedirs(target_folder, exist_ok=True)

            # Backup to scripts/data/backups/ directory (outside web root)
            backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            import datetime
            ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            try:
                current_all = db.get_all_stations()
                backup_path = os.path.join(backup_dir, f'communities_{ts}.json')
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(current_all, f, indent=2, ensure_ascii=False)
            except Exception:
                pass

            # Save in SQLite database (automatically syncs JSON)
            saved_id = db.save_station(data)

            # Re-sync gallery paths
            sync()

            self.send_json_response(200, {
                "success": True,
                "message": f"Community {saved_id} saved successfully in SQLite database",
                "communityId": saved_id
            })
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_community(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}
            community_id = data.get('id') or data.get('communityId')
            if not community_id:
                self.send_json_response(400, {"error": "Missing community id"})
                return

            db.delete_station(community_id)
            sync()
            new_communities = db.get_all_stations()
            self.send_json_response(200, {
                "success": True,
                "message": f"Community {community_id} deleted successfully from database",
                "communities": new_communities
            })
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    # ── Memorial Records ──
    def handle_get_memorial(self):
        try:
            records = db.get_memorial_sisters()
            self.send_json_response(200, records)
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_memorial(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            sister_data = json.loads(body.decode('utf-8')) if content_length > 0 else {}

            saved_id = db.save_memorial_sister(sister_data)
            all_records = db.get_memorial_sisters()

            self.send_json_response(200, {
                "success": True,
                "message": f"Memorial record for '{sister_data.get('name')}' saved successfully in database.",
                "id": saved_id,
                "records": all_records
            })
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_memorial(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            req = json.loads(body.decode('utf-8')) if content_length > 0 else {}
            sister_id = req.get('id')
            if not sister_id:
                self.send_json_response(400, {"error": "Missing sister id"})
                return

            db.delete_memorial_sister(sister_id)
            new_records = db.get_memorial_sisters()
            self.send_json_response(200, {
                "success": True,
                "message": "Memorial record deleted successfully from database.",
                "records": new_records
            })
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    # ── Station Uploads (Reports, Chronicles, Submissions from Sisters) ──
    def handle_get_station_uploads(self, query):
        try:
            station_id = query.get('station', [None])[0]
            upload_type = query.get('type', [None])[0]
            uploads = db.get_station_uploads(station_id=station_id, upload_type=upload_type)
            self.send_json_response(200, uploads)
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_station_upload(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}

            station_id = data.get('stationId') or data.get('station_id')
            title = data.get('title')
            if not station_id or not title:
                self.send_json_response(400, {"error": "Missing required fields: stationId and title"})
                return

            upload_id = db.add_station_upload(
                station_id=station_id,
                sister_name=data.get('sisterName') or data.get('sister_name') or 'Sister SCS',
                upload_type=data.get('uploadType') or data.get('upload_type') or 'general',
                title=title,
                content=data.get('content') or data.get('description') or '',
                file_path=data.get('filePath') or data.get('file_path') or '',
                metadata=data.get('metadata') or {}
            )

            self.send_json_response(200, {
                "success": True,
                "message": f"Upload record stored successfully in SQLite database (ID: {upload_id})",
                "uploadId": upload_id
            })
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_station_upload(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}
            upload_id = data.get('id') or data.get('uploadId')
            if not upload_id:
                self.send_json_response(400, {"error": "Missing upload id"})
                return

            db.delete_station_upload(int(upload_id))
            self.send_json_response(200, {
                "success": True,
                "message": f"Upload record {upload_id} deleted successfully"
            })
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    # ── Photo Upload API ──
    def handle_upload(self):
        _, site_dir, comm_images_dir, _, _ = get_paths()

        try:
            content_type = self.headers.get('Content-Type')
            if not content_type or not content_type.startswith('multipart/form-data'):
                self.send_json_response(400, {"error": "Content-Type must be multipart/form-data"})
                return

            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    'REQUEST_METHOD': 'POST',
                    'CONTENT_TYPE': self.headers['Content-Type'],
                }
            )

            community_id = form.getvalue('communityId')
            sister_name = form.getvalue('sisterName', 'Sister SCS')
            is_hero = form.getvalue('isHero', 'false').lower() in ('true', '1', 'yes')

            if not community_id:
                self.send_json_response(400, {"error": "Missing communityId"})
                return

            # Path traversal prevention: strip dangerous characters from communityId
            community_id = community_id.replace('/', '').replace('\\', '').replace('..', '').strip()
            if not community_id or community_id.startswith('.'):
                self.send_json_response(400, {"error": "Invalid communityId"})
                return

            target_folder = os.path.join(comm_images_dir, community_id)
            # Verify the resolved path is still under comm_images_dir
            real_target = os.path.realpath(target_folder)
            real_base = os.path.realpath(comm_images_dir)
            if not real_target.startswith(real_base):
                self.send_json_response(400, {"error": "Invalid communityId"})
                return

            if not os.path.isdir(target_folder):
                os.makedirs(target_folder, exist_ok=True)

            if 'file' not in form:
                self.send_json_response(400, {"error": "No file uploaded"})
                return

            file_item = form['file']
            if not file_item.filename:
                self.send_json_response(400, {"error": "Invalid filename"})
                return

            original_name = os.path.basename(file_item.filename)
            ext = os.path.splitext(original_name.lower())[1]

            if ext not in IMAGE_EXTENSIONS:
                self.send_json_response(400, {"error": f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(IMAGE_EXTENSIONS))}"})
                return

            if is_hero:
                saved_filename = f"hero{ext}"
            else:
                clean_name = "".join(c for c in original_name if c.isalnum() or c in "._- ")
                saved_filename = clean_name or f"photo_{int(os.path.getmtime(comm_images_dir))}{ext}"

            dest_path = os.path.join(target_folder, saved_filename)
            with open(dest_path, 'wb') as f:
                f.write(file_item.file.read())

            # Automatically synchronize site manifest
            sync()

            rel_path = f"images/communities/{community_id}/{saved_filename}"

            # Log photo upload in SQLite station_uploads & station_gallery
            try:
                db.add_station_upload(
                    station_id=community_id,
                    sister_name=sister_name,
                    upload_type='photo',
                    title=f"Photo Uploaded: {saved_filename}",
                    content=f"Archival photograph uploaded by {sister_name} to station archive.",
                    file_path=rel_path,
                    metadata={'isHero': is_hero, 'originalName': original_name}
                )
            except Exception as e:
                print(f"Warning: Failed to log photo upload in SQLite: {e}")

            self.send_json_response(200, {
                "success": True,
                "message": f"Photo successfully uploaded to {community_id}!",
                "path": rel_path
            })

        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_photo(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}

            community_id = data.get('communityId')
            filename = data.get('filename') or data.get('photo')

            if not community_id or not filename:
                self.send_json_response(400, {"error": "Missing communityId or filename"})
                return

            _, site_dir, comm_images_dir, _, _ = get_paths()
            filename = os.path.basename(filename)
            target_path = os.path.join(comm_images_dir, community_id, filename)

            if os.path.exists(target_path) and os.path.isfile(target_path):
                os.remove(target_path)
                sync()
                self.send_json_response(200, {
                    "success": True,
                    "message": f"Photo {filename} deleted successfully from {community_id}"
                })
            else:
                self.send_json_response(404, {"error": "Photo not found"})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    # ── Database Status & Download ──
    def handle_get_db_status(self):
        try:
            stats = db.get_db_stats()
            self.send_json_response(200, stats)
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_download_db(self):
        """Streams the sscs.db file as an attachment for instant download."""
        try:
            if not os.path.exists(db.DB_PATH):
                self.send_error(404, "Database file not found")
                return
            with open(db.DB_PATH, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', 'application/x-sqlite3')
            self.send_header('Content-Disposition', 'attachment; filename="sscs.db"')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_db_sync(self):
        try:
            res = db.sync_to_json()
            if res:
                self.send_json_response(200, {"success": True, "message": "Database synchronized with communities.json and communities-data.js"})
            else:
                self.send_json_response(500, {"error": "Failed to sync database to JSON"})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def send_json_response(self, status_code, data):
        response_bytes = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.end_headers()
        self.wfile.write(response_bytes)

    def is_authorized(self):
        """Check for a valid session token in the Authorization header."""
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            return _validate_session(token)
        return False

    # ── Server-side Login / Logout ──
    def handle_login(self):
        """Authenticate with plaintext password, return a session token."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 1024:
                return self.send_json_response(413, {"error": "Request too large"})
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}
            password = data.get('password', '').strip()
            if not password:
                return self.send_json_response(400, {"error": "Password required"})
            if _verify_admin_password(password):
                token = _create_session()
                self.send_json_response(200, {"success": True, "token": token})
            else:
                # Slow down brute force attempts
                time.sleep(1)
                self.send_json_response(401, {"error": "Invalid access code"})
        except Exception:
            self.send_json_response(500, {"error": "Authentication error"})

    def handle_logout(self):
        """Invalidate the current session token."""
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            _active_sessions.pop(token, None)
        self.send_json_response(200, {"success": True})

    def _safe_error(self, e):
        """Return a generic error message; log the real error server-side."""
        import traceback
        traceback.print_exc()
        return "An internal error occurred"

    # ── Phase 2 Handlers ──
    def handle_post_event(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('title') or not data.get('date'):
                return self.send_json_response(400, {"error": "Missing title or date"})
            event_id = db.add_event(data)
            self.send_json_response(200, {"success": True, "id": event_id})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_event(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id'):
                return self.send_json_response(400, {"error": "Missing id"})
            db.delete_event(data['id'])
            self.send_json_response(200, {"success": True})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_news(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('title') or not data.get('date') or not data.get('content'):
                return self.send_json_response(400, {"error": "Missing title, date or content"})
            news_id = db.add_news(data)
            self.send_json_response(200, {"success": True, "id": news_id})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_news(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id'):
                return self.send_json_response(400, {"error": "Missing id"})
            db.delete_news(data['id'])
            self.send_json_response(200, {"success": True})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_contact(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            # Server-side honeypot check
            if data.get('_gotcha'):
                # Bot detected — silently accept without storing
                return self.send_json_response(200, {"success": True})
            if not data.get('name') or not data.get('email') or not data.get('message'):
                return self.send_json_response(400, {"error": "Missing required fields"})
            msg_id = db.add_contact_message(data)
            self.send_json_response(200, {"success": True, "id": msg_id})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_update_contact_status(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id') or not data.get('status'):
                return self.send_json_response(400, {"error": "Missing id or status"})
            db.update_contact_message_status(data['id'], data['status'])
            self.send_json_response(200, {"success": True})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_newsletter(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            # Server-side honeypot check
            if data.get('_gotcha'):
                return self.send_json_response(200, {"success": True})
            if not data.get('email') or '@' not in data.get('email'):
                return self.send_json_response(400, {"error": "Missing or invalid email"})
            res = db.add_newsletter_subscriber(data['email'])
            if res is None:
                return self.send_json_response(200, {"success": True, "message": "Already subscribed"})
            self.send_json_response(200, {"success": True})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_prayer(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            # Server-side honeypot check
            if data.get('_gotcha'):
                # Bot detected — silently accept without storing
                return self.send_json_response(200, {"success": True})
            if not data.get('intention'):
                return self.send_json_response(400, {"error": "Missing intention"})
            req_id = db.add_prayer_request(data)
            self.send_json_response(200, {"success": True, "id": req_id})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_update_prayer_status(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id') or not data.get('status'):
                return self.send_json_response(400, {"error": "Missing id or status"})
            db.update_prayer_request_status(data['id'], data['status'])
            self.send_json_response(200, {"success": True})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

def run(port=PORT, use_ssl=False):
    import threading
    # Initialize SQLite database and seed if necessary
    db.init_db()
    db.migrate_from_json()

    # Initial image sync
    sync()
    _, site_dir, _, _, _ = get_paths()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    cert_path = os.path.join(script_dir, 'certs', 'cert.pem')
    key_path = os.path.join(script_dir, 'certs', 'key.pem')

    # Ensure self-signed certificate exists
    if not (os.path.exists(cert_path) and os.path.exists(key_path)):
        import subprocess
        os.makedirs(os.path.join(script_dir, 'certs'), exist_ok=True)
        print("Generating self-signed SSL certificate...")
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", key_path, "-out", cert_path,
            "-days", "3650", "-nodes", "-subj", "/CN=localhost"
        ], check=True)

    servers = []

    if use_ssl and port not in (8000, 8443):
        import ssl
        httpd = HTTPServer(('', port), SistersHTTPRequestHandler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=cert_path, keyfile=key_path)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        servers.append((httpd, f"https://localhost:{port}"))
    else:
        # Dual-mode: Run HTTP on 8000 and HTTPS on 8443 concurrently
        import ssl
        http_server = HTTPServer(('', 8000), SistersHTTPRequestHandler)
        https_server = HTTPServer(('', 8443), SistersHTTPRequestHandler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=cert_path, keyfile=key_path)
        https_server.socket = context.wrap_socket(https_server.socket, server_side=True)

        servers.append((http_server, "http://localhost:8000"))
        servers.append((https_server, "https://localhost:8443"))

    print("===================================================================")
    print(f"Satyaseva Sisters Portable Database & Upload Server")
    for _, url in servers:
        icon = "🔒" if "https" in url else "🌐"
        print(f"Server URL:        {url} {icon}")
    print(f"Database File:     {db.DB_PATH} ({round(os.path.getsize(db.DB_PATH)/1024, 1)} KB)")
    print(f"Serving directory: {site_dir}")
    print(f"HSTS Header:       max-age=31536000; includeSubDomains; preload")
    print("===================================================================")
    print("REST Endpoints active: /api/communities, /api/station-uploads, /api/memorial, /api/db/status, /api/db/download")
    print("Press Ctrl+C to stop.\n")

    for s, _ in servers[:-1]:
        t = threading.Thread(target=s.serve_forever, daemon=True)
        t.start()

    try:
        servers[-1][0].serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")

if __name__ == '__main__':
    args = sys.argv[1:]
    use_ssl = ('--ssl' in args) or ('-s' in args)
    args = [a for a in args if a not in ('--ssl', '-s')]
    port = int(args[0]) if args else (8443 if use_ssl else PORT)
    run(port, use_ssl=use_ssl)

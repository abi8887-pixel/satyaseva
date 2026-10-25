#!/usr/bin/env python3
"""
serve.py — Local Server, Portable SQLite Data Layer & Photo Upload API for Satyaseva Sisters
Serves the site/ directory and provides full REST endpoints backed by a portable SQLite database (sscs.db)
to store and manage data uploaded by sisters from each station (communities, reports, chronicles, photos, memorial records).
"""

import os
import sys

# Ensure scripts directory is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

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

# ── Allowed origins for CORS (restrict to production + local dev + cloud deployments) ──
ALLOWED_ORIGINS = [
    'https://satyasevasisters.org',
    'https://www.satyasevasisters.org',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://localhost:8443',
    'https://127.0.0.1:8443',
]
_extra_origins = os.environ.get('ALLOWED_ORIGINS', '')
if _extra_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in _extra_origins.split(',') if o.strip()])

# ── Load environment variables from .env if present ──
def _load_env():
    """Load key-value environment variables from .env if present."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    env_files = [os.path.join(repo_root, '.env'), os.path.join(script_dir, '.env')]
    for ef in env_files:
        if os.path.isfile(ef):
            try:
                with open(ef, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith('#') or '=' not in line:
                            continue
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception as e:
                print(f"[ENV] Warning: Error loading {ef}: {e}")

_load_env()

# ── Industry-Standard Password Hashing (PBKDF2-HMAC-SHA256, 100,000 iterations) ──
# Complies with NIST and OWASP standards for key derivation and storage.
# The hash is never sent to client. Auto-migrates legacy SHA-256 hashes on login.
ADMIN_HASH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', '.admin_hash')

# ── Active session tokens (in-memory; cleared on restart) ──
_active_sessions = {}  # token -> expiry timestamp
SESSION_TTL = 3600 * 8  # 8 hours

# ── Rate limiting & Lockout ──
_rate_limits = {}  # ip -> {endpoint: [timestamps]}
_failed_login_attempts = {}  # ip -> [timestamps]
RATE_LIMITS = {
    '/api/auth/login': (5, 60),            # 5 attempts per 60 seconds
    '/api/auth/forgot-password': (3, 300),  # 3 attempts per 5 minutes
    '/api/auth/reset-password': (5, 300),   # 5 attempts per 5 minutes
    '/api/upload': (30, 60),               # 30 uploads per 60 seconds
    '/api/contact': (10, 60),              # 10 per 60 seconds
    '/api/newsletter': (5, 60),            # 5 per 60 seconds
    '/api/prayers': (10, 60),              # 10 per 60 seconds
    '/api/station-uploads': (15, 60),      # 15 per 60 seconds
}

# ── Email & Password Reset State & Config ──
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'faikhakkaunt@gmail.com')
_reset_codes = {}  # email -> {"code": str, "expires": float, "attempts": int}

def _send_email(to_email, subject, body_text):
    """
    Industry-standard SMTP / Gmail dispatcher.
    Supports STARTTLS (587), SSL (465), Gmail App Passwords, and custom SMTP hosts.
    Returns (success: bool, message: str).
    """
    smtp_user = os.environ.get('SMTP_USER') or os.environ.get('GMAIL_USER')
    smtp_pass = os.environ.get('SMTP_PASS') or os.environ.get('GMAIL_PASS') or os.environ.get('GMAIL_APP_PASSWORD')
    smtp_host = os.environ.get('SMTP_HOST')

    # Auto-detect Gmail host if user email is gmail
    if not smtp_host and smtp_user and ('@gmail.com' in smtp_user.lower() or os.environ.get('GMAIL_USER')):
        smtp_host = 'smtp.gmail.com'

    if not smtp_host or not smtp_user or not smtp_pass:
        msg = "SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS (or GMAIL_USER and GMAIL_APP_PASSWORD) in .env file or server environment."
        print(f"[AUTH/EMAIL INFO] {msg}")
        return False, msg

    # Normalize credentials
    smtp_pass = smtp_pass.replace(' ', '')
    smtp_user = smtp_user.strip()
    to_email = to_email.strip()

    raw_port = os.environ.get('SMTP_PORT')
    if raw_port:
        smtp_port = int(raw_port)
    else:
        use_ssl_env = os.environ.get('SMTP_SSL', '').lower() in ('1', 'true', 'yes')
        smtp_port = 465 if use_ssl_env else 587

    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Satyaseva Sisters <{smtp_user}>"
        msg['To'] = to_email
        msg.attach(MIMEText(body_text, 'plain', 'utf-8'))

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"[AUTH/EMAIL] Email sent to {to_email} via {smtp_host}:{smtp_port}")
        return True, "Email sent successfully"
    except smtplib.SMTPAuthenticationError as auth_err:
        err_msg = (
            f"Gmail/SMTP Authentication failed: {auth_err.smtp_error.decode() if isinstance(auth_err.smtp_error, bytes) else auth_err.smtp_error}. "
            "NOTE: For Gmail with 2-Step Verification, you must generate a 16-character 'App Password' at https://myaccount.google.com/apppasswords."
        )
        print(f"[AUTH/EMAIL ERROR] {err_msg}")
        return False, err_msg
    except Exception as e:
        err_msg = f"SMTP error ({type(e).__name__}): {e}"
        print(f"[AUTH/EMAIL ERROR] {err_msg}")
        return False, err_msg

def _send_reset_email(to_email, code):
    """Send password reset verification code via email."""
    subject = "Satyaseva Admin — Verification Code"
    body = (
        f"Hello,\n\n"
        f"A password reset request was initiated for the Satyaseva Sisters Admin Portal.\n\n"
        f"Your 6-digit verification code is: {code}\n\n"
        f"This code will expire in 15 minutes.\n\n"
        f"If you did not request this, please check your server security."
    )
    success, _ = _send_email(to_email, subject, body)
    return success

def _notify_admin_contact(data):
    """Notify admin when a new contact message is received."""
    subject = f"New Contact Message: {data.get('name', 'Visitor')}"
    body = (
        f"A new contact inquiry was submitted on the website:\n\n"
        f"Name: {data.get('name')}\n"
        f"Email: {data.get('email')}\n"
        f"Subject: {data.get('subject', '(No Subject)')}\n\n"
        f"Message:\n{data.get('message')}\n\n"
        f"View and reply in the Admin Portal under 'Contact & Prayers'."
    )
    _send_email(ADMIN_EMAIL, subject, body)

def _notify_admin_prayer(data):
    """Notify admin when a new prayer request is submitted."""
    subject = f"New Prayer Request from {data.get('name', 'Anonymous')}"
    body = (
        f"A new prayer intention was submitted on the website:\n\n"
        f"Name: {data.get('name', 'Anonymous')}\n\n"
        f"Intention:\n{data.get('intention')}\n\n"
        f"Review in the Admin Portal under 'Contact & Prayers'."
    )
    _send_email(ADMIN_EMAIL, subject, body)

def _check_rate_limit(ip, endpoint):
    """Returns True if request is allowed, False if rate-limited."""
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

def hash_password(plaintext, salt=None):
    """Generate industry-standard PBKDF2-HMAC-SHA256 hash with 100,000 iterations."""
    if not salt:
        salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', plaintext.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"pbkdf2:sha256:100000${salt}${derived.hex()}"

def set_admin_password(plaintext):
    """Hash and store the admin password to disk using PBKDF2."""
    if len(plaintext) < 8:
        raise ValueError("Password must be at least 8 characters long")
    h = hash_password(plaintext)
    os.makedirs(os.path.dirname(ADMIN_HASH_FILE), exist_ok=True)
    with open(ADMIN_HASH_FILE, 'w') as f:
        f.write(h)
    print(f"[AUTH] Admin password hash (PBKDF2-HMAC-SHA256, 100k iters) saved to {ADMIN_HASH_FILE}")

def _verify_admin_password(plaintext):
    """Verify password against env var or PBKDF2 hash on disk, auto-migrating legacy hashes."""
    # 1. Environment variable override
    env_password = os.environ.get('ADMIN_PASSWORD')
    if env_password:
        return secrets.compare_digest(plaintext, env_password)

    # 2. Check stored hash on disk
    if os.path.exists(ADMIN_HASH_FILE):
        try:
            with open(ADMIN_HASH_FILE, 'r') as f:
                stored = f.read().strip()
            # Standard PBKDF2 format: pbkdf2:sha256:100000$salt$hash
            if stored.startswith('pbkdf2:sha256:'):
                parts = stored.split('$')
                if len(parts) == 3:
                    iters = int(parts[0].split(':')[-1])
                    salt = parts[1]
                    expected_hash = parts[2]
                    derived = hashlib.pbkdf2_hmac('sha256', plaintext.encode('utf-8'), salt.encode('utf-8'), iters).hex()
                    return secrets.compare_digest(derived, expected_hash)
            # Legacy format: salt:sha256
            elif ':' in stored:
                salt, stored_hash = stored.split(':', 1)
                legacy_h = hashlib.sha256((salt + plaintext).encode()).hexdigest()
                if secrets.compare_digest(legacy_h, stored_hash):
                    # Automatic migration to PBKDF2!
                    try:
                        set_admin_password(plaintext)
                        print("[AUTH] Successfully auto-migrated legacy SHA-256 password hash to PBKDF2-HMAC-SHA256")
                    except Exception as mig_err:
                        print(f"[AUTH] Warning: could not auto-migrate password hash: {mig_err}")
                    return True
        except Exception as e:
            print(f"[AUTH] Error verifying password: {e}")
            return False

    print("[SECURITY WARNING] Admin password not configured. Set ADMIN_PASSWORD env var or run serve.set_admin_password('<password>').")
    return False

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
        if not origin:
            return None
        if origin in ALLOWED_ORIGINS:
            return origin
        # Also allow *.run.app, *.pages.dev, *.github.io, *.netlify.app for staging & preview
        if origin.endswith('.run.app') or origin.endswith('.pages.dev') or origin.endswith('.github.io') or origin.endswith('.netlify.app'):
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
        elif path == '/api/stats':
            self.send_json_response(200, db.get_public_stats())
        elif path == '/api/response-log':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_get_response_logs(query)
        elif path == '/api/response-log/stats':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.send_json_response(200, db.get_response_log_stats())
        elif path == '/api/response-log/export':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_export_response_log(query)
        else:
            # Block direct access to the database file or backup directory even if lingering in site/
            if path.endswith('.db') or '/backups/' in path:
                self.send_error(403, 'Forbidden')
                return

            # Serve root index.html when requesting / or /index.html
            if path in ('/', '/index.html'):
                root_index = os.path.join(os.path.dirname(site_dir), 'index.html')
                if os.path.exists(root_index):
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    with open(root_index, 'rb') as f:
                        content = f.read()
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return

            # Strip /site prefix so SimpleHTTPRequestHandler serves seamlessly from site_dir
            if self.path.startswith('/site/'):
                self.path = self.path[5:]

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
        elif path == '/api/auth/forgot-password':
            self.handle_forgot_password()
            return
        elif path == '/api/auth/reset-password':
            self.handle_reset_password()
            return

        if path == '/api/upload':
            self.handle_upload()
        elif path == '/api/admin/test-email':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_test_email()
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
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_delete_station_upload()
        elif path == '/api/db/sync':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_db_sync()
        elif path == '/api/delete-photo':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_delete_photo()
        elif path == '/api/events':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_post_event()
        elif path == '/api/events/delete':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_delete_event()
        elif path == '/api/news':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_post_news()
        elif path == '/api/news/delete':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_delete_news()
        elif path == '/api/contact':
            self.handle_post_contact()
        elif path == '/api/contact/status':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_update_contact_status()
        elif path == '/api/newsletter':
            self.handle_post_newsletter()
        elif path == '/api/newsletter/delete':
            self.handle_delete_newsletter()
        elif path == '/api/events/update':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_update_event()
        elif path == '/api/news/update':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_update_news()
        elif path == '/api/prayers':
            self.handle_post_prayer()
        elif path == '/api/prayers/status':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_update_prayer_status()
        elif path == '/api/response-log/review':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_review_response_log()
        elif path == '/api/response-log/revert':
            if not self.is_authorized(): return self.send_json_response(401, {"error": "Unauthorized"})
            self.handle_revert_response_log()
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

            # Capture snapshot BEFORE the change (for response log)
            snapshot_before = db.get_station(community_id)
            is_new = snapshot_before is None

            # Save in SQLite database (automatically syncs JSON)
            saved_id = db.save_station(data)

            # Capture snapshot AFTER the change
            snapshot_after = db.get_station(saved_id)

            # Log to response log
            try:
                action = 'community_add' if is_new else 'community_update'
                summary_parts = []
                if is_new:
                    summary_parts.append(f"New community '{data.get('name', saved_id)}' added")
                else:
                    if snapshot_before and snapshot_after:
                        for key in ['name', 'description', 'location', 'country', 'badge']:
                            old_val = snapshot_before.get(key, '')
                            new_val = snapshot_after.get(key, '')
                            if old_val != new_val:
                                summary_parts.append(f"{key} changed")
                        old_members = len(snapshot_before.get('members', []))
                        new_members = len(snapshot_after.get('members', []))
                        if old_members != new_members:
                            summary_parts.append(f"members: {old_members} → {new_members}")
                        old_ministries = len(snapshot_before.get('ministries', []))
                        new_ministries = len(snapshot_after.get('ministries', []))
                        if old_ministries != new_ministries:
                            summary_parts.append(f"ministries: {old_ministries} → {new_ministries}")
                    if not summary_parts:
                        summary_parts.append('Community data updated')
                db.add_response_log(
                    action_type=action,
                    entity_type='community',
                    entity_id=saved_id,
                    entity_name=data.get('name', saved_id),
                    sister_name='Admin',
                    summary='; '.join(summary_parts),
                    snapshot_before=snapshot_before,
                    snapshot_after=snapshot_after
                )
            except Exception as log_err:
                print(f"Warning: Failed to log community change: {log_err}")

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

            # Capture snapshot before delete for response log
            snapshot_before = db.get_station(community_id)

            db.delete_station(community_id)
            sync()

            # Log deletion to response log
            try:
                db.add_response_log(
                    action_type='community_delete',
                    entity_type='community',
                    entity_id=community_id,
                    entity_name=snapshot_before.get('name', community_id) if snapshot_before else community_id,
                    sister_name='Admin',
                    summary=f"Community '{snapshot_before.get('name', community_id) if snapshot_before else community_id}' deleted",
                    snapshot_before=snapshot_before,
                    snapshot_after=None
                )
            except Exception as log_err:
                print(f"Warning: Failed to log community deletion: {log_err}")

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

            # Capture before snapshot for response log
            existing_id = sister_data.get('id')
            snapshot_before = None
            if existing_id:
                existing_records = db.get_memorial_sisters()
                for rec in existing_records:
                    if rec.get('id') == existing_id:
                        snapshot_before = rec
                        break
            is_new = snapshot_before is None

            saved_id = db.save_memorial_sister(sister_data)
            all_records = db.get_memorial_sisters()

            # Capture after snapshot
            snapshot_after = None
            for rec in all_records:
                if rec.get('id') == saved_id:
                    snapshot_after = rec
                    break

            # Log to response log
            try:
                db.add_response_log(
                    action_type='memorial_add' if is_new else 'memorial_update',
                    entity_type='memorial',
                    entity_id=saved_id,
                    entity_name=sister_data.get('name', saved_id),
                    sister_name='Admin',
                    summary=f"Memorial record {'added' if is_new else 'updated'} for {sister_data.get('name', saved_id)}",
                    snapshot_before=snapshot_before,
                    snapshot_after=snapshot_after
                )
            except Exception as log_err:
                print(f"Warning: Failed to log memorial change: {log_err}")

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

            # Capture before snapshot
            snapshot_before = None
            existing_records = db.get_memorial_sisters()
            for rec in existing_records:
                if rec.get('id') == sister_id:
                    snapshot_before = rec
                    break

            db.delete_memorial_sister(sister_id)
            new_records = db.get_memorial_sisters()

            # Log deletion
            try:
                db.add_response_log(
                    action_type='memorial_delete',
                    entity_type='memorial',
                    entity_id=sister_id,
                    entity_name=snapshot_before.get('name', sister_id) if snapshot_before else sister_id,
                    sister_name='Admin',
                    summary=f"Memorial record deleted for {snapshot_before.get('name', sister_id) if snapshot_before else sister_id}",
                    snapshot_before=snapshot_before,
                    snapshot_after=None
                )
            except Exception as log_err:
                print(f"Warning: Failed to log memorial deletion: {log_err}")

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

            # Include CONTENT_LENGTH so cgi.FieldStorage reads without hanging on HTTP keep-alive
            environ = {
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': self.headers['Content-Type'],
                'CONTENT_LENGTH': self.headers.get('Content-Length', '0'),
            }

            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ=environ
            )

            community_id = form.getvalue('communityId')
            sister_name = form.getvalue('sisterName', 'Sister SCS')
            is_hero = form.getvalue('isHero', 'false').lower() in ('true', '1', 'yes')

            # Verification for public uploads: must be for an existing community
            is_admin = self.is_authorized()
            if not is_admin:
                client_ip = self.client_address[0]
                if not _check_rate_limit(client_ip, '/api/upload'):
                    self.send_json_response(429, {"error": "Too many uploads from this network. Please wait a few moments."})
                    return

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
                self.send_json_response(400, {"error": "Invalid communityId path"})
                return

            if not os.path.isdir(target_folder):
                os.makedirs(target_folder, exist_ok=True)

            if 'file' not in form:
                self.send_json_response(400, {"error": "No file uploaded"})
                return

            raw_files = form['file']
            file_items = raw_files if isinstance(raw_files, list) else [raw_files]

            saved_paths = []
            for idx, file_item in enumerate(file_items):
                if not getattr(file_item, 'filename', None):
                    continue

                original_name = os.path.basename(file_item.filename)
                ext = os.path.splitext(original_name.lower())[1]

                if ext not in IMAGE_EXTENSIONS:
                    continue

                if is_hero and idx == 0:
                    saved_filename = f"hero{ext}"
                else:
                    clean_name = "".join(c for c in original_name if c.isalnum() or c in "._- ")
                    saved_filename = clean_name or f"photo_{int(time.time())}_{idx}{ext}"

                dest_path = os.path.join(target_folder, saved_filename)
                with open(dest_path, 'wb') as f:
                    f.write(file_item.file.read())

                rel_path = f"images/communities/{community_id}/{saved_filename}"
                saved_paths.append(rel_path)

                # Keep SQLite station_gallery table in sync
                try:
                    db.add_station_gallery_photo(community_id, rel_path, is_hero=(is_hero and idx == 0))
                except Exception as db_err:
                    print(f"Warning: Failed to add photo to SQLite gallery: {db_err}")

                # Log photo upload in SQLite station_uploads
                try:
                    db.add_station_upload(
                        station_id=community_id,
                        sister_name=sister_name,
                        upload_type='photo',
                        title=f"Photo Uploaded: {saved_filename}",
                        content=f"Archival photograph uploaded by {sister_name} to station archive.",
                        file_path=rel_path,
                        metadata={'isHero': (is_hero and idx == 0), 'originalName': original_name}
                    )
                except Exception as e:
                    print(f"Warning: Failed to log photo upload in SQLite: {e}")

                # Log photo upload in response log
                try:
                    db.add_response_log(
                        action_type='photo_upload',
                        entity_type='photo',
                        entity_id=community_id,
                        entity_name=f"{saved_filename} ({community_id})",
                        sister_name=sister_name,
                        summary=f"Photo '{saved_filename}' uploaded to {community_id}" + (' as hero image' if (is_hero and idx == 0) else ''),
                        snapshot_before=None,
                        snapshot_after={'filePath': rel_path, 'fileName': saved_filename, 'isHero': (is_hero and idx == 0), 'communityId': community_id}
                    )
                except Exception as log_err:
                    print(f"Warning: Failed to log photo upload to response log: {log_err}")

            if not saved_paths:
                self.send_json_response(400, {"error": "No valid image files processed. Supported formats: JPG, PNG, WEBP, GIF, SVG"})
                return

            # Automatically synchronize site manifest & json
            sync()
            db.sync_to_json()

            self.send_json_response(200, {
                "success": True,
                "message": f"{len(saved_paths)} photo(s) successfully added to {community_id}!",
                "path": saved_paths[0],
                "paths": saved_paths
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
            rel_path = f"images/communities/{community_id}/{filename}"

            if os.path.exists(target_path) and os.path.isfile(target_path):
                os.remove(target_path)

                # Remove from SQLite gallery table
                try:
                    db.remove_station_gallery_photo(community_id, rel_path)
                except Exception as rm_err:
                    print(f"Warning: Failed to remove photo from SQLite gallery: {rm_err}")

                sync()
                db.sync_to_json()

                # Log photo deletion in response log
                try:
                    db.add_response_log(
                        action_type='photo_delete',
                        entity_type='photo',
                        entity_id=community_id,
                        entity_name=f"{filename} ({community_id})",
                        sister_name='Admin',
                        summary=f"Photo '{filename}' deleted from {community_id}",
                        snapshot_before={'filePath': rel_path, 'fileName': filename, 'communityId': community_id},
                        snapshot_after=None
                    )
                except Exception as log_err:
                    print(f"Warning: Failed to log photo deletion: {log_err}")

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

    def handle_forgot_password(self):
        """Initiate admin password reset by validating email and generating a verification code."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 1024:
                return self.send_json_response(413, {"error": "Request too large"})
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}
            email = data.get('email', '').strip().lower()
            if not email:
                return self.send_json_response(400, {"error": "Administrator email required"})

            # Verify against configured admin recovery email
            admin_target = ADMIN_EMAIL.strip().lower()
            if email != admin_target:
                # Add delay to avoid enumeration
                time.sleep(1)
                return self.send_json_response(200, {
                    "success": True,
                    "message": "If that email address is configured as an administrator, a verification code has been dispatched."
                })

            code = f"{secrets.randbelow(900000) + 100000}"
            expires = time.time() + 900  # 15 minutes
            _reset_codes[email] = {
                "code": code,
                "expires": expires,
                "attempts": 0
            }

            # Write code to local disk for console/admin access
            reset_file = os.path.join(os.path.dirname(ADMIN_HASH_FILE), '.reset_code')
            try:
                os.makedirs(os.path.dirname(reset_file), exist_ok=True)
                with open(reset_file, 'w') as f:
                    f.write(f"CODE: {code}\nEMAIL: {email}\nEXPIRES: {time.ctime(expires)}\n")
            except Exception as e:
                print(f"[AUTH] Warning: could not write .reset_code: {e}")

            print(f"\n=======================================================")
            print(f"🔒 [ADMIN PASSWORD RESET] Verification code: {code}")
            print(f"   Target Email: {email}")
            print(f"   Expires: 15 minutes ({time.ctime(expires)})")
            print(f"=======================================================\n")

            email_sent = _send_reset_email(email, code)

            self.send_json_response(200, {
                "success": True,
                "message": "Verification code generated! Please check your email inbox or server console.",
                "emailSent": email_sent
            })
        except Exception:
            self.send_json_response(500, {"error": "Failed to process reset request"})

    def handle_reset_password(self):
        """Verify code and update the admin password."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 2048:
                return self.send_json_response(413, {"error": "Request too large"})
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8')) if content_length > 0 else {}
            email = data.get('email', '').strip().lower()
            code = data.get('code', '').strip()
            new_password = data.get('newPassword', '').strip()

            if not email or not code or not new_password:
                return self.send_json_response(400, {"error": "Email, verification code, and new access code are required"})

            if len(new_password) < 6:
                return self.send_json_response(400, {"error": "New access code must be at least 6 characters"})

            reset_info = _reset_codes.get(email)
            if not reset_info:
                return self.send_json_response(400, {"error": "No active reset request found. Please request a new code."})

            if time.time() > reset_info['expires']:
                _reset_codes.pop(email, None)
                return self.send_json_response(400, {"error": "Verification code has expired. Please request a new code."})

            if reset_info['attempts'] >= 5:
                _reset_codes.pop(email, None)
                return self.send_json_response(429, {"error": "Too many failed attempts. Please request a new code."})

            if not secrets.compare_digest(reset_info['code'], code):
                reset_info['attempts'] += 1
                return self.send_json_response(400, {"error": "Invalid verification code. Please check and try again."})

            # Code verified! Update admin password
            set_admin_password(new_password)
            _reset_codes.pop(email, None)

            # Clean up .reset_code file
            reset_file = os.path.join(os.path.dirname(ADMIN_HASH_FILE), '.reset_code')
            if os.path.exists(reset_file):
                try:
                    os.remove(reset_file)
                except Exception:
                    pass

            # Create an authenticated session immediately
            token = _create_session()

            # Record in response log
            try:
                db.add_response_log(
                    action_type='password_reset',
                    entity_type='admin_auth',
                    entity_id='admin',
                    entity_name='Administrator Access Code',
                    sister_name='Admin',
                    summary=f"Admin access code was reset using recovery email {email}",
                    snapshot_before=None,
                    snapshot_after=None
                )
            except Exception:
                pass

            print(f"[AUTH] Admin password reset completed for {email}")
            self.send_json_response(200, {
                "success": True,
                "token": token,
                "message": "Access code successfully updated!"
            })
        except Exception:
            self.send_json_response(500, {"error": "Failed to reset password"})

    def _safe_error(self, e):
        """Return a generic error message; log the real error server-side."""
        import traceback
        traceback.print_exc()
        return "An internal error occurred"

    # ── Phase 2 Handlers ──
    def handle_test_email(self):
        """Test SMTP / Gmail configuration by sending a test email to ADMIN_EMAIL."""
        target = ADMIN_EMAIL
        configured_user = os.environ.get('SMTP_USER') or os.environ.get('GMAIL_USER') or '(none)'
        subject = "Satyaseva Sisters Portal — SMTP / Gmail Connection Test"
        body = (
            f"Greetings from Satyaseva Sisters Admin Portal!\n\n"
            f"This is a test email confirming that your Gmail/SMTP email integration is working properly.\n"
            f"Timestamp: {time.ctime()}\n"
            f"Configured sender: {configured_user}\n"
            f"Target recipient: {target}\n\n"
            f"Notifications for password resets, contact inquiries, and prayer requests will now be delivered successfully."
        )
        success, msg = _send_email(target, subject, body)
        self.send_json_response(200 if success else 500, {
            "success": success,
            "message": msg,
            "targetEmail": target,
            "configuredUser": configured_user
        })

    def handle_post_event(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('title') or not data.get('date'):
                return self.send_json_response(400, {"error": "Missing title or date"})

            is_update = bool(data.get('id'))
            if is_update:
                event_id = db.update_event(data['id'], data)
                action = 'event_update'
                summary = f"Event '{data.get('title')}' updated"
            else:
                event_id = db.add_event(data)
                action = 'event_add'
                summary = f"Event '{data.get('title')}' added for {data.get('date')}"

            # Log event action
            try:
                db.add_response_log(
                    action_type=action,
                    entity_type='event',
                    entity_id=str(event_id),
                    entity_name=data.get('title', ''),
                    sister_name='Admin',
                    summary=summary,
                    snapshot_before=None,
                    snapshot_after=data
                )
            except Exception as log_err:
                print(f"Warning: Failed to log event change: {log_err}")

            self.send_json_response(200, {"success": True, "id": event_id})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_event(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id'):
                return self.send_json_response(400, {"error": "Missing id"})

            # Capture before snapshot
            snapshot_before = None
            try:
                all_events = db.get_events()
                for ev in all_events:
                    if ev.get('id') == data['id']:
                        snapshot_before = ev
                        break
            except Exception:
                pass

            db.delete_event(data['id'])

            # Log deletion
            try:
                db.add_response_log(
                    action_type='event_delete',
                    entity_type='event',
                    entity_id=str(data['id']),
                    entity_name=snapshot_before.get('title', '') if snapshot_before else '',
                    sister_name='Admin',
                    summary=f"Event '{snapshot_before.get('title', '')}' deleted" if snapshot_before else 'Event deleted',
                    snapshot_before=snapshot_before,
                    snapshot_after=None
                )
            except Exception as log_err:
                print(f"Warning: Failed to log event deletion: {log_err}")

            self.send_json_response(200, {"success": True})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_post_news(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('title') or not data.get('date') or not data.get('content'):
                return self.send_json_response(400, {"error": "Missing title, date or content"})

            is_update = bool(data.get('id'))
            if is_update:
                news_id = db.update_news(data['id'], data)
                action = 'news_update'
                summary = f"News article '{data.get('title')}' updated"
            else:
                news_id = db.add_news(data)
                action = 'news_add'
                summary = f"News article '{data.get('title')}' published"

            # Log news action
            try:
                db.add_response_log(
                    action_type=action,
                    entity_type='news',
                    entity_id=str(news_id),
                    entity_name=data.get('title', ''),
                    sister_name=data.get('author', 'Admin'),
                    summary=summary,
                    snapshot_before=None,
                    snapshot_after=data
                )
            except Exception as log_err:
                print(f"Warning: Failed to log news action: {log_err}")

            self.send_json_response(200, {"success": True, "id": news_id})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_news(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id'):
                return self.send_json_response(400, {"error": "Missing id"})

            # Capture before snapshot
            snapshot_before = None
            try:
                all_news = db.get_news()
                for n in all_news:
                    if n.get('id') == data['id']:
                        snapshot_before = n
                        break
            except Exception:
                pass

            db.delete_news(data['id'])

            # Log deletion
            try:
                db.add_response_log(
                    action_type='news_delete',
                    entity_type='news',
                    entity_id=str(data['id']),
                    entity_name=snapshot_before.get('title', '') if snapshot_before else '',
                    sister_name='Admin',
                    summary=f"News article '{snapshot_before.get('title', '')}' deleted" if snapshot_before else 'News article deleted',
                    snapshot_before=snapshot_before,
                    snapshot_after=None
                )
            except Exception as log_err:
                print(f"Warning: Failed to log news deletion: {log_err}")

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

            # Notify admin via email
            try:
                _notify_admin_contact(data)
            except Exception as mail_err:
                print(f"[MAIL] Contact notification error: {mail_err}")

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

            # Notify admin via email
            try:
                _notify_admin_prayer(data)
            except Exception as mail_err:
                print(f"[MAIL] Prayer notification error: {mail_err}")

            self.send_json_response(200, {"success": True, "id": req_id})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_update_event(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id') or not data.get('title') or not data.get('date'):
                return self.send_json_response(400, {"error": "Missing id, title or date"})

            # Capture before snapshot
            snapshot_before = None
            try:
                all_events = db.get_events()
                for ev in all_events:
                    if ev.get('id') == data['id']:
                        snapshot_before = ev
                        break
            except Exception:
                pass

            db.update_event(data['id'], data)

            # Log update
            try:
                db.add_response_log(
                    action_type='event_update',
                    entity_type='event',
                    entity_id=str(data['id']),
                    entity_name=data.get('title', ''),
                    sister_name='Admin',
                    summary=f"Event '{data.get('title')}' updated",
                    snapshot_before=snapshot_before,
                    snapshot_after=data
                )
            except Exception as log_err:
                print(f"Warning: Failed to log event update: {log_err}")

            self.send_json_response(200, {"success": True, "id": data['id']})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_update_news(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            if not data.get('id') or not data.get('title') or not data.get('content'):
                return self.send_json_response(400, {"error": "Missing id, title or content"})

            # Capture before snapshot
            snapshot_before = None
            try:
                all_news = db.get_news()
                for n in all_news:
                    if n.get('id') == data['id']:
                        snapshot_before = n
                        break
            except Exception:
                pass

            db.update_news(data['id'], data)

            # Log update
            try:
                db.add_response_log(
                    action_type='news_update',
                    entity_type='news',
                    entity_id=str(data['id']),
                    entity_name=data.get('title', ''),
                    sister_name=data.get('author', 'Admin'),
                    summary=f"News article '{data.get('title')}' updated",
                    snapshot_before=snapshot_before,
                    snapshot_after=data
                )
            except Exception as log_err:
                print(f"Warning: Failed to log news update: {log_err}")

            self.send_json_response(200, {"success": True, "id": data['id']})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_delete_newsletter(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            email = data.get('email', '').strip()
            if not email or '@' not in email:
                return self.send_json_response(400, {"error": "Missing or invalid email"})
            deleted = db.delete_newsletter_subscriber(email)
            if deleted:
                self.send_json_response(200, {"success": True, "message": "Unsubscribed successfully"})
            else:
                self.send_json_response(404, {"error": "Email not found"})
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

    # ── Response Log Handlers ──
    def handle_get_response_logs(self, query):
        try:
            status = query.get('status', [None])[0]
            entity_type = query.get('type', [None])[0]
            logs = db.get_response_logs(status=status, entity_type=entity_type)
            self.send_json_response(200, logs)
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_review_response_log(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            log_id = data.get('id')
            status = data.get('status', 'reviewed')
            admin_notes = data.get('adminNotes', '')
            if not log_id:
                return self.send_json_response(400, {"error": "Missing log id"})
            db.update_response_log_status(log_id, status, reviewed_by='Admin', admin_notes=admin_notes)
            self.send_json_response(200, {"success": True, "message": f"Log entry {log_id} marked as {status}"})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_revert_response_log(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
            log_id = data.get('id')
            if not log_id:
                return self.send_json_response(400, {"error": "Missing log id"})
            result = db.revert_response_log(log_id)
            if result is None:
                return self.send_json_response(400, {"error": "Cannot revert this entry — no before-snapshot available"})
            self.send_json_response(200, {"success": True, "message": f"Change reverted successfully", "revertedData": result})
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

    def handle_export_response_log(self, query):
        """Exports response log as a JSON file for Google Drive backup."""
        try:
            status = query.get('status', [None])[0]
            entity_type = query.get('type', [None])[0]
            export_data = db.export_response_logs_for_drive(status=status, entity_type=entity_type)
            response_bytes = json.dumps(export_data, indent=2, ensure_ascii=False).encode('utf-8')
            import datetime
            ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'response_log_backup_{ts}.json'

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(response_bytes)))
            self.end_headers()
            self.wfile.write(response_bytes)
        except Exception as e:
            self.send_json_response(500, {"error": self._safe_error(e)})

def run(port=PORT, use_ssl=False):
    import threading
    # Initialize SQLite database and seed if necessary
    db.init_db()
    db.migrate_from_json()

    # Initial image sync
    try:
        sync()
    except Exception as e:
        print(f"[SYNC] Warning during image sync: {e}")
    _, site_dir, _, _, _ = get_paths()

    env_port = os.environ.get('PORT')
    if env_port:
        try:
            port = int(env_port)
            use_ssl = False  # Cloud Run terminates SSL at the edge proxy
        except ValueError:
            pass

    script_dir = os.path.dirname(os.path.abspath(__file__))
    cert_path = os.path.join(script_dir, 'certs', 'cert.pem')
    key_path = os.path.join(script_dir, 'certs', 'key.pem')

    servers = []

    # Single-port HTTP mode (Cloud Run / container / direct port)
    if env_port or (not use_ssl and port not in (8000, 8443)):
        http_server = HTTPServer(('0.0.0.0', port), SistersHTTPRequestHandler)
        servers.append((http_server, f"http://0.0.0.0:{port}"))
    elif use_ssl and port not in (8000, 8443):
        # Ensure self-signed certificate exists
        if not (os.path.exists(cert_path) and os.path.exists(key_path)):
            import subprocess
            os.makedirs(os.path.join(script_dir, 'certs'), exist_ok=True)
            print("Generating self-signed SSL certificate...")
            try:
                subprocess.run([
                    "openssl", "req", "-x509", "-newkey", "rsa:2048",
                    "-keyout", key_path, "-out", cert_path,
                    "-days", "3650", "-nodes", "-subj", "/CN=localhost"
                ], check=True)
            except Exception as e:
                print(f"Warning: Could not generate SSL certificate: {e}")
        import ssl
        httpd = HTTPServer(('0.0.0.0', port), SistersHTTPRequestHandler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(certfile=cert_path, keyfile=key_path)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        servers.append((httpd, f"https://0.0.0.0:{port}"))
    else:
        # Dual-mode (Local development): Run HTTP on 8000 and HTTPS on 8443 concurrently
        if not (os.path.exists(cert_path) and os.path.exists(key_path)):
            import subprocess
            os.makedirs(os.path.join(script_dir, 'certs'), exist_ok=True)
            print("Generating self-signed SSL certificate...")
            try:
                subprocess.run([
                    "openssl", "req", "-x509", "-newkey", "rsa:2048",
                    "-keyout", key_path, "-out", cert_path,
                    "-days", "3650", "-nodes", "-subj", "/CN=localhost"
                ], check=True)
            except Exception as e:
                print(f"Warning: Could not generate SSL certificate: {e}")
        import ssl
        http_server = HTTPServer(('0.0.0.0', 8000), SistersHTTPRequestHandler)
        servers.append((http_server, "http://0.0.0.0:8000"))
        try:
            https_server = HTTPServer(('0.0.0.0', 8443), SistersHTTPRequestHandler)
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.load_cert_chain(certfile=cert_path, keyfile=key_path)
            https_server.socket = context.wrap_socket(https_server.socket, server_side=True)
            servers.append((https_server, "https://0.0.0.0:8443"))
        except Exception as e:
            print(f"[HTTPS] Dual-mode note: HTTPS listener on 8443 skipped ({e})")

    print("===================================================================")
    print(f"Satyaseva Sisters Portable Database & Upload Server")
    for _, url in servers:
        icon = "🔒" if "https" in url else "🌐"
        print(f"Server URL:        {url} {icon}")
    print(f"Database File:     {db.DB_PATH} ({round(os.path.getsize(db.DB_PATH)/1024, 1) if os.path.exists(db.DB_PATH) else 0} KB)")
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
    env_port = os.environ.get('PORT')
    port = int(env_port) if env_port else (int(args[0]) if args else (8443 if use_ssl else PORT))
    run(port, use_ssl=use_ssl and not env_port)

#!/usr/bin/env python3
"""
build_memory_db.py — Comprehensive Agentic Memory Compiler for Satyaseva Sisters Portal
Generates:
1. memory.db (Portable SQLite Database with relational tables for agents & tools)
2. MEMORY.md (High-density structured markdown for LLM prompt context & instant reading)
3. memory.json (Structured JSON knowledge graph)
Covers: Design, Structure, Dataflows, Deployments, API Endpoints, and Quick Memorize Rules.
"""

import os
import sys
import json
import sqlite3
import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(REPO_ROOT, 'memory.db')
MD_PATH = os.path.join(REPO_ROOT, 'MEMORY.md')
JSON_PATH = os.path.join(REPO_ROOT, 'memory.json')

def init_tables(conn):
    cursor = conn.cursor()
    cursor.executescript("""
    DROP TABLE IF EXISTS memory_meta;
    CREATE TABLE memory_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT
    );

    DROP TABLE IF EXISTS design_system;
    CREATE TABLE design_system (
        token_id TEXT PRIMARY KEY,
        category TEXT NOT NULL,       -- 'color', 'typography', 'elevation', 'layout', 'motion', 'philosophy'
        name TEXT NOT NULL,
        light_value TEXT NOT NULL,
        dark_value TEXT DEFAULT '',
        usage TEXT NOT NULL
    );

    DROP TABLE IF EXISTS structure_pages;
    CREATE TABLE structure_pages (
        filename TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,       -- 'public', 'archival', 'interactive', 'admin', 'legal'
        purpose TEXT NOT NULL,
        key_components TEXT NOT NULL, -- JSON array
        data_dependencies TEXT NOT NULL, -- JSON array
        scripts TEXT NOT NULL,        -- JSON array
        styles TEXT NOT NULL          -- JSON array
    );

    DROP TABLE IF EXISTS structure_backend;
    CREATE TABLE structure_backend (
        component_id TEXT PRIMARY KEY,
        filepath TEXT NOT NULL,
        role TEXT NOT NULL,
        primary_classes_functions TEXT NOT NULL, -- JSON array
        data_layer TEXT NOT NULL,
        security_features TEXT NOT NULL
    );

    DROP TABLE IF EXISTS dataflows;
    CREATE TABLE dataflows (
        flow_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tier TEXT NOT NULL,            -- 'client_fetch', 'admin_sync', 'photo_pipeline', 'public_submission'
        trigger_event TEXT NOT NULL,
        execution_order TEXT NOT NULL, -- JSON array of steps
        fallback_strategy TEXT NOT NULL,
        key_files TEXT NOT NULL        -- JSON array
    );

    DROP TABLE IF EXISTS deployments;
    CREATE TABLE deployments (
        target_id TEXT PRIMARY KEY,
        platform_name TEXT NOT NULL,
        nature TEXT NOT NULL,          -- 'edge_static', 'container_cloud', 'cdn'
        runtime TEXT NOT NULL,
        entrypoint TEXT NOT NULL,
        config_files TEXT NOT NULL,    -- JSON array
        persistence_strategy TEXT NOT NULL,
        security_headers TEXT NOT NULL,
        workflow_summary TEXT NOT NULL
    );

    DROP TABLE IF EXISTS api_endpoints;
    CREATE TABLE api_endpoints (
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        auth_required INTEGER DEFAULT 0,
        rate_limit TEXT DEFAULT '',
        purpose TEXT NOT NULL,
        payload_schema TEXT DEFAULT '',
        response_schema TEXT DEFAULT '',
        PRIMARY KEY (method, path)
    );

    DROP TABLE IF EXISTS agent_quick_memorise;
    CREATE TABLE agent_quick_memorise (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,          -- 'design', 'architecture', 'dataflow', 'deployment', 'security'
        one_liner TEXT NOT NULL,
        golden_rules TEXT NOT NULL,    -- JSON array of key rules
        common_mistakes_to_avoid TEXT NOT NULL
    );
    """)
    conn.commit()

def seed_data(conn):
    cursor = conn.cursor()
    now_iso = datetime.datetime.now().isoformat()

    # 1. Meta
    meta = [
        ('project_name', 'Satyaseva Catechist Sisters of the Families (SSCS) Web & Archive Portal', 'Official repository title'),
        ('version', '3.8.0-production-ready', 'Current architecture state'),
        ('congregation_founded', '1976', 'Diocese of Mysore, Karnataka, India by Mother Regina Woroniecka'),
        ('nature', 'Independent research archive, community directory, & administrative portal', 'Domain scope'),
        ('generated_at', now_iso, 'Database compile timestamp'),
        ('architecture_pattern', 'JAMstack GitOps Static Edge + Optional Python Cloud Run Backend Container', 'Core architecture'),
        ('data_paradigm', 'Triple-Redundant Cascade (API -> Static JSON -> Inline JS Fallback)', 'Client data fetching model')
    ]
    cursor.executemany("INSERT INTO memory_meta VALUES (?, ?, ?)", meta)

    # 2. Design System
    design = [
        ('color_brand', 'color', '--brand', '#0d4b6b (Ocean Blue)', '#1f7aa5 (Vibrant Ocean)', 'Primary brand identity, headers, main badges, active icons'),
        ('color_brand_deep', 'color', '--brand-deep', '#083649 (Deep Navy)', '#0d4b6b (Ocean)', 'Header hover states, footer branding, deep accents'),
        ('color_brand_tint', 'color', '--brand-tint', '#e1eef6 (Pale Ocean Tint)', '#0d2535 (Dark Ocean Tint)', 'Active chip backgrounds, light callout boxes'),
        ('color_accent', 'color', '--accent', '#e8833a (Warm Amber)', '#f09a5c (Bright Amber)', 'Call-to-action buttons, jubilee tags, warm focal highlights'),
        ('color_accent_deep', 'color', '--accent-deep', '#c96820 (Rust Amber)', '#e8833a (Amber)', 'Hover state for buttons, active tabs'),
        ('color_bg', 'color', '--bg', '#f2f6f9 (Cool Slate White)', '#0b1822 (Deep Midnight)', 'Base page body background'),
        ('color_surface', 'color', '--surface', '#ffffff (Pure White)', '#122431 (Slate Charcoal)', 'Card surfaces, dropdowns, navigation pills'),
        ('color_surface_alt', 'color', '--surface-alt', '#eaf1f7 (Soft Gray-Blue)', '#1a2f3e (Medium Slate)', 'Section dividers, newsletter background, table headers'),
        ('color_ink', 'color', '--ink', '#0f2433 (Dark Ocean Ink)', '#e8f1f7 (Soft Ice White)', 'Primary readable text, headings'),
        ('color_ink_soft', 'color', '--ink-soft', '#475c6b (Muted Slate)', '#a3b8c6 (Muted Ice)', 'Secondary body text, descriptions, captions'),
        ('color_line', 'color', '--line', '#d3dee6 (Border Slate)', '#1a4a63 (Subtle Dark Border)', 'Card borders, separators, subtle dividers'),
        ('font_display', 'typography', '--font-serif', '"Young Serif", Georgia, "Times New Roman", serif', 'Same in dark', 'Editorial hero headlines, section headers, h1-h3 titles'),
        ('font_body', 'typography', '--font-sans', '"Hanken Grotesk", system-ui, -apple-system, sans-serif', 'Same in dark', 'All UI elements, body copy, navigation, tables, forms'),
        ('elev_1', 'elevation', '--elev-1', '0 1px 3px rgba(13,75,107,.07), 0 1px 2px rgba(13,75,107,.05)', 'Darker shadow', 'Subtle cards, filter chips, buttons'),
        ('elev_2', 'elevation', '--elev-2', '0 4px 12px rgba(13,75,107,.10), 0 2px 4px rgba(13,75,107,.06)', 'Darker shadow', 'Interactive hover lifts, dropdown menus'),
        ('elev_3', 'elevation', '--elev-3', '0 12px 28px rgba(13,75,107,.16), 0 4px 8px rgba(13,75,107,.08)', 'Darker shadow', 'Floating modals, image lightboxes, hero embeds'),
        ('container_max', 'layout', '--container', '1120px', '1120px', 'Main content container maximum width'),
        ('nav_height', 'layout', '--nav-h', '68px', '68px', 'Fixed top navigation bar height'),
        ('theme_engine', 'philosophy', 'Dynamic Theme Toggle', 'localStorage + system preference IIFE', 'attribute data-theme="dark|light"', 'Flash-free theme switcher via inline script in <head>'),
        ('zero_dep_ethos', 'philosophy', 'Zero Dependency Core', 'Vanilla HTML5 / Modern CSS / Pure JS', 'No npm / No Webpack build step needed', 'Fast, secure, unhackable, permanent archival resilience')
    ]
    cursor.executemany("INSERT INTO design_system VALUES (?, ?, ?, ?, ?, ?)", design)

    # 3. Structure Pages
    pages = [
        ('site/index.html', 'Home / Welcome Portal', 'public',
         'Landing portal with hero lede, dynamic impact counters, chronological story chapters, charism, ministries overview, prayer intentions, newsletter, and WhatsApp widget',
         json.dumps(['Hero with SVG cross', 'Animated Impact Stats', 'Chronological Story Chapters', 'Canva Book Embed', 'Prayer & Offerings Grid', 'Floating WhatsApp Widget', 'Back to Top Button']),
         json.dumps(['/api/newsletter', 'js/main.js', 'js/gallery.js']),
         json.dumps(['js/main.js', 'js/gallery.js']),
         json.dumps(['css/style.css'])),

        ('site/communities.html', 'Community Stations Directory', 'archival',
         'Full filterable grid of all 32+ convent houses and mission stations across India, Germany, and Poland with live photo badges',
         json.dumps(['Search Bar', 'Country Filter Chips', 'Community Card Grid', 'Symbolic Fallback Badges', 'Pagination / Empty State']),
         json.dumps(['data/communities.json', 'data/community-images.json', 'data/communities-data.js', '/api/communities']),
         json.dumps(['js/main.js', 'data/communities-data.js', 'js/communities-grid.js']),
         json.dumps(['css/style.css', 'css/communities.css'])),

        ('site/community.html', 'Community Detail Profile', 'archival',
         'Archival dossier for a single community station with hero photo banner, sisters list, apostolates, photo gallery with pan-zoom lightbox, and interactive upload form',
         json.dumps(['Editorial Brutalist Hero', 'Inline Station Switcher', 'Tabbed Apostolates', 'Sisters & Roles Grid', 'Gallery with Lightbox Pan/Zoom', 'Sister Direct Contribution Upload Modal']),
         json.dumps(['data/communities.json', 'data/community-images.json', 'data/communities-data.js', '/api/communities', '/api/station-uploads']),
         json.dumps(['js/main.js', 'data/communities-data.js', 'js/community-detail.js']),
         json.dumps(['css/style.css', 'css/community.css'])),

        ('site/map.html', 'Interactive Geographic Map', 'interactive',
         'Global interactive Leaflet map marking all convent houses, mission stations, and apostolates across India, Germany, and Poland',
         json.dumps(['Leaflet JS Map Container', 'Country Filter Chips', 'Custom Ocean Blue Pin Markers', 'Rich Popups with Photo & Link', 'Station Selector Sidebar']),
         json.dumps(['data/communities.json', 'data/community-images.json', 'Leaflet CDN CSS/JS', 'OpenStreetMap / CartoDB tiles']),
         json.dumps(['js/main.js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js']),
         json.dumps(['css/style.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'])),

        ('site/memorial.html', 'In Memoriam / Eternal Rest', 'archival',
         'Reverent memorial archive honoring deceased sisters with death anniversary sorting, search, timeline filter, and biography modals',
         json.dumps(['Memorial Search', 'Century/Decade Filters', 'Photo Remembrance Cards', 'Sister Biography Modal', 'Burial Place & Quote Badges']),
         json.dumps(['data/memorial.json', 'data/communities-data.js', '/api/memorial']),
         json.dumps(['js/main.js', 'data/communities-data.js', 'js/memorial.js']),
         json.dumps(['css/style.css', 'css/memorial.css'])),

        ('site/foundress.html', 'Mother Regina Woroniecka', 'archival',
         'Comprehensive biographical archive of foundress Mother Regina (Sr. Jolanta) Woroniecka, Ursuline missionary, her charism and spirituality',
         json.dumps(['Archival Photo Gallery', 'Chronological Life Milestones', 'Spiritual Quotes', 'Historical Sources Accordion']),
         json.dumps(['images/Mother_Regina_*.png', 'images/mother-*.jpg']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css', 'css/foundress.css'])),

        ('site/news.html', 'News & Announcements', 'public',
         'Congregation announcements, feast day photos, pastoral letters, and jubilee bulletins with date badges and search',
         json.dumps(['News Article Cards', 'Date & Author Badges', 'Filter by Year', 'Article Detail Modal']),
         json.dumps(['data/news.json', '/api/news']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/events.html', 'Calendar & Feast Days', 'public',
         'Calendar of upcoming feast days, foundation anniversaries, retreats, and jubilees with countdowns and location markers',
         json.dumps(['Upcoming Events Timeline', 'Event Category Chips', 'Add to Calendar links', 'Location Badges']),
         json.dumps(['data/events.json', '/api/events']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/media.html', 'Media & Publications', 'archival',
         'Multimedia portal containing video reflections, audio hymns, Canva interactive booklets, and downloadable brochures',
         json.dumps(['Video Showcase', 'Canva Booklets Player', 'Photo Archive Grid', 'Document Downloads']),
         json.dumps(['Canva Embed API', 'Local media assets']),
         json.dumps(['js/main.js', 'js/gallery.js']),
         json.dumps(['css/style.css'])),

        ('site/vocations.html', 'Vocations & Formation', 'public',
         'Guide for young women discerning religious life: stages of formation (Aspirancy, Postulancy, Novitiate, Juniorate, Final Vows), FAQ, and contact form',
         json.dumps(['Formation Stages Timeline', 'Sister Testimony Cards', 'Discernment FAQ Accordion', 'Direct Inquiry Form']),
         json.dumps(['/api/contact']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/prayers.html', 'Prayer Wall & Daily Office', 'interactive',
         'Congregation prayers, Rosary intentions, and an interactive Prayer Request Wall where visitors can submit intentions',
         json.dumps(['Prayer Intention Form', 'Public Prayer Wall Grid', 'Daily Prayers Audio/Text', 'Sisters Daily Offering']),
         json.dumps(['/api/prayers']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/donate.html', 'Support & Foster Care Giving', 'public',
         'Support mission apostolates: foster care for orphaned children, evening schools, medical aid, bank account details for India & overseas FCRA',
         json.dumps(['Apostolate Sponsorship Cards', 'Indian Banking NEFT/RTGS Info', 'Overseas FCRA Account Info', 'Tax Exemption Details']),
         json.dumps(['static']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/contact.html', 'Generalate Directory & Inquiries', 'public',
         'Official communication channel with interactive message submission form, phone numbers, Generalate address, and Google Map link',
         json.dumps(['Interactive Contact Form', 'Generalate Postal Details', 'Direct Phone & Email Links', 'Office Hours']),
         json.dumps(['/api/contact']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/admin.html', 'Administrative Master Dashboard', 'admin',
         'Comprehensive administrative control room for managing stations, sisters, uploads, photo galleries, memorial records, events, news, audit logs, and backups',
         json.dumps(['Secure Login Modal', 'Station CRUD Table', 'Multi-Photo Drag & Drop Uploader', 'Memorial Editor', 'Audit Trail with One-Click Revert', 'Database Status & JSON Re-Sync Tool']),
         json.dumps(['/api/auth/login', '/api/communities', '/api/memorial', '/api/events', '/api/news', '/api/response-log', '/api/db/sync', '/api/db/status']),
         json.dumps(['js/admin.js']),
         json.dumps(['css/style.css', 'css/admin.css'])),

        ('site/privacy.html', 'Privacy Policy & Zero Tracker Notice', 'legal',
         'Strict privacy pledge explaining zero third-party trackers, zero cookies, no analytics scripts, and GDPR compliance',
         json.dumps(['Data Handling Explainer', 'Rights Notice', 'Contact DPO']),
         json.dumps(['static']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/impressum.html', 'Impressum & Ecclesiastical Attribution', 'legal',
         'Legal ownership statement, canonical affiliation, ecclesiastical research archive disclaimers, and copyright notices',
         json.dumps(['Diocesan Affiliation', 'Copyright Notice', 'Archival Sources Attribution']),
         json.dumps(['static']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css'])),

        ('site/404.html', 'Not Found Error Page', 'public',
         'Branded 404 error page with navigation shortcuts and search suggestions',
         json.dumps(['Error Code Banner', 'Helpful Navigation Links']),
         json.dumps(['static']),
         json.dumps(['js/main.js']),
         json.dumps(['css/style.css']))
    ]
    cursor.executemany("INSERT INTO structure_pages VALUES (?, ?, ?, ?, ?, ?, ?, ?)", pages)

    # 4. Structure Backend
    backend = [
        ('server_daemon', 'scripts/serve.py',
         'Production/Local HTTP & REST Server daemon with built-in security, authentication, and database routing',
         json.dumps(['SatyasevaServer (SimpleHTTPRequestHandler)', 'do_GET', 'do_POST', 'handle_upload', 'handle_login', 'handle_response_log_revert']),
         'scripts/data/sscs.db via scripts/db.py',
         'PBKDF2-HMAC-SHA256 password hashing (100k rounds), rate-limiting per IP/endpoint, CORS domain whitelisting, 10MB payload cap, session tokens (8h TTL)'),

        ('database_manager', 'scripts/db.py',
         'Portable zero-dependency SQLite abstraction layer with schema migrations, relational indexing, and automatic static JSON synchronization',
         json.dumps(['init_db', 'get_connection', 'migrate_from_json', 'sync_all_to_json', 'get_stations', 'upsert_station', 'log_response_action', 'revert_response_log']),
         'SQLite (sscs.db) with WAL mode & PRAGMA foreign_keys = ON',
         'Strict prepared SQL statements, transactional integrity, automatic timestamping, before/after JSON change snapshots'),

        ('image_synchronizer', 'scripts/sync_images.py',
         'Filesystem scanner that reads site/images/communities/<id>/ and synchronizes community-images.json and communities.json automatically',
         json.dumps(['sync()', 'get_paths()', 'natural_sort_key()']),
         'Updates site/data/community-images.json and site/data/communities.json',
         'Sanitizes folder names, filters non-image files, supports .jpg, .jpeg, .png, .webp, .avif, .gif, .svg'),

        ('image_watcher', 'scripts/watch_images.py',
         'Continuous filesystem watchdog that detects newly dropped photos and auto-triggers sync_images without manual CLI commands',
         json.dumps(['main loop', 'polling / inotify handler']),
         'Calls scripts/sync_images.py on change',
         'Throttled debounce timer to prevent thrashing during multi-file file manager drops'),

        ('pwa_service_worker', 'site/sw.js',
         'Client-side progressive web app cache worker providing instant offline loading and stale-while-revalidate updates',
         json.dumps(['install event', 'activate event', 'fetch event (stale-while-revalidate)', 'message event']),
         'Client CacheStorage (satyaseva-v6)',
         'Explicitly bypasses /api/*, /admin.html, and /js/admin.js from cache to guarantee zero security credential or data caching')
    ]
    cursor.executemany("INSERT INTO structure_backend VALUES (?, ?, ?, ?, ?, ?)", backend)

    # 5. Dataflows
    flows = [
        ('client_data_cascade', 'Client-Side Triple-Redundancy Cascade', 'client_fetch',
         'Page load on communities.html, community.html, or memorial.html',
         json.dumps([
             '1. Check window.__INITIAL_COMMUNITIES__ from communities-data.js (Zero-delay render)',
             '2. Simultaneously fire background fetch to /api/communities (if running on full Python backend)',
             '3. If API responds (HTTP 200), update DOM with real-time database state and update cache',
             '4. If API fails (e.g. static Git host like GitHub Pages), fallback to fetch("data/communities.json")',
             '5. If static JSON fetch fails (e.g. offline file:// protocol), rely 100% on window.__INITIAL_COMMUNITIES__'
         ]),
         'Guarantees the website renders flawlessly even if completely offline, on static hosting, or directly opened from a USB stick',
         json.dumps(['site/js/communities-grid.js', 'site/js/community-detail.js', 'site/data/communities-data.js'])),

        ('admin_save_sync_cycle', 'Admin Mutation & Auto-Sync Cycle', 'admin_sync',
         'Sister or Admin submits a change (station edit, new sister, event, or memorial record) via admin.html',
         json.dumps([
             '1. Client sends JSON payload to POST /api/<entity> with Authorization: Bearer <session_token>',
             '2. serve.py verifies token against in-memory active sessions and checks IP rate limit',
             '3. serve.py calls db.py to take a JSON snapshot of the record BEFORE mutation',
             '4. db.py writes mutation into SQLite tables within an ACID transaction',
             '5. db.py records an entry in response_log with before/after snapshots and sister attribution',
             '6. db.py triggers sync_all_to_json(), re-exporting communities.json, memorial.json, events.json, news.json, and communities-data.js',
             '7. serve.py returns HTTP 200 JSON with updated entity ID and status'
         ]),
         'Transaction rollback on error; static JSON files always match SQLite state 1-to-1',
         json.dumps(['site/admin.html', 'site/js/admin.js', 'scripts/serve.py', 'scripts/db.py'])),

        ('audit_revert_pipeline', 'One-Click Response Log Audit & Revert', 'admin_sync',
         'Admin reviews response logs and clicks "Revert" on an erroneous edit or upload',
         json.dumps([
             '1. Admin selects log entry in admin.html Audit Trail tab and clicks "Revert"',
             '2. POST /api/response-log/revert sent with log ID',
             '3. db.py retrieves snapshot_before from response_log table',
             '4. db.py restores the exact previous state into the target table',
             '5. db.py updates response_log status to "reverted"',
             '6. db.py re-triggers sync_all_to_json() to reflect the rollback in static files',
             '7. Admin UI updates with success alert and reloads table'
         ]),
         'Zero risk of data loss from sister mistakes; complete reversible history',
         json.dumps(['site/js/admin.js', 'scripts/serve.py', 'scripts/db.py'])),

        ('photo_upload_pipeline', 'Photo Upload & Synchronization Pipeline', 'photo_pipeline',
         'User drops a photo in admin.html or directly into site/images/communities/<id>/',
         json.dumps([
             '1. If via browser: POST /api/upload with multipart/form-data (community ID + file)',
             '2. serve.py validates file extension (.jpg, .jpeg, .png, .webp, .avif) and size (<10MB)',
             '3. File written to disk at site/images/communities/<id>/<filename>',
             '4. serve.py calls sync_images.sync()',
             '5. sync_images scans folder, assigns hero image (if named hero.* or first image), builds manifest',
             '6. Writes site/data/community-images.json and injects hero/gallery paths into communities.json',
             '7. If SQLite active, adds record to station_gallery table'
         ]),
         'Auto-creates directories if missing; natural sorting on image numbers (img1, img2, img10)',
         json.dumps(['scripts/serve.py', 'scripts/sync_images.py', 'scripts/watch_images.py'])),

        ('public_interactions_pipeline', 'Public Contact, Prayer, & Newsletter Submission', 'public_submission',
         'Visitor submits contact message, prayer intention, or newsletter email',
         json.dumps([
             '1. Browser fires fetch() to /api/contact, /api/prayers, or /api/newsletter',
             '2. serve.py checks IP rate limiter (prevent spam floods: max 5-10 per minute)',
             '3. Sanitizes strings and escapes HTML tags to neutralize XSS',
             '4. Stores record in contact_messages, prayer_requests, or newsletter_subscribers table',
             '5. If prayer request: initially marked "pending" until reviewed in admin portal',
             '6. Returns HTTP 200 {"success": true}'
         ]),
         'Client-side optimistic UI with friendly thank you confirmation and graceful network error alerts',
         json.dumps(['site/index.html', 'site/contact.html', 'site/prayers.html', 'scripts/serve.py', 'scripts/db.py']))
    ]
    cursor.executemany("INSERT INTO dataflows VALUES (?, ?, ?, ?, ?, ?, ?)", flows)

    # 6. Deployments
    deployments = [
        ('github_pages', 'GitHub Pages (Recommended & Free)', 'edge_static',
         'Static Edge CDN (Fastly / GitHub Edge)',
         'site/index.html',
         json.dumps(['.github/workflows/deploy.yml', 'site/.nojekyll']),
         'Stateless static deployment; content updates pushed via Git commits. SQLite and backup files stripped before publish.',
         'Strict Content-Security-Policy via meta tags + _headers; safe for public distribution',
         'Git commit -> GitHub Actions runs Python script to compile fallbacks -> deploys site/ folder to gh-pages in ~60s'),

        ('cloudflare_pages', 'Cloudflare Pages (Global Edge CDN)', 'edge_static',
         'Cloudflare Global Edge Network',
         'site/index.html',
         json.dumps(['site/_headers']),
         'Stateless global edge cache with sub-second asset delivery',
         'Native HTTP response headers applied via site/_headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options',
         'Connect GitHub repository -> Framework preset: None -> Build output: site -> Live at *.pages.dev'),

        ('google_cloud_run', 'Google Cloud Run (Full Backend Container)', 'container_cloud',
         'Containerized Python 3.11-slim (Serverless Docker)',
         'scripts/serve.py (via Dockerfile)',
         json.dumps(['Dockerfile', '.dockerignore', 'gcp-deployment-guide.md']),
         'Scale-to-zero serverless container. Persistent SQLite and photo uploads enabled via Cloud Storage FUSE volume mount.',
         'HTTPS enforced by Google Cloud; CORS dynamically permits *.run.app and satyasevasisters.org; rate-limited endpoints',
         'Cloud Build compiles Dockerfile -> Cloud Run starts container on $PORT (8080) -> Fully interactive REST & photo upload API live worldwide'),

        ('local_airgapped', 'Local Maintainer / Offline Air-Gapped Mode', 'cdn',
         'Local Python runtime (Zero dependencies) or direct file:// launch',
         'python3 scripts/serve.py 8000 OR double click site/index.html',
         json.dumps(['scripts/serve.py', 'site/index.html']),
         'Writes directly to local disk (scripts/data/sscs.db and site/images/communities/)',
         'Binds to 127.0.0.1 or 0.0.0.0; password protected admin portal',
         'Maintainer runs scripts/serve.py locally to make edits, then git commits changes for GitOps cloud sync')
    ]
    cursor.executemany("INSERT INTO deployments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", deployments)

    # 7. API Endpoints
    endpoints = [
        ('GET', '/api/communities', 0, 'Unlimited', 'Fetch all communities list with hero photos and ministries', '', 'Array of community objects'),
        ('POST', '/api/communities', 1, 'Standard', 'Create or update community record', 'Community JSON schema', '{"success": true, "id": str}'),
        ('POST', '/api/communities/delete', 1, 'Standard', 'Delete a community station record', '{"id": str}', '{"success": true}'),
        ('GET', '/api/memorial', 0, 'Unlimited', 'Fetch all deceased sisters memorial records', '', 'Array of memorial sister objects'),
        ('POST', '/api/memorial', 1, 'Standard', 'Create or update memorial sister record', 'Memorial sister JSON', '{"success": true, "id": str}'),
        ('POST', '/api/memorial/delete', 1, 'Standard', 'Delete a memorial sister record', '{"id": str}', '{"success": true}'),
        ('GET', '/api/events', 0, 'Unlimited', 'Fetch upcoming events and feast day celebrations', '', 'Array of event objects'),
        ('POST', '/api/events', 1, 'Standard', 'Create new calendar event', 'Event JSON', '{"success": true, "id": int}'),
        ('POST', '/api/events/update', 1, 'Standard', 'Update existing event', 'Event JSON with id', '{"success": true}'),
        ('POST', '/api/events/delete', 1, 'Standard', 'Delete calendar event', '{"id": int}', '{"success": true}'),
        ('GET', '/api/news', 0, 'Unlimited', 'Fetch published news and pastoral announcements', '', 'Array of news objects'),
        ('POST', '/api/news', 1, 'Standard', 'Create new news post', 'News JSON', '{"success": true, "id": int}'),
        ('POST', '/api/news/update', 1, 'Standard', 'Update existing news post', 'News JSON with id', '{"success": true}'),
        ('POST', '/api/news/delete', 1, 'Standard', 'Delete news post', '{"id": int}', '{"success": true}'),
        ('POST', '/api/contact', 0, '10 / min', 'Submit public inquiry or vocation message', '{"name", "email", "subject", "message"}', '{"success": true}'),
        ('GET', '/api/contact', 1, 'Standard', 'View submitted contact inquiries in admin portal', '', 'Array of message objects'),
        ('POST', '/api/contact/status', 1, 'Standard', 'Update message status (read/unread/replied)', '{"id": int, "status": str}', '{"success": true}'),
        ('POST', '/api/newsletter', 0, '5 / min', 'Public newsletter email subscription', '{"email": str}', '{"success": true}'),
        ('GET', '/api/newsletter', 1, 'Standard', 'List newsletter subscriber emails', '', 'Array of subscriber emails'),
        ('POST', '/api/newsletter/delete', 1, 'Standard', 'Unsubscribe an email', '{"email": str}', '{"success": true}'),
        ('POST', '/api/prayers', 0, '10 / min', 'Submit prayer intention to prayer wall', '{"name", "intention"}', '{"success": true}'),
        ('GET', '/api/prayers', 0, 'Unlimited', 'Fetch approved public prayer intentions', '?status=approved', 'Array of prayer intentions'),
        ('POST', '/api/prayers/status', 1, 'Standard', 'Approve or archive prayer intention', '{"id": int, "status": str}', '{"success": true}'),
        ('POST', '/api/upload', 0, '30 / min', 'Multi-file photo uploader for community stations', 'multipart/form-data (station_id, photos)', '{"success": true, "uploaded": int, "files": array}'),
        ('POST', '/api/delete-photo', 1, 'Standard', 'Remove a photo from community gallery', '{"path": str, "station_id": str}', '{"success": true}'),
        ('GET', '/api/station-uploads', 1, '15 / min', 'List reports and chronicles submitted by sisters', '?station_id=<id>', 'Array of station upload objects'),
        ('POST', '/api/station-uploads', 1, 'Standard', 'Sister submits report, chronicle, or prayer request', 'Upload payload', '{"success": true}'),
        ('POST', '/api/auth/login', 0, '5 / min', 'Admin portal authentication (PBKDF2-HMAC-SHA256)', '{"password": str}', '{"success": true, "token": str, "expires_in": int}'),
        ('POST', '/api/auth/logout', 0, 'Unlimited', 'Invalidate active session token', '', '{"success": true}'),
        ('POST', '/api/auth/forgot-password', 0, '3 / 5min', 'Trigger OTP email reset link to ADMIN_EMAIL', '{"email": str}', '{"success": true}'),
        ('POST', '/api/auth/reset-password', 0, '5 / 5min', 'Verify OTP code and set new admin password', '{"code": str, "new_password": str}', '{"success": true}'),
        ('GET', '/api/response-log', 1, 'Standard', 'Retrieve audit trail of changes made by sisters', '?page=1&status=pending', '{"logs": array, "total": int}'),
        ('GET', '/api/response-log/stats', 1, 'Standard', 'Get audit trail statistics and metrics', '', '{"total": int, "pending": int, "reviewed": int}'),
        ('POST', '/api/response-log/review', 1, 'Standard', 'Mark change log as reviewed by administrator', '{"id": int, "status": str, "notes": str}', '{"success": true}'),
        ('POST', '/api/response-log/revert', 1, 'Standard', 'Roll back a change using its historical before-snapshot', '{"id": int}', '{"success": true, "reverted_id": int}'),
        ('GET', '/api/response-log/export', 1, 'Standard', 'Download complete audit trail as CSV', '', 'CSV file stream'),
        ('GET', '/api/db/status', 1, 'Standard', 'Diagnostic stats: table record counts, file sizes, sync health', '', 'Diagnostic JSON object'),
        ('POST', '/api/db/sync', 1, 'Standard', 'Manually trigger SQLite to static JSON re-synchronization', '', '{"success": true, "synced_files": array}'),
        ('GET', '/api/db/download', 1, 'Standard', 'Download full sscs.db SQLite database backup', '', 'Binary SQLite stream')
    ]
    cursor.executemany("INSERT INTO api_endpoints VALUES (?, ?, ?, ?, ?, ?, ?)", endpoints)

    # 8. Agent Quick Memorise Rules
    rules = [
        ('design', 'Spiritual, Archival & Dignified Aesthetic with Editorial Brutalism',
         json.dumps([
             'Primary Brand is Deep Ocean Blue (#0d4b6b), Accent is Warm Amber (#e8833a)',
             'Headings MUST use Young Serif; UI and Body MUST use Hanken Grotesk',
             'Dark Mode is controlled via data-theme="dark" attribute with inline IIFE in <head> to prevent flash of unstyled content',
             'Never add external npm packages or bulky web UI frameworks; preserve vanilla HTML5/CSS/JS purity',
             'Photos must always feature fallback symbolic badges (Mission, Families, Service) if no image exists'
         ]),
         'Do not use generic blue/red/green or bootstrap-style alert boxes. Stick to custom CSS tokens.'),

        ('architecture', 'Static First JAMstack with Optional Cloud Run Server Container',
         json.dumps([
             'site/ is the complete deployable deliverable for static web hosting (GitHub Pages, Cloudflare Pages, Netlify)',
             'scripts/ contains all Python backend, sync engines, and database tooling',
             'Database sscs.db lives in scripts/data/sscs.db OUTSIDE the publicly-served site/ folder for security',
             'GitHub Actions workflow in .github/workflows/deploy.yml strips .db and backups before publishing',
             'PWA service worker site/sw.js explicitly excludes admin.html and admin.js from caching'
         ]),
         'Never save sensitive databases, password hashes, or backup directories inside site/.'),

        ('dataflow', 'Triple-Redundant Cascade: Global JS -> Fetch JSON -> REST API',
         json.dumps([
             'Always check window.__INITIAL_*__ first so pages render with zero latency offline',
             'Whenever mutating data in admin.html or db.py, always call sync_all_to_json() to keep static files matching SQLite',
             'Every mutation records a snapshot_before in response_log for instant one-click revertability',
             'Images dropped into site/images/communities/<id>/ are auto-mapped by sync_images.py natural sort'
         ]),
         'Never edit communities.json directly without syncing communities-data.js and sscs.db.'),

        ('deployment', 'Zero-Cost Free Tier GitOps with 60-Second Auto Deployments',
         json.dumps([
             'GitHub Pages runs zero Python: purely static CDN delivering JSON and assets',
             'Google Cloud Run container reads $PORT (8080), binds to 0.0.0.0, and scales to zero when idle ($0 cost)',
             'Cloudflare Pages supports security headers directly via site/_headers',
             'Cloud Storage FUSE can be mounted to /app/scripts/data and /app/site/images/communities for persistent Cloud Run storage'
         ]),
         'Do not require a Python backend for public browsing; public site is 100% static-capable.'),

        ('security', 'Defense in Depth: Strict CSP, PBKDF2 Password Hashing & Rate Limits',
         json.dumps([
             'Strict Content-Security-Policy restricts scripts to self and approved CDNs (Leaflet, unpkg)',
             'PBKDF2-HMAC-SHA256 password hashing with 100,000 iterations for admin protection',
             'Rate limits applied per client IP on login, uploads, forgot-password, and public submissions',
             'Input escaping in frontend (esc() function) and parameter-binding in backend to defeat XSS and SQL injection'
         ]),
         'Never send the admin password hash to the client. Keep sessions in-memory with 8-hour TTL.')
    ]
    cursor.executemany("INSERT INTO agent_quick_memorise (domain, one_liner, golden_rules, common_mistakes_to_avoid) VALUES (?, ?, ?, ?)", rules)

    conn.commit()

def generate_markdown(conn):
    cursor = conn.cursor()

    lines = []
    lines.append("# 🧠 Satyaseva Sisters Portal — Master Architectural Memory (memory.db)")
    lines.append("")
    lines.append("> **Quick-Memorization Knowledge Base for AI Agents & Developers**  ")
    lines.append("> *Compiled on: " + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S') + "*  ")
    lines.append("> *Repository: `sscs` | Primary Deliverable: `site/` | Engine: `scripts/`*")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Meta
    lines.append("## 📌 1. Repository & Mission Executive Overview")
    lines.append("")
    lines.append("| Key | Value | Description |")
    lines.append("|---|---|---|")
    for r in cursor.execute("SELECT key, value, description FROM memory_meta"):
        lines.append(f"| `{r[0]}` | **{r[1]}** | {r[2]} |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Golden Rules Quick Memorize
    lines.append("## ⚡ 2. Agent Quick-Memorize Rules (Golden Rules)")
    lines.append("")
    for r in cursor.execute("SELECT domain, one_liner, golden_rules, common_mistakes_to_avoid FROM agent_quick_memorise"):
        rules = json.loads(r[2])
        lines.append(f"### 🛡️ Domain: {r[0].upper()} — *{r[1]}*")
        for rule in rules:
            lines.append(f"- **Rule:** {rule}")
        lines.append(f"- ⚠️ **Avoid:** *{r[3]}*")
        lines.append("")
    lines.append("---")
    lines.append("")

    # Design System
    lines.append("## 🎨 3. Design System & Aesthetics")
    lines.append("")
    lines.append("| Token | Light Mode Value | Dark Mode Value | Category | Intended Usage |")
    lines.append("|---|---|---|---|---|")
    for r in cursor.execute("SELECT name, light_value, dark_value, category, usage FROM design_system"):
        lines.append(f"| `{r[0]}` | `{r[1]}` | `{r[2]}` | *{r[3]}* | {r[4]} |")
    lines.append("")
    lines.append("> **Design Aesthetic Summary:**  ")
    lines.append("> A warm, sacred, archival aesthetic featuring **Ocean Blue (`#0d4b6b`)** and **Warm Amber (`#e8833a`)**. Typography balances editorial authority (**Young Serif**) with legibility (**Hanken Grotesk**). Zero framework dependencies. Instant zero-flash dark mode via inline script in `<head>` reading `localStorage.getItem('sscs-theme')`.")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Structure Pages
    lines.append("## 📂 4. Structure: Complete Page Inventory (`site/*.html`)")
    lines.append("")
    lines.append("| File Path | Title & Role | Purpose | Components | Data Sources |")
    lines.append("|---|---|---|---|---|")
    for r in cursor.execute("SELECT filename, title, purpose, key_components, data_dependencies FROM structure_pages"):
        comps = ", ".join(json.loads(r[3])[:3])
        datas = ", ".join(json.loads(r[4]))
        lines.append(f"| [`{r[0]}`](file://{os.path.join(REPO_ROOT, r[0])}) | **{r[1]}** | {r[2]} | {comps} | {datas} |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Structure Backend
    lines.append("## ⚙️ 5. Structure: Backend Daemon & Scripts (`scripts/`)")
    lines.append("")
    for r in cursor.execute("SELECT filepath, role, primary_classes_functions, data_layer, security_features FROM structure_backend"):
        lines.append(f"### 🔧 [`{r[0]}`](file://{os.path.join(REPO_ROOT, r[0])})")
        lines.append(f"- **Role:** {r[1]}")
        lines.append(f"- **Key Classes/Functions:** `{', '.join(json.loads(r[2]))}`")
        lines.append(f"- **Data Layer:** {r[3]}")
        lines.append(f"- **Security & Resiliency:** {r[4]}")
        lines.append("")
    lines.append("---")
    lines.append("")

    # Dataflows
    lines.append("## 🔄 6. Critical Dataflows & Lifecycles")
    lines.append("")
    for r in cursor.execute("SELECT name, trigger_event, execution_order, fallback_strategy, key_files FROM dataflows"):
        lines.append(f"### 🔁 Flow: {r[0]}")
        lines.append(f"- **Trigger:** {r[1]}")
        lines.append("- **Step-by-Step Sequence:**")
        for s in json.loads(r[2]):
            lines.append(f"  {s}")
        lines.append(f"- **Fallback / Guarantee:** {r[3]}")
        lines.append(f"- **Key Files:** `{', '.join(json.loads(r[4]))}`")
        lines.append("")
    lines.append("---")
    lines.append("")

    # Deployments
    lines.append("## 🚀 7. Deployment Targets & Infrastructure")
    lines.append("")
    for r in cursor.execute("SELECT platform_name, nature, runtime, entrypoint, config_files, persistence_strategy, security_headers, workflow_summary FROM deployments"):
        lines.append(f"### 🌐 {r[0]}")
        lines.append(f"- **Tier & Nature:** `{r[1]}`")
        lines.append(f"- **Runtime & Entrypoint:** `{r[2]}` ➔ `{r[3]}`")
        lines.append(f"- **Key Configuration:** `{', '.join(json.loads(r[4]))}`")
        lines.append(f"- **Persistence Strategy:** {r[5]}")
        lines.append(f"- **Security & Headers:** {r[6]}")
        lines.append(f"- **Workflow:** {r[7]}")
        lines.append("")
    lines.append("---")
    lines.append("")

    # API Endpoints
    lines.append("## 📡 8. REST API Endpoints Catalog (`scripts/serve.py`)")
    lines.append("")
    lines.append("| Method | Path | Auth? | Rate Limit | Purpose | Payload Schema |")
    lines.append("|---|---|---|---|---|---|")
    for r in cursor.execute("SELECT method, path, auth_required, rate_limit, purpose, payload_schema FROM api_endpoints ORDER BY path, method"):
        auth_badge = "🔒 Required" if r[2] == 1 else "🌐 Public"
        lines.append(f"| `{r[0]}` | `{r[1]}` | {auth_badge} | {r[3]} | {r[4]} | `{r[5]}` |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("### 💡 How to Query memory.db in SQLite")
    lines.append("```bash")
    lines.append("sqlite3 memory.db \"SELECT name, light_value FROM design_system WHERE category='color';\"")
    lines.append("sqlite3 memory.db \"SELECT filename, purpose FROM structure_pages;\"")
    lines.append("sqlite3 memory.db \"SELECT path, purpose FROM api_endpoints WHERE auth_required=1;\"")
    lines.append("```")

    with open(MD_PATH, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines) + "\n")
    print(f"Exported markdown memory to {MD_PATH}")

def generate_json(conn):
    cursor = conn.cursor()
    data = {"meta": {}, "design_system": [], "structure_pages": [], "structure_backend": [], "dataflows": [], "deployments": [], "api_endpoints": [], "agent_quick_memorise": []}

    for r in cursor.execute("SELECT key, value, description FROM memory_meta"):
        data["meta"][r[0]] = {"value": r[1], "description": r[2]}

    for r in cursor.execute("SELECT * FROM design_system"):
        data["design_system"].append(dict(r))

    for r in cursor.execute("SELECT * FROM structure_pages"):
        row = dict(r)
        row["key_components"] = json.loads(row["key_components"])
        row["data_dependencies"] = json.loads(row["data_dependencies"])
        row["scripts"] = json.loads(row["scripts"])
        row["styles"] = json.loads(row["styles"])
        data["structure_pages"].append(row)

    for r in cursor.execute("SELECT * FROM structure_backend"):
        row = dict(r)
        row["primary_classes_functions"] = json.loads(row["primary_classes_functions"])
        data["structure_backend"].append(row)

    for r in cursor.execute("SELECT * FROM dataflows"):
        row = dict(r)
        row["execution_order"] = json.loads(row["execution_order"])
        row["key_files"] = json.loads(row["key_files"])
        data["dataflows"].append(row)

    for r in cursor.execute("SELECT * FROM deployments"):
        row = dict(r)
        row["config_files"] = json.loads(row["config_files"])
        data["deployments"].append(row)

    for r in cursor.execute("SELECT * FROM api_endpoints"):
        data["api_endpoints"].append(dict(r))

    for r in cursor.execute("SELECT * FROM agent_quick_memorise"):
        row = dict(r)
        row["golden_rules"] = json.loads(row["golden_rules"])
        data["agent_quick_memorise"].append(row)

    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"Exported JSON memory graph to {JSON_PATH}")

def main():
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        init_tables(conn)
        seed_data(conn)
        print(f"Compiled SQLite memory database at {DB_PATH}")
        generate_markdown(conn)
        generate_json(conn)
    finally:
        conn.close()

if __name__ == '__main__':
    main()

# 🧠 Satyaseva Sisters Portal — Master Architectural Memory (memory.db)

> **Quick-Memorization Knowledge Base for AI Agents & Developers**  
> *Compiled on: 2026-10-25 05:01:15*  
> *Repository: `sscs` | Primary Deliverable: `site/` | Engine: `scripts/`*

---

## 📌 1. Repository & Mission Executive Overview

| Key | Value | Description |
|---|---|---|
| `project_name` | **Satyaseva Catechist Sisters of the Families (SSCS) Web & Archive Portal** | Official repository title |
| `version` | **3.8.0-production-ready** | Current architecture state |
| `congregation_founded` | **1976** | Diocese of Mysore, Karnataka, India by Mother Regina Woroniecka |
| `nature` | **Independent research archive, community directory, & administrative portal** | Domain scope |
| `generated_at` | **2026-10-25T05:01:15.700997** | Database compile timestamp |
| `architecture_pattern` | **JAMstack GitOps Static Edge + Optional Python Cloud Run Backend Container** | Core architecture |
| `data_paradigm` | **Triple-Redundant Cascade (API -> Static JSON -> Inline JS Fallback)** | Client data fetching model |

---

## ⚡ 2. Agent Quick-Memorize Rules (Golden Rules)

### 🛡️ Domain: DESIGN — *Spiritual, Archival & Dignified Aesthetic with Editorial Brutalism*
- **Rule:** Primary Brand is Deep Ocean Blue (#0d4b6b), Accent is Warm Amber (#e8833a)
- **Rule:** Headings MUST use Young Serif; UI and Body MUST use Hanken Grotesk
- **Rule:** Dark Mode is controlled via data-theme="dark" attribute with inline IIFE in <head> to prevent flash of unstyled content
- **Rule:** Never add external npm packages or bulky web UI frameworks; preserve vanilla HTML5/CSS/JS purity
- **Rule:** Photos must always feature fallback symbolic badges (Mission, Families, Service) if no image exists
- ⚠️ **Avoid:** *Do not use generic blue/red/green or bootstrap-style alert boxes. Stick to custom CSS tokens.*

### 🛡️ Domain: ARCHITECTURE — *Static First JAMstack with Optional Cloud Run Server Container*
- **Rule:** site/ is the complete deployable deliverable for static web hosting (GitHub Pages, Cloudflare Pages, Netlify)
- **Rule:** scripts/ contains all Python backend, sync engines, and database tooling
- **Rule:** Database sscs.db lives in scripts/data/sscs.db OUTSIDE the publicly-served site/ folder for security
- **Rule:** GitHub Actions workflow in .github/workflows/deploy.yml strips .db and backups before publishing
- **Rule:** PWA service worker site/sw.js explicitly excludes admin.html and admin.js from caching
- ⚠️ **Avoid:** *Never save sensitive databases, password hashes, or backup directories inside site/.*

### 🛡️ Domain: DATAFLOW — *Triple-Redundant Cascade: Global JS -> Fetch JSON -> REST API*
- **Rule:** Always check window.__INITIAL_*__ first so pages render with zero latency offline
- **Rule:** Whenever mutating data in admin.html or db.py, always call sync_all_to_json() to keep static files matching SQLite
- **Rule:** Every mutation records a snapshot_before in response_log for instant one-click revertability
- **Rule:** Images dropped into site/images/communities/<id>/ are auto-mapped by sync_images.py natural sort
- ⚠️ **Avoid:** *Never edit communities.json directly without syncing communities-data.js and sscs.db.*

### 🛡️ Domain: DEPLOYMENT — *Zero-Cost Free Tier GitOps with 60-Second Auto Deployments*
- **Rule:** GitHub Pages runs zero Python: purely static CDN delivering JSON and assets
- **Rule:** Google Cloud Run container reads $PORT (8080), binds to 0.0.0.0, and scales to zero when idle ($0 cost)
- **Rule:** Cloudflare Pages supports security headers directly via site/_headers
- **Rule:** Cloud Storage FUSE can be mounted to /app/scripts/data and /app/site/images/communities for persistent Cloud Run storage
- ⚠️ **Avoid:** *Do not require a Python backend for public browsing; public site is 100% static-capable.*

### 🛡️ Domain: SECURITY — *Defense in Depth: Strict CSP, PBKDF2 Password Hashing & Rate Limits*
- **Rule:** Strict Content-Security-Policy restricts scripts to self and approved CDNs (Leaflet, unpkg)
- **Rule:** PBKDF2-HMAC-SHA256 password hashing with 100,000 iterations for admin protection
- **Rule:** Rate limits applied per client IP on login, uploads, forgot-password, and public submissions
- **Rule:** Input escaping in frontend (esc() function) and parameter-binding in backend to defeat XSS and SQL injection
- ⚠️ **Avoid:** *Never send the admin password hash to the client. Keep sessions in-memory with 8-hour TTL.*

---

## 🎨 3. Design System & Aesthetics

| Token | Light Mode Value | Dark Mode Value | Category | Intended Usage |
|---|---|---|---|---|
| `--brand` | `#0d4b6b (Ocean Blue)` | `#1f7aa5 (Vibrant Ocean)` | *color* | Primary brand identity, headers, main badges, active icons |
| `--brand-deep` | `#083649 (Deep Navy)` | `#0d4b6b (Ocean)` | *color* | Header hover states, footer branding, deep accents |
| `--brand-tint` | `#e1eef6 (Pale Ocean Tint)` | `#0d2535 (Dark Ocean Tint)` | *color* | Active chip backgrounds, light callout boxes |
| `--accent` | `#e8833a (Warm Amber)` | `#f09a5c (Bright Amber)` | *color* | Call-to-action buttons, jubilee tags, warm focal highlights |
| `--accent-deep` | `#c96820 (Rust Amber)` | `#e8833a (Amber)` | *color* | Hover state for buttons, active tabs |
| `--bg` | `#f2f6f9 (Cool Slate White)` | `#0b1822 (Deep Midnight)` | *color* | Base page body background |
| `--surface` | `#ffffff (Pure White)` | `#122431 (Slate Charcoal)` | *color* | Card surfaces, dropdowns, navigation pills |
| `--surface-alt` | `#eaf1f7 (Soft Gray-Blue)` | `#1a2f3e (Medium Slate)` | *color* | Section dividers, newsletter background, table headers |
| `--ink` | `#0f2433 (Dark Ocean Ink)` | `#e8f1f7 (Soft Ice White)` | *color* | Primary readable text, headings |
| `--ink-soft` | `#475c6b (Muted Slate)` | `#a3b8c6 (Muted Ice)` | *color* | Secondary body text, descriptions, captions |
| `--line` | `#d3dee6 (Border Slate)` | `#1a4a63 (Subtle Dark Border)` | *color* | Card borders, separators, subtle dividers |
| `--font-serif` | `"Young Serif", Georgia, "Times New Roman", serif` | `Same in dark` | *typography* | Editorial hero headlines, section headers, h1-h3 titles |
| `--font-sans` | `"Hanken Grotesk", system-ui, -apple-system, sans-serif` | `Same in dark` | *typography* | All UI elements, body copy, navigation, tables, forms |
| `--elev-1` | `0 1px 3px rgba(13,75,107,.07), 0 1px 2px rgba(13,75,107,.05)` | `Darker shadow` | *elevation* | Subtle cards, filter chips, buttons |
| `--elev-2` | `0 4px 12px rgba(13,75,107,.10), 0 2px 4px rgba(13,75,107,.06)` | `Darker shadow` | *elevation* | Interactive hover lifts, dropdown menus |
| `--elev-3` | `0 12px 28px rgba(13,75,107,.16), 0 4px 8px rgba(13,75,107,.08)` | `Darker shadow` | *elevation* | Floating modals, image lightboxes, hero embeds |
| `--container` | `1120px` | `1120px` | *layout* | Main content container maximum width |
| `--nav-h` | `68px` | `68px` | *layout* | Fixed top navigation bar height |
| `Dynamic Theme Toggle` | `localStorage + system preference IIFE` | `attribute data-theme="dark|light"` | *philosophy* | Flash-free theme switcher via inline script in <head> |
| `Zero Dependency Core` | `Vanilla HTML5 / Modern CSS / Pure JS` | `No npm / No Webpack build step needed` | *philosophy* | Fast, secure, unhackable, permanent archival resilience |

> **Design Aesthetic Summary:**  
> A warm, sacred, archival aesthetic featuring **Ocean Blue (`#0d4b6b`)** and **Warm Amber (`#e8833a`)**. Typography balances editorial authority (**Young Serif**) with legibility (**Hanken Grotesk**). Zero framework dependencies. Instant zero-flash dark mode via inline script in `<head>` reading `localStorage.getItem('sscs-theme')`.

---

## 📂 4. Structure: Complete Page Inventory (`site/*.html`)

| File Path | Title & Role | Purpose | Components | Data Sources |
|---|---|---|---|---|
| [`site/index.html`](file:///home/jc/AB/fun/sscs/site/index.html) | **Home / Welcome Portal** | Landing portal with hero lede, dynamic impact counters, chronological story chapters, charism, ministries overview, prayer intentions, newsletter, and WhatsApp widget | Hero with SVG cross, Animated Impact Stats, Chronological Story Chapters | /api/newsletter, js/main.js, js/gallery.js |
| [`site/communities.html`](file:///home/jc/AB/fun/sscs/site/communities.html) | **Community Stations Directory** | Full filterable grid of all 32+ convent houses and mission stations across India, Germany, and Poland with live photo badges | Search Bar, Country Filter Chips, Community Card Grid | data/communities.json, data/community-images.json, data/communities-data.js, /api/communities |
| [`site/community.html`](file:///home/jc/AB/fun/sscs/site/community.html) | **Community Detail Profile** | Archival dossier for a single community station with hero photo banner, sisters list, apostolates, photo gallery with pan-zoom lightbox, and interactive upload form | Editorial Brutalist Hero, Inline Station Switcher, Tabbed Apostolates | data/communities.json, data/community-images.json, data/communities-data.js, /api/communities, /api/station-uploads |
| [`site/map.html`](file:///home/jc/AB/fun/sscs/site/map.html) | **Interactive Geographic Map** | Global interactive Leaflet map marking all convent houses, mission stations, and apostolates across India, Germany, and Poland | Leaflet JS Map Container, Country Filter Chips, Custom Ocean Blue Pin Markers | data/communities.json, data/community-images.json, Leaflet CDN CSS/JS, OpenStreetMap / CartoDB tiles |
| [`site/memorial.html`](file:///home/jc/AB/fun/sscs/site/memorial.html) | **In Memoriam / Eternal Rest** | Reverent memorial archive honoring deceased sisters with death anniversary sorting, search, timeline filter, and biography modals | Memorial Search, Century/Decade Filters, Photo Remembrance Cards | data/memorial.json, data/communities-data.js, /api/memorial |
| [`site/foundress.html`](file:///home/jc/AB/fun/sscs/site/foundress.html) | **Mother Regina Woroniecka** | Comprehensive biographical archive of foundress Mother Regina (Sr. Jolanta) Woroniecka, Ursuline missionary, her charism and spirituality | Archival Photo Gallery, Chronological Life Milestones, Spiritual Quotes | images/Mother_Regina_*.png, images/mother-*.jpg |
| [`site/news.html`](file:///home/jc/AB/fun/sscs/site/news.html) | **News & Announcements** | Congregation announcements, feast day photos, pastoral letters, and jubilee bulletins with date badges and search | News Article Cards, Date & Author Badges, Filter by Year | data/news.json, /api/news |
| [`site/events.html`](file:///home/jc/AB/fun/sscs/site/events.html) | **Calendar & Feast Days** | Calendar of upcoming feast days, foundation anniversaries, retreats, and jubilees with countdowns and location markers | Upcoming Events Timeline, Event Category Chips, Add to Calendar links | data/events.json, /api/events |
| [`site/media.html`](file:///home/jc/AB/fun/sscs/site/media.html) | **Media & Publications** | Multimedia portal containing video reflections, audio hymns, Canva interactive booklets, and downloadable brochures | Video Showcase, Canva Booklets Player, Photo Archive Grid | Canva Embed API, Local media assets |
| [`site/vocations.html`](file:///home/jc/AB/fun/sscs/site/vocations.html) | **Vocations & Formation** | Guide for young women discerning religious life: stages of formation (Aspirancy, Postulancy, Novitiate, Juniorate, Final Vows), FAQ, and contact form | Formation Stages Timeline, Sister Testimony Cards, Discernment FAQ Accordion | /api/contact |
| [`site/prayers.html`](file:///home/jc/AB/fun/sscs/site/prayers.html) | **Prayer Wall & Daily Office** | Congregation prayers, Rosary intentions, and an interactive Prayer Request Wall where visitors can submit intentions | Prayer Intention Form, Public Prayer Wall Grid, Daily Prayers Audio/Text | /api/prayers |
| [`site/donate.html`](file:///home/jc/AB/fun/sscs/site/donate.html) | **Support & Foster Care Giving** | Support mission apostolates: foster care for orphaned children, evening schools, medical aid, bank account details for India & overseas FCRA | Apostolate Sponsorship Cards, Indian Banking NEFT/RTGS Info, Overseas FCRA Account Info | static |
| [`site/contact.html`](file:///home/jc/AB/fun/sscs/site/contact.html) | **Generalate Directory & Inquiries** | Official communication channel with interactive message submission form, phone numbers, Generalate address, and Google Map link | Interactive Contact Form, Generalate Postal Details, Direct Phone & Email Links | /api/contact |
| [`site/admin.html`](file:///home/jc/AB/fun/sscs/site/admin.html) | **Administrative Master Dashboard** | Comprehensive administrative control room for managing stations, sisters, uploads, photo galleries, memorial records, events, news, audit logs, and backups | Secure Login Modal, Station CRUD Table, Multi-Photo Drag & Drop Uploader | /api/auth/login, /api/communities, /api/memorial, /api/events, /api/news, /api/response-log, /api/db/sync, /api/db/status |
| [`site/privacy.html`](file:///home/jc/AB/fun/sscs/site/privacy.html) | **Privacy Policy & Zero Tracker Notice** | Strict privacy pledge explaining zero third-party trackers, zero cookies, no analytics scripts, and GDPR compliance | Data Handling Explainer, Rights Notice, Contact DPO | static |
| [`site/impressum.html`](file:///home/jc/AB/fun/sscs/site/impressum.html) | **Impressum & Ecclesiastical Attribution** | Legal ownership statement, canonical affiliation, ecclesiastical research archive disclaimers, and copyright notices | Diocesan Affiliation, Copyright Notice, Archival Sources Attribution | static |
| [`site/404.html`](file:///home/jc/AB/fun/sscs/site/404.html) | **Not Found Error Page** | Branded 404 error page with navigation shortcuts and search suggestions | Error Code Banner, Helpful Navigation Links | static |

---

## ⚙️ 5. Structure: Backend Daemon & Scripts (`scripts/`)

### 🔧 [`scripts/serve.py`](file:///home/jc/AB/fun/sscs/scripts/serve.py)
- **Role:** Production/Local HTTP & REST Server daemon with built-in security, authentication, and database routing
- **Key Classes/Functions:** `SatyasevaServer (SimpleHTTPRequestHandler), do_GET, do_POST, handle_upload, handle_login, handle_response_log_revert`
- **Data Layer:** scripts/data/sscs.db via scripts/db.py
- **Security & Resiliency:** PBKDF2-HMAC-SHA256 password hashing (100k rounds), rate-limiting per IP/endpoint, CORS domain whitelisting, 10MB payload cap, session tokens (8h TTL)

### 🔧 [`scripts/db.py`](file:///home/jc/AB/fun/sscs/scripts/db.py)
- **Role:** Portable zero-dependency SQLite abstraction layer with schema migrations, relational indexing, and automatic static JSON synchronization
- **Key Classes/Functions:** `init_db, get_connection, migrate_from_json, sync_all_to_json, get_stations, upsert_station, log_response_action, revert_response_log`
- **Data Layer:** SQLite (sscs.db) with WAL mode & PRAGMA foreign_keys = ON
- **Security & Resiliency:** Strict prepared SQL statements, transactional integrity, automatic timestamping, before/after JSON change snapshots

### 🔧 [`scripts/sync_images.py`](file:///home/jc/AB/fun/sscs/scripts/sync_images.py)
- **Role:** Filesystem scanner that reads site/images/communities/<id>/ and synchronizes community-images.json and communities.json automatically
- **Key Classes/Functions:** `sync(), get_paths(), natural_sort_key()`
- **Data Layer:** Updates site/data/community-images.json and site/data/communities.json
- **Security & Resiliency:** Sanitizes folder names, filters non-image files, supports .jpg, .jpeg, .png, .webp, .avif, .gif, .svg

### 🔧 [`scripts/watch_images.py`](file:///home/jc/AB/fun/sscs/scripts/watch_images.py)
- **Role:** Continuous filesystem watchdog that detects newly dropped photos and auto-triggers sync_images without manual CLI commands
- **Key Classes/Functions:** `main loop, polling / inotify handler`
- **Data Layer:** Calls scripts/sync_images.py on change
- **Security & Resiliency:** Throttled debounce timer to prevent thrashing during multi-file file manager drops

### 🔧 [`site/sw.js`](file:///home/jc/AB/fun/sscs/site/sw.js)
- **Role:** Client-side progressive web app cache worker providing instant offline loading and stale-while-revalidate updates
- **Key Classes/Functions:** `install event, activate event, fetch event (stale-while-revalidate), message event`
- **Data Layer:** Client CacheStorage (satyaseva-v6)
- **Security & Resiliency:** Explicitly bypasses /api/*, /admin.html, and /js/admin.js from cache to guarantee zero security credential or data caching

---

## 🔄 6. Critical Dataflows & Lifecycles

### 🔁 Flow: Client-Side Triple-Redundancy Cascade
- **Trigger:** Page load on communities.html, community.html, or memorial.html
- **Step-by-Step Sequence:**
  1. Check window.__INITIAL_COMMUNITIES__ from communities-data.js (Zero-delay render)
  2. Simultaneously fire background fetch to /api/communities (if running on full Python backend)
  3. If API responds (HTTP 200), update DOM with real-time database state and update cache
  4. If API fails (e.g. static Git host like GitHub Pages), fallback to fetch("data/communities.json")
  5. If static JSON fetch fails (e.g. offline file:// protocol), rely 100% on window.__INITIAL_COMMUNITIES__
- **Fallback / Guarantee:** Guarantees the website renders flawlessly even if completely offline, on static hosting, or directly opened from a USB stick
- **Key Files:** `site/js/communities-grid.js, site/js/community-detail.js, site/data/communities-data.js`

### 🔁 Flow: Admin Mutation & Auto-Sync Cycle
- **Trigger:** Sister or Admin submits a change (station edit, new sister, event, or memorial record) via admin.html
- **Step-by-Step Sequence:**
  1. Client sends JSON payload to POST /api/<entity> with Authorization: Bearer <session_token>
  2. serve.py verifies token against in-memory active sessions and checks IP rate limit
  3. serve.py calls db.py to take a JSON snapshot of the record BEFORE mutation
  4. db.py writes mutation into SQLite tables within an ACID transaction
  5. db.py records an entry in response_log with before/after snapshots and sister attribution
  6. db.py triggers sync_all_to_json(), re-exporting communities.json, memorial.json, events.json, news.json, and communities-data.js
  7. serve.py returns HTTP 200 JSON with updated entity ID and status
- **Fallback / Guarantee:** Transaction rollback on error; static JSON files always match SQLite state 1-to-1
- **Key Files:** `site/admin.html, site/js/admin.js, scripts/serve.py, scripts/db.py`

### 🔁 Flow: One-Click Response Log Audit & Revert
- **Trigger:** Admin reviews response logs and clicks "Revert" on an erroneous edit or upload
- **Step-by-Step Sequence:**
  1. Admin selects log entry in admin.html Audit Trail tab and clicks "Revert"
  2. POST /api/response-log/revert sent with log ID
  3. db.py retrieves snapshot_before from response_log table
  4. db.py restores the exact previous state into the target table
  5. db.py updates response_log status to "reverted"
  6. db.py re-triggers sync_all_to_json() to reflect the rollback in static files
  7. Admin UI updates with success alert and reloads table
- **Fallback / Guarantee:** Zero risk of data loss from sister mistakes; complete reversible history
- **Key Files:** `site/js/admin.js, scripts/serve.py, scripts/db.py`

### 🔁 Flow: Photo Upload & Synchronization Pipeline
- **Trigger:** User drops a photo in admin.html or directly into site/images/communities/<id>/
- **Step-by-Step Sequence:**
  1. If via browser: POST /api/upload with multipart/form-data (community ID + file)
  2. serve.py validates file extension (.jpg, .jpeg, .png, .webp, .avif) and size (<10MB)
  3. File written to disk at site/images/communities/<id>/<filename>
  4. serve.py calls sync_images.sync()
  5. sync_images scans folder, assigns hero image (if named hero.* or first image), builds manifest
  6. Writes site/data/community-images.json and injects hero/gallery paths into communities.json
  7. If SQLite active, adds record to station_gallery table
- **Fallback / Guarantee:** Auto-creates directories if missing; natural sorting on image numbers (img1, img2, img10)
- **Key Files:** `scripts/serve.py, scripts/sync_images.py, scripts/watch_images.py`

### 🔁 Flow: Public Contact, Prayer, & Newsletter Submission
- **Trigger:** Visitor submits contact message, prayer intention, or newsletter email
- **Step-by-Step Sequence:**
  1. Browser fires fetch() to /api/contact, /api/prayers, or /api/newsletter
  2. serve.py checks IP rate limiter (prevent spam floods: max 5-10 per minute)
  3. Sanitizes strings and escapes HTML tags to neutralize XSS
  4. Stores record in contact_messages, prayer_requests, or newsletter_subscribers table
  5. If prayer request: initially marked "pending" until reviewed in admin portal
  6. Returns HTTP 200 {"success": true}
- **Fallback / Guarantee:** Client-side optimistic UI with friendly thank you confirmation and graceful network error alerts
- **Key Files:** `site/index.html, site/contact.html, site/prayers.html, scripts/serve.py, scripts/db.py`

---

## 🚀 7. Deployment Targets & Infrastructure

### 🌐 GitHub Pages (Recommended & Free)
- **Tier & Nature:** `edge_static`
- **Runtime & Entrypoint:** `Static Edge CDN (Fastly / GitHub Edge)` ➔ `site/index.html`
- **Key Configuration:** `.github/workflows/deploy.yml, site/.nojekyll`
- **Persistence Strategy:** Stateless static deployment; content updates pushed via Git commits. SQLite and backup files stripped before publish.
- **Security & Headers:** Strict Content-Security-Policy via meta tags + _headers; safe for public distribution
- **Workflow:** Git commit -> GitHub Actions runs Python script to compile fallbacks -> deploys site/ folder to gh-pages in ~60s

### 🌐 Cloudflare Pages (Global Edge CDN)
- **Tier & Nature:** `edge_static`
- **Runtime & Entrypoint:** `Cloudflare Global Edge Network` ➔ `site/index.html`
- **Key Configuration:** `site/_headers`
- **Persistence Strategy:** Stateless global edge cache with sub-second asset delivery
- **Security & Headers:** Native HTTP response headers applied via site/_headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Workflow:** Connect GitHub repository -> Framework preset: None -> Build output: site -> Live at *.pages.dev

### 🌐 Google Cloud Run (Full Backend Container)
- **Tier & Nature:** `container_cloud`
- **Runtime & Entrypoint:** `Containerized Python 3.11-slim (Serverless Docker)` ➔ `scripts/serve.py (via Dockerfile)`
- **Key Configuration:** `Dockerfile, .dockerignore, gcp-deployment-guide.md`
- **Persistence Strategy:** Scale-to-zero serverless container. Persistent SQLite and photo uploads enabled via Cloud Storage FUSE volume mount.
- **Security & Headers:** HTTPS enforced by Google Cloud; CORS dynamically permits *.run.app and satyasevasisters.org; rate-limited endpoints
- **Workflow:** Cloud Build compiles Dockerfile -> Cloud Run starts container on $PORT (8080) -> Fully interactive REST & photo upload API live worldwide

### 🌐 Local Maintainer / Offline Air-Gapped Mode
- **Tier & Nature:** `cdn`
- **Runtime & Entrypoint:** `Local Python runtime (Zero dependencies) or direct file:// launch` ➔ `python3 scripts/serve.py 8000 OR double click site/index.html`
- **Key Configuration:** `scripts/serve.py, site/index.html`
- **Persistence Strategy:** Writes directly to local disk (scripts/data/sscs.db and site/images/communities/)
- **Security & Headers:** Binds to 127.0.0.1 or 0.0.0.0; password protected admin portal
- **Workflow:** Maintainer runs scripts/serve.py locally to make edits, then git commits changes for GitOps cloud sync

---

## 📡 8. REST API Endpoints Catalog (`scripts/serve.py`)

| Method | Path | Auth? | Rate Limit | Purpose | Payload Schema |
|---|---|---|---|---|---|
| `POST` | `/api/auth/forgot-password` | 🌐 Public | 3 / 5min | Trigger OTP email reset link to ADMIN_EMAIL | `{"email": str}` |
| `POST` | `/api/auth/login` | 🌐 Public | 5 / min | Admin portal authentication (PBKDF2-HMAC-SHA256) | `{"password": str}` |
| `POST` | `/api/auth/logout` | 🌐 Public | Unlimited | Invalidate active session token | `` |
| `POST` | `/api/auth/reset-password` | 🌐 Public | 5 / 5min | Verify OTP code and set new admin password | `{"code": str, "new_password": str}` |
| `GET` | `/api/communities` | 🌐 Public | Unlimited | Fetch all communities list with hero photos and ministries | `` |
| `POST` | `/api/communities` | 🔒 Required | Standard | Create or update community record | `Community JSON schema` |
| `POST` | `/api/communities/delete` | 🔒 Required | Standard | Delete a community station record | `{"id": str}` |
| `GET` | `/api/contact` | 🔒 Required | Standard | View submitted contact inquiries in admin portal | `` |
| `POST` | `/api/contact` | 🌐 Public | 10 / min | Submit public inquiry or vocation message | `{"name", "email", "subject", "message"}` |
| `POST` | `/api/contact/status` | 🔒 Required | Standard | Update message status (read/unread/replied) | `{"id": int, "status": str}` |
| `GET` | `/api/db/download` | 🔒 Required | Standard | Download full sscs.db SQLite database backup | `` |
| `GET` | `/api/db/status` | 🔒 Required | Standard | Diagnostic stats: table record counts, file sizes, sync health | `` |
| `POST` | `/api/db/sync` | 🔒 Required | Standard | Manually trigger SQLite to static JSON re-synchronization | `` |
| `POST` | `/api/delete-photo` | 🔒 Required | Standard | Remove a photo from community gallery | `{"path": str, "station_id": str}` |
| `GET` | `/api/events` | 🌐 Public | Unlimited | Fetch upcoming events and feast day celebrations | `` |
| `POST` | `/api/events` | 🔒 Required | Standard | Create new calendar event | `Event JSON` |
| `POST` | `/api/events/delete` | 🔒 Required | Standard | Delete calendar event | `{"id": int}` |
| `POST` | `/api/events/update` | 🔒 Required | Standard | Update existing event | `Event JSON with id` |
| `GET` | `/api/memorial` | 🌐 Public | Unlimited | Fetch all deceased sisters memorial records | `` |
| `POST` | `/api/memorial` | 🔒 Required | Standard | Create or update memorial sister record | `Memorial sister JSON` |
| `POST` | `/api/memorial/delete` | 🔒 Required | Standard | Delete a memorial sister record | `{"id": str}` |
| `GET` | `/api/news` | 🌐 Public | Unlimited | Fetch published news and pastoral announcements | `` |
| `POST` | `/api/news` | 🔒 Required | Standard | Create new news post | `News JSON` |
| `POST` | `/api/news/delete` | 🔒 Required | Standard | Delete news post | `{"id": int}` |
| `POST` | `/api/news/update` | 🔒 Required | Standard | Update existing news post | `News JSON with id` |
| `GET` | `/api/newsletter` | 🔒 Required | Standard | List newsletter subscriber emails | `` |
| `POST` | `/api/newsletter` | 🌐 Public | 5 / min | Public newsletter email subscription | `{"email": str}` |
| `POST` | `/api/newsletter/delete` | 🔒 Required | Standard | Unsubscribe an email | `{"email": str}` |
| `GET` | `/api/prayers` | 🌐 Public | Unlimited | Fetch approved public prayer intentions | `?status=approved` |
| `POST` | `/api/prayers` | 🌐 Public | 10 / min | Submit prayer intention to prayer wall | `{"name", "intention"}` |
| `POST` | `/api/prayers/status` | 🔒 Required | Standard | Approve or archive prayer intention | `{"id": int, "status": str}` |
| `GET` | `/api/response-log` | 🔒 Required | Standard | Retrieve audit trail of changes made by sisters | `?page=1&status=pending` |
| `GET` | `/api/response-log/export` | 🔒 Required | Standard | Download complete audit trail as CSV | `` |
| `POST` | `/api/response-log/revert` | 🔒 Required | Standard | Roll back a change using its historical before-snapshot | `{"id": int}` |
| `POST` | `/api/response-log/review` | 🔒 Required | Standard | Mark change log as reviewed by administrator | `{"id": int, "status": str, "notes": str}` |
| `GET` | `/api/response-log/stats` | 🔒 Required | Standard | Get audit trail statistics and metrics | `` |
| `GET` | `/api/station-uploads` | 🔒 Required | 15 / min | List reports and chronicles submitted by sisters | `?station_id=<id>` |
| `POST` | `/api/station-uploads` | 🔒 Required | Standard | Sister submits report, chronicle, or prayer request | `Upload payload` |
| `POST` | `/api/upload` | 🌐 Public | 30 / min | Multi-file photo uploader for community stations | `multipart/form-data (station_id, photos)` |

---

### 💡 How to Query memory.db in SQLite
```bash
sqlite3 memory.db "SELECT name, light_value FROM design_system WHERE category='color';"
sqlite3 memory.db "SELECT filename, purpose FROM structure_pages;"
sqlite3 memory.db "SELECT path, purpose FROM api_endpoints WHERE auth_required=1;"
```

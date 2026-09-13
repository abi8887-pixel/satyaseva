#!/usr/bin/env python3
"""
db.py — Portable SQLite Database Manager for Satyaseva Sisters Archive
Provides a lightweight, zero-dependency SQLite database (sscs.db) to store and manage:
- Station / Community profiles & contact info
- Ministries and members stationed at each community
- Data and reports uploaded by sisters from each station (chronicles, monthly reports, photos)
- Memorial records for past sisters
- Automatic two-way synchronization with static JSON files (communities.json, communities-data.js)
"""

import os
import sys
import json
import sqlite3
import datetime
from pathlib import Path

# Paths resolution
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
SITE_DIR = os.path.join(REPO_ROOT, 'site')
SITE_DATA_DIR = os.path.join(SITE_DIR, 'data')
# Database lives OUTSIDE the publicly-served site/ directory for security
DB_DATA_DIR = os.path.join(SCRIPT_DIR, 'data')
DB_PATH = os.path.join(DB_DATA_DIR, 'sscs.db')
COMMUNITIES_JSON = os.path.join(SITE_DATA_DIR, 'communities.json')
COMMUNITIES_DATA_JS = os.path.join(SITE_DATA_DIR, 'communities-data.js')
MEMORIAL_JSON = os.path.join(SITE_DATA_DIR, 'memorial.json')

def get_connection():
    """Returns a SQLite connection with row factory configured."""
    os.makedirs(DB_DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    """Initializes SQLite schema if tables do not exist."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Stations / Communities
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS stations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            established INTEGER,
            location TEXT,
            country TEXT,
            badge TEXT DEFAULT '',
            description TEXT DEFAULT '',
            address TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            hero_image TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Ministries per station
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS station_ministries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
            ministry_text TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );
        """)

        # 3. Members / Sisters stationed at each community
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS station_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            role TEXT DEFAULT '',
            feast_day TEXT DEFAULT '',
            contact TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        );
        """)

        # 4. Stories / Chronicles per station
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS station_stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
            year TEXT DEFAULT '',
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );
        """)

        # 5. Station Uploads: Data uploaded by sisters from each station
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS station_uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
            sister_name TEXT DEFAULT '',
            upload_type TEXT NOT NULL, -- 'chronicle', 'monthly_report', 'ministry_update', 'event', 'photo', 'prayer_request'
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            file_path TEXT DEFAULT '',
            metadata TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 6. Station Photo Gallery
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS station_gallery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
            image_path TEXT NOT NULL,
            caption TEXT DEFAULT '',
            is_hero INTEGER DEFAULT 0,
            uploaded_by TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 7. Memorial Sisters (In Memoriam)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS memorial_sisters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            title TEXT DEFAULT '',
            birth_date TEXT DEFAULT '',
            profession_date TEXT DEFAULT '',
            departure_date TEXT DEFAULT '',
            photo TEXT DEFAULT '',
            communities TEXT DEFAULT '[]', -- JSON array of community names
            ministry TEXT DEFAULT '',
            biography TEXT DEFAULT '',
            quote TEXT DEFAULT '',
            burial_place TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 8. Events
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT DEFAULT '',
            location TEXT DEFAULT '',
            description TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 9. News
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT DEFAULT 'Admin',
            date TEXT NOT NULL,
            content TEXT NOT NULL,
            image_path TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 10. Contact Messages
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT DEFAULT '',
            message TEXT NOT NULL,
            status TEXT DEFAULT 'unread',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 11. Newsletter Subscribers
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 12. Prayer Requests
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS prayer_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Anonymous',
            intention TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 13. DB Meta Info
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS db_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """)

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ministries_station ON station_ministries(station_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_members_station ON station_members(station_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_stories_station ON station_stories(station_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_uploads_station ON station_uploads(station_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_uploads_type ON station_uploads(upload_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_gallery_station ON station_gallery(station_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_date ON news(date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prayers_status ON prayer_requests(status);")

        conn.commit()

def migrate_from_json():
    """Migrates existing data from communities.json and memorial.json if the database is empty."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Check if stations table is populated
        cursor.execute("SELECT COUNT(*) FROM stations")
        count = cursor.fetchone()[0]
        
        if count == 0 and os.path.exists(COMMUNITIES_JSON):
            print(f"[*] Seeding SQLite database from {COMMUNITIES_JSON}...")
            try:
                with open(COMMUNITIES_JSON, 'r', encoding='utf-8') as f:
                    communities = json.load(f)
                
                for c in communities:
                    cid = c.get('id')
                    if not cid:
                        continue
                    contact = c.get('contact') or {}
                    cursor.execute("""
                        INSERT OR REPLACE INTO stations (
                            id, name, established, location, country, badge,
                            description, address, phone, email, hero_image, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, (
                        cid,
                        c.get('name', ''),
                        c.get('established'),
                        c.get('location', ''),
                        c.get('country', ''),
                        c.get('badge', ''),
                        c.get('description', ''),
                        contact.get('address', ''),
                        contact.get('phone', ''),
                        contact.get('email', ''),
                        c.get('heroImage', '')
                    ))

                    # Ministries
                    for idx, m in enumerate(c.get('ministries', [])):
                        cursor.execute("""
                            INSERT INTO station_ministries (station_id, ministry_text, sort_order)
                            VALUES (?, ?, ?)
                        """, (cid, m, idx))

                    # Members
                    for idx, member in enumerate(c.get('members', [])):
                        if isinstance(member, dict):
                            cursor.execute("""
                                INSERT INTO station_members (station_id, name, role, feast_day, contact, bio, sort_order)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            """, (
                                cid,
                                member.get('name', ''),
                                member.get('role', ''),
                                member.get('feastDay', ''),
                                member.get('contact', ''),
                                member.get('bio', ''),
                                idx
                            ))
                        elif isinstance(member, str):
                            cursor.execute("""
                                INSERT INTO station_members (station_id, name, sort_order)
                                VALUES (?, ?, ?)
                            """, (cid, member, idx))

                    # Stories
                    for idx, story in enumerate(c.get('stories', [])):
                        if isinstance(story, dict):
                            cursor.execute("""
                                INSERT INTO station_stories (station_id, year, title, content, sort_order)
                                VALUES (?, ?, ?, ?, ?)
                            """, (
                                cid,
                                str(story.get('year', '')),
                                story.get('title', ''),
                                story.get('content', ''),
                                idx
                            ))

                    # Gallery
                    for img in c.get('gallery', []):
                        cursor.execute("""
                            INSERT INTO station_gallery (station_id, image_path, is_hero)
                            VALUES (?, ?, 0)
                        """, (cid, img))

                print(f"[+] Successfully seeded {len(communities)} stations into SQLite database.")
            except Exception as e:
                print(f"[-] Error migrating communities: {e}")

        # Seed memorial sisters if table empty
        cursor.execute("SELECT COUNT(*) FROM memorial_sisters")
        mem_count = cursor.fetchone()[0]
        if mem_count == 0 and os.path.exists(MEMORIAL_JSON):
            print(f"[*] Seeding memorial sisters from {MEMORIAL_JSON}...")
            try:
                with open(MEMORIAL_JSON, 'r', encoding='utf-8') as f:
                    memorial_data = json.load(f)
                
                for m in memorial_data:
                    mid = m.get('id')
                    if not mid:
                        continue
                    comms_json = json.dumps(m.get('communities', []), ensure_ascii=False)
                    cursor.execute("""
                        INSERT OR REPLACE INTO memorial_sisters (
                            id, name, title, birth_date, profession_date, departure_date,
                            photo, communities, ministry, biography, quote, burial_place
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        mid,
                        m.get('name', ''),
                        m.get('title', ''),
                        m.get('birthDate', ''),
                        m.get('professionDate', ''),
                        m.get('departureDate', ''),
                        m.get('photo', ''),
                        comms_json,
                        m.get('ministry', ''),
                        m.get('biography', ''),
                        m.get('quote', ''),
                        m.get('burialPlace', '')
                    ))
                print(f"[+] Successfully seeded {len(memorial_data)} memorial sister records.")
            except Exception as e:
                print(f"[-] Error migrating memorial records: {e}")

        # Seed a sample station report if station_uploads is empty
        cursor.execute("SELECT COUNT(*) FROM station_uploads")
        uploads_count = cursor.fetchone()[0]
        if uploads_count == 0:
            cursor.execute("""
                INSERT INTO station_uploads (station_id, sister_name, upload_type, title, content, metadata)
                VALUES (
                    'mariyapura',
                    'Sr. Superior SCS',
                    'monthly_report',
                    'Feast & Community Mission Report',
                    'Daily family visits conducted across 24 households. Special chain adoration organized in the Motherhouse chapel with intense prayer for the missions.',
                    '{"category": "Mission Chronicle", "verified": true}'
                )
            """)

        cursor.execute("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('last_migration', ?)", (datetime.datetime.now().isoformat(),))
        conn.commit()

def get_all_stations():
    """Retrieves all stations with nested ministries, members, stories, and gallery."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stations ORDER BY CASE WHEN id='mariyapura' THEN 0 ELSE 1 END, name ASC")
        rows = cursor.fetchall()
        
        stations = []
        for r in rows:
            sid = r['id']
            # Ministries
            cursor.execute("SELECT ministry_text FROM station_ministries WHERE station_id = ? ORDER BY sort_order ASC, id ASC", (sid,))
            ministries = [m['ministry_text'] for m in cursor.fetchall()]
            
            # Members
            cursor.execute("SELECT name, role, feast_day, contact, bio FROM station_members WHERE station_id = ? ORDER BY sort_order ASC, id ASC", (sid,))
            members = []
            for mem in cursor.fetchall():
                m_dict = {'name': mem['name'], 'role': mem['role']}
                if mem['feast_day']: m_dict['feastDay'] = mem['feast_day']
                if mem['contact']: m_dict['contact'] = mem['contact']
                if mem['bio']: m_dict['bio'] = mem['bio']
                members.append(m_dict)

            # Stories
            cursor.execute("SELECT year, title, content FROM station_stories WHERE station_id = ? ORDER BY sort_order ASC, id ASC", (sid,))
            stories = [{'year': s['year'], 'title': s['title'], 'content': s['content']} for s in cursor.fetchall()]

            # Gallery
            cursor.execute("SELECT image_path FROM station_gallery WHERE station_id = ? AND is_hero = 0 ORDER BY id ASC", (sid,))
            gallery = [g['image_path'] for g in cursor.fetchall()]

            station = {
                'id': sid,
                'name': r['name'],
                'established': r['established'],
                'location': r['location'] or '',
                'country': r['country'] or '',
                'badge': r['badge'] or '',
                'description': r['description'] or '',
                'contact': {
                    'address': r['address'] or '',
                    'phone': r['phone'] or '',
                    'email': r['email'] or ''
                },
                'ministries': ministries,
                'members': members,
                'stories': stories,
                'heroImage': r['hero_image'] or '',
                'gallery': gallery
            }
            stations.append(station)
        return stations

def get_station(station_id):
    """Retrieves a single station by id."""
    stations = get_all_stations()
    for s in stations:
        if s['id'] == station_id:
            return s
    return None

def save_station(data):
    """Saves or updates a station record and updates relational tables."""
    sid = data.get('id') or data.get('communityId')
    if not sid:
        name = data.get('name', '')
        sid = "".join(c.lower() for c in name if c.isalnum() or c in "_-").strip()
    if not sid:
        raise ValueError("Missing station ID or name")

    data['id'] = sid
    contact = data.get('contact') or {}

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO stations (
                id, name, established, location, country, badge,
                description, address, phone, email, hero_image, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                established=excluded.established,
                location=excluded.location,
                country=excluded.country,
                badge=excluded.badge,
                description=excluded.description,
                address=excluded.address,
                phone=excluded.phone,
                email=excluded.email,
                hero_image=COALESCE(NULLIF(excluded.hero_image, ''), stations.hero_image),
                updated_at=CURRENT_TIMESTAMP;
        """, (
            sid,
            data.get('name', ''),
            data.get('established'),
            data.get('location', ''),
            data.get('country', ''),
            data.get('badge', ''),
            data.get('description', ''),
            contact.get('address', ''),
            contact.get('phone', ''),
            contact.get('email', ''),
            data.get('heroImage', '')
        ))

        # Update ministries if provided
        if 'ministries' in data:
            cursor.execute("DELETE FROM station_ministries WHERE station_id = ?", (sid,))
            for idx, m in enumerate(data['ministries']):
                cursor.execute("""
                    INSERT INTO station_ministries (station_id, ministry_text, sort_order)
                    VALUES (?, ?, ?)
                """, (sid, m, idx))

        # Update members if provided
        if 'members' in data:
            cursor.execute("DELETE FROM station_members WHERE station_id = ?", (sid,))
            for idx, mem in enumerate(data['members']):
                if isinstance(mem, dict):
                    cursor.execute("""
                        INSERT INTO station_members (station_id, name, role, feast_day, contact, bio, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        sid,
                        mem.get('name', ''),
                        mem.get('role', ''),
                        mem.get('feastDay', ''),
                        mem.get('contact', ''),
                        mem.get('bio', ''),
                        idx
                    ))
                elif isinstance(mem, str):
                    cursor.execute("""
                        INSERT INTO station_members (station_id, name, sort_order)
                        VALUES (?, ?, ?)
                    """, (sid, mem, idx))

        # Update stories if provided
        if 'stories' in data:
            cursor.execute("DELETE FROM station_stories WHERE station_id = ?", (sid,))
            for idx, st in enumerate(data['stories']):
                if isinstance(st, dict):
                    cursor.execute("""
                        INSERT INTO station_stories (station_id, year, title, content, sort_order)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        sid,
                        str(st.get('year', '')),
                        st.get('title', ''),
                        st.get('content', ''),
                        idx
                    ))

        conn.commit()

    # Sync back to JSON and JS
    sync_to_json()
    return sid

def delete_station(station_id):
    """Deletes a station and cascading records."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM stations WHERE id = ?", (station_id,))
        conn.commit()
    sync_to_json()
    return True

# ── Station Uploads (Reports, Chronicles, Files from Sisters) ──
def get_station_uploads(station_id=None, upload_type=None, limit=100):
    """Queries uploaded station reports and data."""
    with get_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT u.*, s.name as station_name 
            FROM station_uploads u
            LEFT JOIN stations s ON u.station_id = s.id
            WHERE 1=1
        """
        params = []
        if station_id and station_id != 'all':
            query += " AND u.station_id = ?"
            params.append(station_id)
        if upload_type and upload_type != 'all':
            query += " AND u.upload_type = ?"
            params.append(upload_type)
        query += " ORDER BY u.created_at DESC, u.id DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for r in rows:
            meta = {}
            try:
                meta = json.loads(r['metadata']) if r['metadata'] else {}
            except Exception:
                pass
            results.append({
                'id': r['id'],
                'stationId': r['station_id'],
                'stationName': r['station_name'] or r['station_id'],
                'sisterName': r['sister_name'] or 'Sister SCS',
                'uploadType': r['upload_type'],
                'title': r['title'],
                'content': r['content'] or '',
                'filePath': r['file_path'] or '',
                'metadata': meta,
                'createdAt': r['created_at']
            })
        return results

def add_station_upload(station_id, sister_name, upload_type, title, content='', file_path='', metadata=None):
    """Stores a new upload from a sister at a station."""
    meta_json = json.dumps(metadata or {}, ensure_ascii=False)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO station_uploads (
                station_id, sister_name, upload_type, title, content, file_path, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            station_id,
            sister_name or 'Sister SCS',
            upload_type or 'general',
            title,
            content,
            file_path,
            meta_json
        ))
        upload_id = cursor.lastrowid
        conn.commit()
    return upload_id

def delete_station_upload(upload_id):
    """Deletes a station upload record."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM station_uploads WHERE id = ?", (upload_id,))
        conn.commit()
    return True

# ── Memorial Sisters ──
def get_memorial_sisters():
    """Retrieves all memorial sister records."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM memorial_sisters ORDER BY departure_date DESC, name ASC")
        rows = cursor.fetchall()
        results = []
        for r in rows:
            comms = []
            try:
                comms = json.loads(r['communities']) if r['communities'] else []
            except Exception:
                pass
            results.append({
                'id': r['id'],
                'name': r['name'],
                'title': r['title'] or '',
                'birthDate': r['birth_date'] or '',
                'professionDate': r['profession_date'] or '',
                'departureDate': r['departure_date'] or '',
                'photo': r['photo'] or '',
                'communities': comms,
                'ministry': r['ministry'] or '',
                'biography': r['biography'] or '',
                'quote': r['quote'] or '',
                'burialPlace': r['burial_place'] or ''
            })
        return results

def save_memorial_sister(data):
    """Saves or updates a memorial sister record."""
    sid = data.get('id')
    if not sid:
        name = data.get('name', 'sister')
        sid = "".join(c.lower() for c in name if c.isalnum() or c in "_-").strip()
    if not sid:
        sid = f"sister-{int(datetime.datetime.now().timestamp())}"
    data['id'] = sid

    comms_json = json.dumps(data.get('communities', []), ensure_ascii=False)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO memorial_sisters (
                id, name, title, birth_date, profession_date, departure_date,
                photo, communities, ministry, biography, quote, burial_place
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                title=excluded.title,
                birth_date=excluded.birth_date,
                profession_date=excluded.profession_date,
                departure_date=excluded.departure_date,
                photo=excluded.photo,
                communities=excluded.communities,
                ministry=excluded.ministry,
                biography=excluded.biography,
                quote=excluded.quote,
                burial_place=excluded.burial_place;
        """, (
            sid,
            data.get('name', ''),
            data.get('title', ''),
            data.get('birthDate', ''),
            data.get('professionDate', ''),
            data.get('departureDate', ''),
            data.get('photo', ''),
            comms_json,
            data.get('ministry', ''),
            data.get('biography', ''),
            data.get('quote', ''),
            data.get('burialPlace', '')
        ))
        conn.commit()

    sync_to_json()
    return sid

def delete_memorial_sister(sister_id):
    """Deletes a memorial sister record."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memorial_sisters WHERE id = ?", (sister_id,))
        conn.commit()
    sync_to_json()
    return True

# ── Synchronization to Static Files ──
def sync_to_json():
    """Exports SQLite tables to communities.json, memorial.json, and communities-data.js."""
    try:
        stations = get_all_stations()
        memorials = get_memorial_sisters()

        # 1. Update communities.json
        with open(COMMUNITIES_JSON, 'w', encoding='utf-8') as f:
            json.dump(stations, f, indent=2, ensure_ascii=False)

        # 2. Update memorial.json
        with open(MEMORIAL_JSON, 'w', encoding='utf-8') as f:
            json.dump(memorials, f, indent=2, ensure_ascii=False)

        # 3. Update communities-data.js (embedded fallback for static offline site)
        with open(COMMUNITIES_DATA_JS, 'w', encoding='utf-8') as f:
            f.write("// Embedded fallback data for communities and memorial sisters\n")
            f.write(f"window.__INITIAL_COMMUNITIES__ = {json.dumps(stations, ensure_ascii=False)};\n")
            f.write(f"window.__INITIAL_MEMORIAL__ = {json.dumps(memorials, ensure_ascii=False)};\n")

        return True
    except Exception as e:
        print(f"[-] Error syncing database to JSON: {e}")
        return False

# ── Phase 2 Community Features ──

# Events
def get_events():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events ORDER BY date ASC, time ASC")
        return [dict(r) for r in cursor.fetchall()]

def add_event(data):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO events (title, date, time, location, description)
            VALUES (?, ?, ?, ?, ?)
        """, (data.get('title'), data.get('date'), data.get('time', ''), data.get('location', ''), data.get('description', '')))
        conn.commit()
        return cursor.lastrowid

def delete_event(event_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
    return True

# News
def get_news():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM news ORDER BY date DESC, id DESC")
        return [dict(r) for r in cursor.fetchall()]

def add_news(data):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO news (title, author, date, content, image_path)
            VALUES (?, ?, ?, ?, ?)
        """, (data.get('title'), data.get('author', 'Admin'), data.get('date'), data.get('content'), data.get('image_path', '')))
        conn.commit()
        return cursor.lastrowid

def delete_news(news_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM news WHERE id = ?", (news_id,))
        conn.commit()
    return True

# Contact Messages
def get_contact_messages():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contact_messages ORDER BY created_at DESC")
        return [dict(r) for r in cursor.fetchall()]

def add_contact_message(data):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO contact_messages (name, email, subject, message, status)
            VALUES (?, ?, ?, ?, 'unread')
        """, (data.get('name'), data.get('email'), data.get('subject', ''), data.get('message')))
        conn.commit()
        return cursor.lastrowid

def update_contact_message_status(msg_id, status):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE contact_messages SET status = ? WHERE id = ?", (status, msg_id))
        conn.commit()
    return True

# Newsletter Subscribers
def get_newsletter_subscribers():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC")
        return [dict(r) for r in cursor.fetchall()]

def add_newsletter_subscriber(email):
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO newsletter_subscribers (email) VALUES (?)", (email,))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None # Already subscribed

# Prayer Requests
def get_prayer_requests(status=None):
    with get_connection() as conn:
        cursor = conn.cursor()
        if status:
            cursor.execute("SELECT * FROM prayer_requests WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            cursor.execute("SELECT * FROM prayer_requests ORDER BY created_at DESC")
        return [dict(r) for r in cursor.fetchall()]

def add_prayer_request(data):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO prayer_requests (name, intention, status)
            VALUES (?, ?, 'pending')
        """, (data.get('name', 'Anonymous'), data.get('intention')))
        conn.commit()
        return cursor.lastrowid

def update_prayer_request_status(req_id, status):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE prayer_requests SET status = ? WHERE id = ?", (status, req_id))
        conn.commit()
    return True


# ── Stats & Diagnostics ──
def get_db_stats():
    """Returns statistics about the SQLite database."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM stations")
        total_stations = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM station_uploads")
        total_uploads = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM station_gallery")
        total_gallery = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM memorial_sisters")
        total_memorial = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM events")
        total_events = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM news")
        total_news = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM contact_messages")
        total_contacts = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM newsletter_subscribers")
        total_subscribers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM prayer_requests")
        total_prayers = cursor.fetchone()[0]

    db_size_bytes = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    size_kb = round(db_size_bytes / 1024, 2)

    return {
        'dbPath': DB_PATH,
        'relPath': os.path.relpath(DB_PATH, REPO_ROOT),
        'sqliteVersion': sqlite3.sqlite_version,
        'sizeBytes': db_size_bytes,
        'sizeKb': size_kb,
        'totalStations': total_stations,
        'totalUploads': total_uploads,
        'totalGallery': total_gallery,
        'totalMemorial': total_memorial,
        'totalEvents': total_events,
        'totalNews': total_news,
        'totalContacts': total_contacts,
        'totalSubscribers': total_subscribers,
        'totalPrayers': total_prayers,
        'status': 'connected'
    }

# ── CLI Interface ──
def main():
    if len(sys.argv) < 2:
        print("""
Usage: python3 scripts/db.py <command> [args]

Commands:
  init             Initialize SQLite schema and migrate from JSON files
  status           Display database stats, table counts, and file size
  query "<SQL>"   Execute a read-only SQL query and print rows
  export [format]  Export database to json (default) or sql
  sync             Sync current database to communities.json and communities-data.js
        """)
        sys.exit(0)

    cmd = sys.argv[1].lower()

    if cmd == 'init':
        init_db()
        migrate_from_json()
        print(f"[✓] Database ready at {DB_PATH}")

    elif cmd == 'status':
        stats = get_db_stats()
        print("=" * 60)
        print("Satyaseva Sisters Portable Database Status")
        print("=" * 60)
        print(f"File Path:       {stats['dbPath']}")
        print(f"Database Size:   {stats['sizeKb']} KB ({stats['sizeBytes']} bytes)")
        print(f"SQLite Version:  {stats['sqliteVersion']}")
        print(f"Stations:        {stats['totalStations']}")
        print(f"Station Uploads: {stats['totalUploads']}")
        print(f"Gallery Photos:  {stats['totalGallery']}")
        print(f"Past Sisters:    {stats['totalMemorial']}")
        print("=" * 60)

    elif cmd == 'sync':
        sync_to_json()
        print("[✓] Synchronized SQLite database to communities.json & communities-data.js")

    elif cmd == 'query':
        if len(sys.argv) < 3:
            print("Please provide a SQL query in quotes.")
            sys.exit(1)
        query = sys.argv[2]
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query)
            rows = cursor.fetchall()
            if not rows:
                print("No rows returned.")
            else:
                for r in rows:
                    print(dict(r))

    elif cmd == 'export':
        fmt = sys.argv[2] if len(sys.argv) > 2 else 'json'
        if fmt == 'json':
            stations = get_all_stations()
            print(json.dumps(stations, indent=2, ensure_ascii=False))
        else:
            print(f"Format {fmt} not supported yet.")
    else:
        print(f"Unknown command: {cmd}")

if __name__ == '__main__':
    main()

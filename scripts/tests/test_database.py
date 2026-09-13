#!/usr/bin/env python3
"""
test_database.py — Unit Tests for db.py (SQLite Data Layer)
Tests schema initialization, CRUD operations for all tables,
data integrity, migration, sync, and edge cases.
"""

import os
import sys
import json
import sqlite3
import tempfile
import unittest
import shutil

# Add scripts directory to path
SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS_DIR)

import db


class TestDatabaseSetup(unittest.TestCase):
    """Tests for database initialization and schema creation."""

    @classmethod
    def setUpClass(cls):
        """Use a temporary database for all tests."""
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls._orig_communities_json = db.COMMUNITIES_JSON
        cls._orig_communities_data_js = db.COMMUNITIES_DATA_JS
        cls._orig_memorial_json = db.MEMORIAL_JSON

        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        # Create empty JSON files to avoid migration issues
        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        """Restore original paths and clean up temp files."""
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        db.COMMUNITIES_JSON = cls._orig_communities_json
        db.COMMUNITIES_DATA_JS = cls._orig_communities_data_js
        db.MEMORIAL_JSON = cls._orig_memorial_json
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        """Clean DB before each test."""
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_init_db_creates_file(self):
        """DB file should be created on init."""
        self.assertTrue(os.path.exists(db.DB_PATH))

    def test_init_db_creates_all_tables(self):
        """All expected tables should exist after init."""
        expected_tables = [
            'stations', 'station_ministries', 'station_members',
            'station_stories', 'station_uploads', 'station_gallery',
            'memorial_sisters', 'events', 'news', 'contact_messages',
            'newsletter_subscribers', 'prayer_requests', 'db_meta'
        ]
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row['name'] for row in cursor.fetchall()]

        for t in expected_tables:
            self.assertIn(t, tables, f"Table '{t}' not found in database")

    def test_init_db_creates_indexes(self):
        """Expected indexes should exist after init."""
        expected_indexes = [
            'idx_ministries_station', 'idx_members_station',
            'idx_stories_station', 'idx_uploads_station',
            'idx_uploads_type', 'idx_gallery_station',
            'idx_events_date', 'idx_news_date',
            'idx_contact_status', 'idx_prayers_status'
        ]
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
            indexes = [row['name'] for row in cursor.fetchall()]

        for idx in expected_indexes:
            self.assertIn(idx, indexes, f"Index '{idx}' not found")

    def test_init_db_idempotent(self):
        """Calling init_db multiple times should not error."""
        db.init_db()
        db.init_db()
        db.init_db()
        # If we get here without errors, the test passes
        self.assertTrue(True)

    def test_foreign_keys_enabled(self):
        """Foreign keys should be enforced."""
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys")
            fk_status = cursor.fetchone()[0]
            self.assertEqual(fk_status, 1, "Foreign keys should be ON")


class TestStationsCRUD(unittest.TestCase):
    """Tests for Station/Community CRUD operations."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls._orig_communities_json = db.COMMUNITIES_JSON
        cls._orig_communities_data_js = db.COMMUNITIES_DATA_JS
        cls._orig_memorial_json = db.MEMORIAL_JSON

        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        db.COMMUNITIES_JSON = cls._orig_communities_json
        db.COMMUNITIES_DATA_JS = cls._orig_communities_data_js
        db.MEMORIAL_JSON = cls._orig_memorial_json
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def _sample_station(self, **overrides):
        data = {
            'id': 'test-station',
            'name': 'Test Station',
            'established': 2020,
            'location': 'Test City',
            'country': 'India',
            'badge': '🕊️',
            'description': 'A test community',
            'contact': {
                'address': '123 Test St',
                'phone': '+91-1234567890',
                'email': 'test@scs.org'
            },
            'ministries': ['Education', 'Healthcare', 'Social Work'],
            'members': [
                {'name': 'Sr. Mary', 'role': 'Superior', 'feastDay': 'Jan 1'},
                {'name': 'Sr. Agnes', 'role': 'Teacher'}
            ],
            'stories': [
                {'year': '2020', 'title': 'Foundation', 'content': 'Station was established.'}
            ],
            'heroImage': 'images/test-hero.jpg'
        }
        data.update(overrides)
        return data

    def test_save_station_creates_record(self):
        """save_station should insert a new station."""
        data = self._sample_station()
        sid = db.save_station(data)
        self.assertEqual(sid, 'test-station')

        station = db.get_station('test-station')
        self.assertIsNotNone(station)
        self.assertEqual(station['name'], 'Test Station')

    def test_save_station_updates_existing(self):
        """save_station should update if station ID exists (upsert)."""
        data = self._sample_station()
        db.save_station(data)

        data['description'] = 'Updated description'
        db.save_station(data)

        station = db.get_station('test-station')
        self.assertEqual(station['description'], 'Updated description')

    def test_save_station_with_ministries(self):
        """Ministries should be saved relationally."""
        data = self._sample_station()
        db.save_station(data)

        station = db.get_station('test-station')
        self.assertEqual(len(station['ministries']), 3)
        self.assertIn('Education', station['ministries'])

    def test_save_station_with_members(self):
        """Members should be saved relationally."""
        data = self._sample_station()
        db.save_station(data)

        station = db.get_station('test-station')
        self.assertEqual(len(station['members']), 2)
        self.assertEqual(station['members'][0]['name'], 'Sr. Mary')
        self.assertEqual(station['members'][0]['role'], 'Superior')

    def test_save_station_with_stories(self):
        """Stories should be saved relationally."""
        data = self._sample_station()
        db.save_station(data)

        station = db.get_station('test-station')
        self.assertEqual(len(station['stories']), 1)
        self.assertEqual(station['stories'][0]['title'], 'Foundation')

    def test_save_station_with_contact(self):
        """Contact info should be stored correctly."""
        data = self._sample_station()
        db.save_station(data)

        station = db.get_station('test-station')
        self.assertEqual(station['contact']['address'], '123 Test St')
        self.assertEqual(station['contact']['phone'], '+91-1234567890')
        self.assertEqual(station['contact']['email'], 'test@scs.org')

    def test_get_all_stations(self):
        """Should return all stations."""
        db.save_station(self._sample_station(id='station-a', name='Station A'))
        db.save_station(self._sample_station(id='station-b', name='Station B'))

        stations = db.get_all_stations()
        self.assertEqual(len(stations), 2)

    def test_get_station_not_found(self):
        """get_station with non-existent ID should return None."""
        result = db.get_station('nonexistent-id')
        self.assertIsNone(result)

    def test_delete_station(self):
        """Deleting a station should remove it and cascade."""
        data = self._sample_station()
        db.save_station(data)

        db.delete_station('test-station')
        result = db.get_station('test-station')
        self.assertIsNone(result)

    def test_delete_station_cascades_ministries(self):
        """Deleting a station should cascade delete ministries."""
        db.save_station(self._sample_station())
        db.delete_station('test-station')

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM station_ministries WHERE station_id = 'test-station'")
            count = cursor.fetchone()[0]
        self.assertEqual(count, 0)

    def test_delete_station_cascades_members(self):
        """Deleting a station should cascade delete members."""
        db.save_station(self._sample_station())
        db.delete_station('test-station')

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM station_members WHERE station_id = 'test-station'")
            count = cursor.fetchone()[0]
        self.assertEqual(count, 0)

    def test_save_station_missing_id_generates_from_name(self):
        """If no ID, should auto-generate from name."""
        data = self._sample_station()
        del data['id']
        data['name'] = 'New Community'
        sid = db.save_station(data)
        self.assertTrue(len(sid) > 0)

    def test_save_station_missing_both_raises(self):
        """Missing both id and name should raise ValueError."""
        with self.assertRaises(ValueError):
            db.save_station({})

    def test_station_updates_ministries_on_re_save(self):
        """Re-saving with new ministries should replace old ones."""
        data = self._sample_station()
        db.save_station(data)

        data['ministries'] = ['Nursing', 'Teaching']
        db.save_station(data)

        station = db.get_station('test-station')
        self.assertEqual(len(station['ministries']), 2)
        self.assertNotIn('Education', station['ministries'])
        self.assertIn('Nursing', station['ministries'])


class TestMemorialCRUD(unittest.TestCase):
    """Tests for Memorial Sisters CRUD."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls._orig_communities_json = db.COMMUNITIES_JSON
        cls._orig_communities_data_js = db.COMMUNITIES_DATA_JS
        cls._orig_memorial_json = db.MEMORIAL_JSON

        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        db.COMMUNITIES_JSON = cls._orig_communities_json
        db.COMMUNITIES_DATA_JS = cls._orig_communities_data_js
        db.MEMORIAL_JSON = cls._orig_memorial_json
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def _sample_memorial(self, **overrides):
        data = {
            'id': 'sr-test',
            'name': 'Sr. Test',
            'title': 'Venerable',
            'birthDate': '1930-01-15',
            'professionDate': '1955-06-20',
            'departureDate': '2020-03-10',
            'photo': 'images/memorial/sr-test.jpg',
            'communities': ['Mariyapura', 'Chittur'],
            'ministry': 'Education and Healthcare',
            'biography': 'A life dedicated to service.',
            'quote': 'Love is the greatest gift.',
            'burialPlace': 'Motherhouse Cemetery'
        }
        data.update(overrides)
        return data

    def test_save_memorial_sister(self):
        """Should save a memorial sister record."""
        data = self._sample_memorial()
        sid = db.save_memorial_sister(data)
        self.assertEqual(sid, 'sr-test')

    def test_get_memorial_sisters(self):
        """Should retrieve all memorial records."""
        db.save_memorial_sister(self._sample_memorial(id='sr-a', name='Sr. A'))
        db.save_memorial_sister(self._sample_memorial(id='sr-b', name='Sr. B'))

        records = db.get_memorial_sisters()
        self.assertEqual(len(records), 2)

    def test_memorial_communities_json_field(self):
        """Communities should be stored/returned as JSON array."""
        db.save_memorial_sister(self._sample_memorial())
        records = db.get_memorial_sisters()
        sr = [r for r in records if r['id'] == 'sr-test'][0]
        self.assertIsInstance(sr['communities'], list)
        self.assertIn('Mariyapura', sr['communities'])

    def test_delete_memorial_sister(self):
        """Should delete a memorial record."""
        db.save_memorial_sister(self._sample_memorial())
        db.delete_memorial_sister('sr-test')
        records = db.get_memorial_sisters()
        self.assertEqual(len(records), 0)

    def test_memorial_update_on_conflict(self):
        """Saving with same ID should update the record."""
        db.save_memorial_sister(self._sample_memorial())
        db.save_memorial_sister(self._sample_memorial(quote='Updated quote'))
        records = db.get_memorial_sisters()
        sr = [r for r in records if r['id'] == 'sr-test'][0]
        self.assertEqual(sr['quote'], 'Updated quote')

    def test_memorial_auto_id_from_name(self):
        """If no ID provided, should generate from name."""
        data = self._sample_memorial()
        del data['id']
        data['name'] = 'Sr. Auto'
        sid = db.save_memorial_sister(data)
        self.assertTrue(len(sid) > 0)


class TestEventsCRUD(unittest.TestCase):
    """Tests for Events CRUD."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_add_event(self):
        """Should create a new event and return its ID."""
        eid = db.add_event({
            'title': 'Annual Retreat',
            'date': '2026-12-01',
            'time': '09:00',
            'location': 'Motherhouse',
            'description': 'Yearly gathering'
        })
        self.assertIsInstance(eid, int)
        self.assertGreater(eid, 0)

    def test_get_events(self):
        """Should return all events ordered by date."""
        db.add_event({'title': 'Event B', 'date': '2026-12-15'})
        db.add_event({'title': 'Event A', 'date': '2026-12-01'})

        events = db.get_events()
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]['title'], 'Event A')  # Earlier date first

    def test_delete_event(self):
        """Should remove event by ID."""
        eid = db.add_event({'title': 'To Delete', 'date': '2026-01-01'})
        db.delete_event(eid)
        events = db.get_events()
        self.assertEqual(len(events), 0)


class TestNewsCRUD(unittest.TestCase):
    """Tests for News CRUD."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_add_news(self):
        """Should create a news article."""
        nid = db.add_news({
            'title': 'Test News',
            'author': 'Admin',
            'date': '2026-09-12',
            'content': 'Test content body.'
        })
        self.assertIsInstance(nid, int)

    def test_get_news_ordered_desc(self):
        """News should be ordered by date descending."""
        db.add_news({'title': 'Old', 'date': '2026-01-01', 'content': 'x'})
        db.add_news({'title': 'New', 'date': '2026-12-01', 'content': 'y'})

        news = db.get_news()
        self.assertEqual(news[0]['title'], 'New')

    def test_delete_news(self):
        """Should delete a news article."""
        nid = db.add_news({'title': 'X', 'date': '2026-01-01', 'content': 'body'})
        db.delete_news(nid)
        self.assertEqual(len(db.get_news()), 0)

    def test_news_default_author(self):
        """Author should default to 'Admin'."""
        nid = db.add_news({'title': 'Y', 'date': '2026-01-01', 'content': 'body'})
        news = db.get_news()
        self.assertEqual(news[0]['author'], 'Admin')


class TestContactMessages(unittest.TestCase):
    """Tests for Contact Messages CRUD."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_add_contact_message(self):
        """Should store a contact message."""
        mid = db.add_contact_message({
            'name': 'John',
            'email': 'john@test.com',
            'subject': 'Inquiry',
            'message': 'Hello, I want to learn more.'
        })
        self.assertIsInstance(mid, int)

    def test_contact_message_default_status(self):
        """New messages should default to 'unread'."""
        db.add_contact_message({
            'name': 'Jane',
            'email': 'jane@test.com',
            'message': 'Info please.'
        })
        msgs = db.get_contact_messages()
        self.assertEqual(msgs[0]['status'], 'unread')

    def test_update_contact_status(self):
        """Should update message status."""
        mid = db.add_contact_message({
            'name': 'Test',
            'email': 'test@test.com',
            'message': 'Test msg.'
        })
        db.update_contact_message_status(mid, 'read')
        msgs = db.get_contact_messages()
        self.assertEqual(msgs[0]['status'], 'read')


class TestNewsletterSubscribers(unittest.TestCase):
    """Tests for Newsletter Subscribers."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_add_subscriber(self):
        """Should add a new subscriber."""
        result = db.add_newsletter_subscriber('new@test.com')
        self.assertIsNotNone(result)

    def test_duplicate_subscriber_returns_none(self):
        """Adding same email twice should return None (no duplicate)."""
        db.add_newsletter_subscriber('dupe@test.com')
        result = db.add_newsletter_subscriber('dupe@test.com')
        self.assertIsNone(result)

    def test_get_subscribers(self):
        """Should return all subscribers."""
        db.add_newsletter_subscriber('a@test.com')
        db.add_newsletter_subscriber('b@test.com')
        subs = db.get_newsletter_subscribers()
        self.assertEqual(len(subs), 2)


class TestPrayerRequests(unittest.TestCase):
    """Tests for Prayer Requests CRUD."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_add_prayer_request(self):
        """Should add a prayer request."""
        pid = db.add_prayer_request({
            'name': 'Test Devotee',
            'intention': 'For peace in the world'
        })
        self.assertIsInstance(pid, int)

    def test_prayer_default_status_pending(self):
        """New prayer requests should default to 'pending'."""
        db.add_prayer_request({'intention': 'Test prayer'})
        prayers = db.get_prayer_requests()
        self.assertEqual(prayers[0]['status'], 'pending')

    def test_prayer_default_name_anonymous(self):
        """Name should default to 'Anonymous'."""
        db.add_prayer_request({'intention': 'Anonymous test'})
        prayers = db.get_prayer_requests()
        self.assertEqual(prayers[0]['name'], 'Anonymous')

    def test_update_prayer_status(self):
        """Should update prayer request status."""
        pid = db.add_prayer_request({'intention': 'Status test'})
        db.update_prayer_request_status(pid, 'prayed')
        prayers = db.get_prayer_requests('prayed')
        self.assertEqual(len(prayers), 1)

    def test_get_prayer_requests_filtered(self):
        """Should filter by status."""
        db.add_prayer_request({'intention': 'A'})
        pid = db.add_prayer_request({'intention': 'B'})
        db.update_prayer_request_status(pid, 'answered')

        pending = db.get_prayer_requests('pending')
        answered = db.get_prayer_requests('answered')
        all_prayers = db.get_prayer_requests()

        self.assertEqual(len(pending), 1)
        self.assertEqual(len(answered), 1)
        self.assertEqual(len(all_prayers), 2)


class TestStationUploads(unittest.TestCase):
    """Tests for Station Uploads CRUD."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()
        # Need a station to reference due to FK
        db.save_station({
            'id': 'test-station',
            'name': 'Test Station',
            'established': 2020,
            'location': 'Test',
            'country': 'India'
        })

    def test_add_upload(self):
        """Should create a station upload."""
        uid = db.add_station_upload(
            station_id='test-station',
            sister_name='Sr. Mary',
            upload_type='monthly_report',
            title='September Report',
            content='Report content here.',
            file_path='',
            metadata={'verified': True}
        )
        self.assertIsInstance(uid, int)

    def test_get_uploads_all(self):
        """Should retrieve all uploads."""
        db.add_station_upload('test-station', 'Sr. A', 'chronicle', 'C1', 'c')
        db.add_station_upload('test-station', 'Sr. B', 'photo', 'P1', 'p')

        uploads = db.get_station_uploads()
        self.assertEqual(len(uploads), 2)

    def test_get_uploads_filtered_by_type(self):
        """Should filter uploads by type."""
        db.add_station_upload('test-station', 'Sr. A', 'chronicle', 'C1')
        db.add_station_upload('test-station', 'Sr. B', 'photo', 'P1')

        chronicles = db.get_station_uploads(upload_type='chronicle')
        photos = db.get_station_uploads(upload_type='photo')

        self.assertEqual(len(chronicles), 1)
        self.assertEqual(len(photos), 1)

    def test_get_uploads_filtered_by_station(self):
        """Should filter by station ID."""
        db.save_station({
            'id': 'other-station',
            'name': 'Other Station',
            'established': 2021,
            'location': 'Other',
            'country': 'India'
        })
        db.add_station_upload('test-station', 'Sr.', 'report', 'R1')
        db.add_station_upload('other-station', 'Sr.', 'report', 'R2')

        result = db.get_station_uploads(station_id='test-station')
        self.assertEqual(len(result), 1)

    def test_delete_upload(self):
        """Should delete a station upload."""
        uid = db.add_station_upload('test-station', 'Sr.', 'report', 'Del')
        db.delete_station_upload(uid)

        uploads = db.get_station_uploads()
        self.assertEqual(len(uploads), 0)

    def test_upload_metadata_json(self):
        """Metadata should be stored and returned as dict."""
        meta = {'category': 'Mission', 'verified': True, 'tags': ['annual', 'report']}
        uid = db.add_station_upload(
            'test-station', 'Sr.', 'report', 'Meta Test',
            metadata=meta
        )
        uploads = db.get_station_uploads()
        self.assertIsInstance(uploads[0]['metadata'], dict)
        self.assertEqual(uploads[0]['metadata']['category'], 'Mission')


class TestSyncToJSON(unittest.TestCase):
    """Tests for database sync to JSON/JS files."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls._orig_communities_json = db.COMMUNITIES_JSON
        cls._orig_communities_data_js = db.COMMUNITIES_DATA_JS
        cls._orig_memorial_json = db.MEMORIAL_JSON

        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        db.COMMUNITIES_JSON = cls._orig_communities_json
        db.COMMUNITIES_DATA_JS = cls._orig_communities_data_js
        db.MEMORIAL_JSON = cls._orig_memorial_json
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_sync_creates_communities_json(self):
        """sync_to_json should write communities.json."""
        db.save_station({
            'id': 'sync-test',
            'name': 'Sync Test',
            'established': 2020,
            'location': 'X',
            'country': 'India'
        })
        result = db.sync_to_json()
        self.assertTrue(result)
        self.assertTrue(os.path.exists(db.COMMUNITIES_JSON))

        with open(db.COMMUNITIES_JSON, 'r') as f:
            data = json.load(f)
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_sync_creates_memorial_json(self):
        """sync_to_json should write memorial.json."""
        db.save_memorial_sister({
            'id': 'sr-sync',
            'name': 'Sr. Sync'
        })
        db.sync_to_json()
        self.assertTrue(os.path.exists(db.MEMORIAL_JSON))

    def test_sync_creates_communities_data_js(self):
        """sync_to_json should write communities-data.js."""
        db.save_station({
            'id': 'js-test',
            'name': 'JS Test',
            'established': 2020,
            'location': 'X',
            'country': 'India'
        })
        db.sync_to_json()
        self.assertTrue(os.path.exists(db.COMMUNITIES_DATA_JS))

        with open(db.COMMUNITIES_DATA_JS, 'r') as f:
            content = f.read()
        self.assertIn('window.__INITIAL_COMMUNITIES__', content)
        self.assertIn('window.__INITIAL_MEMORIAL__', content)


class TestDBStats(unittest.TestCase):
    """Tests for get_db_stats."""

    @classmethod
    def setUpClass(cls):
        cls._orig_db_path = db.DB_PATH
        cls._orig_data_dir = db.DATA_DIR
        cls._orig_repo_root = db.REPO_ROOT
        cls.temp_dir = tempfile.mkdtemp(prefix='sscs_test_')
        db.DATA_DIR = cls.temp_dir
        db.DB_PATH = os.path.join(cls.temp_dir, 'test_sscs.db')
        db.COMMUNITIES_JSON = os.path.join(cls.temp_dir, 'communities.json')
        db.COMMUNITIES_DATA_JS = os.path.join(cls.temp_dir, 'communities-data.js')
        db.MEMORIAL_JSON = os.path.join(cls.temp_dir, 'memorial.json')
        db.REPO_ROOT = cls.temp_dir

        with open(db.COMMUNITIES_JSON, 'w') as f:
            json.dump([], f)
        with open(db.MEMORIAL_JSON, 'w') as f:
            json.dump([], f)

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls._orig_db_path
        db.DATA_DIR = cls._orig_data_dir
        db.REPO_ROOT = cls._orig_repo_root
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()

    def test_stats_returns_dict(self):
        """get_db_stats should return a dict with expected keys."""
        stats = db.get_db_stats()
        expected_keys = [
            'dbPath', 'sqliteVersion', 'sizeBytes', 'sizeKb',
            'totalStations', 'totalUploads', 'totalGallery',
            'totalMemorial', 'totalEvents', 'totalNews',
            'totalContacts', 'totalSubscribers', 'totalPrayers', 'status'
        ]
        for key in expected_keys:
            self.assertIn(key, stats, f"Missing key '{key}' in stats")

    def test_stats_status_connected(self):
        """Status should be 'connected'."""
        stats = db.get_db_stats()
        self.assertEqual(stats['status'], 'connected')

    def test_stats_counts_correct(self):
        """Counts should accurately reflect inserted data."""
        db.save_station({
            'id': 'stats-test', 'name': 'Stats Test',
            'established': 2020, 'location': 'X', 'country': 'India'
        })
        db.add_event({'title': 'E', 'date': '2026-01-01'})
        db.add_news({'title': 'N', 'date': '2026-01-01', 'content': 'c'})
        db.add_contact_message({'name': 'C', 'email': 'c@t.com', 'message': 'm'})
        db.add_newsletter_subscriber('s@t.com')
        db.add_prayer_request({'intention': 'p'})

        stats = db.get_db_stats()
        self.assertEqual(stats['totalStations'], 1)
        self.assertEqual(stats['totalEvents'], 1)
        self.assertEqual(stats['totalNews'], 1)
        self.assertEqual(stats['totalContacts'], 1)
        self.assertEqual(stats['totalSubscribers'], 1)
        self.assertEqual(stats['totalPrayers'], 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)

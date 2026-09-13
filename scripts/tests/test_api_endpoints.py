#!/usr/bin/env python3
"""
test_api_endpoints.py — Integration Tests for REST API Endpoints
Tests all HTTP API endpoints served by serve.py against the live server.
Requires the server to be running on localhost:8000 / localhost:8443.
"""

import json
import ssl
import sys
import os
import unittest
import urllib.request
import urllib.error
import urllib.parse

BASE_HTTP = 'http://localhost:8000'
BASE_HTTPS = 'https://localhost:8443'
AUTH_TOKEN = 'Bearer 3da9d3db181afc4921f55f9c0e6fb27172af8514621131a549bb6e89362b85f9'

# SSL context that accepts self-signed certs
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def api_get(path, base=BASE_HTTP, auth=False):
    """Helper: perform GET request."""
    headers = {'User-Agent': 'TestBot/1.0'}
    if auth:
        headers['Authorization'] = AUTH_TOKEN
    req = urllib.request.Request(f"{base}{path}", headers=headers)
    ctx = SSL_CTX if 'https' in base else None
    with urllib.request.urlopen(req, timeout=10, context=ctx) as res:
        return res.status, json.loads(res.read().decode('utf-8'))


def api_post(path, data, base=BASE_HTTP, auth=False):
    """Helper: perform POST request with JSON body."""
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'TestBot/1.0'
    }
    if auth:
        headers['Authorization'] = AUTH_TOKEN
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(f"{base}{path}", data=body, headers=headers)
    ctx = SSL_CTX if 'https' in base else None
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8') if e.fp else '{}'
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {'error': body}


class TestServerHealth(unittest.TestCase):
    """Verify server is reachable on both ports."""

    def test_http_server_running(self):
        """HTTP server on port 8000 should respond."""
        req = urllib.request.Request(f"{BASE_HTTP}/", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10) as res:
            self.assertEqual(res.status, 200)

    def test_https_server_running(self):
        """HTTPS server on port 8443 should respond."""
        req = urllib.request.Request(f"{BASE_HTTPS}/", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as res:
            self.assertEqual(res.status, 200)


class TestSecurityHeaders(unittest.TestCase):
    """Verify security headers on responses."""

    def test_hsts_header(self):
        """HSTS header should be present."""
        req = urllib.request.Request(f"{BASE_HTTP}/", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10) as res:
            hsts = res.headers.get('Strict-Transport-Security')
            self.assertIsNotNone(hsts)
            self.assertIn('max-age=31536000', hsts)

    def test_x_content_type_options(self):
        """X-Content-Type-Options: nosniff should be present."""
        req = urllib.request.Request(f"{BASE_HTTP}/", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10) as res:
            self.assertEqual(res.headers.get('X-Content-Type-Options'), 'nosniff')

    def test_x_frame_options(self):
        """X-Frame-Options: SAMEORIGIN should be present."""
        req = urllib.request.Request(f"{BASE_HTTP}/", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10) as res:
            self.assertEqual(res.headers.get('X-Frame-Options'), 'SAMEORIGIN')

    def test_referrer_policy(self):
        """Referrer-Policy should be set."""
        req = urllib.request.Request(f"{BASE_HTTP}/", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10) as res:
            rp = res.headers.get('Referrer-Policy')
            self.assertIsNotNone(rp)

    def test_cors_header_on_api(self):
        """API responses should include CORS headers."""
        req = urllib.request.Request(f"{BASE_HTTP}/api/communities", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10) as res:
            cors = res.headers.get('Access-Control-Allow-Origin')
            self.assertEqual(cors, '*')


class TestPublicGETEndpoints(unittest.TestCase):
    """Tests for all public (no-auth) GET API endpoints."""

    def test_get_communities(self):
        """GET /api/communities should return a list."""
        status, data = api_get('/api/communities')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_communities_structure(self):
        """Each community should have required fields."""
        status, data = api_get('/api/communities')
        if data:
            c = data[0]
            self.assertIn('id', c)
            self.assertIn('name', c)
            self.assertIn('contact', c)
            self.assertIsInstance(c['contact'], dict)

    def test_get_events(self):
        """GET /api/events should return a list."""
        status, data = api_get('/api/events')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_news(self):
        """GET /api/news should return a list."""
        status, data = api_get('/api/news')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_memorial(self):
        """GET /api/memorial should return a list."""
        status, data = api_get('/api/memorial')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_prayers(self):
        """GET /api/prayers should return a list."""
        status, data = api_get('/api/prayers')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_station_uploads(self):
        """GET /api/station-uploads should return a list."""
        status, data = api_get('/api/station-uploads')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_db_status(self):
        """GET /api/db/status should return status dict."""
        status, data = api_get('/api/db/status')
        self.assertEqual(status, 200)
        self.assertIn('status', data)
        self.assertEqual(data['status'], 'connected')
        self.assertIn('totalStations', data)
        self.assertIn('sqliteVersion', data)


class TestPublicGETEndpointsHTTPS(unittest.TestCase):
    """Same public GET tests but over HTTPS."""

    def test_get_communities_https(self):
        """GET /api/communities over HTTPS."""
        status, data = api_get('/api/communities', base=BASE_HTTPS)
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_events_https(self):
        """GET /api/events over HTTPS."""
        status, data = api_get('/api/events', base=BASE_HTTPS)
        self.assertEqual(status, 200)

    def test_get_news_https(self):
        """GET /api/news over HTTPS."""
        status, data = api_get('/api/news', base=BASE_HTTPS)
        self.assertEqual(status, 200)

    def test_get_memorial_https(self):
        """GET /api/memorial over HTTPS."""
        status, data = api_get('/api/memorial', base=BASE_HTTPS)
        self.assertEqual(status, 200)

    def test_get_db_status_https(self):
        """GET /api/db/status over HTTPS."""
        status, data = api_get('/api/db/status', base=BASE_HTTPS)
        self.assertEqual(status, 200)
        self.assertEqual(data['status'], 'connected')


class TestPublicPOSTEndpoints(unittest.TestCase):
    """Tests for public POST endpoints (no auth required)."""

    def test_post_contact(self):
        """POST /api/contact should accept and store a message."""
        status, data = api_post('/api/contact', {
            'name': 'Unit Test User',
            'email': 'unittest@sscs.test',
            'subject': 'Test Subject',
            'message': 'This is an automated unit test message.'
        })
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))
        self.assertIn('id', data)

    def test_post_contact_missing_fields(self):
        """POST /api/contact without required fields should return 400."""
        status, data = api_post('/api/contact', {
            'name': 'Incomplete'
            # Missing email and message
        })
        self.assertEqual(status, 400)

    def test_post_newsletter(self):
        """POST /api/newsletter should accept email."""
        import time
        email = f'unittest_{int(time.time())}@sscs.test'
        status, data = api_post('/api/newsletter', {'email': email})
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))

    def test_post_newsletter_duplicate(self):
        """POST /api/newsletter with same email should succeed gracefully."""
        email = 'dupe_test@sscs.test'
        api_post('/api/newsletter', {'email': email})
        status, data = api_post('/api/newsletter', {'email': email})
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))

    def test_post_newsletter_missing_email(self):
        """POST /api/newsletter without email should return 400."""
        status, data = api_post('/api/newsletter', {})
        self.assertEqual(status, 400)

    def test_post_prayer(self):
        """POST /api/prayers should accept a prayer request."""
        status, data = api_post('/api/prayers', {
            'name': 'Test Devotee',
            'intention': 'For world peace — unit test'
        })
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))

    def test_post_prayer_missing_intention(self):
        """POST /api/prayers without intention should return 400."""
        status, data = api_post('/api/prayers', {'name': 'Test'})
        self.assertEqual(status, 400)

    def test_post_station_upload(self):
        """POST /api/station-uploads should create an upload."""
        status, data = api_post('/api/station-uploads', {
            'stationId': 'mariyapura',
            'title': 'Unit Test Upload',
            'sisterName': 'Sr. Test',
            'uploadType': 'monthly_report',
            'content': 'Automated test upload.'
        })
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))


class TestAuthenticatedEndpoints(unittest.TestCase):
    """Tests for auth-protected endpoints."""

    def test_get_contact_unauthorized(self):
        """GET /api/contact without auth should return 401."""
        try:
            req = urllib.request.Request(
                f"{BASE_HTTP}/api/contact",
                headers={'User-Agent': 'TestBot'}
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                self.fail("Expected 401 but got 200")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 401)

    def test_get_contact_authorized(self):
        """GET /api/contact with valid auth should return 200."""
        status, data = api_get('/api/contact', auth=True)
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_newsletter_unauthorized(self):
        """GET /api/newsletter without auth should return 401."""
        try:
            req = urllib.request.Request(
                f"{BASE_HTTP}/api/newsletter",
                headers={'User-Agent': 'TestBot'}
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                self.fail("Expected 401 but got 200")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 401)

    def test_get_newsletter_authorized(self):
        """GET /api/newsletter with valid auth should succeed."""
        status, data = api_get('/api/newsletter', auth=True)
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_post_event_unauthorized(self):
        """POST /api/events without auth should return 401."""
        status, data = api_post('/api/events', {
            'title': 'Auth Test Event',
            'date': '2026-12-01'
        })
        self.assertEqual(status, 401)

    def test_post_event_authorized(self):
        """POST /api/events with auth should succeed."""
        status, data = api_post('/api/events', {
            'title': 'Auth Test Event',
            'date': '2026-12-25',
            'time': '10:00',
            'location': 'Test',
            'description': 'Unit test event'
        }, auth=True)
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))

    def test_post_news_unauthorized(self):
        """POST /api/news without auth should return 401."""
        status, data = api_post('/api/news', {
            'title': 'Unauth News',
            'date': '2026-01-01',
            'content': 'Should not work.'
        })
        self.assertEqual(status, 401)

    def test_post_news_authorized(self):
        """POST /api/news with auth should succeed."""
        status, data = api_post('/api/news', {
            'title': 'Auth Test News',
            'date': '2026-09-12',
            'content': 'Unit test news article.'
        }, auth=True)
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))

    def test_post_event_missing_fields(self):
        """POST /api/events without title/date should return 400."""
        status, data = api_post('/api/events', {
            'description': 'Missing title and date'
        }, auth=True)
        self.assertEqual(status, 400)

    def test_post_news_missing_fields(self):
        """POST /api/news without required fields should return 400."""
        status, data = api_post('/api/news', {
            'title': 'Missing content/date'
        }, auth=True)
        self.assertEqual(status, 400)

    def test_db_sync_authorized(self):
        """POST /api/db/sync with auth should succeed."""
        status, data = api_post('/api/db/sync', {}, auth=True)
        self.assertEqual(status, 200)
        self.assertTrue(data.get('success'))

    def test_db_sync_unauthorized(self):
        """POST /api/db/sync without auth should fail."""
        status, data = api_post('/api/db/sync', {})
        self.assertEqual(status, 401)


class TestStaticAssets(unittest.TestCase):
    """Tests for static file serving."""

    def _check_static(self, path, expected_content_type=None):
        """Helper to check a static file is served correctly."""
        req = urllib.request.Request(f"{BASE_HTTP}{path}", headers={'User-Agent': 'TestBot'})
        with urllib.request.urlopen(req, timeout=10) as res:
            self.assertEqual(res.status, 200)
            if expected_content_type:
                ct = res.headers.get('Content-Type', '')
                self.assertIn(expected_content_type, ct)

    def test_index_html(self):
        self._check_static('/index.html', 'text/html')

    def test_admin_html(self):
        self._check_static('/admin.html', 'text/html')

    def test_donate_html(self):
        self._check_static('/donate.html', 'text/html')

    def test_events_html(self):
        self._check_static('/events.html', 'text/html')

    def test_news_html(self):
        self._check_static('/news.html', 'text/html')

    def test_contact_html(self):
        self._check_static('/contact.html', 'text/html')

    def test_prayers_html(self):
        self._check_static('/prayers.html', 'text/html')

    def test_communities_html(self):
        self._check_static('/communities.html', 'text/html')

    def test_community_html(self):
        self._check_static('/community.html', 'text/html')

    def test_map_html(self):
        self._check_static('/map.html', 'text/html')

    def test_media_html(self):
        self._check_static('/media.html', 'text/html')

    def test_memorial_html(self):
        self._check_static('/memorial.html', 'text/html')

    def test_vocations_html(self):
        self._check_static('/vocations.html', 'text/html')

    def test_foundress_html(self):
        self._check_static('/foundress.html', 'text/html')

    def test_privacy_html(self):
        self._check_static('/privacy.html', 'text/html')

    def test_impressum_html(self):
        self._check_static('/impressum.html', 'text/html')

    def test_404_html(self):
        self._check_static('/404.html', 'text/html')

    def test_manifest_json(self):
        self._check_static('/manifest.json', 'application/json')

    def test_service_worker(self):
        self._check_static('/sw.js', 'javascript')

    def test_favicon(self):
        self._check_static('/favicon.svg')

    def test_sitemap_xml(self):
        self._check_static('/sitemap.xml')

    def test_robots_txt(self):
        self._check_static('/robots.txt', 'text/plain')

    def test_css_served(self):
        self._check_static('/css/style.css', 'text/css')

    def test_main_js_served(self):
        self._check_static('/js/main.js', 'javascript')

    def test_communities_json(self):
        self._check_static('/data/communities.json', 'application/json')


class TestCORSPreflight(unittest.TestCase):
    """Tests for OPTIONS/CORS preflight handling."""

    def test_options_request(self):
        """OPTIONS should return 200 with CORS headers."""
        req = urllib.request.Request(
            f"{BASE_HTTP}/api/communities",
            method='OPTIONS',
            headers={'User-Agent': 'TestBot'}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            self.assertEqual(res.status, 200)
            self.assertEqual(res.headers.get('Access-Control-Allow-Origin'), '*')
            methods = res.headers.get('Access-Control-Allow-Methods')
            self.assertIn('GET', methods)
            self.assertIn('POST', methods)


class TestAPIResponseFormat(unittest.TestCase):
    """Tests for API response formatting consistency."""

    def test_json_content_type(self):
        """API responses should have application/json content type."""
        req = urllib.request.Request(
            f"{BASE_HTTP}/api/communities",
            headers={'User-Agent': 'TestBot'}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            ct = res.headers.get('Content-Type')
            self.assertIn('application/json', ct)

    def test_no_cache_headers(self):
        """API responses should have no-cache directives."""
        req = urllib.request.Request(
            f"{BASE_HTTP}/api/db/status",
            headers={'User-Agent': 'TestBot'}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            cc = res.headers.get('Cache-Control')
            self.assertIn('no-cache', cc)

    def test_error_response_format(self):
        """Error responses should be JSON with 'error' key."""
        status, data = api_post('/api/contact', {'name': 'test'})
        self.assertEqual(status, 400)
        self.assertIn('error', data)


if __name__ == '__main__':
    unittest.main(verbosity=2)

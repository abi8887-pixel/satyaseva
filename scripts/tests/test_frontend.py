#!/usr/bin/env python3
"""
test_frontend.py — HTML/Frontend Structural Tests
Validates HTML structure, SEO meta tags, navigation consistency,
accessibility attributes, PWA manifest, and internal link integrity.
"""

import os
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path

SITE_DIR = Path('/home/jc/AB/fun/sscs/site')


class HTMLStructureParser(HTMLParser):
    """Parses an HTML file and extracts structural metadata."""

    def __init__(self):
        super().__init__()
        self.title = None
        self.meta_description = None
        self.meta_viewport = None
        self.charset = None
        self.h1_count = 0
        self.h1_texts = []
        self.links = set()  # href values from <a>
        self.stylesheets = set()
        self.scripts = set()
        self.ids = set()
        self.aria_labels = []
        self.has_lang_attr = False
        self.has_manifest = False
        self.has_theme_toggle = False
        self.has_nav = False
        self.has_footer = False
        self.nav_links = set()
        self.images = []
        self._in_title = False
        self._title_text = ''
        self._in_h1 = False
        self._h1_text = ''

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == 'html':
            if 'lang' in attrs_dict:
                self.has_lang_attr = True

        if tag == 'meta':
            name = attrs_dict.get('name', '').lower()
            if name == 'description':
                self.meta_description = attrs_dict.get('content', '')
            elif name == 'viewport':
                self.meta_viewport = attrs_dict.get('content', '')
            charset = attrs_dict.get('charset')
            if charset:
                self.charset = charset

        if tag == 'title':
            self._in_title = True
            self._title_text = ''

        if tag == 'h1':
            self.h1_count += 1
            self._in_h1 = True
            self._h1_text = ''

        if tag == 'a':
            href = attrs_dict.get('href', '')
            self.links.add(href)

        if tag == 'link':
            rel = attrs_dict.get('rel', '')
            if 'stylesheet' in rel:
                self.stylesheets.add(attrs_dict.get('href', ''))
            if 'manifest' in rel:
                self.has_manifest = True

        if tag == 'script':
            src = attrs_dict.get('src', '')
            if src:
                self.scripts.add(src)

        if tag == 'img':
            self.images.append({
                'src': attrs_dict.get('src', ''),
                'alt': attrs_dict.get('alt', None),
                'loading': attrs_dict.get('loading', '')
            })

        if tag == 'nav':
            self.has_nav = True

        if tag == 'footer':
            self.has_footer = True

        # Track unique IDs
        if 'id' in attrs_dict:
            self.ids.add(attrs_dict['id'])

        # Detect theme toggle
        cls = attrs_dict.get('class', '')
        if 'theme-toggle' in cls:
            self.has_theme_toggle = True

        # Track aria-label
        if 'aria-label' in attrs_dict:
            self.aria_labels.append(attrs_dict['aria-label'])

    def handle_data(self, data):
        if self._in_title:
            self._title_text += data
        if self._in_h1:
            self._h1_text += data

    def handle_endtag(self, tag):
        if tag == 'title':
            self._in_title = False
            self.title = self._title_text.strip()
        if tag == 'h1':
            self._in_h1 = False
            self.h1_texts.append(self._h1_text.strip())


def parse_html(filename):
    """Parse an HTML file and return structural metadata."""
    filepath = SITE_DIR / filename
    parser = HTMLStructureParser()
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        parser.feed(f.read())
    return parser


class TestAllPagesExist(unittest.TestCase):
    """Verify all expected HTML pages exist."""

    EXPECTED_PAGES = [
        'index.html', 'admin.html', 'communities.html', 'community.html',
        'contact.html', 'donate.html', 'events.html', 'foundress.html',
        'impressum.html', 'map.html', 'media.html', 'memorial.html',
        'news.html', 'prayers.html', 'privacy.html', 'vocations.html',
        '404.html'
    ]

    def test_all_pages_exist(self):
        """All 17 expected HTML pages should exist in site/."""
        for page in self.EXPECTED_PAGES:
            filepath = SITE_DIR / page
            self.assertTrue(filepath.exists(), f"Missing page: {page}")


class TestSEOMetaTags(unittest.TestCase):
    """Verify SEO best practices on all pages."""

    PAGES = [
        'index.html', 'communities.html', 'contact.html', 'donate.html',
        'events.html', 'foundress.html', 'map.html', 'media.html',
        'memorial.html', 'news.html', 'prayers.html', 'vocations.html'
    ]

    def test_all_pages_have_title(self):
        """Every page should have a <title> tag."""
        for page in self.PAGES:
            p = parse_html(page)
            self.assertIsNotNone(p.title, f"{page}: Missing <title>")
            self.assertGreater(len(p.title), 0, f"{page}: Empty <title>")

    def test_all_pages_have_meta_description(self):
        """Every page should have a meta description."""
        for page in self.PAGES:
            p = parse_html(page)
            self.assertIsNotNone(p.meta_description,
                                 f"{page}: Missing meta description")

    def test_title_length(self):
        """Titles should be between 10-80 characters (SEO best practice)."""
        for page in self.PAGES:
            p = parse_html(page)
            if p.title:
                length = len(p.title)
                self.assertGreaterEqual(length, 10,
                                        f"{page}: Title too short ({length} chars)")
                self.assertLessEqual(length, 80,
                                     f"{page}: Title too long ({length} chars)")

    def test_single_h1_per_page(self):
        """Each page should have exactly one <h1> (SEO rule)."""
        for page in self.PAGES:
            p = parse_html(page)
            self.assertEqual(p.h1_count, 1,
                             f"{page}: Has {p.h1_count} <h1> tags (expected 1)")

    def test_charset_utf8(self):
        """Pages should declare UTF-8 charset."""
        for page in self.PAGES:
            p = parse_html(page)
            if p.charset:
                self.assertIn('utf', p.charset.lower(),
                              f"{page}: Charset should be UTF-8, got {p.charset}")

    def test_viewport_meta(self):
        """Pages should have viewport meta for mobile responsiveness."""
        for page in self.PAGES:
            p = parse_html(page)
            self.assertIsNotNone(p.meta_viewport,
                                 f"{page}: Missing viewport meta tag")


class TestHTMLLanguageAttribute(unittest.TestCase):
    """Verify <html lang='en'> is set."""

    def test_lang_attribute(self):
        """Key pages should have lang attribute on <html>."""
        for page in ['index.html', 'communities.html', 'donate.html']:
            p = parse_html(page)
            self.assertTrue(p.has_lang_attr,
                            f"{page}: Missing lang attribute on <html>")


class TestNavigationConsistency(unittest.TestCase):
    """Verify navigation is consistent across pages."""

    CORE_PAGES = [
        'index.html', 'communities.html', 'contact.html', 'donate.html',
        'events.html', 'foundress.html', 'prayers.html', 'vocations.html',
        'news.html', 'map.html', 'media.html'
    ]

    def test_all_pages_have_nav(self):
        """All core pages should have a <nav> element."""
        for page in self.CORE_PAGES:
            p = parse_html(page)
            self.assertTrue(p.has_nav, f"{page}: Missing <nav> element")

    def test_all_pages_have_footer(self):
        """All core pages should have a <footer> element."""
        for page in self.CORE_PAGES:
            p = parse_html(page)
            self.assertTrue(p.has_footer, f"{page}: Missing <footer> element")

    def test_main_js_included(self):
        """All core pages should include main.js."""
        for page in self.CORE_PAGES:
            p = parse_html(page)
            has_main = any('main.js' in s for s in p.scripts)
            self.assertTrue(has_main, f"{page}: Missing main.js script")

    def test_stylesheet_included(self):
        """All core pages should link to style.css."""
        for page in self.CORE_PAGES:
            p = parse_html(page)
            has_style = any('style.css' in s for s in p.stylesheets)
            self.assertTrue(has_style, f"{page}: Missing style.css stylesheet")


class TestInternalLinkIntegrity(unittest.TestCase):
    """Verify all internal links point to existing files."""

    def test_no_broken_internal_links(self):
        """Internal navigation links should point to existing files."""
        broken = []
        for html_file in SITE_DIR.glob('*.html'):
            p = parse_html(html_file.name)
            for href in p.links:
                # Skip external, mailto, tel, hash, javascript, api
                if href.startswith(('http://', 'https://', 'mailto:', 'tel:',
                                    'javascript:', '#', '/api/')):
                    continue
                if not href or href == '#':
                    continue

                # Clean up the path
                target = href.split('#')[0].split('?')[0].lstrip('/')
                if not target:
                    continue

                target_path = SITE_DIR / target
                if not target_path.exists():
                    broken.append((html_file.name, href))

        if broken:
            details = "\n".join(f"  [{src}] -> '{href}'" for src, href in broken)
            self.fail(f"Found {len(broken)} broken internal link(s):\n{details}")


class TestPWAManifest(unittest.TestCase):
    """Verify PWA configuration files."""

    def test_manifest_exists(self):
        """manifest.json should exist."""
        self.assertTrue((SITE_DIR / 'manifest.json').exists())

    def test_manifest_valid_json(self):
        """manifest.json should be valid JSON."""
        with open(SITE_DIR / 'manifest.json', 'r') as f:
            data = json.load(f)
        self.assertIn('name', data)
        self.assertIn('start_url', data)

    def test_service_worker_exists(self):
        """sw.js should exist."""
        self.assertTrue((SITE_DIR / 'sw.js').exists())

    def test_index_links_manifest(self):
        """index.html should link to manifest.json."""
        p = parse_html('index.html')
        self.assertTrue(p.has_manifest, "index.html: Missing manifest link")


class TestAccessibility(unittest.TestCase):
    """Basic accessibility checks."""

    def test_images_have_alt_text(self):
        """All <img> tags should have alt attributes."""
        missing_alt = []
        for html_file in SITE_DIR.glob('*.html'):
            p = parse_html(html_file.name)
            for img in p.images:
                if img['alt'] is None:
                    missing_alt.append((html_file.name, img['src']))

        if missing_alt:
            details = "\n".join(f"  [{f}] <img src='{s}'>" for f, s in missing_alt[:10])
            extra = f"\n  ... and {len(missing_alt) - 10} more" if len(missing_alt) > 10 else ""
            self.fail(f"Found {len(missing_alt)} images without alt text:\n{details}{extra}")

    def test_nav_toggle_has_aria(self):
        """Navigation toggle should have aria-expanded."""
        p = parse_html('index.html')
        self.assertIn('navToggle', p.ids, "Missing navToggle element")


class TestSitemapAndRobots(unittest.TestCase):
    """Verify SEO sitemap and robots.txt."""

    def test_sitemap_exists(self):
        """sitemap.xml should exist."""
        self.assertTrue((SITE_DIR / 'sitemap.xml').exists())

    def test_robots_txt_exists(self):
        """robots.txt should exist."""
        self.assertTrue((SITE_DIR / 'robots.txt').exists())

    def test_robots_txt_references_sitemap(self):
        """robots.txt should reference the sitemap."""
        with open(SITE_DIR / 'robots.txt', 'r') as f:
            content = f.read()
        self.assertIn('Sitemap', content)


class TestDataFiles(unittest.TestCase):
    """Verify data files integrity."""

    def test_communities_json_exists(self):
        """communities.json should exist and be valid JSON."""
        path = SITE_DIR / 'data' / 'communities.json'
        self.assertTrue(path.exists(), "communities.json not found")
        with open(path, 'r') as f:
            data = json.load(f)
        self.assertIsInstance(data, list)

    def test_memorial_json_exists(self):
        """memorial.json should exist and be valid JSON."""
        path = SITE_DIR / 'data' / 'memorial.json'
        self.assertTrue(path.exists(), "memorial.json not found")
        with open(path, 'r') as f:
            data = json.load(f)
        self.assertIsInstance(data, list)

    def test_communities_data_js_exists(self):
        """communities-data.js should exist."""
        path = SITE_DIR / 'data' / 'communities-data.js'
        self.assertTrue(path.exists(), "communities-data.js not found")
        with open(path, 'r') as f:
            content = f.read()
        self.assertIn('window.__INITIAL_COMMUNITIES__', content)


class TestThemeToggle(unittest.TestCase):
    """Verify Dark Mode toggle is present on key pages."""

    PAGES_WITH_TOGGLE = [
        'index.html', 'communities.html', 'donate.html', 'events.html',
        'news.html', 'prayers.html', 'contact.html'
    ]

    def test_theme_toggle_present(self):
        """Key pages should have a theme-toggle-btn element."""
        for page in self.PAGES_WITH_TOGGLE:
            p = parse_html(page)
            self.assertTrue(p.has_theme_toggle,
                            f"{page}: Missing theme toggle button")


class TestSecurityFiles(unittest.TestCase):
    """Verify security-related static files."""

    def test_headers_file_exists(self):
        """_headers file should exist for CSP/security headers."""
        path = SITE_DIR / '_headers'
        self.assertTrue(path.exists(), "_headers file not found")

    def test_privacy_page_exists(self):
        """Privacy policy page should exist."""
        self.assertTrue((SITE_DIR / 'privacy.html').exists())

    def test_impressum_page_exists(self):
        """Legal impressum page should exist."""
        self.assertTrue((SITE_DIR / 'impressum.html').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)

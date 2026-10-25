#!/usr/bin/env python3
"""
stamp.py — Uniform Header & Footer Stamper for Satyaseva Sisters Website
Reads canonical templates from scripts/templates/header.html and scripts/templates/footer.html
and stamps them across public pages in site/ (and root index.html).
"""

import os
import re
import pathlib

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
SITE_DIR = REPO_ROOT / 'site'
TEMPLATES_DIR = SCRIPT_DIR / 'templates'

HEADER_TMPL = (TEMPLATES_DIR / 'header.html').read_text(encoding='utf-8').strip()
FOOTER_TMPL = (TEMPLATES_DIR / 'footer.html').read_text(encoding='utf-8').strip()

# Regex to match main nav header
NAV_RE = re.compile(
    r'(?:<nav\b[^>]*?(?:id=[\'"]nav[\'"]|class=[\'"][^\'"]*nav-header)[^>]*>[\s\S]*?</nav>|<header\s+class=[\'"]nav-header[\'"][\s\S]*?</header>)',
    re.IGNORECASE
)

# Regex to match main footer
FOOTER_RE = re.compile(r'<footer[\s\S]*?</footer>', re.IGNORECASE)

# Skip files that should not have standard nav stamped
SKIP_FILES = {'admin.html'}

def stamp_file(file_path: pathlib.Path, is_root: bool = False):
    text = file_path.read_text(encoding='utf-8')
    page_name = file_path.name
    
    # 1. Prepare stamped header with aria-current="page" and active class
    stamped_header = HEADER_TMPL
    
    # Match the active page in nav links container only (avoid touching brand link)
    def mark_active(match):
        links_block = match.group(0)
        target = f'href="{page_name}"'
        if page_name == 'community.html':
            target = 'href="communities.html"'
        return links_block.replace(target, f'{target} class="active" aria-current="page"', 1)

    stamped_header = re.sub(r'<div class="nav-links"[\s\S]*?</div>', mark_active, stamped_header)
        
    # If stamping root index.html, paths might need site/ prefix
    if is_root:
        # Prefix non-index links with site/ for root index.html
        for p in ['communities.html', 'map.html', 'foundress.html', 'memorial.html', 'events.html', 'news.html', 'media.html', 'vocations.html', 'prayers.html', 'donate.html', 'contact.html', 'privacy.html', 'impressum.html']:
            stamped_header = stamped_header.replace(f'href="{p}"', f'href="site/{p}"')
    
    new_text = text
    
    # 2. Replace Nav (except community.html which has custom back-link nav if desired, but user wants unified nav)
    # If community.html has back-link, we can either keep or replace. Let's replace for consistency unless specified.
    if NAV_RE.search(new_text):
        new_text = NAV_RE.sub(stamped_header, new_text, count=1)
    
    # 3. Replace Footer
    stamped_footer = FOOTER_TMPL
    if is_root:
        for p in ['communities.html', 'map.html', 'foundress.html', 'memorial.html', 'events.html', 'news.html', 'media.html', 'vocations.html', 'prayers.html', 'donate.html', 'contact.html', 'privacy.html', 'impressum.html']:
            stamped_footer = stamped_footer.replace(f'href="{p}"', f'href="site/{p}"')
            
    if FOOTER_RE.search(new_text):
        new_text = FOOTER_RE.sub(stamped_footer, new_text, count=1)
        
    if new_text != text:
        file_path.write_text(new_text, encoding='utf-8')
        print(f"  ✓ Stamped: {file_path.name}")
    else:
        print(f"  · No change: {file_path.name}")

def main():
    print("=== SSCS Uniform Navigation & Footer Stamper ===")
    
    # Process site/*.html
    for html_file in sorted(SITE_DIR.glob('*.html')):
        if html_file.name in SKIP_FILES:
            print(f"  - Skipped: {html_file.name}")
            continue
        stamp_file(html_file, is_root=False)
        
    # Also stamp root index.html
    root_index = REPO_ROOT / 'index.html'
    if root_index.exists():
        stamp_file(root_index, is_root=True)

    print("=== Stamping Complete ===")

if __name__ == '__main__':
    main()

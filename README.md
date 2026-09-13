# Satyaseva Catechist Sisters — Research Archive

A small, static, source-verified website about the Satyaseva Catechist Sisters of the
Families, an indigenous Indian Catholic congregation. Built to be free to host, secure by
default, and easy for someone else to pick up and maintain.

**This is an independent, unofficial research archive — not published by the congregation.**

## What's here

```
scs_site/
├── site/                     ← THE DELIVERABLE. Deploy this folder as-is.
│   ├── index.html
│   ├── founder.html
│   ├── history.html
│   ├── charism-ministries.html
│   ├── communities.html
│   ├── foster-care.html
│   ├── sources.html
│   ├── about-this-site.html
│   ├── 404.html
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── _headers              ← security headers for Netlify / Cloudflare Pages
│   ├── netlify.toml          ← optional Netlify config (headers + 404 routing)
│   ├── assets/
│   │   ├── css/style.css     ← the entire design system, one file
│   │   └── js/main.js        ← ~15 lines: mobile nav toggle, nothing else
│   └── docs/
│       ├── CONTENT-SOURCES.md
│       ├── DEPLOYMENT.md
│       └── MAINTENANCE.md
├── scripts/
│   └── generate.py           ← regenerates site/*.html from the content defined inside it
└── README.md                 ← you are here
```

## Design decisions, briefly

- **Plain HTML/CSS/JS, zero dependencies.** No framework, no npm install, no build step
  required to *serve* the site. `scripts/generate.py` is a convenience for editing content
  consistently across pages — it is not needed to host or run the site.
- **No external requests at all.** No Google Fonts, no CDNs, no analytics, no tracking, no
  cookies. Fonts are system font stacks. This minimizes attack surface, works offline once
  cached, and means nothing about a visitor is ever sent to a third party.
- **Every factual claim is source-tagged.** Small `[code]` badges next to claims expand
  (native `<details>`, no JavaScript needed) to show the exact source. See
  `docs/CONTENT-SOURCES.md` for the full registry.
- **Security is designed in, not bolted on.** Strict Content-Security-Policy on every page
  (via `<meta>`, which works on any static host), plus a `_headers`/`netlify.toml` pair for
  hosts that support real HTTP response headers. See `docs/DEPLOYMENT.md`.

## Quick start (for a future maintainer)

**To view the site locally**, just open `site/index.html` in a browser, or serve the folder:

```bash
cd site
python3 -m http.server 8000
# visit http://localhost:8000
```

**To edit content**, edit `scripts/generate.py` (the `SOURCES` dict and the `build_*()`
functions), then regenerate:

```bash
python3 scripts/generate.py
```

**To add community photos (for Sisters & Maintainers)**:
Each community has a dedicated folder under `site/images/communities/<community_id>/`:
1. Drop photos (`.jpg`, `.jpeg`, `.png`, `.webp`) directly into the community folder.
2. (Optional) Name any photo `hero.jpg` to set it as the main header banner for that community.
3. Run the auto-synchronizer:
   ```bash
   python3 scripts/sync_images.py
   ```
   Or leave the real-time watcher running in the background:
   ```bash
   python3 scripts/watch_images.py
   ```
   Or run the local site server with browser-based photo upload:
   ```bash
   python3 scripts/serve.py
   ```
   The website updates automatically without editing any HTML, JavaScript, or JSON!

**To add a new page**, add a `("filename.html", "Nav Label")` tuple to the `NAV` list, write
a `build_yourpage()` function following the existing pattern, call it from `__main__`, and
add the filename to `site/sitemap.xml`.

## License / reuse

The code (HTML/CSS/JS/Python) here may be reused freely. The written content is a compiled,
paraphrased summary of publicly available third-party sources — see
`site/docs/CONTENT-SOURCES.md` before reusing prose elsewhere, and verify anything
load-bearing against the original sources directly.

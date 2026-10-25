/* ================================================================
   main.js — Satyaseva Sisters site
   Handles: sky rays, nav scroll, vine SVG, scroll-linked growth,
            scroll-reveal, mobile nav toggle, language switching
   ================================================================ */
(function(){
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Ambient sky rays ─────────────────────────────────────────── */
  var sky = document.getElementById('sky');
  if (sky) {
    var beamAngles = [-22,-11,0,11,22];
    beamAngles.forEach(function(a, i){
      var r = document.createElement('div');
      r.className = 'ray';
      r.style.left = (46 + i*2) + '%';
      r.style.transform = 'rotate(' + a + 'deg)';
      r.style.animation = reduced ? 'none' : 'none';
      sky.appendChild(r);
    });
  }

  /* ── Navbar scroll state ──────────────────────────────────────── */
  var nav = document.getElementById('nav');
  if (nav) {
    function onNavScroll(){ nav.classList.toggle('scrolled', window.scrollY > 20); }
    window.addEventListener('scroll', onNavScroll, {passive:true});
    onNavScroll();
  }

  /* ── Mobile hamburger toggle ──────────────────────────────────── */
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function(){
      var open = navLinks.classList.toggle('open');
      navToggle.classList.toggle('active', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Close mobile nav when any link is clicked
    navLinks.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', function(){
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Navbar collapse/expand toggle ('^' / 'v') ─────────────────── */
  var navCollapse = document.getElementById('navCollapse');
  if (nav && navCollapse) {
    navCollapse.addEventListener('click', function(e){
      e.stopPropagation();
      var isCollapsed = nav.classList.toggle('nav-collapsed');
      navCollapse.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      navCollapse.setAttribute('title', isCollapsed ? 'Expand navigation' : 'Collapse navigation');
      try { sessionStorage.setItem('sscs-nav-collapsed', isCollapsed ? '1' : '0'); } catch(err){}
    });
    // Restore collapsed preference in session if desired
    try {
      if (sessionStorage.getItem('sscs-nav-collapsed') === '1') {
        nav.classList.add('nav-collapsed');
        navCollapse.setAttribute('aria-expanded', 'false');
        navCollapse.setAttribute('title', 'Expand navigation');
      }
    } catch(err){}
  }

  /* ── Language switching ───────────────────────────────────────── */
  var langSelect = document.getElementById('lang-select');
  if (langSelect) {
    // Detect language from URL params or localStorage
    var params = new URLSearchParams(window.location.search);
    var savedLang = params.get('lang') || localStorage.getItem('sscs-lang') || 'en';
    langSelect.value = savedLang;
    document.documentElement.lang = savedLang;

    langSelect.addEventListener('change', function(){
      var lang = this.value;
      localStorage.setItem('sscs-lang', lang);
      document.documentElement.lang = lang;
      // Update URL without reload for bookmarkability
      var url = new URL(window.location);
      if (lang === 'en') {
        url.searchParams.delete('lang');
      } else {
        url.searchParams.set('lang', lang);
      }
      window.history.replaceState({}, '', url);
      applyTranslations(lang);
    });

    // Apply on load if not English
    if (savedLang !== 'en') {
      applyTranslations(savedLang);
    }
  }

  /* Translation data — Polish */
  var translations = {
    pl: {
      'Our Story': 'Nasza Historia',
      'Vision & Mission': 'Wizja i Misja',
      'Ministries': 'Posługi',
      'Gallery': 'Galeria',
      'Prayers': 'Modlitwy',
      'Communities': 'Wspólnoty',
      'Connect With Us': 'Skontaktuj się',
      'Home': 'Strona Główna',
      'Our Foundress': 'Nasza Założycielka',
      'Map': 'Mapa',
      'Events': 'Wydarzenia',
      'News': 'Aktualności',
      'Vocations': 'Powołania',
      'Donate': 'Wesprzyj',
      'Contact': 'Kontakt',
      'In Memoriam': 'In Memoriam',
      'Privacy Policy': 'Polityka Prywatności',
      'Impressum': 'Impressum',
      'Accept All': 'Akceptuj Wszystko',
      'Essential Only': 'Tylko Niezbędne',
      'Years of Mission': 'Lata Misji',
      'Global Communities': 'Wspólnoty na Świecie',
      'Families Served': 'Rodziny Wsparcia',
      'Children Supported': 'Dzieci pod Opieką',
      'Subscribe': 'Subskrybuj',
      'Send Message': 'Wyślij Wiadomość',
      'Submit Prayer Request': 'Prześlij Intencję',
      'Stay Connected': 'Bądźmy w Kontakcie',
      'How we serve': 'Jak Służymy',
      'Pray with us': 'Módl się z Nami',
      'Why This Matters Now': 'Dlaczego to Ma Znaczenie',
      'Faith carried home': 'Wiara Przyniesiona do Domu',
      'Read Mother Regina\'s Biography': 'Przeczytaj Biografię Matki Reginy',
      'Chat with Us': 'Napisz do Nas'
    }
  };

  function applyTranslations(lang) {
    var isEn = (lang === 'en');
    if (!isEn && !translations[lang]) return;
    var dict = isEn ? null : translations[lang];

    // Translate nav links, footer links, buttons, eyebrows, and i18n data elements
    var selectors = '.nav-links a, .footer-links a, .nav-cta, .nav-donate, .btn, .eyebrow, .impact-label, button[type="submit"], [data-i18n]';
    document.querySelectorAll(selectors).forEach(function(el){
      var origText = el.getAttribute('data-orig-text');
      if (!origText) {
        origText = el.getAttribute('data-i18n') || el.textContent.trim();
        el.setAttribute('data-orig-text', origText);
      }

      var targetText = isEn ? origText : (dict[origText] || origText);

      if (el.children.length === 0) {
        el.textContent = targetText;
      } else {
        // If the element has children (like an SVG icon inside a button), replace matching text node
        Array.from(el.childNodes).forEach(function(node) {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
            node.nodeValue = targetText;
          }
        });
      }
    });
  }


  /* ── Reveal on scroll (content) ───────────────────────────────── */
  function initScrollReveal() {
    if (reduced) {
      document.querySelectorAll('.reveal').forEach(function(el) {
        el.classList.add('visible');
      });
      return;
    }
    var revealTargets = document.querySelectorAll('.reveal:not(.visible)');
    if (!revealTargets.length) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
      revealTargets.forEach(function(t) { io.observe(t); });
    } else {
      revealTargets.forEach(function(t) { t.classList.add('visible'); });
    }
  }

  /* ── Active Nav Link Highlighter ────────────────────────────── */
  function initActiveNav() {
    var rawPath = window.location.pathname.split('/').pop() || 'index.html';
    var currentPath = rawPath.split('?')[0].split('#')[0] || 'index.html';
    if (currentPath === '' || currentPath === '/') currentPath = 'index.html';

    var navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var linkPath = href.split('/').pop().split('?')[0].split('#')[0];
      var isCurrent = (linkPath === currentPath) ||
                      (currentPath === 'index.html' && (linkPath === '' || href === '#main-content' || linkPath === 'index.html')) ||
                      (currentPath === 'community.html' && linkPath === 'communities.html');

      if (isCurrent) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  /* ── Service Worker Registration + Update Notification (PWA) ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').then(function(reg) {
        console.log('Satyaseva PWA Service Worker registered:', reg.scope);

        // Check for updates periodically
        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — show update toast
              showUpdateToast(reg);
            }
          });
        });
      }).catch(function(err) {
        console.warn('Satyaseva PWA Service Worker registration failed:', err);
      });
    });
  }

  function showUpdateToast(reg) {
    if (document.getElementById('sscs-update-toast')) return;
    var toast = document.createElement('div');
    toast.id = 'sscs-update-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%) translateY(80px)',
      'z-index:9999', 'background:var(--ink,#1e293b)', 'color:var(--card,#fff)',
      'padding:12px 24px', 'font-size:13px', 'font-weight:600',
      'font-family:var(--font-sans,sans-serif)',
      'border-radius:999px', 'box-shadow:0 8px 32px rgba(0,0,0,0.3)',
      'display:flex', 'align-items:center', 'gap:12px',
      'transition:transform 0.4s cubic-bezier(0.16,1,0.3,1)',
      'max-width:90vw'
    ].join(';');
    toast.innerHTML = '<span>✨ New content available</span>' +
      '<button id="sscs-update-btn" style="background:var(--gold,#d97706);color:#fff;border:none;padding:6px 16px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Refresh</button>' +
      '<button id="sscs-update-dismiss" style="background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:16px;padding:0 4px;" aria-label="Dismiss">✕</button>';

    document.body.appendChild(toast);
    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });
    });

    document.getElementById('sscs-update-btn').addEventListener('click', function() {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    });
    document.getElementById('sscs-update-dismiss').addEventListener('click', function() {
      toast.style.transform = 'translateX(-50%) translateY(80px)';
      setTimeout(function() { toast.remove(); }, 400);
    });
  }


  /* ── GDPR Cookie Consent Banner ──────────────────────────────── */
  function initCookieConsent() {
    var consent = localStorage.getItem('sscs-cookie-consent');
    if (consent) return; // User already interacted

    var banner = document.createElement('div');
    banner.id = 'sscs-cookie-banner';
    banner.className = 'cookie-banner-overlay';
    banner.innerHTML = [
      '<div class="cookie-banner-content">',
      '  <div class="cookie-text">',
      '    <span>🍪</span>',
      '    <p><strong>We value your privacy.</strong> We use essential cookies to ensure our portal operates securely and smoothly. Read our <a href="privacy.html">Privacy Policy</a> to learn more.</p>',
      '  </div>',
      '  <div class="cookie-actions">',
      '    <button type="button" id="cookie-accept" class="btn btn-primary btn-sm">Accept All</button>',
      '    <button type="button" id="cookie-essential" class="btn btn-outline btn-sm">Essential Only</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(banner);

    var acceptBtn = document.getElementById('cookie-accept');
    var essentialBtn = document.getElementById('cookie-essential');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function() {
        localStorage.setItem('sscs-cookie-consent', 'all');
        banner.remove();
      });
    }

    if (essentialBtn) {
      essentialBtn.addEventListener('click', function() {
        localStorage.setItem('sscs-cookie-consent', 'essential');
        banner.remove();
      });
    }
  }

  /* ── Universal Dark Mode Toggle ──────────────────────────────── */
  function initTheme() {
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      if (document.documentElement.style) {
        document.documentElement.style.colorScheme = theme;
      }
      updateThemeButtons(theme);
    }

    function updateThemeButtons(theme) {
      document.querySelectorAll('.theme-toggle-btn').forEach(function(btn) {
        btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      });
    }

    var savedTheme = localStorage.getItem('sscs-theme');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var currentTheme = savedTheme || (systemDark ? 'dark' : 'light');

    applyTheme(currentTheme);

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.theme-toggle-btn');
      if (!btn) return;
      var activeTheme = document.documentElement.getAttribute('data-theme');
      var newTheme = (activeTheme === 'dark') ? 'light' : 'dark';
      applyTheme(newTheme);
      try {
        localStorage.setItem('sscs-theme', newTheme);
      } catch (err) {}
    });

    if (window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
          if (!localStorage.getItem('sscs-theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
          }
        });
      } catch (err) {}
    }
  }

  /* ── Animated Impact Statistics Counter ───────────────────────── */
  function initCounters() {
    var counters = document.querySelectorAll('.counter-animate');
    if (!counters.length) return;

    function animate(el) {
      var target = parseInt(el.getAttribute('data-target'), 10) || 0;
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var duration = 1800; // ms
      var startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        // Easing out cubic
        var easeOut = 1 - Math.pow(1 - progress, 3);
        var current = Math.floor(easeOut * target);
        el.textContent = prefix + current.toLocaleString() + suffix;
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          el.textContent = prefix + target.toLocaleString() + suffix;
        }
      }

      window.requestAnimationFrame(step);
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });

      counters.forEach(function(c) { observer.observe(c); });
    } else {
      counters.forEach(function(c) { animate(c); });
    }
  }

  /* ── Back to Top Floating Arrow Button ───────────────────────────── */
  function initBackToTop() {
    var btn = document.getElementById('back-to-top');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'back-to-top';
      btn.className = 'back-to-top-btn';
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', 'Back to top of page');
      btn.setAttribute('title', 'Back to top');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>';
      document.body.appendChild(btn);
    }

    function toggleBtn() {
      if (window.scrollY > 280) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', toggleBtn, { passive: true });
    toggleBtn();

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initApp() {
    initCookieConsent();
    initTheme();
    initActiveNav();
    initScrollReveal();
    initCounters();
    initBackToTop();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();



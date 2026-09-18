/* ================================================================
   gallery.js — Rotating gallery tiles + shared fullscreen lightbox
   Satyaseva Catechist Sisters of the Families
   ================================================================
   Features:
   - Rotating homepage gallery tiles with staggered crossfade
   - Full-screen lightbox with prev/next navigation
   - Keyboard support: ←/→ arrows, Escape to close
   - Touch swipe support for mobile
   - Image counter badge (1 / N)
   - Shared API: window.SatyasevaLightbox.open(images, startIndex)
   ================================================================ */
(function(){
  'use strict';

  /* ── Gallery image pool ──────────────────────────────────────── */
  var galleryImages = [
    "assets/images/20260718_111236_0000.png",
    "assets/images/20260801_210357_0000.png",
    "assets/images/20260802_162938_0000.png",
    "assets/images/ChatGPT Image Aug 1, 2026, 08_52_48 PM.png",
    "assets/images/ChatGPT Image Aug 1, 2026, 08_52_53 PM.png",
    "assets/images/ChatGPT Image Aug 1, 2026, 11_52_19 PM.png",
    "assets/images/ChatGPT Image Aug 1, 2026, 11_52_23 PM.png",
    "assets/images/ChatGPT Image Aug 2, 2026, 04_33_40 PM.png",
    "assets/images/ChatGPT Image Aug 2, 2026, 04_46_52 PM.png",
    "assets/images/ChatGPT Image Aug 2, 2026, 04_52_43 PM.png",
    "assets/images/ChatGPT Image Aug 2, 2026, 05_59_02 PM.png",
    "assets/images/ChatGPT Image Aug 2, 2026, 06_30_56 PM.png",
    "assets/images/ChatGPT Image Jul 16, 2026, 06_02_46 PM.png",
    "assets/images/ChatGPT Image Jul 18, 2026, 08_33_22 AM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 01_36_22 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 02_40_18 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 03_11_40 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 03_12_25 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 03_13_14 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 03_13_26 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 03_14_19 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 05_26_24 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 05_51_32 PM.png",
    "assets/images/ChatGPT Image Jul 20, 2026, 05_52_24 PM.png",
    "assets/images/ChatGPT Image Jul 21, 2026, 04_00_46 PM.png",
    "assets/images/ChatGPT Image Jul 21, 2026, 07_07_31 AM.png",
    "assets/images/ChatGPT Image Jul 21, 2026, 07_10_07 AM.png",
    "assets/images/ChatGPT Image Jul 21, 2026, 07_28_51 AM.png",
    "assets/images/ChatGPT Image Jul 21, 2026, 12_02_14 PM.png",
    "assets/images/ChatGPT Image Jul 21, 2026, 12_11_51 PM.png",
    "assets/images/ChatGPT Image Jul 26, 2026, 02_07_17 PM.png",
    "assets/images/ChatGPT Image Jul 26, 2026, 02_14_23 PM.png",
    "assets/images/ChatGPT Image Jul 26, 2026, 03_18_18 PM.png",
    "assets/images/ChatGPT Image Jul 26, 2026, 08_38_19 PM.png",
    "assets/images/ChatGPT Image Jul 27, 2026, 10_46_22 PM.png",
    "assets/images/ChatGPT Image Jul 27, 2026, 11_27_50 PM.png",
    "assets/images/ChatGPT Image Jul 27, 2026, 11_43_46 PM.png",
    "assets/images/ChatGPT Image Jul 27, 2026, 11_46_18 AM.png",
    "assets/images/ChatGPT Image Jul 28, 2026, 06_29_18 AM.png",
    "assets/images/ChatGPT Image Jul 28, 2026, 07_07_20 AM.png",
    "assets/images/FrankfurtCommunity.png",
    "assets/images/Index_20260802_190209_0000.png",
    "assets/images/Marianiketan_20260727_114012_0000.png",
    "assets/images/c9dcefc0-1115-4be0-ad25-e162fb4d9a8f.png"
  ];

  /* ── Utility helpers ─────────────────────────────────────────── */
  function toCssUrl(src) {
    if (!src) return '';
    return 'url("' + encodeURI(src).replace(/\(/g, '%28').replace(/\)/g, '%29') + '")';
  }

  function preloadBatch(images) {
    images.forEach(function(src) { var img = new Image(); img.src = src; });
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var pool = [];
  function getNextImages(count) {
    if (pool.length < count) pool = pool.concat(shuffleArray(galleryImages));
    return pool.splice(0, count);
  }

  /* ── Rotating tile crossfade ─────────────────────────────────── */
  function updateTiles() {
    var genericTiles = Array.from(document.querySelectorAll('.grid-gallery .tile:not(.static-bg)'));
    if (!genericTiles.length || !galleryImages.length) return;

    var nextBatch = getNextImages(genericTiles.length);
    preloadBatch(nextBatch);

    genericTiles.forEach(function(tile, idx) {
      var nextImg = nextBatch[idx % nextBatch.length];
      var delay = idx * 180;
      setTimeout(function() {
        tile.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        tile.style.opacity = '0';
        setTimeout(function() {
          tile.dataset.currentImg = nextImg;
          tile.style.backgroundImage = toCssUrl(nextImg);
          tile.style.backgroundSize = 'cover';
          tile.style.backgroundPosition = 'center';
          tile.style.opacity = '1';
        }, 550);
      }, delay);
    });

    if (pool.length < genericTiles.length) pool = pool.concat(shuffleArray(galleryImages));
    preloadBatch(pool.slice(0, genericTiles.length));
  }

  /* ══════════════════════════════════════════════════════════════
     SHARED LIGHTBOX — window.SatyasevaLightbox
     ══════════════════════════════════════════════════════════════ */
  var lightbox = {
    _el: null,
    _img: null,
    _counter: null,
    _prev: null,
    _next: null,
    _images: [],
    _index: 0,
    _touchStartX: 0,
    _touchStartY: 0,
    _swiping: false,

    /** Create lightbox DOM (once) */
    _build: function() {
      if (this._el) return;

      var overlay = document.createElement('div');
      overlay.id = 'sscs-lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Photo viewer');

      overlay.innerHTML = [
        '<div class="lb-backdrop"></div>',
        '<div class="lb-content">',
        '  <button class="lb-nav lb-prev" aria-label="Previous photo">',
        '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
        '  </button>',
        '  <div class="lb-image-wrap">',
        '    <img class="lb-img" src="" alt="Photo" draggable="false">',
        '  </div>',
        '  <button class="lb-nav lb-next" aria-label="Next photo">',
        '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',
        '  </button>',
        '</div>',
        '<div class="lb-bar">',
        '  <span class="lb-counter">1 / 1</span>',
        '  <button class="lb-close" aria-label="Close photo viewer">',
        '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        '  </button>',
        '</div>'
      ].join('\n');

      document.body.appendChild(overlay);

      this._el = overlay;
      this._img = overlay.querySelector('.lb-img');
      this._counter = overlay.querySelector('.lb-counter');
      this._prev = overlay.querySelector('.lb-prev');
      this._next = overlay.querySelector('.lb-next');

      var self = this;

      // Close on backdrop click or close button
      overlay.querySelector('.lb-backdrop').addEventListener('click', function() { self.close(); });
      overlay.querySelector('.lb-close').addEventListener('click', function() { self.close(); });

      // Navigation buttons
      this._prev.addEventListener('click', function(e) { e.stopPropagation(); self.prev(); });
      this._next.addEventListener('click', function(e) { e.stopPropagation(); self.next(); });

      // Keyboard: arrows + escape
      document.addEventListener('keydown', function(e) {
        if (!self._el || self._el.getAttribute('data-open') !== 'true') return;
        if (e.key === 'Escape') { self.close(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { self.prev(); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { self.next(); e.preventDefault(); }
      });

      // Touch swipe
      var wrap = overlay.querySelector('.lb-image-wrap');
      wrap.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
          self._touchStartX = e.touches[0].clientX;
          self._touchStartY = e.touches[0].clientY;
          self._swiping = true;
        }
      }, { passive: true });

      wrap.addEventListener('touchend', function(e) {
        if (!self._swiping) return;
        self._swiping = false;
        var dx = e.changedTouches[0].clientX - self._touchStartX;
        var dy = e.changedTouches[0].clientY - self._touchStartY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
          if (dx < 0) self.next(); else self.prev();
        }
      }, { passive: true });

      // Inject styles
      if (!document.getElementById('sscs-lightbox-css')) {
        var style = document.createElement('style');
        style.id = 'sscs-lightbox-css';
        style.textContent = [
          '#sscs-lightbox {',
          '  position: fixed; inset: 0; z-index: 10000;',
          '  display: none; opacity: 0;',
          '  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
          '}',
          '#sscs-lightbox[data-open="true"] { display: flex; flex-direction: column; }',
          '#sscs-lightbox[data-visible="true"] { opacity: 1; }',
          '.lb-backdrop {',
          '  position: absolute; inset: 0;',
          '  background: rgba(10, 15, 20, 0.92); backdrop-filter: blur(16px);',
          '  -webkit-backdrop-filter: blur(16px);',
          '}',
          '.lb-content {',
          '  flex: 1; display: flex; align-items: center; justify-content: center;',
          '  position: relative; z-index: 1; padding: 16px; min-height: 0;',
          '}',
          '.lb-image-wrap {',
          '  display: flex; align-items: center; justify-content: center;',
          '  max-width: 90vw; max-height: 82vh; overflow: hidden;',
          '}',
          '.lb-img {',
          '  max-width: 90vw; max-height: 82vh; object-fit: contain;',
          '  border-radius: 8px;',
          '  box-shadow: 0 24px 64px rgba(0,0,0,0.6);',
          '  transform: scale(0.92); opacity: 0;',
          '  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;',
          '  user-select: none; -webkit-user-select: none;',
          '}',
          '#sscs-lightbox[data-visible="true"] .lb-img {',
          '  transform: scale(1); opacity: 1;',
          '}',
          '.lb-nav {',
          '  position: absolute; top: 50%; z-index: 2;',
          '  width: 48px; height: 48px;',
          '  border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);',
          '  background: rgba(255,255,255,0.1); backdrop-filter: blur(8px);',
          '  color: #fff; cursor: pointer;',
          '  display: flex; align-items: center; justify-content: center;',
          '  transform: translateY(-50%);',
          '  transition: background 0.2s, border-color 0.2s, transform 0.2s;',
          '}',
          '.lb-nav:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.5); }',
          '.lb-nav:active { transform: translateY(-50%) scale(0.92); }',
          '.lb-nav svg { width: 22px; height: 22px; }',
          '.lb-prev { left: 16px; }',
          '.lb-next { right: 16px; }',
          '.lb-nav[hidden] { display: none; }',
          '.lb-bar {',
          '  position: relative; z-index: 2;',
          '  display: flex; align-items: center; justify-content: center;',
          '  gap: 16px; padding: 12px 24px;',
          '}',
          '.lb-counter {',
          '  color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600;',
          '  letter-spacing: 0.08em; font-family: var(--font-sans, sans-serif);',
          '}',
          '.lb-close {',
          '  position: absolute; right: 20px; top: 50%; transform: translateY(-50%);',
          '  width: 40px; height: 40px; border-radius: 50%;',
          '  border: 2px solid rgba(255,255,255,0.3);',
          '  background: rgba(255,255,255,0.1); backdrop-filter: blur(8px);',
          '  color: #fff; cursor: pointer;',
          '  display: flex; align-items: center; justify-content: center;',
          '  transition: background 0.2s, border-color 0.2s;',
          '}',
          '.lb-close:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.5); }',
          '.lb-close svg { width: 18px; height: 18px; }',
          '@media (max-width: 640px) {',
          '  .lb-nav { width: 36px; height: 36px; }',
          '  .lb-nav svg { width: 18px; height: 18px; }',
          '  .lb-prev { left: 8px; }',
          '  .lb-next { right: 8px; }',
          '  .lb-img { border-radius: 4px; }',
          '}'
        ].join('\n');
        document.head.appendChild(style);
      }
    },

    /** Open the lightbox with an array of image URLs and a starting index */
    open: function(images, startIndex) {
      if (!images || !images.length) return;
      this._build();
      this._images = images;
      this._index = Math.max(0, Math.min(startIndex || 0, images.length - 1));

      // Show/hide nav arrows for single image
      var multi = images.length > 1;
      this._prev.hidden = !multi;
      this._next.hidden = !multi;

      this._show();
      document.body.style.overflow = 'hidden';
    },

    /** Close the lightbox */
    close: function() {
      if (!this._el) return;
      this._el.setAttribute('data-visible', 'false');
      var self = this;
      setTimeout(function() {
        self._el.setAttribute('data-open', 'false');
        document.body.style.overflow = '';
      }, 300);
    },

    /** Navigate to previous image */
    prev: function() {
      if (this._images.length <= 1) return;
      this._index = (this._index - 1 + this._images.length) % this._images.length;
      this._transition(-1);
    },

    /** Navigate to next image */
    next: function() {
      if (this._images.length <= 1) return;
      this._index = (this._index + 1) % this._images.length;
      this._transition(1);
    },

    /** Internal: render the current image with animation */
    _show: function() {
      this._img.src = this._images[this._index];
      this._counter.textContent = (this._index + 1) + ' / ' + this._images.length;
      this._el.setAttribute('data-open', 'true');
      var self = this;
      // Force reflow before adding visible
      void this._el.offsetWidth;
      requestAnimationFrame(function() {
        self._el.setAttribute('data-visible', 'true');
      });
    },

    /** Internal: animate transition between images */
    _transition: function(direction) {
      var self = this;
      this._img.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
      this._img.style.transform = 'scale(0.95) translateX(' + (direction * -30) + 'px)';
      this._img.style.opacity = '0';
      setTimeout(function() {
        self._img.src = self._images[self._index];
        self._counter.textContent = (self._index + 1) + ' / ' + self._images.length;
        self._img.style.transform = 'scale(0.95) translateX(' + (direction * 30) + 'px)';
        // Wait for image load before animating in
        var onLoad = function() {
          requestAnimationFrame(function() {
            self._img.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease';
            self._img.style.transform = 'scale(1) translateX(0)';
            self._img.style.opacity = '1';
          });
        };
        if (self._img.complete) { onLoad(); }
        else { self._img.onload = onLoad; }
      }, 160);
    }
  };

  // Expose globally
  window.SatyasevaLightbox = lightbox;

  // Backwards-compat alias used by old gallery code
  window._openGalleryLightbox = function(src) {
    lightbox.open([src], 0);
  };

  /* ── Homepage gallery tile init ──────────────────────────────── */
  function init() {
    var tiles = Array.from(document.querySelectorAll('.grid-gallery .tile'));
    if (!tiles.length) return;

    var initialBatch = getNextImages(tiles.length);
    preloadBatch(initialBatch);

    tiles.forEach(function(tile, idx) {
      tile.style.cursor = 'pointer';
      tile.setAttribute('title', 'Click to view full photo');
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('role', 'button');

      // Click to open lightbox — collect all visible tile images
      function openFromTile() {
        var allTiles = Array.from(document.querySelectorAll('.grid-gallery .tile'));
        var images = allTiles.map(function(t) { return t.dataset.currentImg; }).filter(Boolean);
        var myImg = tile.dataset.currentImg;
        var myIdx = images.indexOf(myImg);
        // Include the full gallery pool too for richer browsing
        var fullSet = images.concat(galleryImages.filter(function(g) { return images.indexOf(g) === -1; }));
        window.SatyasevaLightbox.open(fullSet, myIdx >= 0 ? myIdx : 0);
      }

      tile.addEventListener('click', openFromTile);
      tile.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromTile(); }
      });

      // Set initial image
      var currentBg = tile.style.backgroundImage || '';
      if (!currentBg || currentBg.indexOf('MJA_') !== -1 || currentBg.indexOf('none') !== -1) {
        var initialImg = initialBatch[idx % initialBatch.length];
        tile.dataset.currentImg = initialImg;
        tile.style.backgroundImage = toCssUrl(initialImg);
        tile.style.backgroundSize = 'cover';
        tile.style.backgroundPosition = 'center';
      } else {
        var match = currentBg.match(/url\(["']?([^"']+)["']?\)/);
        if (match && match[1]) tile.dataset.currentImg = match[1];
      }
    });

    setInterval(updateTiles, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

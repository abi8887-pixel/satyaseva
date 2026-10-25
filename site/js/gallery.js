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

  /* ── Gallery image pool (Verified authentic archive & community photos) ── */
  var galleryImages = [
    "images/communities/generalate/hero.jpg",
    "images/communities/generalate/community_life.jpeg",
    "images/communities/generalate/prayer_meeting.jpeg",
    "images/communities/mariyapura/hero.jpg",
    "images/communities/mariyapura/early_years.jpg",
    "images/communities/frankfurt/hero.png",
    "images/communities/bydgosh-jp2/hero.jpg",
    "images/Mother_Regina_Woroniecka_1.jpg",
    "images/Mother_Regina_Woroniecka_3.png",
    "images/mother-001.jpg",
    "images/mother-002.jpg",
    "images/mother-003.jpg",
    "images/mother-004.jpg",
    "images/mother-005.jpg",
    "images/mother-006.jpg",
    "images/mother-007.jpg",
    "images/FrankfurtCommunity.png"
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
    _wrap: null,
    _counter: null,
    _prev: null,
    _next: null,
    _zoomInBtn: null,
    _zoomOutBtn: null,
    _zoomLevelBtn: null,
    _zoomResetBtn: null,
    _images: [],
    _index: 0,
    _zoomScale: 1,
    _panX: 0,
    _panY: 0,
    _isDragging: false,
    _startDragX: 0,
    _startDragY: 0,
    _initialPanX: 0,
    _initialPanY: 0,
    _touchStartX: 0,
    _touchStartY: 0,
    _touchStartPanX: 0,
    _touchStartPanY: 0,
    _isTouchPanning: false,
    _swiping: false,

    _applyZoom: function() {
      if (!this._img) return;
      if (this._zoomScale <= 1) {
        this._zoomScale = 1;
        this._panX = 0;
        this._panY = 0;
      }
      this._img.style.transform = 'translate(' + this._panX + 'px, ' + this._panY + 'px) scale(' + this._zoomScale + ')';
      if (this._zoomLevelBtn) {
        this._zoomLevelBtn.textContent = Math.round(this._zoomScale * 100) + '%';
      }
      if (this._zoomOutBtn) {
        this._zoomOutBtn.disabled = this._zoomScale <= 1;
      }
      if (this._zoomInBtn) {
        this._zoomInBtn.disabled = this._zoomScale >= 3.5;
      }
      if (this._wrap) {
        if (this._zoomScale > 1) {
          this._wrap.classList.add('is-zoomed');
        } else {
          this._wrap.classList.remove('is-zoomed');
          this._wrap.classList.remove('is-panning');
        }
      }
    },

    _setZoom: function(scale) {
      this._zoomScale = Math.min(3.5, Math.max(1, Math.round(scale * 100) / 100));
      if (this._zoomScale === 1) {
        this._panX = 0;
        this._panY = 0;
      }
      this._applyZoom();
    },

    _zoomIn: function() {
      this._setZoom(this._zoomScale + 0.35);
    },

    _zoomOut: function() {
      this._setZoom(this._zoomScale - 0.35);
    },

    _resetZoom: function() {
      this._setZoom(1);
    },

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
        '  <div class="lb-zoom-group">',
        '    <button class="lb-zoom-btn lb-zoom-out" aria-label="Zoom out" title="Zoom out (-)">',
        '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        '    </button>',
        '    <button class="lb-zoom-btn lb-zoom-level" aria-label="Reset zoom" title="Reset zoom (0)">100%</button>',
        '    <button class="lb-zoom-btn lb-zoom-in" aria-label="Zoom in" title="Zoom in (+)">',
        '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        '    </button>',
        '    <button class="lb-zoom-btn lb-zoom-reset" aria-label="Fit to screen" title="Fit to screen (0)">',
        '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
        '    </button>',
        '  </div>',
        '  <span class="lb-counter">1 / 1</span>',
        '  <button class="lb-close" aria-label="Close photo viewer">',
        '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        '  </button>',
        '</div>'
      ].join('\n');

      document.body.appendChild(overlay);

      this._el = overlay;
      this._wrap = overlay.querySelector('.lb-image-wrap');
      this._img = overlay.querySelector('.lb-img');
      this._counter = overlay.querySelector('.lb-counter');
      this._prev = overlay.querySelector('.lb-prev');
      this._next = overlay.querySelector('.lb-next');
      this._zoomInBtn = overlay.querySelector('.lb-zoom-in');
      this._zoomOutBtn = overlay.querySelector('.lb-zoom-out');
      this._zoomLevelBtn = overlay.querySelector('.lb-zoom-level');
      this._zoomResetBtn = overlay.querySelector('.lb-zoom-reset');

      var self = this;

      // Close on backdrop click or close button
      overlay.querySelector('.lb-backdrop').addEventListener('click', function() { self.close(); });
      overlay.querySelector('.lb-close').addEventListener('click', function() { self.close(); });

      // Navigation buttons
      this._prev.addEventListener('click', function(e) { e.stopPropagation(); self.prev(); });
      this._next.addEventListener('click', function(e) { e.stopPropagation(); self.next(); });

      // Zoom buttons
      if (this._zoomInBtn) this._zoomInBtn.addEventListener('click', function(e) { e.stopPropagation(); self._zoomIn(); });
      if (this._zoomOutBtn) this._zoomOutBtn.addEventListener('click', function(e) { e.stopPropagation(); self._zoomOut(); });
      if (this._zoomLevelBtn) this._zoomLevelBtn.addEventListener('click', function(e) { e.stopPropagation(); self._resetZoom(); });
      if (this._zoomResetBtn) this._zoomResetBtn.addEventListener('click', function(e) { e.stopPropagation(); self._resetZoom(); });

      // Double-click image to toggle zoom
      this._img.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (self._zoomScale > 1) {
          self._resetZoom();
        } else {
          self._setZoom(2.2);
        }
      });

      // Mouse wheel zoom
      this._wrap.addEventListener('wheel', function(e) {
        e.preventDefault();
        var delta = e.deltaY < 0 ? 0.25 : -0.25;
        self._setZoom(self._zoomScale + delta);
      }, { passive: false });

      // Mouse drag to pan when zoomed
      this._wrap.addEventListener('mousedown', function(e) {
        if (self._zoomScale <= 1) return;
        if (e.button !== 0) return;
        e.preventDefault();
        self._isDragging = true;
        self._startDragX = e.clientX;
        self._startDragY = e.clientY;
        self._initialPanX = self._panX;
        self._initialPanY = self._panY;
        self._wrap.classList.add('is-panning');
      });

      window.addEventListener('mousemove', function(e) {
        if (!self._isDragging) return;
        self._panX = self._initialPanX + (e.clientX - self._startDragX);
        self._panY = self._initialPanY + (e.clientY - self._startDragY);
        self._applyZoom();
      });

      window.addEventListener('mouseup', function() {
        if (self._isDragging) {
          self._isDragging = false;
          if (self._wrap) self._wrap.classList.remove('is-panning');
        }
      });

      // Keyboard: arrows, zoom +/-, escape
      document.addEventListener('keydown', function(e) {
        if (!self._el || self._el.getAttribute('data-open') !== 'true') return;
        if (e.key === 'Escape') { self.close(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { self.prev(); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { self.next(); e.preventDefault(); }
        else if (e.key === '+' || e.key === '=') { self._zoomIn(); e.preventDefault(); }
        else if (e.key === '-' || e.key === '_') { self._zoomOut(); e.preventDefault(); }
        else if (e.key === '0') { self._resetZoom(); e.preventDefault(); }
      });

      // Touch swipe and pan
      this._wrap.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
          self._touchStartX = e.touches[0].clientX;
          self._touchStartY = e.touches[0].clientY;
          if (self._zoomScale > 1) {
            self._isTouchPanning = true;
            self._touchStartPanX = self._panX;
            self._touchStartPanY = self._panY;
          } else {
            self._isTouchPanning = false;
            self._swiping = true;
          }
        }
      }, { passive: true });

      this._wrap.addEventListener('touchmove', function(e) {
        if (self._isTouchPanning && self._zoomScale > 1 && e.touches.length === 1) {
          self._panX = self._touchStartPanX + (e.touches[0].clientX - self._touchStartX);
          self._panY = self._touchStartPanY + (e.touches[0].clientY - self._touchStartY);
          self._applyZoom();
        }
      }, { passive: true });

      this._wrap.addEventListener('touchend', function(e) {
        if (self._isTouchPanning) {
          self._isTouchPanning = false;
          return;
        }
        if (!self._swiping || self._zoomScale > 1) return;
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
          '  position: relative; border-radius: 8px;',
          '  user-select: none; -webkit-user-select: none;',
          '}',
          '.lb-image-wrap.is-zoomed { cursor: grab; }',
          '.lb-image-wrap.is-zoomed.is-panning { cursor: grabbing; }',
          '.lb-img {',
          '  max-width: 90vw; max-height: 82vh; object-fit: contain;',
          '  border-radius: 8px;',
          '  box-shadow: 0 24px 64px rgba(0,0,0,0.6);',
          '  transform: scale(0.92); opacity: 0;',
          '  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;',
          '  user-select: none; -webkit-user-select: none;',
          '  cursor: zoom-in;',
          '  will-change: transform;',
          '}',
          '.lb-image-wrap.is-zoomed .lb-img { cursor: grab; }',
          '.lb-image-wrap.is-zoomed.is-panning .lb-img { cursor: grabbing; transition: none !important; }',
          '#sscs-lightbox[data-visible="true"] .lb-img {',
          '  opacity: 1;',
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
          '.lb-zoom-group {',
          '  display: flex; align-items: center;',
          '  background: rgba(255, 255, 255, 0.1);',
          '  border: 1px solid rgba(255, 255, 255, 0.25);',
          '  border-radius: 9999px; padding: 3px;',
          '  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);',
          '  gap: 2px;',
          '}',
          '.lb-zoom-btn {',
          '  width: 32px; height: 32px;',
          '  background: transparent; border: none; border-radius: 50%;',
          '  color: #fff; display: flex; align-items: center; justify-content: center;',
          '  cursor: pointer; transition: all 0.2s;',
          '}',
          '.lb-zoom-btn:hover:not(:disabled) {',
          '  background: rgba(255, 255, 255, 0.2); color: #d4af37;',
          '}',
          '.lb-zoom-btn:disabled { opacity: 0.35; cursor: not-allowed; }',
          '.lb-zoom-btn svg { width: 16px; height: 16px; }',
          '.lb-zoom-level {',
          '  width: auto; min-width: 44px; padding: 0 6px;',
          '  border-radius: 9999px; font-size: 11.5px; font-weight: 600;',
          '  letter-spacing: 0.04em; font-family: var(--font-sans, sans-serif);',
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
          '  .lb-bar { gap: 8px; padding: 10px 14px; }',
          '  .lb-zoom-btn { width: 28px; height: 28px; }',
          '  .lb-zoom-level { min-width: 38px; font-size: 10.5px; padding: 0 4px; }',
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

      this._resetZoom();
      this._show();
      document.body.style.overflow = 'hidden';
    },

    /** Close the lightbox */
    close: function() {
      if (!this._el) return;
      this._resetZoom();
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
      this._resetZoom();
      this._index = (this._index - 1 + this._images.length) % this._images.length;
      this._transition(-1);
    },

    /** Navigate to next image */
    next: function() {
      if (this._images.length <= 1) return;
      this._resetZoom();
      this._index = (this._index + 1) % this._images.length;
      this._transition(1);
    },

    /** Internal: render the current image with animation */
    _show: function() {
      this._resetZoom();
      this._img.src = this._images[this._index];
      this._counter.textContent = (this._index + 1) + ' / ' + this._images.length;
      this._el.setAttribute('data-open', 'true');
      var self = this;
      // Force reflow before adding visible
      void this._el.offsetWidth;
      requestAnimationFrame(function() {
        self._el.setAttribute('data-visible', 'true');
        self._applyZoom();
      });
    },

    /** Internal: animate transition between images */
    _transition: function(direction) {
      var self = this;
      this._resetZoom();
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
            self._resetZoom();
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

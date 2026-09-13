/* ================================================================
   gallery.js — Rotating background tiles for the gallery section
   Cycles through congregation photographs from assets/images
   with smooth staggered crossfade and interactive lightbox preview
   ================================================================ */
(function(){
  'use strict';

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

  // Helper to format safe CSS background-image url
  function toCssUrl(src) {
    if (!src) return '';
    return 'url("' + encodeURI(src).replace(/\(/g, '%28').replace(/\)/g, '%29') + '")';
  }

  // Preload batch of images in the background to avoid flicker
  function preloadBatch(images) {
    images.forEach(function(src) {
      var img = new Image();
      img.src = src;
    });
  }

  // Fisher-Yates shuffle
  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // Maintain a pool to avoid repeats across cycles
  var pool = [];
  function getNextImages(count) {
    if (pool.length < count) {
      pool = pool.concat(shuffleArray(galleryImages));
    }
    return pool.splice(0, count);
  }

  // Staggered tile update for elegant visual flow
  function updateTiles() {
    var genericTiles = Array.from(document.querySelectorAll('.grid-gallery .tile:not(.static-bg)'));
    if (!genericTiles.length || !galleryImages.length) return;

    var nextBatch = getNextImages(genericTiles.length);
    preloadBatch(nextBatch);

    genericTiles.forEach(function(tile, idx) {
      var nextImg = nextBatch[idx % nextBatch.length];
      var delay = idx * 180; // Gentle staggered wave

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

    // Preload following batch ahead of time
    if (pool.length < genericTiles.length) {
      pool = pool.concat(shuffleArray(galleryImages));
    }
    preloadBatch(pool.slice(0, genericTiles.length));
  }

  // Interactive Lightbox
  function setupLightbox() {
    var modal = document.getElementById('gallery-lightbox');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'gallery-lightbox';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Gallery photo viewer');
      modal.style.cssText = [
        'position: fixed', 'inset: 0', 'z-index: 9999',
        'background: rgba(10, 15, 20, 0.88)', 'backdrop-filter: blur(10px)',
        'display: none', 'align-items: center', 'justify-content: center',
        'padding: 24px', 'cursor: zoom-out', 'transition: opacity 0.25s ease',
        'opacity: 0'
      ].join(';');

      modal.innerHTML = [
        '<div style="position:relative; max-width:90vw; max-height:90vh; display:flex; flex-direction:column; align-items:center; cursor:default;">',
        '  <img id="gallery-lightbox-img" src="" alt="Congregation photo" style="max-width:90vw; max-height:85vh; object-fit:contain; border-radius:12px; box-shadow:0 24px 64px rgba(0,0,0,0.5); transform:scale(0.96); transition:transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);">',
        '  <button id="gallery-lightbox-close" aria-label="Close" style="position:absolute; top:-16px; right:-16px; width:36px; height:36px; border-radius:50%; background:#fff; color:#111; border:none; font-size:18px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.25);">✕</button>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);

      function closeModal() {
        modal.style.opacity = '0';
        var img = document.getElementById('gallery-lightbox-img');
        if (img) img.style.transform = 'scale(0.96)';
        setTimeout(function(){ modal.style.display = 'none'; }, 250);
      }

      modal.addEventListener('click', function(e) {
        if (e.target === modal || e.target.id === 'gallery-lightbox-close') {
          closeModal();
        }
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
          closeModal();
        }
      });

      window._openGalleryLightbox = function(src) {
        var img = document.getElementById('gallery-lightbox-img');
        if (!img || !src) return;
        img.src = src;
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.style.opacity = '1';
        img.style.transform = 'scale(1)';
      };
    }
  }

  function init() {
    var tiles = Array.from(document.querySelectorAll('.grid-gallery .tile'));
    if (!tiles.length) return;

    setupLightbox();

    // Populate initial tiles immediately if missing or broken
    var initialBatch = getNextImages(tiles.length);
    preloadBatch(initialBatch);

    tiles.forEach(function(tile, idx) {
      tile.style.cursor = 'pointer';
      tile.setAttribute('title', 'Click to view full photo');

      // Click to open lightbox
      tile.addEventListener('click', function() {
        var src = tile.dataset.currentImg || initialBatch[idx % initialBatch.length];
        if (window._openGalleryLightbox) {
          window._openGalleryLightbox(src);
        }
      });

      // Set initial image if not already styled or if pointing to missing images
      var currentBg = tile.style.backgroundImage || '';
      if (!currentBg || currentBg.indexOf('MJA_') !== -1 || currentBg.indexOf('none') !== -1) {
        var initialImg = initialBatch[idx % initialBatch.length];
        tile.dataset.currentImg = initialImg;
        tile.style.backgroundImage = toCssUrl(initialImg);
        tile.style.backgroundSize = 'cover';
        tile.style.backgroundPosition = 'center';
      } else {
        // Extract existing path if available
        var match = currentBg.match(/url\(["']?([^"']+)["']?\)/);
        if (match && match[1]) tile.dataset.currentImg = match[1];
      }
    });

    // Start cycling with 6-second intervals
    setInterval(updateTiles, 6000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

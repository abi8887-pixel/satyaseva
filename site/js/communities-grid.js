/* ================================================================
   communities-grid.js — Renders the community card grid from JSON
   Fetches data/communities.json & data/community-images.json and
   builds rich, clickable cards showcasing live community photos.
   ================================================================ */
(function(){
  'use strict';

  var grid = document.getElementById('comm-grid');
  if (!grid) return;

  /* Country flag map */
  var flags = {
    'India': '🇮🇳',
    'Germany': '🇩🇪',
    'Poland': '🇵🇱'
  };

  /* SVG icon templates */
  var pinIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
  var arrowIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  var cameraIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

  var missionIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M4 8h16"/></svg>';
  var familiesIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  var serviceIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.35-9.5-9C1 8 3 4 7 4c2 0 4 1.5 5 3 1-1.5 3-3 5-3 4 0 6 4 4.5 8-2.5 4.65-9.5 9-9.5 9Z"/></svg>';

  function renderCard(c, imagesManifest) {
    var flag = flags[c.country] || '';
    var badgeText = c.badge || ('Est. ' + c.established);

    // Check for images in manifest or community record
    var folderData = imagesManifest[c.id] || null;
    var heroImage = (folderData && folderData.hero) || c.heroImage || '';
    var totalPhotos = (folderData && folderData.totalImages) || (c.gallery ? c.gallery.length : 0);

    var card = document.createElement('a');
    card.className = 'comm-card';
    card.href = 'community.html?id=' + encodeURIComponent(c.id);
    card.id = 'card-' + c.id;
    card.setAttribute('aria-label', 'View details for ' + c.name);

    var previewHTML = '';
    if (heroImage) {
      var badgeLabel = totalPhotos > 1 ? (totalPhotos + ' Photos') : 'Photo';
      previewHTML =
        '<div class="card-photo-banner" style="background-image:url(\'' + heroImage + '\')">' +
          '<span class="photo-badge">' + cameraIcon + ' ' + badgeLabel + '</span>' +
        '</div>';
    } else {
      previewHTML =
        '<div class="symbolic-gallery">' +
          '<div class="sym-tile" title="Community Mission">' + missionIcon + '<span>Mission</span></div>' +
          '<div class="sym-tile" title="Family Formation">' + familiesIcon + '<span>Families</span></div>' +
          '<div class="sym-tile" title="Charity &amp; Service">' + serviceIcon + '<span>Service</span></div>' +
        '</div>';
    }

    card.innerHTML =
      '<div class="badge">' + badgeText + '</div>' +
      '<h3>' + c.name + '</h3>' +
      '<div class="location">' + pinIcon + ' ' + (flag ? flag + ' ' : '') + c.location + '</div>' +
      previewHTML +
      '<div class="desc"><p>' + c.description + '</p></div>' +
      '<div class="card-cta">Explore Community ' + arrowIcon + '</div>';

    return card;
  }

  function renderGrid(communities, imagesManifest) {
    grid.innerHTML = '';
    communities.forEach(function(c) {
      grid.appendChild(renderCard(c, imagesManifest));
    });
  }

  /* Fetch both communities data and community-images manifest */
  var cacheBuster = '?t=' + Date.now();
  Promise.all([
    fetch('data/communities.json' + cacheBuster).then(function(res) {
      if (!res.ok) throw new Error('Failed to load communities data');
      return res.json();
    }),
    fetch('data/community-images.json' + cacheBuster).then(function(res) {
      return res.ok ? res.json() : {};
    }).catch(function() {
      return {};
    })
  ])
  .then(function(results) {
    var communities = results[0];
    var imagesManifest = results[1] || {};
    renderGrid(communities, imagesManifest);
  })
  .catch(function(err) {
    if (window.__INITIAL_COMMUNITIES__ && Array.isArray(window.__INITIAL_COMMUNITIES__)) {
      renderGrid(window.__INITIAL_COMMUNITIES__, {});
      return;
    }
    console.error('Communities grid error:', err);
    grid.innerHTML = '<p style="text-align:center;color:var(--ink-soft);padding:40px;">Unable to load communities. Please try again later.</p>';
  });

})();

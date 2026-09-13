/* ================================================================
   memorial.js — Public In Memoriam Page Logic
   Renders departed sisters cards, provides live search, and opens
   rich tribute detail modals.
   ================================================================ */
(function() {
  'use strict';

  var sistersData = [];
  var gridEl = document.getElementById('memorial-grid');
  var loadingEl = document.getElementById('memorial-loading');
  var emptyEl = document.getElementById('memorial-empty');
  var searchInput = document.getElementById('memorial-search');
  var countTag = document.getElementById('memorial-count-tag');
  var clearSearchBtn = document.getElementById('btn-clear-search');

  /* Modal elements */
  var modal = document.getElementById('memorial-modal');
  var backdrop = document.getElementById('modal-backdrop');
  var closeBtn = document.getElementById('modal-close-btn');
  var footerCloseBtn = document.getElementById('btn-close-modal');

  /* ── Icons ── */
  var crossIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="5" y1="8" x2="19" y2="8"></line></svg>';

  /* ── Format Lifespan Years ── */
  function formatLifespan(s) {
    var bYear = s.birthDate ? s.birthDate.substring(0, 4) : '';
    var dYear = s.departureDate ? s.departureDate.substring(0, 4) : '';
    if (bYear && dYear) return bYear + ' – ' + dYear;
    if (dYear) return 'Rest in Peace ' + dYear;
    return '';
  }

  function formatFullDate(dateStr) {
    if (!dateStr) return '';
    try {
      var parts = dateStr.split('-');
      if (parts.length === 3) {
        var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch(e) {}
    return dateStr;
  }

  /* ── Render Sister Cards ── */
  function renderGrid(list) {
    if (!gridEl) return;

    if (!list || list.length === 0) {
      gridEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      if (countTag) countTag.textContent = '0 Sisters Found';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    gridEl.style.display = 'grid';

    if (countTag) {
      countTag.textContent = list.length === 1 ? '1 Sister of Blessed Memory' : list.length + ' Sisters of Blessed Memory';
    }

    var html = '';
    list.forEach(function(s, idx) {
      var lifespan = formatLifespan(s);
      var hasPhoto = !!s.photo;

      html += '<article class="sister-card" data-id="' + s.id + '" tabindex="0" role="button" aria-label="View memorial tribute for ' + s.name + '">';
      
      if (hasPhoto) {
        html += '  <div class="sister-card-photo-box" style="background-image:url(\'' + s.photo + '\')">';
      } else {
        html += '  <div class="sister-card-photo-box sister-card-photo-placeholder">';
        html += '    ' + crossIcon;
        html += '    <span>Satyaseva Sisters</span>';
      }
      if (lifespan) {
        html += '    <span class="card-lifespan-badge">' + lifespan + '</span>';
      }
      html += '  </div>';

      html += '  <div class="sister-card-body">';
      html += '    <h3 class="sister-card-name">' + s.name + '</h3>';
      if (s.title) {
        html += '    <div class="sister-card-title">' + s.title + '</div>';
      }

      if (s.communities && s.communities.length > 0) {
        html += '    <div class="sister-card-communities">';
        s.communities.slice(0, 3).forEach(function(comm) {
          html += '      <span class="comm-pill">' + comm + '</span>';
        });
        if (s.communities.length > 3) {
          html += '      <span class="comm-pill">+' + (s.communities.length - 3) + ' more</span>';
        }
        html += '    </div>';
      }

      if (s.quote) {
        html += '    <p class="sister-card-quote">“' + s.quote + '”</p>';
      }

      html += '    <div class="sister-card-cta">';
      html += '      <span>Life &amp; Ministry</span>';
      html += '      <span>Read Tribute →</span>';
      html += '    </div>';
      html += '  </div>';
      html += '</article>';
    });

    gridEl.innerHTML = html;

    /* Attach click listeners */
    var cards = gridEl.querySelectorAll('.sister-card');
    cards.forEach(function(card) {
      card.onclick = function() {
        var id = card.getAttribute('data-id');
        openSisterModal(id);
      };
      card.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var id = card.getAttribute('data-id');
          openSisterModal(id);
        }
      };
    });
  }

  /* ── Open Sister Modal ── */
  function openSisterModal(id) {
    var sister = sistersData.find(function(s) { return s.id === id; });
    if (!sister || !modal) return;

    var nameEl = document.getElementById('modal-sister-name');
    var titleEl = document.getElementById('modal-sister-title');
    var lifespanEl = document.getElementById('modal-lifespan');
    var photoCol = document.getElementById('modal-photo-col');
    var datesRow = document.getElementById('modal-dates-row');
    var quoteBox = document.getElementById('modal-quote-box');
    var quoteText = document.getElementById('modal-quote-text');
    var bioText = document.getElementById('modal-bio-text');
    var ministryText = document.getElementById('modal-ministry-text');
    var commTags = document.getElementById('modal-communities-tags');
    var burialItem = document.getElementById('modal-burial-item');
    var burialText = document.getElementById('modal-burial-text');

    if (nameEl) nameEl.textContent = sister.name;
    if (titleEl) titleEl.textContent = sister.title || 'Sister of the Satyaseva Catechist Congregation';
    if (lifespanEl) lifespanEl.textContent = formatLifespan(sister);

    if (photoCol) {
      if (sister.photo) {
        photoCol.style.backgroundImage = 'url(\'' + sister.photo + '\')';
        photoCol.innerHTML = '';
      } else {
        photoCol.style.backgroundImage = '';
        photoCol.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--mem-sage);">' + crossIcon + '<span>SCS Archive</span></div>';
      }
    }

    /* Dates breakdown */
    if (datesRow) {
      var datesHtml = '';
      if (sister.birthDate) datesHtml += '<span>Born: ' + formatFullDate(sister.birthDate) + '</span>';
      if (sister.professionDate) datesHtml += '<span>• Vows: ' + formatFullDate(sister.professionDate) + '</span>';
      if (sister.departureDate) datesHtml += '<span>• Departed: ' + formatFullDate(sister.departureDate) + '</span>';
      datesRow.innerHTML = datesHtml;
    }

    /* Quote */
    if (quoteBox && quoteText) {
      if (sister.quote) {
        quoteText.textContent = '“' + sister.quote + '”';
        quoteBox.style.display = 'block';
      } else {
        quoteBox.style.display = 'none';
      }
    }

    if (bioText) bioText.textContent = sister.biography || 'A life of humble fidelity and dedicated service to the families in our missions.';
    if (ministryText) ministryText.textContent = sister.ministry || 'Catechesis and Pastoral Service';

    /* Communities */
    if (commTags) {
      var commHtml = '';
      if (sister.communities && sister.communities.length) {
        sister.communities.forEach(function(c) {
          commHtml += '<span class="comm-pill">' + c + '</span>';
        });
      } else {
        commHtml = '<span style="color:var(--mem-ink-faint);font-size:13px;">General Mission Service</span>';
      }
      commTags.innerHTML = commHtml;
    }

    /* Burial */
    if (burialItem && burialText) {
      if (sister.burialPlace) {
        burialText.textContent = sister.burialPlace;
        burialItem.style.display = 'block';
      } else {
        burialItem.style.display = 'none';
      }
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.onclick = closeModal;
  if (footerCloseBtn) footerCloseBtn.onclick = closeModal;
  if (backdrop) backdrop.onclick = closeModal;

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });

  /* ── Filter / Search Logic ── */
  function filterSisters() {
    var query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    if (!query) {
      renderGrid(sistersData);
      return;
    }

    var filtered = sistersData.filter(function(s) {
      var nameMatch = (s.name || '').toLowerCase().indexOf(query) !== -1;
      var titleMatch = (s.title || '').toLowerCase().indexOf(query) !== -1;
      var ministryMatch = (s.ministry || '').toLowerCase().indexOf(query) !== -1;
      var bioMatch = (s.biography || '').toLowerCase().indexOf(query) !== -1;
      var quoteMatch = (s.quote || '').toLowerCase().indexOf(query) !== -1;
      var commMatch = s.communities && s.communities.some(function(c) {
        return c.toLowerCase().indexOf(query) !== -1;
      });
      return nameMatch || titleMatch || ministryMatch || bioMatch || quoteMatch || commMatch;
    });

    renderGrid(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener('input', filterSisters);
  }

  if (clearSearchBtn) {
    clearSearchBtn.onclick = function() {
      if (searchInput) searchInput.value = '';
      renderGrid(sistersData);
    };
  }

  /* ── Fetch Data ── */
  fetch('data/memorial.json')
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to load memorial records');
      return res.json();
    })
    .then(function(data) {
      sistersData = data || [];
      if (loadingEl) loadingEl.style.display = 'none';
      renderGrid(sistersData);
    })
    .catch(function(err) {
      console.error('Memorial load error:', err);
      if (loadingEl) {
        loadingEl.innerHTML = '<p style="color:var(--mem-sage-deep);font-weight:700;">Unable to load memorial records at this time.</p>';
      }
    });

})();

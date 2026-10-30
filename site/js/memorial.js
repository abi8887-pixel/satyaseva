/* ================================================================
   memorial.js — Public In Memoriam Page Logic
   Manages the 7-sister commemorative gallery cards & tribute detail modals.
   ================================================================ */
(function() {
  'use strict';

  var sistersData = [];

  /* Modal elements */
  var modal = document.getElementById('memorial-modal');
  var backdrop = document.getElementById('modal-backdrop');
  var closeBtn = document.getElementById('modal-close-btn');
  var footerCloseBtn = document.getElementById('btn-close-modal');

  /* ── Icons ── */
  var crossIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="5" y1="8" x2="19" y2="8"></line></svg>';

  /* ── Format Lifespan Years ── */
  function formatLifespan(s) {
    if (s.dateDisplay) return 'Rest in Peace ' + s.dateDisplay;
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
    if (lifespanEl) lifespanEl.textContent = sister.dateDisplay ? ('Passed to Eternal Rest: ' + sister.dateDisplay) : formatLifespan(sister);

    if (photoCol) {
      if (sister.photo) {
        photoCol.innerHTML = '<img src="' + sister.photo + '" alt="' + sister.name + '">';
      } else {
        photoCol.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--mem-burgundy);">' + crossIcon + '<span>SCS Archive</span></div>';
      }
    }

    /* Dates breakdown */
    if (datesRow) {
      var datesHtml = '';
      if (sister.birthDate) datesHtml += '<span>Born: ' + formatFullDate(sister.birthDate) + '</span>';
      if (sister.professionDate) datesHtml += '<span> • Vows: ' + formatFullDate(sister.professionDate) + '</span>';
      if (sister.departureDate) datesHtml += '<span> • Departed: ' + (sister.dateDisplay || formatFullDate(sister.departureDate)) + '</span>';
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
        commHtml = '<span style="color:var(--mem-text-muted);font-size:13px;">General Mission Service</span>';
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

  /* ── Attach Card Click Listeners ── */
  function attachCardListeners() {
    var cards = document.querySelectorAll('.memorial-sister-card[data-sister-id]');
    cards.forEach(function(card) {
      card.onclick = function(e) {
        e.preventDefault();
        var id = card.getAttribute('data-sister-id');
        openSisterModal(id);
      };
      card.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var id = card.getAttribute('data-sister-id');
          openSisterModal(id);
        }
      };
    });
  }

  /* ── Initialize Data ── */
  function initData(data) {
    sistersData = data || [];
    attachCardListeners();
  }

  fetch('data/memorial.json')
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to load memorial records');
      return res.json();
    })
    .then(function(data) {
      initData(data);
    })
    .catch(function() {
      if (window.__INITIAL_MEMORIAL__ && Array.isArray(window.__INITIAL_MEMORIAL__)) {
        initData(window.__INITIAL_MEMORIAL__);
      } else {
        attachCardListeners();
      }
    });

})();

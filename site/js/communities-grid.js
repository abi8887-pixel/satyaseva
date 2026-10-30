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
  var calIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
  var arrowIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';

  function renderCard(c, imagesManifest) {
    // Check for images in manifest or community record
    var folderData = imagesManifest[c.id] || null;
    var heroImage = (folderData && folderData.hero) || c.heroImage || '';

    // Check aliases if not found directly
    if (!heroImage) {
      if (c.id === 'mariapura' && imagesManifest['mariyapura']) heroImage = imagesManifest['mariyapura'].hero;
      if (c.id === 'prakashpalya' && imagesManifest['prakashpalaya']) heroImage = imagesManifest['prakashpalaya'].hero;
      if (c.id === 'bydgoszcz-home' && imagesManifest['bydgosh-jp2']) heroImage = imagesManifest['bydgosh-jp2'].hero;
    }

    var card = document.createElement('a');
    card.className = 'comm-card';
    card.href = 'community.html?id=' + encodeURIComponent(c.id);
    card.id = 'card-' + c.id;
    card.setAttribute('aria-label', 'View history and mission of ' + c.name);

    var imgHTML = '';
    if (heroImage) {
      imgHTML =
        '<div class="card-img-wrap">' +
          '<img src="' + heroImage + '" alt="' + c.name + '" class="card-photo" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML=\'<div class=\\\'card-img-placeholder\\\'><svg viewBox=\\\'0 0 24 24\\\' width=\\\'28\\\' height=\\\'28\\\' fill=\\\'none\\\' stroke=\\\'currentColor\\\' stroke-width=\\\'1.8\\\'><path d=\\\'M12 2v20M4 8h16\\\'/></svg><span>' + c.name + '</span></div>\';">' +
        '</div>';
    } else {
      imgHTML =
        '<div class="card-img-wrap">' +
          '<div class="card-img-placeholder">' +
            '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M4 8h16"/></svg>' +
            '<span>' + c.name + '</span>' +
          '</div>' +
        '</div>';
    }

    var estText = c.established ? ('Established ' + c.established) : '';

    card.innerHTML =
      imgHTML +
      '<div class="card-body">' +
        '<h3 class="card-title">' + c.name + '</h3>' +
        '<div class="card-meta">' +
          (c.location ? '<div class="card-meta-row"><span class="meta-icon pin-icon">' + pinIcon + '</span><span class="meta-text">' + c.location + '</span></div>' : '') +
          (estText ? '<div class="card-meta-row"><span class="meta-icon cal-icon">' + calIcon + '</span><span class="meta-text">' + estText + '</span></div>' : '') +
        '</div>' +
        '<div class="card-desc"><p>' + (c.description || 'Dedicated to catechesis, prayer, and pastoral presence in family life.') + '</p></div>' +
        '<div class="card-action">' +
          '<span class="card-btn">View History &amp; Mission ' + arrowIcon + '</span>' +
        '</div>' +
      '</div>';

    return card;
  }

  function renderGrid(communities, imagesManifest) {
    grid.innerHTML = '';
    if (communities.length === 0) {
      grid.innerHTML = '<div class="grid-empty"><p>No communities found matching your criteria.</p><button type="button" class="btn-reset-filters" onclick="document.getElementById(\'comm-search\').value=\'\'; document.querySelector(\'.filter-tab[data-filter=\\\'all\\\']\').click();">Reset Filters</button></div>';
      return;
    }
    communities.forEach(function(c) {
      grid.appendChild(renderCard(c, imagesManifest));
    });
  }

  /* Fetch both communities data and community-images manifest (cached by SW) */
  Promise.all([
    fetch('data/communities.json').then(function(res) {
      if (!res.ok) throw new Error('Failed to load communities data');
      return res.json();
    }),
    fetch('data/community-images.json').then(function(res) {
      return res.ok ? res.json() : {};
    }).catch(function() {
      return {};
    })
  ])
  .then(function(results) {
    var communities = results[0];
    var imagesManifest = results[1] || {};
    
    var allCommunities = communities;
    var currentCountry = 'all';
    var searchQuery = '';

    // Initial render
    renderGrid(allCommunities, imagesManifest);

    // Setup IntersectionObserver for scroll reveal
    var observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    var cardObserver = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(entry, index) {
        if (entry.isIntersecting) {
          // Staggered reveal based on index in this batch
          setTimeout(function() {
            entry.target.classList.remove('is-hidden');
          }, index * 75);
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    function observeCards() {
      var cards = document.querySelectorAll('.comm-card');
      cards.forEach(function(card) {
        card.classList.add('is-hidden');
        cardObserver.observe(card);
      });
    }
    
    // Initial observe
    observeCards();

    // Sliding Pill Logic
    var tabsContainer = document.getElementById('filter-tabs');
    var tabs = document.querySelectorAll('.filter-tab');
    
    function updatePill(tab) {
      if (!tabsContainer || !tab) return;
      // Get the relative offset within the container
      var containerRect = tabsContainer.getBoundingClientRect();
      var tabRect = tab.getBoundingClientRect();
      var offsetLeft = tabRect.left - containerRect.left - 4; // 4px padding in container
      
      tabsContainer.style.setProperty('--pill-width', tabRect.width + 'px');
      tabsContainer.style.setProperty('--pill-offset', offsetLeft + 'px');
    }

    // Set initial pill position
    var activeTab = document.querySelector('.filter-tab.active');
    if (activeTab) {
      // Need a slight delay to ensure fonts/layout are loaded for correct width
      setTimeout(function() { updatePill(activeTab); }, 50);
      window.addEventListener('resize', function() { updatePill(document.querySelector('.filter-tab.active')); });
    }

    // Setup filtering with FLIP animation
    function applyFilters() {
      var filtered = allCommunities;

      if (currentCountry !== 'all') {
        filtered = filtered.filter(function(c) { return c.country === currentCountry; });
      }

      if (searchQuery) {
        var lowerQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(function(c) {
          var nameStr = String(c.name || '');
          var locStr = String(c.location || '');
          var descStr = String(c.description || '');
          var minStr = Array.isArray(c.ministries) ? c.ministries.join(' ') : String(c.ministries || '');
          var searchable = (nameStr + ' ' + locStr + ' ' + descStr + ' ' + minStr).toLowerCase();
          return searchable.indexOf(lowerQuery) !== -1;
        });
      }

      // FLIP First: Record current positions
      var oldCards = Array.from(grid.querySelectorAll('.comm-card'));
      var firstRects = {};
      oldCards.forEach(function(card) {
        if (card && card.id) {
          firstRects[card.id] = card.getBoundingClientRect();
        }
      });

      // Update DOM
      renderGrid(filtered, imagesManifest);

      // FLIP Last & Invert
      var newCards = Array.from(grid.querySelectorAll('.comm-card'));
      newCards.forEach(function(card) {
        var firstRect = firstRects[card.id];
        if (firstRect) {
          // Card existed before, calculate delta
          var lastRect = card.getBoundingClientRect();
          var deltaX = firstRect.left - lastRect.left;
          var deltaY = firstRect.top - lastRect.top;
          
          if (deltaX !== 0 || deltaY !== 0) {
            // Invert
            card.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px)';
            card.style.transition = 'none';
            
            // Play
            requestAnimationFrame(function() {
              if (card) {
                card.style.transform = '';
                card.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
              }
            });
          }
        } else {
          // New card appearing
          card.classList.add('is-hidden');
          cardObserver.observe(card);
        }
      });
      
      // Update "All" tab count dynamically
      // Update "All Communities" tab label
      var allTab = document.querySelector('.filter-tab[data-filter="all"]');
      if (allTab) {
        allTab.textContent = searchQuery ? ('All Communities (' + filtered.length + ')') : 'All Communities';
        if (currentCountry === 'all') updatePill(allTab);
      }
    }

    // Tab Listeners
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { 
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        
        updatePill(tab);
        
        currentCountry = tab.getAttribute('data-filter');
        applyFilters();
      });
    });

    // Search Listener & Controls
    var searchInput = document.getElementById('comm-search');
    var clearBtn = document.getElementById('comm-search-clear');
    var searchTimeout = null;

    if (searchInput) {
      function handleSearchInput() {
        searchQuery = searchInput.value.trim();
        if (clearBtn) {
          clearBtn.style.display = searchQuery ? 'inline-flex' : 'none';
        }
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
          applyFilters();
        }, 150);
      }

      searchInput.addEventListener('input', handleSearchInput);

      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
        } else if (e.key === 'Escape') {
          searchInput.value = '';
          handleSearchInput();
        }
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          searchInput.value = '';
          searchInput.focus();
          handleSearchInput();
        });
      }

      var searchIcon = document.querySelector('.search-icon');
      if (searchIcon) {
        searchIcon.addEventListener('click', function() {
          searchInput.focus();
        });
      }
    }

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

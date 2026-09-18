/* ================================================================
   community-detail.js — High-Efficiency Archival Detail View
   Editorial Brutalist aesthetic with prominent hero showcase,
   inline community switcher, tabular metadata, and numbered apostolates.
   ================================================================ */
(function() {
  'use strict';

  /* ── Country flag map ───────────────────────────────────────── */
  var flags = {
    'India': '🇮🇳',
    'Germany': '🇩🇪',
    'Poland': '🇵🇱'
  };

  /* ── HTML Escape Utility (XSS Prevention) ──────────────────── */
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── SVG Icons ─────────────────────────────────────────────── */
  var pinIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
  var calendarIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  var cameraIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  var mailIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  var phoneIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var uploadIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  var crossIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="5" y1="8" x2="19" y2="8"></line></svg>';

  /* ── DOM Elements ───────────────────────────────────────────── */
  var heroSection = document.getElementById('detail-hero');
  var contentSection = document.getElementById('detail-content');
  var loadingEl = document.getElementById('detail-loading');
  var navSection = document.getElementById('detail-nav');

  /* ── Lightbox State & Logic ─────────────────────────────────── */
  var currentLightboxList = [];
  var currentLightboxIndex = 0;

  function initLightbox() {
    var modal = document.getElementById('lightbox-modal');
    var closeBtn = document.getElementById('lightbox-close');
    var prevBtn = document.getElementById('lightbox-prev');
    var nextBtn = document.getElementById('lightbox-next');

    if (!modal) return;

    function closeLightbox() {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function updateUI() {
      var imgEl = document.getElementById('lightbox-img');
      var captionEl = document.getElementById('lightbox-caption');
      if (!imgEl || !currentLightboxList.length) return;
      imgEl.src = currentLightboxList[currentLightboxIndex];
      if (captionEl) {
        captionEl.textContent = 'Archival Photograph ' + (currentLightboxIndex + 1) + ' of ' + currentLightboxList.length;
      }
    }

    function nextPhoto() {
      if (!currentLightboxList.length) return;
      currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxList.length;
      updateUI();
    }

    function prevPhoto() {
      if (!currentLightboxList.length) return;
      currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxList.length) % currentLightboxList.length;
      updateUI();
    }

    if (closeBtn) closeBtn.onclick = closeLightbox;
    if (nextBtn) nextBtn.onclick = nextPhoto;
    if (prevBtn) prevBtn.onclick = prevPhoto;

    modal.onclick = function(e) {
      if (e.target === modal) closeLightbox();
    };

    window.addEventListener('keydown', function(e) {
      if (!modal.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
    });

    // Touch Swipe Support
    var touchStartX = 0;
    var touchEndX = 0;
    
    modal.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches[0].screenX;
    }, {passive: true});

    modal.addEventListener('touchend', function(e) {
      touchEndX = e.changedTouches[0].screenX;
      if (touchEndX < touchStartX - 50) nextPhoto(); // Swipe left -> Next
      if (touchEndX > touchStartX + 50) prevPhoto(); // Swipe right -> Prev
    }, {passive: true});

    window._openLightbox = function(images, index) {
      if (!images || !images.length) return;
      currentLightboxList = images;
      currentLightboxIndex = index || 0;
      updateUI();
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };
  }

  /* ── Sister Upload & Folder Guide Modal ──────────────────────── */
  function setupUploadModal(community) {
    var modal = document.getElementById('upload-modal');
    var titleEl = document.getElementById('upload-modal-title');
    var pathEl = document.getElementById('folder-guide-path');
    var dropzone = document.getElementById('upload-dropzone');
    var fileInput = document.getElementById('upload-file-input');
    var isHeroCheckbox = document.getElementById('upload-is-hero');
    var statusEl = document.getElementById('upload-status');
    var closeBtn = document.getElementById('upload-modal-close');

    if (!modal) return;

    if (titleEl) titleEl.textContent = 'Archival Upload — ' + community.name;
    if (pathEl) pathEl.textContent = 'site/images/communities/' + community.id + '/';

    function openModal() {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      if (statusEl) {
        statusEl.className = 'upload-status';
        statusEl.textContent = '';
        statusEl.style.display = 'none';
      }
    }

    function closeModal() {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = function(e) {
      if (e.target === modal) closeModal();
    };

    /* Bind triggers across page */
    var triggers = document.querySelectorAll('.trigger-upload-modal');
    triggers.forEach(function(btn) {
      btn.onclick = openModal;
    });

    if (dropzone && fileInput) {
      dropzone.onclick = function() { fileInput.click(); };

      dropzone.ondragover = function(e) {
        e.preventDefault();
        dropzone.classList.add('dragover');
      };
      dropzone.ondragleave = function(e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      };
      dropzone.ondrop = function(e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          uploadFiles(e.dataTransfer.files);
        }
      };

      fileInput.onchange = function() {
        if (fileInput.files && fileInput.files.length > 0) {
          uploadFiles(fileInput.files);
        }
      };
    }

    function uploadFiles(files) {
      if (!files.length) return;
      var file = files[0];
      var formData = new FormData();
      formData.append('communityId', community.id);
      formData.append('isHero', isHeroCheckbox && isHeroCheckbox.checked ? 'true' : 'false');
      formData.append('file', file);
      var sisterNameInput = document.getElementById('upload-sister-name');
      var captionInput = document.getElementById('upload-photo-caption');
      if (sisterNameInput && sisterNameInput.value.trim()) {
        formData.append('sisterName', sisterNameInput.value.trim());
      }
      if (captionInput && captionInput.value.trim()) {
        formData.append('caption', captionInput.value.trim());
      }

      if (statusEl) {
        statusEl.className = 'upload-status';
        statusEl.style.display = 'block';
        statusEl.textContent = 'Uploading ' + file.name + ' to community archive…';
      }

      fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      .then(function(res) {
        if (!res.ok) throw new Error('Server returned ' + res.status);
        return res.json();
      })
      .then(function(data) {
        if (statusEl) {
          statusEl.className = 'upload-status success';
          statusEl.textContent = '✓ ' + (data.message || 'Photograph uploaded successfully! Reloading archive…');
        }
        setTimeout(function() {
          window.location.reload();
        }, 1200);
      })
      .catch(function() {
        if (statusEl) {
          statusEl.className = 'upload-status error';
          statusEl.innerHTML = 'Direct folder drop ready! Place photographs into:<br><code>site/images/communities/' + community.id + '/</code>';
        }
      });
    }
  }

  /* ── Render Hero Section with Highly Visible Image ─────────── */
  function renderHero(c, communities, currentIndex, allCommunityPhotos) {
    var flag = flags[c.country] || '';
    var totalCount = communities.length;
    var indexPad = String(currentIndex + 1).padStart(2, '0');
    var totalPad = String(totalCount).padStart(2, '0');
    var hasHeroImage = !!c.heroImage;
    var photoCount = allCommunityPhotos.length;

    var prevComm = currentIndex > 0 ? communities[currentIndex - 1] : null;
    var nextComm = currentIndex < totalCount - 1 ? communities[currentIndex + 1] : null;

    var html = '';

    /* 1. Quick In-Page Switcher Toolbar (Clean, Not Clumsy) */
    html += '<div class="archive-toolbar">';
    html += '  <div class="archive-toolbar-left">';
    html += '    <span class="archive-index-tag">ARCHIVE RECORD ' + indexPad + ' / ' + totalPad + '</span>';
    if (c.badge) {
      html += '    <span class="archive-badge-tag">' + c.badge + '</span>';
    }
    html += '  </div>';

    html += '  <div class="archive-toolbar-right">';
    html += '    <label for="community-quick-select" class="sr-only">Switch Community</label>';
    html += '    <select id="community-quick-select" class="archive-switcher-select">';
    communities.forEach(function(item, idx) {
      var itemFlag = flags[item.country] || '';
      var isSelected = (idx === currentIndex) ? ' selected' : '';
      html += '<option value="' + item.id + '"' + isSelected + '>' + (itemFlag ? itemFlag + ' ' : '') + item.name + '</option>';
    });
    html += '    </select>';

    var tbPrevSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
    var tbNextSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

    if (prevComm) {
      html += '    <a href="community.html?id=' + encodeURIComponent(prevComm.id) + '" class="toolbar-nav-btn" title="Previous: ' + prevComm.name + '" aria-label="Previous community: ' + prevComm.name + '">' + tbPrevSvg + '</a>';
    } else {
      html += '    <span class="toolbar-nav-btn disabled" aria-disabled="true" title="No previous community">' + tbPrevSvg + '</span>';
    }

    if (nextComm) {
      html += '    <a href="community.html?id=' + encodeURIComponent(nextComm.id) + '" class="toolbar-nav-btn" title="Next: ' + nextComm.name + '" aria-label="Next community: ' + nextComm.name + '">' + tbNextSvg + '</a>';
    } else {
      html += '    <span class="toolbar-nav-btn disabled" aria-disabled="true" title="No next community">' + tbNextSvg + '</span>';
    }
    html += '  </div>';
    html += '</div>';

    /* 2. Hero Header Block */
    html += '<div class="hero-header-block">';
    html += '  <div class="hero-header-inner">';
    html += '    <h1 class="community-title">' + esc(c.name) + '</h1>';
    html += '    <div class="community-geo-line">';
    html += '      ' + pinIcon + ' <span>' + (flag ? flag + ' ' : '') + esc(c.location) + '</span>';
    html += '      <span class="geo-sep">/</span>';
    html += '      ' + calendarIcon + ' <span>Founded ' + esc(String(c.established)) + '</span>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    /* 3. Tabular Key Facts Strip */
    html += '<div class="key-facts-strip">';
    html += '  <div class="fact-col">';
    html += '    <span class="fact-label">Established</span>';
    html += '    <span class="fact-value">' + esc(String(c.established)) + '</span>';
    html += '  </div>';
    html += '  <div class="fact-col">';
    html += '    <span class="fact-label">Location</span>';
    html += '    <span class="fact-value">' + (c.country ? (flags[c.country] || '') + ' ' + esc(c.country) : esc(c.location)) + '</span>';
    html += '  </div>';
    html += '  <div class="fact-col">';
    html += '    <span class="fact-label">Active Apostolates</span>';
    html += '    <span class="fact-value">' + (c.ministries ? c.ministries.length : 0) + ' Ministries</span>';
    html += '  </div>';
    html += '  <div class="fact-col">';
    html += '    <span class="fact-label">Archival Record</span>';
    html += '    <span class="fact-value">' + (photoCount > 0 ? (photoCount + ' Photo' + (photoCount > 1 ? 's' : '')) : 'Cataloged') + '</span>';
    html += '  </div>';
    html += '</div>';

    /* 4. PROMINENT HERO IMAGE SHOWCASE (Clear, 100% visible, crisp natural light) */
    if (hasHeroImage) {
      html += '<div class="hero-showcase-container">';
      html += '  <div class="hero-showcase-frame">';
      html += '    <img src="' + esc(c.heroImage) + '" alt="' + esc(c.name) + ' archival photograph" class="hero-showcase-img" id="hero-main-img">';
      html += '    <div class="hero-showcase-caption">';
      html += '      <div class="caption-left">';
      html += '        ' + cameraIcon + ' <span>Archival Photograph: ' + esc(c.name) + ' (' + esc(String(c.established)) + ')</span>';
      html += '      </div>';
      html += '      <button type="button" class="hero-expand-btn" id="hero-expand-btn" aria-label="View photo full screen">';
      html += '        <span>Full Resolution</span> ⤢';
      html += '      </button>';
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
    } else {
      /* Dignified Archival Monogram Seal when no image exists yet */
      html += '<div class="hero-seal-container">';
      html += '  <div class="hero-seal-box">';
      html += '    <div class="seal-crest">' + crossIcon + '</div>';
      html += '    <div class="seal-title">Congregation of Satyaseva Catechist Sisters</div>';
      html += '    <div class="seal-sub">' + c.name + ' • Est. ' + c.established + '</div>';
      html += '    <p class="seal-note">Photographic archive for this mission house is actively being compiled.</p>';
      html += '    <button type="button" class="upload-trigger-btn trigger-upload-modal">';
      html += '      ' + uploadIcon + ' <span>Upload First Archival Photo</span>';
      html += '    </button>';
      html += '  </div>';
      html += '</div>';
    }

    heroSection.innerHTML = html;

    /* Attach events for quick switcher and hero expand */
    var selectEl = document.getElementById('community-quick-select');
    if (selectEl) {
      selectEl.onchange = function() {
        var chosenId = selectEl.value;
        if (chosenId && chosenId !== c.id) {
          window.location.href = 'community.html?id=' + encodeURIComponent(chosenId);
        }
      };
    }

    var heroExpandBtn = document.getElementById('hero-expand-btn');
    var heroMainImg = document.getElementById('hero-main-img');
    if (hasHeroImage && (heroExpandBtn || heroMainImg)) {
      var openHero = function() {
        if (window._openLightbox) {
          window._openLightbox(allCommunityPhotos, 0);
        }
      };
      if (heroExpandBtn) heroExpandBtn.onclick = openHero;
      if (heroMainImg) {
        heroMainImg.onclick = openHero;
        heroMainImg.style.cursor = 'pointer';
      }
    }
  }

  /* ── Render Content Sections ────────────────────────────────── */
  function renderContent(c, allCommunityPhotos) {
    var html = '';

    /* ── Section: Description & Mission Statement ── */
    if (c.description) {
      html += '<section class="detail-section" id="about-section">';
      html += '  <div class="section-title-wrap">';
      html += '    <div class="section-kicker">01 / OVERVIEW</div>';
      html += '    <h2 class="section-heading">Historical Overview &amp; Community Spirit</h2>';
      html += '  </div>';
      html += '  <p class="editorial-lead-text">' + c.description + '</p>';
      html += '</section>';
    }

    /* ── Section: Numbered Apostolates Ledger ── */
    if (c.ministries && c.ministries.length > 0) {
      html += '<section class="detail-section" id="ministries-section">';
      html += '  <div class="section-title-wrap">';
      html += '    <div class="section-kicker">02 / APOSTOLATES</div>';
      html += '    <h2 class="section-heading">Active Ministries &amp; Pastoral Outreach (' + c.ministries.length + ')</h2>';
      html += '  </div>';
      html += '  <div class="apostolates-ledger">';
      c.ministries.forEach(function(m, i) {
        var numStr = String(i + 1).padStart(2, '0');
        html += '    <div class="apostolate-row">';
        html += '      <span class="apostolate-num">' + numStr + '</span>';
        html += '      <div class="apostolate-body">';
        html += '        <p class="apostolate-text">' + m + '</p>';
        html += '      </div>';
        html += '    </div>';
      });
      html += '  </div>';
      html += '</section>';
    }

    /* ── Section: Members (Only if data exists, no empty placeholder clutter) ── */
    if (c.members && c.members.length > 0) {
      html += '<section class="detail-section" id="members-section">';
      html += '  <div class="section-title-wrap">';
      html += '    <div class="section-kicker">03 / COMMUNITY MEMBERS</div>';
      html += '    <h2 class="section-heading">Sisters Stationed</h2>';
      html += '  </div>';
      html += '  <div class="members-grid">';
      c.members.forEach(function(m) {
        html += '    <div class="member-card">';
        if (m.photo) {
          html += '      <div class="member-photo" style="background-image:url(\'' + m.photo + '\')"></div>';
        } else {
          html += '      <div class="member-photo member-photo-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>';
        }
        html += '      <div class="member-info">';
        html += '        <h4>' + m.name + '</h4>';
        if (m.role) html += '        <span class="member-role">' + m.role + '</span>';
        html += '      </div>';
        html += '    </div>';
      });
      html += '  </div>';
      html += '</section>';
    }

    /* ── Section: Stories & Chronicles (Only if data exists) ── */
    if (c.stories && c.stories.length > 0) {
      html += '<section class="detail-section" id="stories-section">';
      html += '  <div class="section-title-wrap">';
      html += '    <div class="section-kicker">04 / CHRONICLES</div>';
      html += '    <h2 class="section-heading">Community Stories &amp; Milestones</h2>';
      html += '  </div>';
      html += '  <div class="stories-timeline">';
      c.stories.forEach(function(s) {
        html += '    <div class="story-card">';
        if (s.date) html += '      <div class="story-date">' + s.date + '</div>';
        html += '      <h4>' + s.title + '</h4>';
        html += '      <p>' + (s.excerpt || s.body || '') + '</p>';
        html += '    </div>';
      });
      html += '  </div>';
      html += '</section>';
    }

    /* ── Section: Photo Archive & Gallery ── */
    var totalPhotos = allCommunityPhotos.length;
    html += '<section class="detail-section" id="gallery-section">';
    html += '  <div class="gallery-header-row">';
    html += '    <div class="section-title-wrap" style="margin-bottom:0">';
    html += '      <div class="section-kicker">ARCHIVE / PHOTOGRAPHS</div>';
    html += '      <h2 class="section-heading">Visual Record (' + totalPhotos + ')</h2>';
    html += '    </div>';
    html += '    <button type="button" class="upload-trigger-btn trigger-upload-modal">';
    html += '      ' + uploadIcon + ' <span>Add Photos</span>';
    html += '    </button>';
    html += '  </div>';

    if (totalPhotos > 0) {
      html += '  <div class="detail-gallery-grid">';
      allCommunityPhotos.forEach(function(img, idx) {
        html += '    <div class="gallery-thumb-card" tabindex="0" role="button" data-index="' + idx + '" aria-label="View photo ' + (idx + 1) + '">';
        html += '      <img src="' + img + '" alt="' + c.name + ' archival photo ' + (idx + 1) + '" class="gallery-thumb-img" loading="lazy">';
        html += '      <div class="thumb-badge">Photo ' + (idx + 1) + ' ⤢</div>';
        html += '    </div>';
      });
      html += '  </div>';
    } else {
      html += '  <div class="gallery-empty-banner">';
      html += '    <div class="empty-banner-content">';
      html += '      ' + cameraIcon;
      html += '      <div>';
      html += '        <strong>No photographs currently on file for ' + c.name + '</strong>';
      html += '        <p>Drop images into <code>site/images/communities/' + c.id + '/</code> or click below to upload directly.</p>';
      html += '      </div>';
      html += '    </div>';
      html += '    <button type="button" class="upload-trigger-btn trigger-upload-modal" style="flex-shrink:0;">' + uploadIcon + ' Upload Photo</button>';
      html += '  </div>';
    }
    html += '</section>';

    /* ── Section: Contact / Location Details (if provided) ── */
    if (c.contact && (c.contact.address || c.contact.phone || c.contact.email)) {
      html += '<section class="detail-section" id="contact-section">';
      html += '  <div class="section-title-wrap">';
      html += '    <div class="section-kicker">COMMUNICATION</div>';
      html += '    <h2 class="section-heading">House Contact &amp; Postal Address</h2>';
      html += '  </div>';
      html += '  <div class="contact-card-grid">';
      if (c.contact.address) {
        html += '    <div class="contact-box">' + pinIcon + '<div><strong>Postal Address</strong><p>' + c.contact.address + '</p></div></div>';
      }
      if (c.contact.phone) {
        html += '    <div class="contact-box">' + phoneIcon + '<div><strong>Telephone</strong><p><a href="tel:' + c.contact.phone + '">' + c.contact.phone + '</a></p></div></div>';
      }
      if (c.contact.email) {
        html += '    <div class="contact-box">' + mailIcon + '<div><strong>Direct Email</strong><p><a href="mailto:' + c.contact.email + '">' + c.contact.email + '</a></p></div></div>';
      }
      html += '  </div>';
      html += '</section>';
    }

    /* ── Section: Archival Submission Portal Card ── */
    html += '<section class="detail-section archival-portal-section">';
    html += '  <div class="archival-portal-box">';
    html += '    <div class="portal-info">';
    html += '      <span class="portal-tag">SISTER PORTAL &amp; ARCHIVE REGISTRATION</span>';
    html += '      <h3>Are you stationed at ' + c.name + '?</h3>';
    html += '      <p>Help preserve the legacy of this community. Add historical photographs, update current ministries, or send sister roster updates to the generalate archive.</p>';
    html += '    </div>';
    html += '    <div class="portal-actions">';
    html += '      <button type="button" class="upload-trigger-btn trigger-upload-modal">' + uploadIcon + ' Add Photos Now</button>';
    html += '      <a href="admin.html" class="portal-link-btn">Sister Login / Admin →</a>';
    html += '    </div>';
    html += '  </div>';
    html += '</section>';

    contentSection.innerHTML = html;

    /* Attach IntersectionObserver for scroll-reveal entrance animations */
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      var sections = contentSection.querySelectorAll('.detail-section');
      sections.forEach(function(sec) {
        sec.classList.add('reveal-on-scroll');
        observer.observe(sec);
      });
    }

    /* Attach Lightbox events to thumbnails */
    var thumbs = contentSection.querySelectorAll('.gallery-thumb-card');
    thumbs.forEach(function(thumb) {
      thumb.onclick = function() {
        var idx = parseInt(thumb.getAttribute('data-index'), 10) || 0;
        if (window._openLightbox) window._openLightbox(allCommunityPhotos, idx);
      };
      thumb.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var idx = parseInt(thumb.getAttribute('data-index'), 10) || 0;
          if (window._openLightbox) window._openLightbox(allCommunityPhotos, idx);
        }
      };
    });

    /* Attach modal triggers */
    setupUploadModal(c);
  }

  /* ── Render Bottom Prev/Next Community Nav ───────────────────── */
  function renderNav(communities, currentIndex) {
    if (!navSection) return;

    var prev = currentIndex > 0 ? communities[currentIndex - 1] : null;
    var next = currentIndex < communities.length - 1 ? communities[currentIndex + 1] : null;

    var html = '';

    var leftArrowSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
    var rightArrowSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

    if (prev) {
      html += '<a href="community.html?id=' + encodeURIComponent(prev.id) + '" class="detail-nav-box prev" aria-label="Previous community: ' + prev.name + '">';
      html += '  <div class="nav-box-inner">';
      html += '    <div class="nav-arrow-badge">' + leftArrowSvg + '</div>';
      html += '    <div class="nav-box-content">';
      html += '      <span class="nav-direction-label">Previous Community</span>';
      html += '      <strong class="nav-community-name">' + prev.name + '</strong>';
      html += '      <span class="nav-community-meta">' + (flags[prev.country] || '') + ' ' + prev.location + ' • Est. ' + prev.established + '</span>';
      html += '    </div>';
      html += '  </div>';
      html += '</a>';
    } else {
      html += '<div class="detail-nav-placeholder"></div>';
    }

    if (next) {
      html += '<a href="community.html?id=' + encodeURIComponent(next.id) + '" class="detail-nav-box next" aria-label="Next community: ' + next.name + '">';
      html += '  <div class="nav-box-inner">';
      html += '    <div class="nav-box-content">';
      html += '      <span class="nav-direction-label">Next Community</span>';
      html += '      <strong class="nav-community-name">' + next.name + '</strong>';
      html += '      <span class="nav-community-meta">' + (flags[next.country] || '') + ' ' + next.location + ' • Est. ' + next.established + '</span>';
      html += '    </div>';
      html += '    <div class="nav-arrow-badge">' + rightArrowSvg + '</div>';
      html += '  </div>';
      html += '</a>';
    } else {
      html += '<div class="detail-nav-placeholder"></div>';
    }

    navSection.innerHTML = html;

    /* Global Keyboard Arrows for Community Switching */
    window.addEventListener('keydown', function(e) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      var activeLightbox = document.getElementById('lightbox-modal');
      var activeUpload = document.getElementById('upload-modal');
      if ((activeLightbox && activeLightbox.classList.contains('active')) ||
          (activeUpload && activeUpload.classList.contains('active'))) {
        return;
      }

      if (e.key === 'ArrowLeft' && prev) {
        window.location.href = 'community.html?id=' + encodeURIComponent(prev.id);
      } else if (e.key === 'ArrowRight' && next) {
        window.location.href = 'community.html?id=' + encodeURIComponent(next.id);
      }
    });
  }

  /* Initialize Lightbox immediately */
  initLightbox();

  /* ── Fetch and Render Data ───────────────────────────────────── */
  var params = new URLSearchParams(window.location.search);
  var requestedId = params.get('id');

  var cacheBuster = '?t=' + Date.now();
  function displayCommunity(communities, imagesManifest) {
    if (!communities || !communities.length) {
      throw new Error('Community catalog is empty');
    }

    /* Find community or default gracefully to mariyapura or first */
    var idx = -1;
    if (requestedId) {
      for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === requestedId) {
          idx = i;
          break;
        }
      }
    }

    /* If not found or no ID provided, default gracefully to Mariyapura or first item */
    if (idx === -1) {
      for (var j = 0; j < communities.length; j++) {
        if (communities[j].id === 'mariyapura') {
          idx = j;
          break;
        }
      }
      if (idx === -1) idx = 0;
    }

    var community = communities[idx];

    var adminLink = document.getElementById('nav-admin-link');
    if (adminLink) {
      adminLink.href = 'admin.html?id=' + encodeURIComponent(community.id);
      adminLink.title = 'Edit ' + community.name + ' in Admin Portal';
    }

    /* Merge folder images manifest */
    var folderData = imagesManifest[community.id] || null;
    if (folderData) {
      if (folderData.hero) community.heroImage = folderData.hero;
      if (folderData.gallery && folderData.gallery.length > 0) community.gallery = folderData.gallery;
      if (folderData.allImages && folderData.allImages.length > 0) community.allImages = folderData.allImages;
    }

    /* Consolidate all photos for lightbox/gallery */
    var allPhotos = [];
    if (community.heroImage) allPhotos.push(community.heroImage);
    if (community.gallery && community.gallery.length) {
      community.gallery.forEach(function(p) {
        if (allPhotos.indexOf(p) === -1) allPhotos.push(p);
      });
    }
    if (community.allImages && community.allImages.length) {
      community.allImages.forEach(function(p) {
        if (allPhotos.indexOf(p) === -1) allPhotos.push(p);
      });
    }

    /* Hide loader, reveal hero & content */
    if (loadingEl) loadingEl.style.display = 'none';
    if (heroSection) heroSection.style.display = '';
    if (contentSection) contentSection.style.display = '';

    /* Update page title */
    document.title = community.name + ' — Satyaseva Sisters Archive';

    /* Render sections */
    renderHero(community, communities, idx, allPhotos);
    renderContent(community, allPhotos);
    renderNav(communities, idx);
  }

  /* Fetch both communities data and community-images manifest */
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
    displayCommunity(results[0], results[1] || {});
  })
  .catch(function(err) {
    if (window.__INITIAL_COMMUNITIES__ && Array.isArray(window.__INITIAL_COMMUNITIES__)) {
      try {
        displayCommunity(window.__INITIAL_COMMUNITIES__, {});
        return;
      } catch (e2) {}
    }
    console.error('Community detail loading error:', err);
    if (loadingEl) {
      loadingEl.innerHTML = '<div class="error-box"><p>Unable to load community record.</p><a href="communities.html" class="portal-link-btn">Return to All Communities →</a></div>';
    }
  });

})();

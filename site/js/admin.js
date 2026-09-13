// ─── Admin Portal – Satyaseva Sisters ───
// Password-gated graphical editor for communities

(function () {
  'use strict';

  // ─── Constants ───
  const SESSION_KEY = 'sscs_admin_token';  // stores server-issued session token

  // ─── Utilities ───
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ─── State ───
  let communities = [];
  let currentCommunity = null;
  let activeTab = 'communities';
  let memorialSisters = [];
  let currentSister = null;
  let activeApiBase = '';
  let stationUploads = [];
  let dbStats = null;

  // ─── Secure Fetch: Only attach auth to same-origin API requests ───
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (token) {
      // Only attach Authorization header to same-origin or relative API requests
      let isSameOrigin = false;
      if (typeof url === 'string') {
        if (url.startsWith('/') || url.startsWith('./')) {
          isSameOrigin = true;
        } else {
          try {
            const parsed = new URL(url);
            isSameOrigin = parsed.origin === window.location.origin;
          } catch(e) {
            isSameOrigin = false;
          }
        }
      }
      if (isSameOrigin) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers['Authorization'] = 'Bearer ' + token;
      }
    }
    return originalFetch(url, options);
  };

  function getCandidateApiUrls(endpoint) {
    var origin = window.location.origin;
    var candidates = [];
    candidates.push(endpoint);
    if (activeApiBase) {
      candidates.push(activeApiBase + endpoint);
    }
    if (origin && origin.indexOf('http') === 0) {
      candidates.push(origin + endpoint);
    }
    if (window.location.protocol === 'http:') {
      candidates.push('http://localhost:8000' + endpoint);
      candidates.push('http://127.0.0.1:8000' + endpoint);
    }
    return candidates;
  }

  function fetchWithCandidates(endpoint) {
    var urls = getCandidateApiUrls(endpoint);
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        return Promise.reject(new Error('All API candidates failed for ' + endpoint));
      }
      var u = urls[i++];
      return fetch(u, { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json().then(function (data) {
            if (u.indexOf('http') === 0) {
              var parsed = new URL(u);
              activeApiBase = parsed.origin;
            } else if (u.indexOf('/') === 0) {
              activeApiBase = '';
            }
            return data;
          });
        })
        .catch(function () {
          return tryNext();
        });
    }
    return tryNext();
  }

  // ─── Toast Notifications ───
  function toast(message, type = 'info', duration = 3500) {
    const container = $('#toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  // ─── Authentication (server-side session tokens) ───
  function isAuthenticated() {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  async function authenticate(code) {
    const input = (code || '').trim();
    if (!input) return false;
    try {
      const res = await originalFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input })
      });
      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem(SESSION_KEY, data.token);
        return true;
      }
    } catch(e) {
      console.error('Auth error:', e);
    }
    return false;
  }

  function logout() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (token) {
      originalFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      }).catch(() => {});
    }
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  let adminInitialized = false;

  function showApp() {
    const gate = $('#login-gate');
    const app = $('#admin-app');
    if (gate) {
      gate.hidden = true;
      gate.style.display = 'none';
    }
    if (app) {
      app.hidden = false;
      app.style.display = 'flex';
    }
    if (!adminInitialized) {
      adminInitialized = true;
      initAdmin();
    }
  }

  function showGate() {
    const gate = $('#login-gate');
    const app = $('#admin-app');
    if (gate) {
      gate.hidden = false;
      gate.style.display = 'flex';
    }
    if (app) {
      app.hidden = true;
      app.style.display = 'none';
    }
  }

  function setupLoginGate() {
    if (isAuthenticated()) {
      showApp();
      return;
    }

    showGate();

    const form = $('#login-form');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const pwd = ($('#login-password').value || '').trim();
        const isValid = await authenticate(pwd);
        if (isValid) {
          showApp();
        } else {
          const err = $('#login-error');
          if (err) {
            err.hidden = false;
            err.style.display = 'block';
          }
          const card = document.querySelector('.login-card');
          if (card) {
            card.classList.remove('shake');
            void card.offsetWidth; // force reflow
            card.classList.add('shake');
          }
        }
      });
    }
  }

  // ─── Admin Initialization ───
  function initAdmin() {
    // Check URL parameters for tab and community id
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const targetId = urlParams.get('id') || urlParams.get('community');

    fetchCommunities(targetId);

    const tabCommBtn = $('#tab-btn-communities');
    const tabMemBtn = $('#tab-btn-memorial');
    const tabEvNewsBtn = $('#tab-btn-eventsnews');
    const tabInboxBtn = $('#tab-btn-inbox');
    const tabDbBtn = $('#tab-btn-database');
    
    const commView = $('#communities-view');
    const memView = $('#memorial-view');
    const evNewsView = $('#eventsnews-view');
    const inboxView = $('#inbox-view');
    const dbView = $('#database-view');

    function switchTab(tab) {
      activeTab = tab;
      const allTabs = [tabCommBtn, tabMemBtn, tabEvNewsBtn, tabInboxBtn, tabDbBtn];
      const allViews = [commView, memView, evNewsView, inboxView, dbView];
      
      allTabs.forEach(t => t && t.classList.remove('active'));
      allViews.forEach(v => v && (v.style.display = 'none'));

      if (tab === 'communities') {
        if (tabCommBtn) tabCommBtn.classList.add('active');
        if (commView) commView.style.display = 'flex';
      } else if (tab === 'memorial') {
        if (tabMemBtn) tabMemBtn.classList.add('active');
        if (memView) memView.style.display = 'flex';
        if (!memorialSisters.length) {
          fetchMemorialSisters();
        }
      } else if (tab === 'eventsnews') {
        if (tabEvNewsBtn) tabEvNewsBtn.classList.add('active');
        if (evNewsView) evNewsView.style.display = 'flex';
        fetchEventsAdmin();
        fetchNewsAdmin();
      } else if (tab === 'inbox') {
        if (tabInboxBtn) tabInboxBtn.classList.add('active');
        if (inboxView) inboxView.style.display = 'block';
        fetchInboxAdmin();
      } else if (tab === 'database') {
        if (tabDbBtn) tabDbBtn.classList.add('active');
        if (dbView) dbView.style.display = 'flex';
        fetchDbStats();
        fetchStationUploads();
        populateStationDropdowns();
      }
    }

    if (tabParam === 'memorial') {
      switchTab('memorial');
    } else if (tabParam === 'database') {
      switchTab('database');
    } else if (tabParam === 'eventsnews') {
      switchTab('eventsnews');
    } else if (tabParam === 'inbox') {
      switchTab('inbox');
    } else {
      switchTab('communities');
    }

    if (tabCommBtn) tabCommBtn.addEventListener('click', () => switchTab('communities'));
    if (tabMemBtn) tabMemBtn.addEventListener('click', () => switchTab('memorial'));
    if (tabEvNewsBtn) tabEvNewsBtn.addEventListener('click', () => switchTab('eventsnews'));
    if (tabInboxBtn) tabInboxBtn.addEventListener('click', () => switchTab('inbox'));
    if (tabDbBtn) tabDbBtn.addEventListener('click', () => switchTab('database'));

    const addCommBtn = $('#btn-add-community');
    if (addCommBtn) addCommBtn.addEventListener('click', addNewCommunityRecord);

    $('#search-input').addEventListener('input', e => filterCommunityList(e.target.value));
    $('#country-filters').addEventListener('click', e => {
      if (e.target.classList.contains('filter-btn')) toggleCountryFilter(e.target);
    });
    $('#save-btn').addEventListener('click', saveChanges);
    $('#export-btn').addEventListener('click', exportJSON);
    $('#logout-btn').addEventListener('click', logout);

    // Delegated events for dynamic editor
    $('#editor').addEventListener('click', handleEditorClick);
    $('#editor').addEventListener('change', handleEditorChange);

    // Memorial listeners
    const addSisterBtn = $('#btn-add-sister-record');
    if (addSisterBtn) addSisterBtn.addEventListener('click', addNewSisterRecord);

    const memSearch = $('#memorial-admin-search');
    if (memSearch) memSearch.addEventListener('input', e => filterMemorialList(e.target.value));

    const memEditor = $('#memorial-editor');
    if (memEditor) memEditor.addEventListener('click', handleMemorialEditorClick);

    // Database listeners
    const btnOpenUpload = $('#btn-open-station-upload');
    if (btnOpenUpload) btnOpenUpload.addEventListener('click', openStationUploadModal);

    const btnCloseUpload = $('#btn-close-upload-modal');
    if (btnCloseUpload) btnCloseUpload.addEventListener('click', closeStationUploadModal);

    const btnCancelUpload = $('#btn-cancel-upload-modal');
    if (btnCancelUpload) btnCancelUpload.addEventListener('click', closeStationUploadModal);

    const uploadForm = $('#station-upload-form');
    if (uploadForm) uploadForm.addEventListener('submit', handleStationUploadSubmit);

    const btnSyncStatic = $('#btn-sync-static');
    if (btnSyncStatic) btnSyncStatic.addEventListener('click', handleSyncStatic);

    const filterStation = $('#filter-upload-station');
    if (filterStation) filterStation.addEventListener('change', renderStationUploads);

    const filterType = $('#filter-upload-type');
    if (filterType) filterType.addEventListener('change', renderStationUploads);

    const filterSearch = $('#filter-upload-search');
    if (filterSearch) filterSearch.addEventListener('input', renderStationUploads);

    const uploadsTbody = $('#uploads-table-body');
    if (uploadsTbody) {
      uploadsTbody.addEventListener('click', e => {
        const viewBtn = e.target.closest('.btn-view-upload');
        if (viewBtn) {
          viewStationUploadDetails(viewBtn.dataset.id);
          return;
        }
        const delBtn = e.target.closest('.btn-delete-upload');
        if (delBtn) {
          deleteStationUploadRecord(delBtn.dataset.id);
          return;
        }
      });
    }

    const btnCloseView = $('#btn-close-view-modal');
    if (btnCloseView) btnCloseView.addEventListener('click', closeViewModal);

    const btnDismissView = $('#btn-dismiss-view-modal');
    if (btnDismissView) btnDismissView.addEventListener('click', closeViewModal);
  }

  function fetchCommunities(targetId) {
    fetchWithCandidates('/api/communities')
      .then(function (data) {
        if (Array.isArray(data) && data.length > 0) {
          communities = data;
          renderCommunityList();
          populateStationDropdowns();
          if (targetId) selectCommunity(targetId);
          return;
        }
        throw new Error('Empty community array');
      })
      .catch(function (err) {
        console.warn('API error, checking static candidates', err);
        var staticCandidates = [
          'data/communities.json?t=' + Date.now(),
          './data/communities.json?t=' + Date.now(),
          '/data/communities.json?t=' + Date.now(),
          '/sscs/site/data/communities.json?t=' + Date.now()
        ];
        var idx = 0;
        function tryStatic() {
          if (idx >= staticCandidates.length) {
            // Check window fallback dataset
            if (window.__INITIAL_COMMUNITIES__ && Array.isArray(window.__INITIAL_COMMUNITIES__)) {
              console.info('Loaded communities from embedded fallback dataset');
              communities = JSON.parse(JSON.stringify(window.__INITIAL_COMMUNITIES__));
              renderCommunityList();
              populateStationDropdowns();
              if (targetId) selectCommunity(targetId);
              return;
            }
            toast('Failed to load communities', 'error');
            return;
          }
          var sUrl = staticCandidates[idx++];
          fetch(sUrl)
            .then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.json();
            })
            .then(function (data) {
              if (Array.isArray(data) && data.length > 0) {
                communities = data;
                renderCommunityList();
                populateStationDropdowns();
                if (targetId) selectCommunity(targetId);
              } else {
                tryStatic();
              }
            })
            .catch(function () {
              tryStatic();
            });
        }
        tryStatic();
      });
  }

  function addNewCommunityRecord() {
    var ts = Date.now();
    var newComm = {
      id: 'community-' + ts,
      name: 'New Community SCS',
      established: new Date().getFullYear(),
      location: '',
      country: 'India',
      badge: '',
      heroImage: '',
      description: '',
      contact: { address: '', phone: '', email: '' },
      ministries: [],
      members: [],
      stories: [],
      gallery: []
    };
    communities.unshift(newComm);
    renderCommunityList();
    selectCommunity(newComm.id);
    toast('Created new community record. Edit details and click Save Changes.', 'info');
  }

  // ─── Sidebar ───
  function renderCommunityList() {
    const list = $('#community-list');
    list.innerHTML = '';
    communities.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c.name || c.id;
      li.dataset.id = c.id;
      li.addEventListener('click', () => selectCommunity(c.id));
      if (currentCommunity && currentCommunity.id === c.id) li.classList.add('active');
      list.appendChild(li);
    });
  }

  function filterCommunityList(term) {
    const lowered = term.toLowerCase();
    $$('#community-list li').forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(lowered) ? '' : 'none';
    });
  }

  function toggleCountryFilter(btn) {
    const country = btn.dataset.country;
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('#community-list li').forEach(li => {
      const comm = communities.find(c => c.id === li.dataset.id);
      const match = country === 'all' || (comm && comm.country === country);
      li.style.display = match ? '' : 'none';
    });
  }

  function selectCommunity(id) {
    currentCommunity = communities.find(c => c.id === id);
    $$('#community-list li').forEach(li => li.classList.toggle('active', li.dataset.id === id));
    renderEditor();
  }

  // ─── Editor Renderer ───
  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderEditor() {
    const editor = $('#editor');
    if (!currentCommunity) {
      editor.innerHTML = `<div class="editor-empty"><div class="empty-icon">📋</div><h3>Select a community</h3><p>Choose from the sidebar to start editing</p></div>`;
      return;
    }
    const c = currentCommunity;
    const contact = c.contact || {};

    // Basic Info
    const basicHTML = `
    <section class="editor-section" data-section="basic">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:2px solid var(--ink);padding-bottom:10px;">
        <h2 style="margin:0;">📝 Basic Information</h2>
        <button type="button" class="delete-community-btn" data-action="delete-community" style="background:#000;color:#fff;border:2px solid #000;padding:8px 16px;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;">Delete Community</button>
      </div>
      <div class="input-row">
        <div class="input-group"><label>Community Name</label><input type="text" data-field="name" value="${esc(c.name)}"></div>
        <div class="input-group"><label>Location</label><input type="text" data-field="location" value="${esc(c.location)}"></div>
      </div>
      <div class="input-row-3">
        <div class="input-group"><label>Established</label><input type="number" data-field="established" value="${c.established || ''}"></div>
        <div class="input-group"><label>Badge</label><input type="text" data-field="badge" value="${esc(c.badge)}" placeholder="e.g. Motherhouse"></div>
        <div class="input-group"><label>Country</label><input type="text" data-field="country" value="${esc(c.country)}" placeholder="India / Germany / Poland"></div>
      </div>
      <div class="input-group"><label>Description</label><textarea data-field="description" rows="3">${esc(c.description)}</textarea></div>
    </section>`;

    // Contact
    const contactHTML = `
    <section class="editor-section" data-section="contact">
      <h2>📞 Contact</h2>
      <div class="input-group"><label>Address</label><input type="text" data-field="contact.address" value="${esc(contact.address)}"></div>
      <div class="input-row">
        <div class="input-group"><label>Phone</label><input type="text" data-field="contact.phone" value="${esc(contact.phone)}"></div>
        <div class="input-group"><label>Email</label><input type="email" data-field="contact.email" value="${esc(contact.email)}"></div>
      </div>
    </section>`;

    // Ministries
    const tagsHTML = (c.ministries || []).map((m, i) =>
      `<span class="tag" data-index="${i}">${esc(m)}<button class="remove-tag" data-action="remove-ministry" data-index="${i}">✕</button></span>`
    ).join('');
    const ministryHTML = `
    <section class="editor-section" data-section="ministries">
      <h2>🙏 Ministries</h2>
      <div class="tag-container" id="ministry-tags">${tagsHTML}</div>
      <div class="add-inline">
        <input type="text" id="new-ministry" placeholder="Add a ministry...">
        <button class="add-btn" data-action="add-ministry">+ Add</button>
      </div>
    </section>`;

    // Members
    const membersRows = (c.members || []).map((m, i) => `
      <div class="member-row" data-index="${i}">
        <input type="text" class="member-name" placeholder="Sister's name" value="${esc(m.name)}">
        <input type="text" class="member-role" placeholder="Role / Designation" value="${esc(m.role)}">
        <button class="remove-member" data-action="remove-member" data-index="${i}">✕</button>
      </div>`).join('');
    const membersHTML = `
    <section class="editor-section" data-section="members">
      <h2>👥 Members</h2>
      <div id="members-list">${membersRows}</div>
      <button class="add-btn" data-action="add-member" style="margin-top:8px">+ Add Member</button>
    </section>`;

    // Stories (markdown)
    const storiesCards = (c.stories || []).map((s, i) => `
      <div class="story-card" data-index="${i}">
        <input type="text" class="story-title" placeholder="Story title" value="${esc(s.title)}">
        <textarea class="story-body" placeholder="Story body (supports markdown)">${esc(s.body)}</textarea>
        <div class="story-actions"><button class="story-remove-btn" data-action="remove-story" data-index="${i}">Remove</button></div>
      </div>`).join('');
    const storiesHTML = `
    <section class="editor-section" data-section="stories">
      <h2>📖 Stories</h2>
      <div id="stories-list">${storiesCards}</div>
      <button class="add-btn" data-action="add-story" style="margin-top:8px">+ Add Story</button>
    </section>`;

    // Gallery
    const galleryItems = (c.gallery || []).map(img => `
      <div class="gallery-item" style="background-image:url('${img}')">
        <button class="delete-btn" data-action="delete-photo" data-filename="${img.split('/').pop()}">✕</button>
      </div>`).join('');
    const galleryHTML = `
    <section class="editor-section" data-section="gallery">
      <h2>🖼️ Photo Gallery</h2>
      <div class="gallery-grid" id="gallery-grid">${galleryItems}</div>
      <div class="upload-zone" id="upload-zone">
        <input type="file" id="gallery-upload" multiple accept="image/*">
        <div class="upload-icon">📷</div>
        <div class="upload-label">Drag & drop images here or <strong>click to browse</strong></div>
      </div>
      <div class="hero-toggle-row">
        <input type="checkbox" id="hero-toggle"> <label for="hero-toggle">Set first uploaded image as hero/banner</label>
      </div>
    </section>`;

    editor.innerHTML = basicHTML + contactHTML + ministryHTML + membersHTML + storiesHTML + galleryHTML;

    // Setup upload zone
    setupUploadZone();
  }

  // ─── Delegated Event Handlers ───
  function handleEditorClick(e) {
    const action = e.target.dataset.action;
    if (!action) return;

    switch (action) {
      case 'delete-community': deleteCurrentCommunity(); break;
      case 'add-ministry': addMinistry(); break;
      case 'remove-ministry': removeMinistry(e.target); break;
      case 'add-member': addMember(); break;
      case 'remove-member': removeMember(e.target); break;
      case 'add-story': addStory(); break;
      case 'remove-story': removeStory(e.target); break;
      case 'delete-photo': deletePhoto(e.target); break;
    }
  }

  function deleteCurrentCommunity() {
    if (!currentCommunity) return;
    const confirmDelete = window.confirm('Are you sure you want to delete "' + (currentCommunity.name || currentCommunity.id) + '"? This action cannot be undone.');
    if (!confirmDelete) return;

    toast('Deleting community...', 'info', 2000);
    const apiTarget = (activeApiBase || '') + '/api/communities/delete';
    fetch(apiTarget, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentCommunity.id })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) {
          toast('Community deleted successfully', 'success');
          communities = communities.filter(function (c) { return c.id !== currentCommunity.id; });
          currentCommunity = null;
          renderCommunityList();
          renderEditor();
        } else {
          toast('Delete failed: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(function () {
        communities = communities.filter(function (c) { return c.id !== currentCommunity.id; });
        currentCommunity = null;
        renderCommunityList();
        renderEditor();
        toast('Community removed locally', 'info');
      });
  }

  function handleEditorChange(e) {
    // handled in gather
  }

  // ─── Ministries ───
  function addMinistry() {
    const input = $('#new-ministry');
    const val = input.value.trim();
    if (!val) return;
    const container = $('#ministry-tags');
    const idx = container.children.length;
    const span = document.createElement('span');
    span.className = 'tag';
    span.dataset.index = idx;
    span.innerHTML = `${esc(val)}<button class="remove-tag" data-action="remove-ministry" data-index="${idx}">✕</button>`;
    container.appendChild(span);
    input.value = '';
    input.focus();
  }

  function removeMinistry(btn) {
    btn.closest('.tag').remove();
  }

  // ─── Members ───
  function addMember() {
    const list = $('#members-list');
    const idx = list.children.length;
    const div = document.createElement('div');
    div.className = 'member-row';
    div.dataset.index = idx;
    div.innerHTML = `
      <input type="text" class="member-name" placeholder="Sister's name">
      <input type="text" class="member-role" placeholder="Role / Designation">
      <button class="remove-member" data-action="remove-member" data-index="${idx}">✕</button>`;
    list.appendChild(div);
  }

  function removeMember(btn) {
    btn.closest('.member-row').remove();
  }

  // ─── Stories ───
  function addStory() {
    const list = $('#stories-list');
    const idx = list.children.length;
    const div = document.createElement('div');
    div.className = 'story-card';
    div.dataset.index = idx;
    div.innerHTML = `
      <input type="text" class="story-title" placeholder="Story title">
      <textarea class="story-body" placeholder="Story body (supports markdown)"></textarea>
      <div class="story-actions"><button class="story-remove-btn" data-action="remove-story" data-index="${idx}">Remove</button></div>`;
    list.appendChild(div);
  }

  function removeStory(btn) {
    btn.closest('.story-card').remove();
  }

  // ─── Gallery Upload ───
  function setupUploadZone() {
    const zone = $('#upload-zone');
    const fileInput = $('#gallery-upload');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files.length) uploadFiles(e.target.files);
    });
  }

  function uploadFiles(files) {
    if (!currentCommunity) return;
    const heroToggle = $('#hero-toggle');
    const isHero = heroToggle ? heroToggle.checked : false;
    const form = new FormData();
    form.append('communityId', currentCommunity.id);
    form.append('isHero', isHero);
    for (let i = 0; i < files.length; i++) {
      form.append('file', files[i]);
    }
    toast('Uploading photos...', 'info');
    fetch((activeApiBase || '') + '/api/upload', { method: 'POST', body: form })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Photos uploaded successfully!', 'success');
          refreshCurrentCommunity();
        } else {
          toast('Upload error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Upload failed: ' + err, 'error'));
  }

  function deletePhoto(btn) {
    if (!currentCommunity) return;
    const filename = btn.dataset.filename;
    if (!confirm(`Delete "${filename}"?`)) return;
    fetch((activeApiBase || '') + '/api/delete-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId: currentCommunity.id, filename })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Photo deleted', 'success');
          refreshCurrentCommunity();
        } else {
          toast('Delete error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Delete failed: ' + err, 'error'));
  }

  function refreshCurrentCommunity() {
    fetchWithCandidates('/api/communities')
      .then(data => {
        communities = Array.isArray(data) ? data : [];
        if (currentCommunity) {
          currentCommunity = communities.find(c => c.id === currentCommunity.id) || null;
        }
        renderCommunityList();
        renderEditor();
      })
      .catch(() => {
        fetch('data/communities.json?t=' + Date.now())
          .then(r => r.json())
          .then(data => {
            communities = Array.isArray(data) ? data : [];
            if (currentCommunity) {
              currentCommunity = communities.find(c => c.id === currentCommunity.id) || null;
            }
            renderCommunityList();
            renderEditor();
          });
      });
  }

  // ─── Gather & Save ───
  function gatherFormData() {
    if (!currentCommunity) return null;
    const updated = JSON.parse(JSON.stringify(currentCommunity)); // deep clone

    // Basic fields
    const nameEl = $('[data-field="name"]');
    if (nameEl) updated.name = nameEl.value.trim();
    const locEl = $('[data-field="location"]');
    if (locEl) updated.location = locEl.value.trim();
    const estEl = $('[data-field="established"]');
    if (estEl) updated.established = estEl.value ? parseInt(estEl.value) : null;
    const badgeEl = $('[data-field="badge"]');
    if (badgeEl) updated.badge = badgeEl.value.trim();
    const countryEl = $('[data-field="country"]');
    if (countryEl) updated.country = countryEl.value.trim();
    const descEl = $('[data-field="description"]');
    if (descEl) updated.description = descEl.value.trim();

    // Contact
    const addrEl = $('[data-field="contact.address"]');
    const phoneEl = $('[data-field="contact.phone"]');
    const emailEl = $('[data-field="contact.email"]');
    updated.contact = {
      address: (addrEl ? addrEl.value : '').trim(),
      phone: (phoneEl ? phoneEl.value : '').trim(),
      email: (emailEl ? emailEl.value : '').trim()
    };

    // Ministries — extract text from tag spans, excluding the button text
    updated.ministries = Array.from($$('#ministry-tags .tag')).map(tag => {
      const clone = tag.cloneNode(true);
      const btn = clone.querySelector('.remove-tag');
      if (btn) btn.remove();
      return clone.textContent.trim();
    }).filter(Boolean);

    // Members
    updated.members = Array.from($$('#members-list .member-row')).map(row => {
      const n = row.querySelector('.member-name');
      const r = row.querySelector('.member-role');
      return {
        name: (n ? n.value : '').trim(),
        role: (r ? r.value : '').trim()
      };
    }).filter(m => m.name);

    // Stories
    updated.stories = Array.from($$('#stories-list .story-card')).map(card => {
      const t = card.querySelector('.story-title');
      const b = card.querySelector('.story-body');
      return {
        title: (t ? t.value : '').trim(),
        body: (b ? b.value : '').trim()
      };
    }).filter(s => s.title || s.body);

    return updated;
  }

  function saveChanges() {
    if (activeTab === 'memorial') {
      saveSisterChanges();
      return;
    }

    const payload = gatherFormData();
    if (!payload) { toast('No community selected', 'error'); return; }
    toast('Saving...', 'info', 2000);
    fetch((activeApiBase || '') + '/api/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Community saved successfully!', 'success');
          refreshCurrentCommunity();
        } else {
          toast('Save error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Save failed: ' + err, 'error'));
  }

  function exportJSON() {
    if (activeTab === 'memorial') {
      const dataStr = JSON.stringify(memorialSisters, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'memorial.json';
      a.click();
      URL.revokeObjectURL(url);
      toast('Memorial JSON exported!', 'success');
      return;
    }

    const dataStr = JSON.stringify(communities, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'communities.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('JSON exported!', 'success');
  }

  // ─── Memorial (Past Sisters) Management ───
  function fetchMemorialSisters() {
    fetchWithCandidates('/api/memorial')
      .then(function (data) {
        if (Array.isArray(data) && data.length > 0) {
          memorialSisters = data;
          renderMemorialList();
          return;
        }
        throw new Error('Empty memorial array');
      })
      .catch(function (err) {
        console.warn('Memorial API error, checking static candidates', err);
        var staticCandidates = [
          'data/memorial.json?t=' + Date.now(),
          './data/memorial.json?t=' + Date.now(),
          '/data/memorial.json?t=' + Date.now(),
          '/sscs/site/data/memorial.json?t=' + Date.now()
        ];
        var idx = 0;
        function tryStaticMem() {
          if (idx >= staticCandidates.length) {
            if (window.__INITIAL_MEMORIAL__ && Array.isArray(window.__INITIAL_MEMORIAL__)) {
              console.info('Loaded memorial sisters from embedded fallback dataset');
              memorialSisters = JSON.parse(JSON.stringify(window.__INITIAL_MEMORIAL__));
              renderMemorialList();
              return;
            }
            toast('Failed to load memorial records', 'error');
            return;
          }
          var sUrl = staticCandidates[idx++];
          fetch(sUrl)
            .then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.json();
            })
            .then(function (data) {
              if (Array.isArray(data) && data.length > 0) {
                memorialSisters = data;
                renderMemorialList();
              } else {
                tryStaticMem();
              }
            })
            .catch(function () {
              tryStaticMem();
            });
        }
        tryStaticMem();
      });
  }

  function renderMemorialList() {
    const list = $('#memorial-admin-list');
    if (!list) return;
    list.innerHTML = '';
    memorialSisters.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s.name || s.id;
      li.dataset.id = s.id;
      li.addEventListener('click', () => selectSister(s.id));
      if (currentSister && currentSister.id === s.id) li.classList.add('active');
      list.appendChild(li);
    });
  }

  function filterMemorialList(term) {
    const lowered = (term || '').toLowerCase();
    $$('#memorial-admin-list li').forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(lowered) ? '' : 'none';
    });
  }

  function selectSister(id) {
    currentSister = memorialSisters.find(s => s.id === id);
    $$('#memorial-admin-list li').forEach(li => li.classList.toggle('active', li.dataset.id === id));
    renderMemorialEditor();
  }

  function addNewSisterRecord() {
    const newSister = {
      id: 'sister-' + Date.now(),
      name: 'New Sister SCS',
      title: 'Sister',
      birthDate: '',
      professionDate: '',
      departureDate: '',
      photo: '',
      communities: [],
      ministry: '',
      biography: '',
      quote: '',
      burialPlace: ''
    };
    memorialSisters.unshift(newSister);
    renderMemorialList();
    selectSister(newSister.id);
  }

  function renderMemorialEditor() {
    const editor = $('#memorial-editor');
    if (!editor) return;

    if (!currentSister) {
      editor.innerHTML = `<div class="editor-empty"><div class="empty-icon">✝️</div><h3>Select a sister record</h3><p>Choose a sister from the sidebar to view or edit, or click "+ Add" to create a record.</p></div>`;
      return;
    }

    const s = currentSister;
    const commsStr = (s.communities || []).join(', ');

    editor.innerHTML = `
      <section class="editor-section" data-sister-id="${esc(s.id)}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid var(--ink);padding-bottom:12px;">
          <h2> Sister Memorial Record</h2>
          <button type="button" class="delete-sister-btn" style="background:#000;color:#fff;border:2px solid #000;padding:8px 16px;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;">Delete Record</button>
        </div>

        <div class="input-row">
          <div class="input-group">
            <label>Full Religious Name</label>
            <input type="text" id="mem-field-name" value="${esc(s.name)}" placeholder="e.g. Sr. M. Therese D'Mello SCS">
          </div>
          <div class="input-group">
            <label>Congregation Title / Role</label>
            <input type="text" id="mem-field-title" value="${esc(s.title)}" placeholder="e.g. Pioneer Catechist">
          </div>
        </div>

        <div class="input-row-3">
          <div class="input-group">
            <label>Date of Birth</label>
            <input type="date" id="mem-field-birth" value="${esc(s.birthDate)}">
          </div>
          <div class="input-group">
            <label>Date of Religious Vows / Profession</label>
            <input type="date" id="mem-field-profession" value="${esc(s.professionDate)}">
          </div>
          <div class="input-group">
            <label>Date of Eternal Rest</label>
            <input type="date" id="mem-field-departure" value="${esc(s.departureDate)}">
          </div>
        </div>

        <div class="input-row">
          <div class="input-group">
            <label>Communities Served (comma separated)</label>
            <input type="text" id="mem-field-communities" value="${esc(commsStr)}" placeholder="e.g. Marianiketan Mariyapura, St. Joseph Prakashpalaya">
          </div>
          <div class="input-group">
            <label>Place of Burial / Resting Place</label>
            <input type="text" id="mem-field-burial" value="${esc(s.burialPlace)}" placeholder="e.g. Mariyapura Motherhouse Cemetery">
          </div>
        </div>

        <div class="input-group">
          <label>Key Ministries &amp; Apostolates</label>
          <input type="text" id="mem-field-ministry" value="${esc(s.ministry)}" placeholder="e.g. Village Evangelization, Family Home Visits, Parish School">
        </div>

        <div class="input-group">
          <label>Life Story &amp; Biography</label>
          <textarea id="mem-field-bio" rows="6" placeholder="Chronicle of sister's vocation, virtues, service to families, and spiritual legacy...">${esc(s.biography)}</textarea>
        </div>

        <div class="input-group">
          <label>Spiritual Motto / Personal Quote</label>
          <input type="text" id="mem-field-quote" value="${esc(s.quote)}" placeholder="e.g. In every humble home, Christ is waiting.">
        </div>

        <div class="input-group">
          <label>Photograph Path or URL</label>
          <input type="text" id="mem-field-photo" value="${esc(s.photo)}" placeholder="e.g. images/mother-004.jpg">
        </div>

        <div style="margin-top:24px;display:flex;gap:14px;">
          <button type="button" id="btn-inline-save-sister" class="save-btn" style="padding:10px 24px;">Save Record</button>
        </div>
      </section>
    `;
  }

  function handleMemorialEditorClick(e) {
    if (e.target.closest('#btn-inline-save-sister')) {
      saveSisterChanges();
    } else if (e.target.closest('.delete-sister-btn')) {
      deleteCurrentSister();
    }
  }

  function gatherSisterFormData() {
    if (!currentSister) return null;
    const nameEl = $('#mem-field-name');
    const name = (nameEl ? nameEl.value : '').trim();
    if (!name) {
      toast('Sister name is required', 'error');
      return null;
    }

    const commsEl = $('#mem-field-communities');
    const commsStr = (commsEl ? commsEl.value : '').trim();
    const commsArr = commsStr ? commsStr.split(',').map(c => c.trim()).filter(Boolean) : [];

    const titleEl = $('#mem-field-title');
    const birthEl = $('#mem-field-birth');
    const profEl = $('#mem-field-profession');
    const depEl = $('#mem-field-departure');
    const burialEl = $('#mem-field-burial');
    const minEl = $('#mem-field-ministry');
    const bioEl = $('#mem-field-bio');
    const quoteEl = $('#mem-field-quote');
    const photoEl = $('#mem-field-photo');

    return {
      id: currentSister.id,
      name: name,
      title: (titleEl ? titleEl.value : '').trim(),
      birthDate: birthEl ? birthEl.value : '',
      professionDate: profEl ? profEl.value : '',
      departureDate: depEl ? depEl.value : '',
      communities: commsArr,
      burialPlace: (burialEl ? burialEl.value : '').trim(),
      ministry: (minEl ? minEl.value : '').trim(),
      biography: (bioEl ? bioEl.value : '').trim(),
      quote: (quoteEl ? quoteEl.value : '').trim(),
      photo: (photoEl ? photoEl.value : '').trim()
    };
  }

  function saveSisterChanges() {
    const payload = gatherSisterFormData();
    if (!payload) return;

    toast('Saving memorial record...', 'info', 2000);
    fetch((activeApiBase || '') + '/api/memorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast(res.message || 'Record saved successfully!', 'success');
          // Update in-memory
          const idx = memorialSisters.findIndex(s => s.id === payload.id);
          if (idx !== -1) {
            memorialSisters[idx] = payload;
          } else {
            memorialSisters.push(payload);
          }
          currentSister = payload;
          renderMemorialList();
        } else {
          toast('Save error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Save failed: ' + err, 'error'));
  }

  function deleteCurrentSister() {
    if (!currentSister) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete the memorial record for "${currentSister.name}"?`);
    if (!confirmDelete) return;

    toast('Deleting record...', 'info', 2000);
    fetch((activeApiBase || '') + '/api/memorial/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentSister.id })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Record deleted', 'success');
          memorialSisters = memorialSisters.filter(s => s.id !== currentSister.id);
          currentSister = null;
          renderMemorialList();
          renderMemorialEditor();
        } else {
          toast('Delete failed: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Delete failed: ' + err, 'error'));
  }

  // ─── Portable SQLite Database & Station Uploads ───
  function fetchDbStats() {
    fetchWithCandidates('/api/db/status')
      .then(function (data) {
        if (data && data.status === 'connected') {
          dbStats = data;
          const stationsEl = $('#db-stat-stations');
          const uploadsEl = $('#db-stat-uploads');
          const galleryEl = $('#db-stat-gallery');
          const sizeEl = $('#db-stat-size');
          const pathEl = $('#db-stat-path');
          const badgeEl = $('#db-status-badge');

          if (stationsEl) stationsEl.textContent = data.totalStations || '0';
          if (uploadsEl) uploadsEl.textContent = data.totalUploads || '0';
          if (galleryEl) galleryEl.textContent = data.totalGallery || '0';
          if (sizeEl) sizeEl.textContent = `${data.sizeKb} KB`;
          if (pathEl) pathEl.textContent = data.relPath || 'site/data/sscs.db';
          if (badgeEl) {
            badgeEl.innerHTML = `<span class="pulse-dot"></span> SQLite Connected (v${data.sqliteVersion})`;
          }
        }
      })
      .catch(function (err) {
        console.warn('Could not fetch DB stats:', err);
      });
  }

  function fetchStationUploads() {
    const stationFilter = $('#filter-upload-station') ? $('#filter-upload-station').value : 'all';
    const typeFilter = $('#filter-upload-type') ? $('#filter-upload-type').value : 'all';
    
    let url = '/api/station-uploads?';
    if (stationFilter && stationFilter !== 'all') url += `station=${encodeURIComponent(stationFilter)}&`;
    if (typeFilter && typeFilter !== 'all') url += `type=${encodeURIComponent(typeFilter)}&`;

    fetchWithCandidates(url)
      .then(function (data) {
        stationUploads = Array.isArray(data) ? data : [];
        renderStationUploads();
      })
      .catch(function (err) {
        console.warn('Could not fetch station uploads:', err);
        stationUploads = [];
        renderStationUploads();
      });
  }

  function populateStationDropdowns() {
    const filterSelect = $('#filter-upload-station');
    const formSelect = $('#form-upload-station');

    if (filterSelect) {
      const currentFilterVal = filterSelect.value;
      let filterHtml = '<option value="all">All Stations / Communities</option>';
      communities.forEach(c => {
        filterHtml += `<option value="${c.id}">${c.name} (${c.location || c.country || 'India'})</option>`;
      });
      filterSelect.innerHTML = filterHtml;
      if (currentFilterVal) filterSelect.value = currentFilterVal;
    }

    if (formSelect) {
      let formHtml = '<option value="" disabled selected>Select station community...</option>';
      communities.forEach(c => {
        formHtml += `<option value="${c.id}">${c.name}</option>`;
      });
      formSelect.innerHTML = formHtml;
    }
  }

  function renderStationUploads() {
    const tbody = $('#uploads-table-body');
    const countBadge = $('#uploads-count-badge');
    if (!tbody) return;

    const searchTerm = ($('#filter-upload-search') ? $('#filter-upload-search').value : '').toLowerCase().trim();
    const stationFilter = $('#filter-upload-station') ? $('#filter-upload-station').value : 'all';
    const typeFilter = $('#filter-upload-type') ? $('#filter-upload-type').value : 'all';

    let filtered = stationUploads.filter(item => {
      if (stationFilter !== 'all' && item.stationId !== stationFilter) return false;
      if (typeFilter !== 'all' && item.uploadType !== typeFilter) return false;
      if (searchTerm) {
        const hay = `${item.title} ${item.sisterName} ${item.content} ${item.stationName}`.toLowerCase();
        if (!hay.includes(searchTerm)) return false;
      }
      return true;
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:48px 16px;color:var(--ink-faint);">
            <div style="font-size:24px;margin-bottom:8px;">📂</div>
            <strong>No station uploads found</strong>
            <p style="font-size:12px;margin-top:4px;">Click "+ New Station Upload" to record data or reports from a station.</p>
          </td>
        </tr>
      `;
      return;
    }

    const typeLabels = {
      monthly_report: 'Monthly Report',
      chronicle: 'Chronicle',
      ministry_update: 'Ministry Update',
      photo: 'Photo Upload',
      event: 'Feast / Event',
      prayer_request: 'Prayer Request',
      general: 'General'
    };

    let html = '';
    filtered.forEach(item => {
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
      const label = typeLabels[item.uploadType] || item.uploadType;
      const rawPreview = item.content ? (item.content.length > 80 ? item.content.slice(0, 80) + '…' : item.content) : (item.filePath ? `Attached file: ${item.filePath}` : '—');

      html += `
        <tr data-upload-id="${esc(String(item.id))}">
          <td style="font-weight:700;">${esc(item.stationName || item.stationId)}</td>
          <td>${esc(item.sisterName || 'Sister SCS')}</td>
          <td><span class="type-badge type-${esc(item.uploadType)}">${esc(label)}</span></td>
          <td>
            <div style="font-weight:600;color:var(--ink);">${esc(item.title)}</div>
            <div style="font-size:12px;color:var(--ink-soft);">${esc(rawPreview)}</div>
          </td>
          <td style="white-space:nowrap;font-size:12px;color:var(--ink-soft);">${esc(dateStr)}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button type="button" class="action-btn-sm btn-view-upload" data-id="${esc(String(item.id))}">View</button>
            <button type="button" class="action-btn-sm action-btn-danger btn-delete-upload" data-id="${esc(String(item.id))}">Delete</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function handleStationUploadSubmit(e) {
    e.preventDefault();
    const stationId = $('#form-upload-station').value;
    const sisterName = $('#form-upload-sister').value;
    const uploadType = $('#form-upload-type').value;
    const title = $('#form-upload-title').value;
    const content = $('#form-upload-content').value;

    if (!stationId || !title) {
      toast('Please fill in required fields: station and title', 'error');
      return;
    }

    const payload = {
      stationId,
      sisterName,
      uploadType,
      title,
      content,
      metadata: { clientTimestamp: new Date().toISOString() }
    };

    toast('Saving to SQLite database...', 'info', 1500);

    fetch((activeApiBase || '') + '/api/station-uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Station data saved to SQLite database!', 'success');
          closeStationUploadModal();
          fetchStationUploads();
          fetchDbStats();
        } else {
          toast('Error saving upload: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Upload failed: ' + err, 'error'));
  }

  function deleteStationUploadRecord(id) {
    if (!window.confirm('Are you sure you want to delete this station upload record?')) return;
    toast('Deleting record from database...', 'info', 1500);

    fetch((activeApiBase || '') + '/api/station-uploads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Record deleted from database', 'success');
          fetchStationUploads();
          fetchDbStats();
        } else {
          toast('Delete failed: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Delete failed: ' + err, 'error'));
  }

  function viewStationUploadDetails(id) {
    const item = stationUploads.find(u => String(u.id) === String(id));
    if (!item) return;

    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : '—';
    const bodyEl = $('#view-modal-body');
    const titleEl = $('#view-modal-title');
    if (titleEl) titleEl.textContent = item.title;

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <span class="type-badge type-${item.uploadType}">${item.uploadType}</span>
            <strong style="font-size:14px;">${item.stationName || item.stationId}</strong>
            <span style="font-size:12px;color:var(--ink-soft);">• Submitted by <strong>${item.sisterName || 'Sister SCS'}</strong></span>
            <span style="font-size:12px;color:var(--ink-faint);margin-left:auto;">${dateStr}</span>
          </div>
          
          <div style="background:var(--bg);border:1px solid var(--ink);padding:16px;font-size:14px;white-space:pre-wrap;line-height:1.6;">
            ${item.content || '<em style="color:var(--ink-faint);">No detailed description provided.</em>'}
          </div>

          ${item.filePath ? `
            <div style="margin-top:8px;">
              <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-soft);">Attached File</label>
              <div style="margin-top:4px;">
                <a href="${item.filePath}" target="_blank" class="back-link" style="font-size:13px;">🔗 View Attached Image / Document</a>
              </div>
            </div>
          ` : ''}

          ${item.metadata && Object.keys(item.metadata).length ? `
            <div style="margin-top:8px;">
              <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-soft);">Metadata</label>
              <pre style="background:#fff;border:1px solid #ccc;padding:8px;font-size:11px;margin-top:4px;overflow-x:auto;">${JSON.stringify(item.metadata, null, 2)}</pre>
            </div>
          ` : ''}
        </div>
      `;
    }

    const modal = $('#view-upload-modal');
    if (modal) modal.hidden = false;
  }

  function openStationUploadModal() {
    populateStationDropdowns();
    const form = $('#station-upload-form');
    if (form) form.reset();
    const modal = $('#station-upload-modal');
    if (modal) modal.hidden = false;
  }

  function closeStationUploadModal() {
    const modal = $('#station-upload-modal');
    if (modal) modal.hidden = true;
  }

  function closeViewModal() {
    const modal = $('#view-upload-modal');
    if (modal) modal.hidden = true;
  }

  function handleSyncStatic() {
    toast('Synchronizing SQLite to static JSON & JS...', 'info', 2000);
    fetch((activeApiBase || '') + '/api/db/sync', { method: 'POST' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Static site files successfully synced!', 'success');
        } else {
          toast('Sync error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Sync failed: ' + err, 'error'));
  }

  // ─── Keyboard shortcut: Enter in ministry input adds the tag ───
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'new-ministry') {
      e.preventDefault();
      addMinistry();
    }
  });

  // ─── Events & News Handlers ───
  function fetchEventsAdmin() {
    fetch('/api/events')
      .then(r => r.json())
      .then(data => {
        const list = $('#admin-events-list');
        if (!list) return;
        list.innerHTML = '';
        (data || []).forEach(e => {
          const li = document.createElement('li');
          li.textContent = `${e.date}: ${e.title}`;
          li.style.padding = '8px';
          li.style.borderBottom = '1px solid #ccc';
          list.appendChild(li);
        });
      })
      .catch(console.error);
  }

  function fetchNewsAdmin() {
    fetch('/api/news')
      .then(r => r.json())
      .then(data => {
        const list = $('#admin-news-list');
        if (!list) return;
        list.innerHTML = '';
        (data || []).forEach(n => {
          const li = document.createElement('li');
          li.textContent = `${n.date}: ${n.title}`;
          li.style.padding = '8px';
          li.style.borderBottom = '1px solid #ccc';
          list.appendChild(li);
        });
      })
      .catch(console.error);
  }

  // ─── Inbox Handlers ───
  function fetchInboxAdmin() {
    // Contacts
    fetch('/api/contact')
      .then(r => r.json())
      .then(data => {
        const tbody = $('#admin-contact-tbody');
        if (!tbody) return;
        let html = '';
        (data || []).forEach(m => {
          html += `<tr><td>${esc(new Date(m.created_at).toLocaleDateString())}</td><td>${esc(m.name)}</td><td>${esc(m.email)}</td><td>${esc(m.subject || '-')}</td><td>${esc(m.status || 'new')}</td><td><button class="export-btn" style="padding:4px;" onclick="alert('View/Reply to be implemented')">View</button></td></tr>`;
        });
        tbody.innerHTML = html || '<tr><td colspan="6">No messages</td></tr>';
      }).catch(console.error);

    // Prayers
    fetch('/api/prayers')
      .then(r => r.json())
      .then(data => {
        const tbody = $('#admin-prayers-tbody');
        if (!tbody) return;
        let html = '';
        (data || []).forEach(p => {
          html += `<tr><td>${esc(new Date(p.created_at).toLocaleDateString())}</td><td>${esc(p.name || 'Anonymous')}</td><td>${esc(p.intention)}</td><td>${esc(p.status || 'pending')}</td><td><button class="save-btn" style="padding:4px;" onclick="alert('Approve to be implemented')">Approve</button></td></tr>`;
        });
        tbody.innerHTML = html || '<tr><td colspan="5">No prayer requests</td></tr>';
      }).catch(console.error);

    // Newsletters
    fetch('/api/newsletter')
      .then(r => r.json())
      .then(data => {
        const tbody = $('#admin-newsletter-tbody');
        if (!tbody) return;
        let html = '';
        (data || []).forEach(sub => {
          html += `<tr><td>${esc(new Date(sub.subscribed_at).toLocaleDateString())}</td><td>${esc(sub.email)}</td></tr>`;
        });
        tbody.innerHTML = html || '<tr><td colspan="2">No subscribers</td></tr>';
      }).catch(console.error);
  }

  // ─── Boot ───
  document.addEventListener('DOMContentLoaded', setupLoginGate);
})();

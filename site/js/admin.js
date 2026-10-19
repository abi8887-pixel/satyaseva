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
      let shouldAttach = false;
      if (typeof url === 'string') {
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('api/')) {
          shouldAttach = true;
        } else {
          try {
            const parsed = new URL(url, window.location.href);
            shouldAttach = parsed.origin === window.location.origin ||
                           (activeApiBase && parsed.origin === new URL(activeApiBase, window.location.href).origin) ||
                           parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
          } catch(e) {
            shouldAttach = false;
          }
        }
      }
      if (shouldAttach) {
        options = options || {};
        if (options.headers && typeof options.headers.set === 'function') {
          if (!options.headers.has('Authorization')) {
            options.headers.set('Authorization', 'Bearer ' + token);
          }
        } else {
          options.headers = options.headers || {};
          options.headers['Authorization'] = 'Bearer ' + token;
        }
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
          const card = $('#login-card-main') || document.querySelector('.login-card');
          if (card) {
            card.classList.remove('shake');
            void card.offsetWidth; // force reflow
            card.classList.add('shake');
          }
        }
      });
    }

    // ── Forgot & Reset Password Flow ──
    const mainCard = $('#login-card-main');
    const resetCard = $('#reset-card');
    const btnForgot = $('#btn-forgot-password');
    const cancelBtns = $$('.btn-cancel-reset');
    const step1 = $('#reset-step-1');
    const step2 = $('#reset-step-2');
    const resetReqForm = $('#reset-request-form');
    const resetConfirmForm = $('#reset-confirm-form');
    const resetErr = $('#reset-error');
    const resetSucc = $('#reset-success');
    const btnResend = $('#btn-resend-code');

    let resetEmailPending = '';

    function showResetError(msg) {
      if (!resetErr) return;
      resetErr.textContent = msg;
      resetErr.hidden = false;
      resetErr.style.display = 'block';
      if (resetSucc) resetSucc.style.display = 'none';
      if (resetCard) {
        resetCard.classList.remove('shake');
        void resetCard.offsetWidth;
        resetCard.classList.add('shake');
      }
    }

    function showResetSuccess(msg) {
      if (!resetSucc) return;
      resetSucc.textContent = msg;
      resetSucc.style.display = 'block';
      if (resetErr) {
        resetErr.hidden = true;
        resetErr.style.display = 'none';
      }
    }

    function clearResetAlerts() {
      if (resetErr) { resetErr.hidden = true; resetErr.style.display = 'none'; }
      if (resetSucc) { resetSucc.style.display = 'none'; }
    }

    if (btnForgot && mainCard && resetCard) {
      btnForgot.addEventListener('click', () => {
        mainCard.style.display = 'none';
        resetCard.style.display = 'block';
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        clearResetAlerts();
        const emailInput = $('#reset-email');
        if (emailInput) emailInput.focus();
      });
    }

    cancelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (resetCard) resetCard.style.display = 'none';
        if (mainCard) mainCard.style.display = 'block';
        clearResetAlerts();
      });
    });

    if (btnResend) {
      btnResend.addEventListener('click', () => {
        if (step2) step2.style.display = 'none';
        if (step1) step1.style.display = 'block';
        clearResetAlerts();
        const emailInput = $('#reset-email');
        if (emailInput) emailInput.focus();
      });
    }

    if (resetReqForm) {
      resetReqForm.addEventListener('submit', async e => {
        e.preventDefault();
        clearResetAlerts();
        const email = ($('#reset-email').value || '').trim();
        if (!email) {
          showResetError('Please enter your administrator email.');
          return;
        }

        const submitBtn = $('#btn-send-reset-code');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sending...';
        }

        try {
          const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            resetEmailPending = email;
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'block';
            showResetSuccess(data.message || 'Verification code sent! Please check your email or server console.');
            const codeInput = $('#reset-code');
            if (codeInput) codeInput.focus();
          } else {
            showResetError(data.error || 'Failed to request reset code. Please try again.');
          }
        } catch (err) {
          showResetError('Network error connecting to server.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Code';
          }
        }
      });
    }

    if (resetConfirmForm) {
      resetConfirmForm.addEventListener('submit', async e => {
        e.preventDefault();
        clearResetAlerts();
        const code = ($('#reset-code').value || '').trim();
        const newPassword = ($('#reset-new-password').value || '').trim();
        const confirmPassword = ($('#reset-confirm-password').value || '').trim();

        if (!code) {
          showResetError('Please enter the 6-digit verification code.');
          return;
        }
        if (newPassword.length < 6) {
          showResetError('New access code must be at least 6 characters.');
          return;
        }
        if (newPassword !== confirmPassword) {
          showResetError('Access codes do not match.');
          return;
        }

        const confirmBtn = $('#btn-confirm-reset');
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Updating...';
        }

        try {
          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: resetEmailPending || ($('#reset-email').value || '').trim(),
              code,
              newPassword
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            if (data.token) {
              sessionStorage.setItem(SESSION_KEY, data.token);
            }
            toast(data.message || 'Access code reset successfully! Unlocking...', 'success');
            setTimeout(() => {
              showApp();
            }, 600);
          } else {
            showResetError(data.error || 'Failed to reset access code.');
          }
        } catch (err) {
          showResetError('Network error connecting to server.');
        } finally {
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Update & Log In';
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
    const tabRLogBtn = $('#tab-btn-responselog');
    const tabDbBtn = $('#tab-btn-database');
    
    const commView = $('#communities-view');
    const memView = $('#memorial-view');
    const evNewsView = $('#eventsnews-view');
    const inboxView = $('#inbox-view');
    const rlogView = $('#responselog-view');
    const dbView = $('#database-view');

    function switchTab(tab) {
      activeTab = tab;
      const allTabs = [tabCommBtn, tabMemBtn, tabEvNewsBtn, tabInboxBtn, tabRLogBtn, tabDbBtn];
      const allViews = [commView, memView, evNewsView, inboxView, rlogView, dbView];
      
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
      } else if (tab === 'responselog') {
        if (tabRLogBtn) tabRLogBtn.classList.add('active');
        if (rlogView) rlogView.style.display = 'block';
        fetchResponseLogs();
        fetchResponseLogStats();
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
    } else if (tabParam === 'responselog') {
      switchTab('responselog');
    } else {
      switchTab('communities');
    }

    if (tabCommBtn) tabCommBtn.addEventListener('click', () => switchTab('communities'));
    if (tabMemBtn) tabMemBtn.addEventListener('click', () => switchTab('memorial'));
    if (tabEvNewsBtn) tabEvNewsBtn.addEventListener('click', () => switchTab('eventsnews'));
    if (tabInboxBtn) tabInboxBtn.addEventListener('click', () => switchTab('inbox'));
    if (tabRLogBtn) tabRLogBtn.addEventListener('click', () => switchTab('responselog'));
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
    if (memEditor) {
      memEditor.addEventListener('click', handleMemorialEditorClick);
      memEditor.addEventListener('change', handleMemorialEditorChange);
    }

    // Events & News listeners
    const addEventBtn = $('#btn-add-event');
    if (addEventBtn) addEventBtn.addEventListener('click', addNewEvent);

    const addNewsBtn = $('#btn-add-news');
    if (addNewsBtn) addNewsBtn.addEventListener('click', addNewNews);

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

    const btnTestEmail = $('#btn-test-email');
    if (btnTestEmail) btnTestEmail.addEventListener('click', handleTestEmail);

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

    // Response Log listeners
    initResponseLogListeners();
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

    if (activeTab === 'eventsnews') {
      if (currentEvent) {
        saveEventRecord();
      } else if (currentNews) {
        saveNewsRecord();
      } else {
        toast('Please select an event or news article to save', 'info');
      }
      return;
    }

    if (activeTab === 'stationuploads') {
      openStationUploadModal();
      return;
    }

    if (activeTab === 'database') {
      syncDatabaseWithStatic();
      return;
    }

    // Default: Communities tab
    const payload = gatherFormData();
    if (!payload) { toast('No community selected to save', 'error'); return; }
    toast('Saving community...', 'info', 2000);
    fetch((activeApiBase || '') + '/api/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.success) {
          toast('Community saved successfully!', 'success');
          refreshCurrentCommunity();
        } else {
          toast('Save error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(function(err) { toast('Save failed: ' + err, 'error'); });
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
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="mem-field-photo" value="${esc(s.photo)}" placeholder="e.g. images/communities/mariyapura/sister.jpg" style="flex:1;">
            <label class="action-btn" style="cursor:pointer;padding:8px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px;margin:0;white-space:nowrap;">
              📷 Upload Photo
              <input type="file" id="mem-photo-upload" accept="image/*" style="display:none;">
            </label>
          </div>
          <div id="mem-photo-preview-wrap" style="margin-top:8px;">
            ${s.photo ? `<img src="${esc(s.photo)}" style="max-height:100px;border-radius:4px;border:1px solid var(--border);" alt="Sister Photo">` : ''}
          </div>
        </div>

        <div style="margin-top:24px;display:flex;gap:14px;">
          <button type="button" id="btn-inline-save-sister" class="save-btn" style="padding:10px 24px;">Save Record</button>
        </div>
      </section>
    `;
  }

  function handleMemorialEditorChange(e) {
    if (e.target && e.target.id === 'mem-photo-upload' && e.target.files && e.target.files.length) {
      uploadSisterPhoto(e.target.files[0]);
    }
  }

  function uploadSisterPhoto(file) {
    var form = new FormData();
    form.append('communityId', 'mariyapura');
    form.append('file', file);
    toast('Uploading sister photo...', 'info');
    fetch((activeApiBase || '') + '/api/upload', { method: 'POST', body: form })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.success && res.path) {
          var photoInput = $('#mem-field-photo');
          if (photoInput) photoInput.value = res.path;
          var previewWrap = $('#mem-photo-preview-wrap');
          if (previewWrap) {
            previewWrap.innerHTML = '<img src="' + esc(res.path) + '" style="max-height:100px;border-radius:4px;border:1px solid var(--border);" alt="Sister Photo">';
          }
          toast('Photo uploaded successfully!', 'success');
        } else {
          toast('Upload failed: ' + (res.error || 'unknown error'), 'error');
        }
      })
      .catch(function(err) { toast('Upload error: ' + err, 'error'); });
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

  function handleTestEmail() {
    toast('Testing Gmail / SMTP connection...', 'info', 3000);
    fetch((activeApiBase || '') + '/api/admin/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.success) {
          toast('✓ Test email dispatched to ' + (res.targetEmail || 'admin') + '! Check inbox.', 'success', 6000);
        } else {
          toast('SMTP Notice: ' + (res.message || res.error || 'Check server logs for details'), 'error', 7000);
        }
      })
      .catch(function(err) {
        toast('Connection failed: ' + err, 'error', 4000);
      });
  }

  // ─── Keyboard shortcut: Enter in ministry input adds the tag ───
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'new-ministry') {
      e.preventDefault();
      addMinistry();
    }
  });

  // ─── Events & News State & Handlers ───
  let adminEvents = [];
  let adminNews = [];
  let currentEditType = null; // 'event' or 'news'
  let currentEvent = null;
  let currentNews = null;

  function fetchEventsAdmin() {
    fetch('/api/events')
      .then(r => r.json())
      .then(data => {
        adminEvents = Array.isArray(data) ? data : [];
        renderEventsList();
      })
      .catch(err => {
        console.error('Failed to load events:', err);
        toast('Failed to load events', 'error');
      });
  }

  function fetchNewsAdmin() {
    fetch('/api/news')
      .then(r => r.json())
      .then(data => {
        adminNews = Array.isArray(data) ? data : [];
        renderNewsList();
      })
      .catch(err => {
        console.error('Failed to load news:', err);
        toast('Failed to load news', 'error');
      });
  }

  function renderEventsList() {
    const list = $('#admin-events-list');
    if (!list) return;
    list.innerHTML = '';

    if (!adminEvents.length) {
      const emptyLi = document.createElement('li');
      emptyLi.textContent = 'No events found';
      emptyLi.style.cssText = 'padding:12px 16px;color:var(--ink-faint);font-size:13px;font-style:italic;';
      list.appendChild(emptyLi);
      return;
    }

    adminEvents.forEach(e => {
      const li = document.createElement('li');
      const isSelected = currentEditType === 'event' && currentEvent && currentEvent.id === e.id;
      if (isSelected) li.classList.add('active');

      li.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:var(--gold-deep);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">${esc(e.date || '')}</div>
        <div style="font-weight:600;font-size:13px;line-height:1.3;color:var(--ink);">${esc(e.title || 'Untitled Event')}</div>
        ${e.location ? `<div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">📍 ${esc(e.location)}</div>` : ''}
      `;
      li.style.cursor = 'pointer';
      li.style.padding = '10px 14px';
      li.style.borderBottom = '1px solid var(--line)';

      li.addEventListener('click', () => selectEvent(e.id));
      list.appendChild(li);
    });
  }

  function renderNewsList() {
    const list = $('#admin-news-list');
    if (!list) return;
    list.innerHTML = '';

    if (!adminNews.length) {
      const emptyLi = document.createElement('li');
      emptyLi.textContent = 'No news articles found';
      emptyLi.style.cssText = 'padding:12px 16px;color:var(--ink-faint);font-size:13px;font-style:italic;';
      list.appendChild(emptyLi);
      return;
    }

    adminNews.forEach(n => {
      const li = document.createElement('li');
      const isSelected = currentEditType === 'news' && currentNews && currentNews.id === n.id;
      if (isSelected) li.classList.add('active');

      li.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:var(--sage);margin-bottom:2px;">${esc(n.date || '')} · By ${esc(n.author || 'Admin')}</div>
        <div style="font-weight:600;font-size:13px;line-height:1.3;color:var(--ink);">${esc(n.title || 'Untitled Article')}</div>
      `;
      li.style.cursor = 'pointer';
      li.style.padding = '10px 14px';
      li.style.borderBottom = '1px solid var(--line)';

      li.addEventListener('click', () => selectNews(n.id));
      list.appendChild(li);
    });
  }

  function selectEvent(id) {
    currentEditType = 'event';
    currentNews = null;
    currentEvent = adminEvents.find(e => e.id === id) || null;
    renderEventsList();
    renderNewsList();
    renderEventEditor();
  }

  function selectNews(id) {
    currentEditType = 'news';
    currentEvent = null;
    currentNews = adminNews.find(n => n.id === id) || null;
    renderEventsList();
    renderNewsList();
    renderNewsEditor();
  }

  function addNewEvent() {
    currentEditType = 'event';
    currentNews = null;
    currentEvent = {
      id: null,
      title: '',
      date: new Date().toISOString().slice(0, 10),
      time: '10:00 AM',
      location: '',
      description: ''
    };
    renderEventsList();
    renderNewsList();
    renderEventEditor();
    toast('Creating new event. Fill in details and click Save.', 'info');
  }

  function addNewNews() {
    currentEditType = 'news';
    currentEvent = null;
    currentNews = {
      id: null,
      title: '',
      author: 'Generalate Council',
      date: new Date().toISOString().slice(0, 10),
      image_path: '',
      content: ''
    };
    renderEventsList();
    renderNewsList();
    renderNewsEditor();
    toast('Creating new article. Fill in details and click Save.', 'info');
  }

  function renderEventEditor() {
    const editor = $('#eventsnews-editor');
    if (!editor) return;

    if (!currentEvent) {
      editor.innerHTML = `<div class="editor-empty"><div class="empty-icon">📅</div><h3>Select an event</h3><p>Choose an event from the sidebar or click "+ Add" above.</p></div>`;
      return;
    }

    const e = currentEvent;
    const isNew = !e.id;

    editor.innerHTML = `
      <section class="editor-section" data-event-id="${e.id || 'new'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid var(--ink);padding-bottom:12px;">
          <h2>📅 ${isNew ? 'New Calendar Event' : 'Edit Event'}</h2>
          ${!isNew ? `<button type="button" id="btn-delete-event" style="background:#000;color:#fff;border:2px solid #000;padding:8px 16px;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;">Delete Event</button>` : ''}
        </div>

        <div class="input-group">
          <label>Event Title *</label>
          <input type="text" id="ev-field-title" value="${esc(e.title || '')}" placeholder="e.g. 50th Golden Jubilee Solemn Celebration">
        </div>

        <div class="input-row">
          <div class="input-group">
            <label>Event Date (YYYY-MM-DD) *</label>
            <input type="date" id="ev-field-date" value="${esc(e.date || '')}">
          </div>
          <div class="input-group">
            <label>Time / Schedule</label>
            <input type="text" id="ev-field-time" value="${esc(e.time || '')}" placeholder="e.g. 09:30 AM or Full Day">
          </div>
        </div>

        <div class="input-group">
          <label>Location / Venue</label>
          <input type="text" id="ev-field-location" value="${esc(e.location || '')}" placeholder="e.g. Generalate Chapel, Mysore">
        </div>

        <div class="input-group">
          <label>Event Description / Program Details</label>
          <textarea id="ev-field-desc" rows="5" placeholder="Details about Holy Mass, celebrants, community participation, or special intentions...">${esc(e.description || '')}</textarea>
        </div>

        <div style="margin-top:24px;display:flex;gap:14px;">
          <button type="button" id="btn-save-event" class="save-btn" style="padding:10px 24px;">Save Event</button>
        </div>
      </section>
    `;

    const saveBtn = $('#btn-save-event');
    if (saveBtn) saveBtn.addEventListener('click', saveEventRecord);

    const delBtn = $('#btn-delete-event');
    if (delBtn) delBtn.addEventListener('click', deleteEventRecord);
  }

  function saveEventRecord() {
    if (!currentEvent) return;

    const title = $('#ev-field-title').value.trim();
    const date = $('#ev-field-date').value.trim();
    const time = $('#ev-field-time').value.trim();
    const location = $('#ev-field-location').value.trim();
    const description = $('#ev-field-desc').value.trim();

    if (!title || !date) {
      toast('Title and Date are required fields', 'error');
      return;
    }

    const payload = {
      title,
      date,
      time,
      location,
      description
    };

    const isUpdate = !!currentEvent.id;
    const url = isUpdate ? '/api/events/update' : '/api/events';
    if (isUpdate) payload.id = currentEvent.id;

    toast('Saving event...', 'info', 1500);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast(isUpdate ? 'Event updated successfully!' : 'Event created successfully!', 'success');
          const savedId = isUpdate ? currentEvent.id : res.id;
          fetch('/api/events')
            .then(r => r.json())
            .then(data => {
              adminEvents = Array.isArray(data) ? data : [];
              selectEvent(savedId);
            });
        } else {
          toast('Save error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Save failed: ' + err, 'error'));
  }

  function deleteEventRecord() {
    if (!currentEvent || !currentEvent.id) return;
    if (!confirm(`Are you sure you want to delete the event "${currentEvent.title}"?`)) return;

    toast('Deleting event...', 'info', 1500);

    fetch('/api/events/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentEvent.id })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Event deleted successfully', 'success');
          currentEvent = null;
          fetch('/api/events')
            .then(r => r.json())
            .then(data => {
              adminEvents = Array.isArray(data) ? data : [];
              renderEventsList();
              const editor = $('#eventsnews-editor');
              if (editor) {
                editor.innerHTML = `<div class="editor-empty"><div class="empty-icon">📅</div><h3>Event Deleted</h3><p>Choose an item from the sidebar or click "+ Add" above.</p></div>`;
              }
            });
        } else {
          toast('Delete failed: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Delete failed: ' + err, 'error'));
  }

  function renderNewsEditor() {
    const editor = $('#eventsnews-editor');
    if (!editor) return;

    if (!currentNews) {
      editor.innerHTML = `<div class="editor-empty"><div class="empty-icon">📰</div><h3>Select a news article</h3><p>Choose an article from the sidebar or click "+ Add" above.</p></div>`;
      return;
    }

    const n = currentNews;
    const isNew = !n.id;

    editor.innerHTML = `
      <section class="editor-section" data-news-id="${n.id || 'new'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid var(--ink);padding-bottom:12px;">
          <h2>📰 ${isNew ? 'New News Article' : 'Edit News Article'}</h2>
          ${!isNew ? `<button type="button" id="btn-delete-news" style="background:#000;color:#fff;border:2px solid #000;padding:8px 16px;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;">Delete Article</button>` : ''}
        </div>

        <div class="input-group">
          <label>Article Title / Headline *</label>
          <input type="text" id="news-field-title" value="${esc(n.title || '')}" placeholder="e.g. Golden Jubilee Countdown: Fifty Years of Family Service">
        </div>

        <div class="input-row">
          <div class="input-group">
            <label>Author / Source</label>
            <input type="text" id="news-field-author" value="${esc(n.author || '')}" placeholder="e.g. Generalate Council or Sr. Name">
          </div>
          <div class="input-group">
            <label>Publication Date (YYYY-MM-DD) *</label>
            <input type="date" id="news-field-date" value="${esc(n.date || '')}">
          </div>
        </div>

        <div class="input-group">
          <label>Header Image Path or URL</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="news-field-image" value="${esc(n.image_path || '')}" placeholder="e.g. images/communities/generalate/hero.jpg" style="flex:1;">
            <label class="action-btn" style="cursor:pointer;padding:8px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px;margin:0;white-space:nowrap;">
              📷 Upload Image
              <input type="file" id="news-image-upload" accept="image/*" style="display:none;">
            </label>
          </div>
          <div id="news-preview-wrap" style="margin-top:8px;">
            ${n.image_path ? `<img src="${esc(n.image_path)}" style="max-height:120px;border:2px solid var(--ink);border-radius:var(--radius-sm);" alt="Article Preview">` : ''}
          </div>
        </div>

        <div class="input-group">
          <label>Article Content *</label>
          <textarea id="news-field-content" rows="8" placeholder="Full chronicle or news report text...">${esc(n.content || '')}</textarea>
        </div>

        <div style="margin-top:24px;display:flex;gap:14px;">
          <button type="button" id="btn-save-news" class="save-btn" style="padding:10px 24px;">Save News Article</button>
        </div>
      </section>
    `;

    const saveBtn = $('#btn-save-news');
    if (saveBtn) saveBtn.addEventListener('click', saveNewsRecord);

    const delBtn = $('#btn-delete-news');
    if (delBtn) delBtn.addEventListener('click', deleteNewsRecord);

    const imgUpload = $('#news-image-upload');
    if (imgUpload) {
      imgUpload.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length) {
          uploadNewsImage(e.target.files[0]);
        }
      });
    }
  }

  function uploadNewsImage(file) {
    var form = new FormData();
    form.append('communityId', 'generalate');
    form.append('file', file);
    toast('Uploading news image...', 'info');
    fetch((activeApiBase || '') + '/api/upload', { method: 'POST', body: form })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.success && res.path) {
          var imgInput = $('#news-field-image');
          if (imgInput) imgInput.value = res.path;
          var previewWrap = $('#news-preview-wrap');
          if (previewWrap) {
            previewWrap.innerHTML = '<img src="' + esc(res.path) + '" style="max-height:120px;border:2px solid var(--ink);border-radius:var(--radius-sm);" alt="Article Preview">';
          }
          toast('Image uploaded successfully!', 'success');
        } else {
          toast('Upload failed: ' + (res.error || 'unknown error'), 'error');
        }
      })
      .catch(function(err) { toast('Upload error: ' + err, 'error'); });
  }

  function saveNewsRecord() {
    if (!currentNews) return;

    const title = $('#news-field-title').value.trim();
    const author = $('#news-field-author').value.trim() || 'Admin';
    const date = $('#news-field-date').value.trim();
    const image_path = $('#news-field-image').value.trim();
    const content = $('#news-field-content').value.trim();

    if (!title || !date || !content) {
      toast('Title, Date, and Content are required fields', 'error');
      return;
    }

    const payload = {
      title,
      author,
      date,
      image_path,
      content
    };

    const isUpdate = !!currentNews.id;
    const url = isUpdate ? '/api/news/update' : '/api/news';
    if (isUpdate) payload.id = currentNews.id;

    toast('Saving news article...', 'info', 1500);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast(isUpdate ? 'Article updated successfully!' : 'Article published successfully!', 'success');
          const savedId = isUpdate ? currentNews.id : res.id;
          fetch('/api/news')
            .then(r => r.json())
            .then(data => {
              adminNews = Array.isArray(data) ? data : [];
              selectNews(savedId);
            });
        } else {
          toast('Save error: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Save failed: ' + err, 'error'));
  }

  function deleteNewsRecord() {
    if (!currentNews || !currentNews.id) return;
    if (!confirm(`Are you sure you want to delete the news article "${currentNews.title}"?`)) return;

    toast('Deleting article...', 'info', 1500);

    fetch('/api/news/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentNews.id })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          toast('Article deleted successfully', 'success');
          currentNews = null;
          fetch('/api/news')
            .then(r => r.json())
            .then(data => {
              adminNews = Array.isArray(data) ? data : [];
              renderNewsList();
              const editor = $('#eventsnews-editor');
              if (editor) {
                editor.innerHTML = `<div class="editor-empty"><div class="empty-icon">📰</div><h3>Article Deleted</h3><p>Choose an item from the sidebar or click "+ Add" above.</p></div>`;
              }
            });
        } else {
          toast('Delete failed: ' + (res.error || 'unknown'), 'error');
        }
      })
      .catch(err => toast('Delete failed: ' + err, 'error'));
  }

  // ─── CSV Exporter Helper ───
  function exportToCSV(filename, rows) {
    if (!rows || !rows.length) {
      alert('No data available to export.');
      return;
    }
    const processRow = function (row) {
      return row.map(val => {
        var result = val === null || val === undefined ? '' : String(val);
        result = result.replace(/"/g, '""');
        if (result.search(/("|,|\n)/g) >= 0) {
          result = '"' + result + '"';
        }
        return result;
      }).join(',');
    };

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(processRow).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  window.handleReplyContact = function(id, email, subject) {
    // Mark message as read via API
    fetch('/api/contact/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, status: 'read' })
    }).then(() => fetchInboxAdmin()).catch(console.error);

    // Open mailto link
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=Re: ${encodeURIComponent(subject || 'Inquiry to Satyaseva Sisters')}`;
    window.location.href = mailtoUrl;
  };

  window.handlePrayerStatus = function(id, status) {
    fetch('/api/prayers/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, status: status })
    })
    .then(r => r.json())
    .then(res => {
      if (res.success) fetchInboxAdmin();
      else alert(res.error || 'Failed to update prayer status.');
    })
    .catch(console.error);
  };

  let lastFetchedContacts = [];
  let lastFetchedNewsletter = [];

  function updateUnreadBadge(unreadCount) {
    const badge = $('#inbox-unread-badge');
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  // ─── Inbox Handlers ───
  function fetchInboxAdmin() {
    let unreadCount = 0;

    // Contacts
    fetch('/api/contact')
      .then(r => r.json())
      .then(data => {
        lastFetchedContacts = data || [];
        const tbody = $('#admin-contact-tbody');
        if (!tbody) return;
        let html = '';
        lastFetchedContacts.forEach(m => {
          if (m.status === 'unread' || m.status === 'new') unreadCount++;
          const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString() : '';
          html += `<tr>
            <td>${esc(dateStr)}</td>
            <td>${esc(m.name)}</td>
            <td><a href="mailto:${esc(m.email)}" style="color:var(--sage-deep);">${esc(m.email)}</a></td>
            <td>${esc(m.subject || '-')}</td>
            <td><span class="badge ${m.status === 'read' ? 'badge-sage' : 'badge-gold'}" style="padding:2px 8px; font-size:11px; border-radius:12px;">${esc(m.status || 'unread')}</span></td>
            <td><button class="save-btn" style="padding:4px 8px; font-size:11px;" onclick="handleReplyContact(${m.id}, '${esc(m.email)}', '${esc(m.subject || '')}')">Reply ✉️</button></td>
          </tr>`;
        });
        tbody.innerHTML = html || '<tr><td colspan="6">No messages</td></tr>';
        updateUnreadBadge(unreadCount);
      }).catch(console.error);

    // Prayers
    fetch('/api/prayers')
      .then(r => r.json())
      .then(data => {
        const tbody = $('#admin-prayers-tbody');
        if (!tbody) return;
        let html = '';
        (data || []).forEach(p => {
          const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : '';
          const isApproved = p.status === 'approved';
          const nextStatus = isApproved ? 'pending' : 'approved';
          const btnText = isApproved ? 'Unapprove' : 'Approve ✓';
          const btnClass = isApproved ? 'export-btn' : 'save-btn';
          html += `<tr>
            <td>${esc(dateStr)}</td>
            <td>${esc(p.name || 'Anonymous')}</td>
            <td>${esc(p.intention)}</td>
            <td><span class="badge ${isApproved ? 'badge-sage' : 'badge-gold'}" style="padding:2px 8px; font-size:11px; border-radius:12px;">${esc(p.status || 'pending')}</span></td>
            <td><button class="${btnClass}" style="padding:4px 8px; font-size:11px;" onclick="handlePrayerStatus(${p.id}, '${nextStatus}')">${btnText}</button></td>
          </tr>`;
        });
        tbody.innerHTML = html || '<tr><td colspan="5">No prayer requests</td></tr>';
      }).catch(console.error);

    // Newsletters
    fetch('/api/newsletter')
      .then(r => r.json())
      .then(data => {
        lastFetchedNewsletter = data || [];
        const tbody = $('#admin-newsletter-tbody');
        if (!tbody) return;
        let html = '';
        lastFetchedNewsletter.forEach(sub => {
          const dateStr = sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : '';
          html += `<tr><td>${esc(dateStr)}</td><td><a href="mailto:${esc(sub.email)}" style="color:var(--sage-deep);">${esc(sub.email)}</a></td></tr>`;
        });
        tbody.innerHTML = html || '<tr><td colspan="2">No subscribers</td></tr>';
      }).catch(console.error);
  }

  // ─── Response Log Module ───
  let responseLogEntries = [];
  let currentRLogEntry = null;

  function initResponseLogListeners() {
    const filterStatus = $('#rlog-filter-status');
    if (filterStatus) filterStatus.addEventListener('change', fetchResponseLogs);

    const filterType = $('#rlog-filter-type');
    if (filterType) filterType.addEventListener('change', fetchResponseLogs);

    const filterSearch = $('#rlog-filter-search');
    if (filterSearch) filterSearch.addEventListener('input', renderResponseLogs);

    const btnCloseRLog = $('#btn-close-rlog-modal');
    if (btnCloseRLog) btnCloseRLog.addEventListener('click', closeRLogModal);

    const btnDismissRLog = $('#btn-rlog-dismiss');
    if (btnDismissRLog) btnDismissRLog.addEventListener('click', closeRLogModal);

    const btnMarkReviewed = $('#btn-rlog-mark-reviewed');
    if (btnMarkReviewed) btnMarkReviewed.addEventListener('click', () => reviewResponseLog('reviewed'));

    const btnFlag = $('#btn-rlog-flag');
    if (btnFlag) btnFlag.addEventListener('click', () => reviewResponseLog('flagged'));

    const btnRevert = $('#btn-rlog-revert');
    if (btnRevert) btnRevert.addEventListener('click', revertResponseLog);

    // Delegated table click
    const tbody = $('#rlog-table-body');
    if (tbody) tbody.addEventListener('click', handleRLogTableClick);

    // Export button: attach auth token
    const btnExport = $('#btn-export-responselog');
    if (btnExport) {
      btnExport.addEventListener('click', function(e) {
        e.preventDefault();
        const token = sessionStorage.getItem(SESSION_KEY);
        const filterStatusEl = $('#rlog-filter-status');
        const filterTypeEl = $('#rlog-filter-type');
        const status = (filterStatusEl && filterStatusEl.value) || 'all';
        const type = (filterTypeEl && filterTypeEl.value) || 'all';
        let url = `/api/response-log/export?status=${status}&type=${type}`;
        // Use fetch with auth and download as blob
        fetch(url, { cache: 'no-cache' })
          .then(res => {
            if (!res.ok) throw new Error('Export failed');
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="(.+?)"/);
            const filename = match ? match[1] : 'response_log_backup.json';
            return res.blob().then(blob => ({ blob, filename }));
          })
          .then(({ blob, filename }) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            toast('Response log exported for Google Drive backup', 'success');
          })
          .catch(err => {
            toast('Export failed: ' + err.message, 'error');
          });
      });
    }
  }

  function fetchResponseLogs() {
    const filterStatusEl = $('#rlog-filter-status');
    const filterTypeEl = $('#rlog-filter-type');
    const status = (filterStatusEl && filterStatusEl.value) || 'all';
    const type = (filterTypeEl && filterTypeEl.value) || 'all';
    let url = `/api/response-log?status=${status}&type=${type}`;
    fetch(url, { cache: 'no-cache' })
      .then(r => r.json())
      .then(data => {
        responseLogEntries = data || [];
        renderResponseLogs();
      })
      .catch(err => {
        console.error('Failed to fetch response logs:', err);
        toast('Failed to load response log', 'error');
      });
  }

  function fetchResponseLogStats() {
    fetch('/api/response-log/stats', { cache: 'no-cache' })
      .then(r => r.json())
      .then(stats => {
        const elPending = $('#rlog-stat-pending');
        const elReviewed = $('#rlog-stat-reviewed');
        const elFlagged = $('#rlog-stat-flagged');
        const elReverted = $('#rlog-stat-reverted');
        if (elPending) elPending.textContent = stats.pending || 0;
        if (elReviewed) elReviewed.textContent = stats.reviewed || 0;
        if (elFlagged) elFlagged.textContent = stats.flagged || 0;
        if (elReverted) elReverted.textContent = stats.reverted || 0;

        // Update badge on tab
        const badge = $('#responselog-badge');
        if (badge) {
          const pending = stats.pending || 0;
          if (pending > 0) {
            badge.style.display = 'inline';
            badge.textContent = pending;
          } else {
            badge.style.display = 'none';
          }
        }
      })
      .catch(console.error);
  }

  function renderResponseLogs() {
    const tbody = $('#rlog-table-body');
    if (!tbody) return;

    const searchEl = $('#rlog-filter-search');
    const searchTerm = ((searchEl && searchEl.value) || '').toLowerCase();
    const filtered = responseLogEntries.filter(entry => {
      if (!searchTerm) return true;
      return (entry.entityName || '').toLowerCase().includes(searchTerm) ||
             (entry.summary || '').toLowerCase().includes(searchTerm) ||
             (entry.sisterName || '').toLowerCase().includes(searchTerm);
    });

    const countBadge = $('#rlog-count-badge');
    if (countBadge) countBadge.textContent = `${filtered.length} entries`;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:#888;">No response log entries found</td></tr>';
      return;
    }

    const typeIcons = {
      community: '🏘️',
      photo: '📸',
      event: '📅',
      news: '📰',
      memorial: '✝️'
    };

    const statusColors = {
      pending: '#e74c3c',
      reviewed: '#27ae60',
      flagged: '#f39c12',
      reverted: '#95a5a6'
    };

    const actionLabels = {
      community_add: 'Added',
      community_update: 'Updated',
      community_delete: 'Deleted',
      photo_upload: 'Uploaded',
      photo_delete: 'Deleted',
      event_add: 'Added',
      event_update: 'Updated',
      event_delete: 'Deleted',
      news_add: 'Published',
      news_update: 'Updated',
      news_delete: 'Deleted',
      memorial_add: 'Added',
      memorial_update: 'Updated',
      memorial_delete: 'Deleted'
    };

    let html = '';
    filtered.forEach(entry => {
      const dateStr = entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      const icon = typeIcons[entry.entityType] || '📝';
      const statusColor = statusColors[entry.status] || '#888';
      const actionLabel = actionLabels[entry.actionType] || entry.actionType;
      const hasSnapshot = entry.snapshotBefore && Object.keys(entry.snapshotBefore).length > 0;

      html += `<tr style="border-left: 3px solid ${statusColor};">
        <td style="font-size:11px; color:#888;">#${entry.id}</td>
        <td style="font-size:12px; white-space:nowrap;">${esc(dateStr)}</td>
        <td>${icon} ${esc(entry.entityType)}</td>
        <td><span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:${statusColor}15; color:${statusColor};">${esc(actionLabel)}</span></td>
        <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(entry.entityName)}">${esc(entry.entityName || entry.entityId)}</td>
        <td style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; color:#555;" title="${esc(entry.summary)}">${esc(entry.summary)}</td>
        <td style="font-size:12px;">${esc(entry.sisterName || 'Admin')}</td>
        <td><span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; background:${statusColor}; color:#fff;">${esc(entry.status)}</span></td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn-view-rlog" data-id="${entry.id}" style="padding:4px 10px; font-size:11px; cursor:pointer; border:1px solid #ccc; border-radius:4px; background:#fff;" title="View details">🔍 View</button>
          ${entry.status === 'pending' ? `<button class="btn-quick-review" data-id="${entry.id}" style="padding:4px 10px; font-size:11px; cursor:pointer; border:1px solid #27ae60; border-radius:4px; background:#27ae6020; color:#27ae60; font-weight:600;" title="Quick approve">✓</button>` : ''}
          ${hasSnapshot ? `<button class="btn-quick-revert" data-id="${entry.id}" style="padding:4px 10px; font-size:11px; cursor:pointer; border:1px solid #e74c3c; border-radius:4px; background:#e74c3c15; color:#e74c3c; font-weight:600;" title="Revert change">↩</button>` : ''}
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  }

  function handleRLogTableClick(e) {
    const viewBtn = e.target.closest('.btn-view-rlog');
    if (viewBtn) {
      openRLogDetail(parseInt(viewBtn.dataset.id));
      return;
    }
    const quickReview = e.target.closest('.btn-quick-review');
    if (quickReview) {
      quickReviewRLog(parseInt(quickReview.dataset.id));
      return;
    }
    const quickRevert = e.target.closest('.btn-quick-revert');
    if (quickRevert) {
      if (confirm('Are you sure you want to revert this change? The data will be restored to its previous state.')) {
        quickRevertRLog(parseInt(quickRevert.dataset.id));
      }
      return;
    }
  }

  function openRLogDetail(logId) {
    const entry = responseLogEntries.find(e => e.id === logId);
    if (!entry) return;
    currentRLogEntry = entry;

    const modal = $('#rlog-detail-modal');
    const title = $('#rlog-modal-title');
    const body = $('#rlog-modal-body');
    const notesField = $('#rlog-admin-notes');

    if (title) title.textContent = `Change #${entry.id}: ${entry.entityName || entry.entityId}`;
    if (notesField) notesField.value = entry.adminNotes || '';

    // Build detail view
    let html = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
        <div style="background:#f8f9fa; padding:12px; border-radius:8px;">
          <div style="font-size:11px; color:#888; text-transform:uppercase; margin-bottom:4px;">Action</div>
          <div style="font-weight:600;">${esc(entry.actionType)}</div>
        </div>
        <div style="background:#f8f9fa; padding:12px; border-radius:8px;">
          <div style="font-size:11px; color:#888; text-transform:uppercase; margin-bottom:4px;">Type</div>
          <div style="font-weight:600;">${esc(entry.entityType)}</div>
        </div>
        <div style="background:#f8f9fa; padding:12px; border-radius:8px;">
          <div style="font-size:11px; color:#888; text-transform:uppercase; margin-bottom:4px;">Changed By</div>
          <div style="font-weight:600;">${esc(entry.sisterName || 'Admin')}</div>
        </div>
        <div style="background:#f8f9fa; padding:12px; border-radius:8px;">
          <div style="font-size:11px; color:#888; text-transform:uppercase; margin-bottom:4px;">Date</div>
          <div style="font-weight:600;">${entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</div>
        </div>
      </div>
      <div style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:16px;">
        <div style="font-size:11px; color:#888; text-transform:uppercase; margin-bottom:4px;">Summary</div>
        <div>${esc(entry.summary)}</div>
      </div>
    `;

    // Snapshot Diff
    const hasBefore = entry.snapshotBefore && Object.keys(entry.snapshotBefore).length > 0;
    const hasAfter = entry.snapshotAfter && Object.keys(entry.snapshotAfter).length > 0;

    if (hasBefore || hasAfter) {
      html += '<div style="margin-top:16px;">';
      html += '<h4 style="font-size:14px; margin-bottom:8px; color:#333;">📊 Data Comparison</h4>';
      html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">';

      // Before
      html += '<div style="border:2px solid #e74c3c30; border-radius:8px; padding:12px; background:#fff5f5;">';
      html += '<div style="font-size:12px; font-weight:700; color:#e74c3c; margin-bottom:8px;">⬅ Before</div>';
      if (hasBefore) {
        html += renderSnapshotTable(entry.snapshotBefore);
      } else {
        html += '<div style="color:#888; font-style:italic;">No previous data (new entry)</div>';
      }
      html += '</div>';

      // After
      html += '<div style="border:2px solid #27ae6030; border-radius:8px; padding:12px; background:#f0fff4;">';
      html += '<div style="font-size:12px; font-weight:700; color:#27ae60; margin-bottom:8px;">➡ After</div>';
      if (hasAfter) {
        html += renderSnapshotTable(entry.snapshotAfter);
      } else {
        html += '<div style="color:#888; font-style:italic;">Deleted</div>';
      }
      html += '</div>';

      html += '</div></div>';
    }

    // Review info
    if (entry.reviewedBy) {
      html += `<div style="margin-top:16px; padding:12px; background:#e8f5e9; border-radius:8px; font-size:13px;">
        <strong>Reviewed by:</strong> ${esc(entry.reviewedBy)} 
        ${entry.reviewedAt ? `on ${new Date(entry.reviewedAt).toLocaleString()}` : ''}
        ${entry.adminNotes ? `<br><strong>Notes:</strong> ${esc(entry.adminNotes)}` : ''}
      </div>`;
    }

    if (body) body.innerHTML = html;

    // Show/hide revert button based on data availability
    const revertBtn = $('#btn-rlog-revert');
    if (revertBtn) revertBtn.style.display = hasBefore ? 'inline-flex' : 'none';

    if (modal) modal.hidden = false;
  }

  function renderSnapshotTable(data) {
    if (!data || typeof data !== 'object') return '<em>No data</em>';
    let html = '<table style="width:100%; font-size:12px; border-collapse:collapse;">';
    for (const [key, val] of Object.entries(data)) {
      if (key === 'stories' || key === 'gallery') continue; // Skip large nested arrays
      let displayVal = val;
      if (Array.isArray(val)) {
        displayVal = val.length > 3 ? `[${val.length} items]` : JSON.stringify(val);
      } else if (typeof val === 'object' && val !== null) {
        displayVal = JSON.stringify(val);
      }
      const strVal = String(displayVal || '');
      const truncated = strVal.length > 120 ? strVal.substring(0, 120) + '…' : strVal;
      html += `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:4px 8px; font-weight:600; color:#555; vertical-align:top; white-space:nowrap;">${esc(key)}</td>
        <td style="padding:4px 8px; word-break:break-word;" title="${esc(strVal)}">${esc(truncated)}</td>
      </tr>`;
    }
    html += '</table>';
    return html;
  }

  function closeRLogModal() {
    const modal = $('#rlog-detail-modal');
    if (modal) modal.hidden = true;
    currentRLogEntry = null;
  }

  function reviewResponseLog(status) {
    if (!currentRLogEntry) return;
    const notesEl = $('#rlog-admin-notes');
    const adminNotes = (notesEl && notesEl.value) || '';
    fetch('/api/response-log/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentRLogEntry.id, status, adminNotes })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast(`Entry #${currentRLogEntry.id} marked as ${status}`, 'success');
          closeRLogModal();
          fetchResponseLogs();
          fetchResponseLogStats();
        } else {
          toast(data.error || 'Failed to update status', 'error');
        }
      })
      .catch(err => toast('Error: ' + err.message, 'error'));
  }

  function revertResponseLog() {
    if (!currentRLogEntry) return;
    if (!confirm('Are you sure you want to revert this change? The data will be restored to its previous state.')) return;
    fetch('/api/response-log/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentRLogEntry.id })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast('Change reverted successfully', 'success');
          closeRLogModal();
          fetchResponseLogs();
          fetchResponseLogStats();
          // Refresh communities if relevant
          if (currentRLogEntry.entityType === 'community') {
            fetchCommunities();
          }
        } else {
          toast(data.error || 'Failed to revert', 'error');
        }
      })
      .catch(err => toast('Error: ' + err.message, 'error'));
  }

  function quickReviewRLog(logId) {
    fetch('/api/response-log/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: logId, status: 'reviewed', adminNotes: '' })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast(`Entry #${logId} reviewed ✓`, 'success');
          fetchResponseLogs();
          fetchResponseLogStats();
        } else {
          toast(data.error || 'Review failed', 'error');
        }
      })
      .catch(err => toast('Error: ' + err.message, 'error'));
  }

  function quickRevertRLog(logId) {
    fetch('/api/response-log/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: logId })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast('Change reverted successfully', 'success');
          fetchResponseLogs();
          fetchResponseLogStats();
        } else {
          toast(data.error || 'Revert failed', 'error');
        }
      })
      .catch(err => toast('Error: ' + err.message, 'error'));
  }

  // Bind CSV Export Buttons
  document.addEventListener('DOMContentLoaded', () => {
    const btnExpContacts = $('#btn-export-contacts');
    if (btnExpContacts) {
      btnExpContacts.addEventListener('click', function() {
        const rows = [['Date', 'Name', 'Email', 'Subject', 'Message', 'Status']];
        lastFetchedContacts.forEach(m => {
          rows.push([m.created_at || '', m.name || '', m.email || '', m.subject || '', m.message || '', m.status || '']);
        });
        exportToCSV('satyaseva_contact_messages.csv', rows);
      });
    }

    const btnExpNews = $('#btn-export-newsletter');
    if (btnExpNews) {
      btnExpNews.addEventListener('click', function() {
        const rows = [['Subscribed Date', 'Email Address']];
        lastFetchedNewsletter.forEach(sub => {
          rows.push([sub.subscribed_at || '', sub.email || '']);
        });
        exportToCSV('satyaseva_newsletter_subscribers.csv', rows);
      });
    }
  });

  // ─── Boot ───
  document.addEventListener('DOMContentLoaded', setupLoginGate);
})();

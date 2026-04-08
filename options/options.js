(() => {
  'use strict';

  let THEMES = [];
  let syncState = {};
  let activeFilter = 'all';

  // ─── Theme registry loading ──────────────────────────────────────────────

  async function loadThemes() {
    const url = chrome.runtime.getURL('themes/themes.json');
    const response = await fetch(url);
    const data = await response.json();
    THEMES = data.themes;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function getThemeById(id) {
    return THEMES.find(t => t.id === id) || null;
  }

  function getLightThemes() {
    return THEMES.filter(t => t.category === 'light');
  }

  function getDarkThemes() {
    return THEMES.filter(t => t.category === 'dark');
  }

  function isLightTheme(id) {
    const t = getThemeById(id);
    return t ? t.category === 'light' : false;
  }

  function isDarkTheme(id) {
    const t = getThemeById(id);
    return t ? t.category === 'dark' : false;
  }

  // ─── Swatch generation ────────────────────────────────────────────────────

  function buildSwatch(theme) {
    const c = theme.colors;
    // Pick 4 representative colors: bg, surface, accent, text
    const colors = [c.background, c.surface, c.accent, c.textPrimary];
    return colors.map(col => `<span style="background:${col};"></span>`).join('');
  }

  // ─── Theme grid rendering ─────────────────────────────────────────────────

  function renderThemeGrid(activeThemeId) {
    const grid = document.getElementById('themeGrid');
    grid.innerHTML = '';

    for (const theme of THEMES) {
      const isActive = theme.id === activeThemeId;
      const card = document.createElement('button');
      card.className = `theme-card${isActive ? ' is-active' : ''}${activeFilter !== 'all' && theme.category !== activeFilter ? ' is-hidden' : ''}`;
      card.dataset.theme = theme.id;
      card.role = 'radio';
      card.setAttribute('aria-checked', String(isActive));
      card.setAttribute('title', theme.name);

      card.innerHTML = `
        <div class="theme-swatch">${buildSwatch(theme)}</div>
        <div class="theme-card-body">
          <div class="theme-card-header">
            <span class="theme-name">${theme.name}</span>
            <span class="theme-category-badge ${theme.category}">${theme.category === 'light' ? 'Light' : 'Dark'}</span>
          </div>
          <div class="theme-description">${theme.description}</div>
        </div>
        <button class="theme-apply-btn" data-apply="${theme.id}" tabindex="-1">
          ${isActive ? 'Active' : 'Apply'}
        </button>
        <div class="theme-check" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;

      card.addEventListener('click', (e) => {
        // Don't double-fire when clicking the inner apply button
        if (e.target.dataset.apply) {
          selectTheme(e.target.dataset.apply);
        } else {
          selectTheme(theme.id);
        }
      });

      grid.appendChild(card);
    }
  }

  function updateGridActiveState(activeThemeId) {
    document.querySelectorAll('.theme-card').forEach(card => {
      const id = card.dataset.theme;
      const isActive = id === activeThemeId;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-checked', String(isActive));
      const btn = card.querySelector('.theme-apply-btn');
      if (btn) btn.textContent = isActive ? 'Active' : 'Apply';
    });
  }

  // ─── Filter pills ─────────────────────────────────────────────────────────

  function bindFilterPills() {
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeFilter = pill.dataset.filter;
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');

        document.querySelectorAll('.theme-card').forEach(card => {
          const theme = getThemeById(card.dataset.theme);
          if (!theme) return;
          const hidden = activeFilter !== 'all' && theme.category !== activeFilter;
          card.classList.toggle('is-hidden', hidden);
        });
      });
    });
  }

  // ─── Theme selection ──────────────────────────────────────────────────────

  async function selectTheme(themeId) {
    const updates = { theme: themeId };
    if (isLightTheme(themeId)) updates.lastLightTheme = themeId;
    if (isDarkTheme(themeId)) updates.lastDarkTheme = themeId;

    await chrome.storage.sync.set(updates);
    syncState = { ...syncState, ...updates };

    updateGridActiveState(themeId);
    updateHeaderMeta(themeId);

    // Apply to any active SF tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme: themeId }).catch(() => {});
      }
    } catch (_) {}
  }

  // ─── Auto mode toggle ─────────────────────────────────────────────────────

  async function handleAutoModeToggle() {
    const toggle = document.getElementById('autoModeToggle');
    const autoMode = toggle.checked;
    await chrome.storage.sync.set({ autoMode });
    syncState = { ...syncState, autoMode };

    if (autoMode) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = isDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme: next }).catch(() => {});
        }
      } catch (_) {}
    }
  }

  // ─── Per-org settings ────────────────────────────────────────────────────

  function renderOrgList(orgThemes) {
    const container = document.getElementById('orgList');
    const row = document.getElementById('orgSettingsRow');

    if (!orgThemes || Object.keys(orgThemes).length === 0) {
      row.hidden = true;
      return;
    }

    row.hidden = false;
    container.innerHTML = '';

    for (const [hostname, themeId] of Object.entries(orgThemes)) {
      const theme = getThemeById(themeId);
      const themeName = theme ? theme.name : themeId;
      const shortHost = hostname.replace('.lightning.force.com', '').replace('.my.salesforce.com', '');

      const item = document.createElement('div');
      item.className = 'org-item';
      item.innerHTML = `
        <span class="org-item-host" title="${hostname}">${shortHost}</span>
        <span class="org-item-theme">${themeName}</span>
        <button class="org-item-remove" data-host="${hostname}">Remove</button>
      `;

      item.querySelector('.org-item-remove').addEventListener('click', async () => {
        const updated = { ...(syncState.orgThemes || {}) };
        delete updated[hostname];
        await chrome.storage.sync.set({ orgThemes: updated });
        syncState.orgThemes = updated;
        renderOrgList(updated);
      });

      container.appendChild(item);
    }
  }

  // ─── Header meta ─────────────────────────────────────────────────────────

  function updateHeaderMeta(activeThemeId) {
    const meta = document.getElementById('headerMeta');
    const theme = getThemeById(activeThemeId);
    const name = theme ? theme.name : activeThemeId;
    meta.innerHTML = `
      <div class="header-theme-dot"></div>
      <span>Active: ${name}</span>
      <span style="color: var(--color-border)">·</span>
      <span>${THEMES.length} themes</span>
    `;
  }

  // ─── Version ──────────────────────────────────────────────────────────────

  function setVersion() {
    const manifest = chrome.runtime.getManifest();
    const el = document.getElementById('versionLabel');
    if (el && manifest.version) el.textContent = `v${manifest.version}`;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    await loadThemes();

    syncState = await chrome.storage.sync.get({
      theme: 'connectry',
      autoMode: false,
      lastLightTheme: 'connectry',
      lastDarkTheme: 'connectry-dark',
      orgThemes: {},
    });

    let activeTheme = syncState.theme;
    if (syncState.autoMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = prefersDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
    }

    renderThemeGrid(activeTheme);
    bindFilterPills();
    updateHeaderMeta(activeTheme);
    renderOrgList(syncState.orgThemes);
    setVersion();

    // Auto mode toggle
    const autoToggle = document.getElementById('autoModeToggle');
    autoToggle.checked = syncState.autoMode;
    autoToggle.addEventListener('change', handleAutoModeToggle);

    // Listen for storage changes from other windows/tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.theme) {
        syncState.theme = changes.theme.newValue;
        updateGridActiveState(syncState.theme);
        updateHeaderMeta(syncState.theme);
      }
      if (changes.autoMode) {
        syncState.autoMode = changes.autoMode.newValue;
        autoToggle.checked = changes.autoMode.newValue;
      }
      if (changes.orgThemes) {
        syncState.orgThemes = changes.orgThemes.newValue;
        renderOrgList(syncState.orgThemes);
      }
    });
  }

  init().catch(err => console.error('[Themer options] Init error:', err));
})();

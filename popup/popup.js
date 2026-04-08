(() => {
  'use strict';

  const THEMES = ['connectry', 'midnight', 'slate', 'tron', 'obsidian', 'arctic', 'none'];
  const LIGHT_THEMES = ['connectry', 'slate', 'arctic'];
  const DARK_THEMES = ['midnight', 'tron', 'obsidian'];

  let currentOrgHostname = null;
  let syncState = {};

  // ─── UI state helpers ────────────────────────────────────────────────────

  function setActiveUI(activeTheme) {
    document.querySelectorAll('[data-theme]').forEach((el) => {
      const isActive = el.dataset.theme === activeTheme;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('aria-checked', String(isActive));
    });
  }

  function setAutoModeUI(autoMode, lightTheme, darkTheme) {
    const toggle = document.getElementById('autoModeToggle');
    const selectors = document.getElementById('autoModeSelectors');
    const section = document.querySelector('.themes-section');
    const lightSelect = document.getElementById('lightThemeSelect');
    const darkSelect = document.getElementById('darkThemeSelect');

    toggle.checked = autoMode;
    selectors.hidden = !autoMode;
    section?.classList.toggle('auto-active', autoMode);

    lightSelect.value = lightTheme || 'connectry';
    darkSelect.value = darkTheme || 'midnight';
  }

  function updateOrgRow(orgThemes, activeTheme) {
    if (!currentOrgHostname) return;

    const orgRow = document.getElementById('orgRow');
    const orgStatus = document.getElementById('orgStatus');
    const hasOverride = !!(orgThemes && orgThemes[currentOrgHostname]);
    orgRow.hidden = false;

    if (hasOverride) {
      const shortName = currentOrgHostname.replace('.lightning.force.com', '').replace('.my.salesforce.com', '');
      orgStatus.innerHTML = `
        <span class="org-status-text" title="${currentOrgHostname}">Theme set for ${shortName}</span>
        <button class="org-reset-btn" id="orgResetBtn">Reset to global</button>
      `;
      document.getElementById('orgResetBtn')?.addEventListener('click', resetOrgTheme);
    } else {
      orgStatus.innerHTML = `
        <button class="org-set-link" id="orgSetLink">Set for this org only</button>
      `;
      document.getElementById('orgSetLink')?.addEventListener('click', setOrgTheme);
    }
  }

  // ─── Theme application ───────────────────────────────────────────────────

  async function applyThemeToTab(theme) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme }).catch(() => {});
    } catch (_) {}
  }

  async function selectTheme(theme) {
    if (!THEMES.includes(theme)) return;

    const updates = { theme };

    // Track last used light/dark for keyboard shortcut toggle
    if (LIGHT_THEMES.includes(theme)) updates.lastLightTheme = theme;
    if (DARK_THEMES.includes(theme)) updates.lastDarkTheme = theme;

    // If per-org override is active, update org-specific storage instead of global
    const orgThemes = syncState.orgThemes || {};
    if (currentOrgHostname && orgThemes[currentOrgHostname]) {
      orgThemes[currentOrgHostname] = theme;
      updates.orgThemes = orgThemes;
    }

    await chrome.storage.sync.set(updates);
    syncState = { ...syncState, ...updates };

    // Pre-cache the CSS for zero-flash
    try {
      if (theme !== 'none') {
        const url = chrome.runtime.getURL(`content/themes/${theme}.css`);
        const response = await fetch(url);
        if (response.ok) {
          const css = await response.text();
          await chrome.storage.local.set({ [`themeCSS_${theme}`]: css });
        }
      }
    } catch (_) {}

    setActiveUI(theme);
    updateOrgRow(syncState.orgThemes, theme);
    await applyThemeToTab(theme);
  }

  // ─── Auto mode ───────────────────────────────────────────────────────────

  async function handleAutoModeToggle() {
    const toggle = document.getElementById('autoModeToggle');
    const autoMode = toggle.checked;

    const updates = { autoMode };
    await chrome.storage.sync.set(updates);
    syncState = { ...syncState, ...updates };

    setAutoModeUI(
      autoMode,
      syncState.lightTheme || 'connectry',
      syncState.darkTheme || 'midnight'
    );

    if (autoMode) {
      // Apply the appropriate theme immediately based on current OS mode
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = isDark
        ? (syncState.darkTheme || 'midnight')
        : (syncState.lightTheme || 'connectry');
      setActiveUI(theme);
      await applyThemeToTab(theme);
    }
  }

  async function handleLightThemeChange() {
    const select = document.getElementById('lightThemeSelect');
    const lightTheme = select.value;
    await chrome.storage.sync.set({ lightTheme });
    syncState.lightTheme = lightTheme;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!isDark) {
      setActiveUI(lightTheme);
      await applyThemeToTab(lightTheme);
    }
  }

  async function handleDarkThemeChange() {
    const select = document.getElementById('darkThemeSelect');
    const darkTheme = select.value;
    await chrome.storage.sync.set({ darkTheme });
    syncState.darkTheme = darkTheme;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      setActiveUI(darkTheme);
      await applyThemeToTab(darkTheme);
    }
  }

  // ─── Per-org theming ─────────────────────────────────────────────────────

  async function setOrgTheme() {
    if (!currentOrgHostname) return;
    const orgThemes = { ...(syncState.orgThemes || {}) };
    orgThemes[currentOrgHostname] = syncState.theme || 'connectry';
    await chrome.storage.sync.set({ orgThemes });
    syncState.orgThemes = orgThemes;
    updateOrgRow(orgThemes, syncState.theme);
  }

  async function resetOrgTheme() {
    if (!currentOrgHostname) return;
    const orgThemes = { ...(syncState.orgThemes || {}) };
    delete orgThemes[currentOrgHostname];
    await chrome.storage.sync.set({ orgThemes });
    syncState.orgThemes = orgThemes;
    updateOrgRow(orgThemes, syncState.theme);
    // Revert to global theme
    await applyThemeToTab(syncState.theme || 'connectry');
  }

  // ─── Event binding ───────────────────────────────────────────────────────

  function bindButtons() {
    document.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => selectTheme(btn.dataset.theme));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTheme(btn.dataset.theme);
        }
      });
    });

    document.getElementById('autoModeToggle')?.addEventListener('change', handleAutoModeToggle);
    document.getElementById('lightThemeSelect')?.addEventListener('change', handleLightThemeChange);
    document.getElementById('darkThemeSelect')?.addEventListener('change', handleDarkThemeChange);
  }

  // ─── Detect current tab's org hostname ───────────────────────────────────

  async function detectCurrentOrg() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return null;
      const url = new URL(tab.url);
      const host = url.hostname;
      // Only consider Salesforce org URLs
      if (
        host.endsWith('.lightning.force.com') ||
        host.endsWith('.my.salesforce.com') ||
        host.endsWith('.salesforce.com')
      ) {
        return host;
      }
    } catch (_) {}
    return null;
  }

  // ─── Initialisation ──────────────────────────────────────────────────────

  async function init() {
    const [result, orgHostname] = await Promise.all([
      chrome.storage.sync.get({
        theme: 'connectry',
        autoMode: false,
        lightTheme: 'connectry',
        darkTheme: 'midnight',
        lastLightTheme: 'connectry',
        lastDarkTheme: 'midnight',
        orgThemes: {},
      }),
      detectCurrentOrg(),
    ]);

    syncState = result;
    currentOrgHostname = orgHostname;

    // Determine the effective active theme (per-org overrides global)
    let effectiveTheme = result.theme;
    if (orgHostname && result.orgThemes[orgHostname]) {
      effectiveTheme = result.orgThemes[orgHostname];
    } else if (result.autoMode) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = isDark ? result.darkTheme : result.lightTheme;
    }

    setActiveUI(effectiveTheme);
    setAutoModeUI(result.autoMode, result.lightTheme, result.darkTheme);

    if (orgHostname) {
      updateOrgRow(result.orgThemes, effectiveTheme);
    }

    bindButtons();
  }

  init();
})();

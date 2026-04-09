(() => {
  'use strict';

  let THEMES = [];
  let LIGHT_THEME_IDS = new Set();
  let DARK_THEME_IDS = new Set();
  let THEME_NAMES = {};
  let currentOrgHostname = null;
  let syncState = {};

  // ─── Theme registry loading ──────────────────────────────────────────────

  async function loadThemes() {
    const url = chrome.runtime.getURL('themes/themes.json');
    const response = await fetch(url);
    const data = await response.json();
    THEMES = data.themes;

    for (const t of THEMES) {
      THEME_NAMES[t.id] = t.name;
      if (t.category === 'light') LIGHT_THEME_IDS.add(t.id);
      if (t.category === 'dark') DARK_THEME_IDS.add(t.id);
    }
  }

  function getAllThemeIds() {
    return THEMES.map(t => t.id);
  }

  // ─── Popup rendering ──────────────────────────────────────────────────────

  function buildSwatchColors(theme) {
    const c = theme.colors;
    return [c.background, c.surface, c.accent, c.textPrimary];
  }

  function renderThemesSection() {
    const section = document.getElementById('themesSection');
    section.innerHTML = '';

    const lightThemes = THEMES.filter(t => t.category === 'light');
    const darkThemes = THEMES.filter(t => t.category === 'dark');

    const groups = [
      { label: 'Light Themes', themes: lightThemes },
      { label: 'Dark Themes', themes: darkThemes },
    ];

    for (const group of groups) {
      const label = document.createElement('div');
      label.className = 'theme-group-label';
      label.textContent = group.label;
      section.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'themes-grid';

      for (const theme of group.themes) {
        const btn = document.createElement('button');
        btn.className = 'theme-card';
        btn.dataset.theme = theme.id;
        btn.role = 'radio';
        btn.setAttribute('aria-checked', 'false');
        btn.title = `${theme.name} — ${theme.description}`;

        const swatchColors = buildSwatchColors(theme);
        const swatchHtml = swatchColors
          .map(col => `<span style="background:${col};"></span>`)
          .join('');

        const isDefault = theme.isDefault;
        const descOrTag = isDefault
          ? `<span class="theme-tag">Default</span>`
          : `<span class="theme-desc">${theme.tags[0] || ''}</span>`;

        btn.innerHTML = `
          <div class="theme-swatch">${swatchHtml}</div>
          <div class="theme-info">
            <span class="theme-name">${theme.name}</span>
            ${descOrTag}
          </div>
          <div class="theme-check" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="theme-auto-icon" aria-hidden="true"></div>
        `;

        grid.appendChild(btn);
      }

      section.appendChild(grid);
    }

    // Bind off button
    const offBtn = document.querySelector('.off-button');
    if (offBtn) {
      offBtn.addEventListener('click', () => selectTheme('none'));
      offBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTheme('none'); }
      });
    }

    // Bind theme cards
    document.querySelectorAll('.theme-card[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => selectTheme(btn.dataset.theme));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTheme(btn.dataset.theme); }
      });
    });
  }

  // ─── UI state helpers ────────────────────────────────────────────────────

  // Tracks the most recently picked non-'none' theme. Used by the Theme on/off
  // toggle so we can restore the user's last theme when they flip it back on.
  let _lastEnabledTheme = 'connectry';

  function setActiveUI(activeTheme) {
    document.querySelectorAll('[data-theme]').forEach(el => {
      const isActive = el.dataset.theme === activeTheme;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('aria-checked', String(isActive));
    });

    // Update the header status indicator and the on/off toggle
    const isOn = activeTheme && activeTheme !== 'none';
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const themeToggle = document.getElementById('themeOnToggle');
    if (dot) dot.classList.toggle('status-dot--on', !!isOn);
    if (text) text.textContent = isOn ? 'Theme on' : 'Theme off';
    if (themeToggle) themeToggle.checked = !!isOn;

    if (isOn) _lastEnabledTheme = activeTheme;
  }

  function setAutoModeUI(autoMode) {
    const toggle = document.getElementById('autoModeToggle');
    toggle.checked = autoMode;

    const statusLine = document.getElementById('autoModeStatus');
    statusLine.hidden = !autoMode;

    const section = document.getElementById('themesSection');
    section?.classList.toggle('auto-mode-active', autoMode);

    // Clear auto-mode classes from all cards
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.remove('is-auto-light', 'is-auto-dark');
    });

    if (autoMode) {
      const lightTheme = syncState.lastLightTheme || 'connectry';
      const darkTheme = syncState.lastDarkTheme || 'connectry-dark';

      const lightCard = document.querySelector(`[data-theme="${lightTheme}"]`);
      const darkCard = document.querySelector(`[data-theme="${darkTheme}"]`);

      if (lightCard) {
        lightCard.classList.add('is-auto-light', 'is-active');
        lightCard.setAttribute('aria-checked', 'true');
        const icon = lightCard.querySelector('.theme-auto-icon');
        if (icon) icon.textContent = '\u2600\uFE0F';
      }
      if (darkCard) {
        darkCard.classList.add('is-auto-dark', 'is-active');
        darkCard.setAttribute('aria-checked', 'true');
        const icon = darkCard.querySelector('.theme-auto-icon');
        if (icon) icon.textContent = '\uD83C\uDF19';
      }

      const lightName = THEME_NAMES[lightTheme] || 'Connectry Light';
      const darkName = THEME_NAMES[darkTheme] || 'Connectry Dark';
      document.getElementById('autoLightName').textContent = lightName;
      document.getElementById('autoDarkName').textContent = darkName;
    }
  }

  function updateOrgRow(orgThemes /*, activeTheme */) {
    // Show the per-org row only when we're on a Salesforce tab
    const row = document.getElementById('perOrgRow');
    const toggle = document.getElementById('perOrgToggle');
    if (!row || !toggle) return;
    if (!currentOrgHostname) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    const hasOverride = !!(orgThemes && orgThemes[currentOrgHostname]);
    toggle.checked = hasOverride;
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
    const allIds = getAllThemeIds();
    if (theme !== 'none' && !allIds.includes(theme)) return;

    const updates = { theme };
    if (LIGHT_THEME_IDS.has(theme)) updates.lastLightTheme = theme;
    if (DARK_THEME_IDS.has(theme)) updates.lastDarkTheme = theme;

    const orgThemes = syncState.orgThemes || {};
    if (currentOrgHostname && orgThemes[currentOrgHostname]) {
      orgThemes[currentOrgHostname] = theme;
      updates.orgThemes = orgThemes;
    }

    await chrome.storage.sync.set(updates);
    syncState = { ...syncState, ...updates };

    setActiveUI(theme);
    updateOrgRow(syncState.orgThemes, theme);
    if (syncState.autoMode) setAutoModeUI(true);
    await applyThemeToTab(theme);
  }

  // ─── Auto mode ───────────────────────────────────────────────────────────

  async function handleAutoModeToggle() {
    const toggle = document.getElementById('autoModeToggle');
    const autoMode = toggle.checked;

    await chrome.storage.sync.set({ autoMode });
    syncState = { ...syncState, autoMode };

    setAutoModeUI(autoMode);

    if (autoMode) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = isDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
      setActiveUI(theme);
      await applyThemeToTab(theme);
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
    await applyThemeToTab(syncState.theme || 'connectry');
  }

  // ─── Effects preset selector ────────────────────────────────────────────────

  const POPUP_EFFECTS_PRESETS = {
    none: {
      preset: 'none',
      hoverLift: false, hoverLiftIntensity: 'medium',
      ambientGlow: false, ambientGlowIntensity: 'medium',
      borderShimmer: false, borderShimmerIntensity: 'medium',
      gradientBorders: false, gradientBordersIntensity: 'medium',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: false, cursorTrailIntensity: 'medium',
    },
    subtle: {
      preset: 'subtle',
      hoverLift: true, hoverLiftIntensity: 'subtle',
      ambientGlow: false, ambientGlowIntensity: 'subtle',
      borderShimmer: false, borderShimmerIntensity: 'subtle',
      gradientBorders: false, gradientBordersIntensity: 'subtle',
      aurora: false, auroraIntensity: 'subtle',
      neonFlicker: false, neonFlickerIntensity: 'subtle',
      particles: false, particlesIntensity: 'subtle',
      cursorTrail: false, cursorTrailIntensity: 'subtle',
    },
    alive: {
      preset: 'alive',
      hoverLift: true, hoverLiftIntensity: 'medium',
      ambientGlow: true, ambientGlowIntensity: 'medium',
      borderShimmer: true, borderShimmerIntensity: 'medium',
      gradientBorders: false, gradientBordersIntensity: 'medium',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: false, cursorTrailIntensity: 'medium',
    },
    immersive: {
      preset: 'immersive',
      hoverLift: true, hoverLiftIntensity: 'strong',
      ambientGlow: true, ambientGlowIntensity: 'strong',
      borderShimmer: true, borderShimmerIntensity: 'medium',
      gradientBorders: true, gradientBordersIntensity: 'strong',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: true, cursorTrailIntensity: 'medium',
    },
  };

  function bindEffectsSelector() {
    const pills = document.querySelectorAll('.effects-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', async () => {
        const preset = pill.dataset.preset;
        const config = POPUP_EFFECTS_PRESETS[preset] || POPUP_EFFECTS_PRESETS.none;
        await chrome.storage.sync.set({ effectsConfig: { ...config } });
        setEffectsUI(preset);
      });
    });
  }

  function setEffectsUI(preset) {
    const pills = document.querySelectorAll('.effects-pill');
    pills.forEach(p => {
      const isActive = p.dataset.preset === preset;
      p.classList.toggle('is-active', isActive);
      p.setAttribute('aria-checked', String(isActive));
    });
  }

  // ─── Options page button ──────────────���───────────────────────────────────

  function bindOptionsButton() {
    document.getElementById('openOptionsBtn')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // ─── Help tooltips ────────────────────────────────────────────────────────
  //
  // All three tooltips share one pattern: a [data-tooltip="targetId"] button
  // toggles the tooltip with the matching ID, positioning it as a floating
  // overlay anchored just below the row that owns the help button. Click
  // outside or press Esc to dismiss.

  const TOOLTIP_IDS = ['autoTooltip', 'scopeTooltip', 'effectsTooltip', 'orgTooltip'];

  function bindHelpTooltip() {
    document.querySelectorAll('.settings-help-btn[data-tooltip]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tipId = btn.dataset.tooltip;
        const tip = document.getElementById(tipId);
        if (!tip) return;
        const wasHidden = tip.hidden;
        hideAllTooltips();
        if (wasHidden) {
          positionTooltipBelow(tip, btn);
          tip.hidden = false;
        }
      });
    });

    // Effects tooltip → open options page on Effects tab
    document.getElementById('effectsTooltipLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      openOptionsOnTab('effects');
    });

    // Click outside closes any open tooltip
    document.addEventListener('click', (e) => {
      if (e.target.closest('.popup-tooltip') || e.target.closest('.settings-help-btn')) return;
      hideAllTooltips();
    });

    // Esc closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideAllTooltips();
    });
  }

  function hideAllTooltips() {
    TOOLTIP_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  /**
   * Position a tooltip directly below the row that owns the given help button.
   * Tooltips are absolute-positioned children of the .settings-card so we
   * compute coordinates relative to it.
   */
  function positionTooltipBelow(tooltip, anchorBtn) {
    const card = anchorBtn.closest('.settings-card');
    if (!card) return;
    const row = anchorBtn.closest('.settings-row');
    if (!row) return;
    const cardRect = card.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.bottom - cardRect.top + 4;
    tooltip.style.top = `${top}px`;
  }

  function openOptionsOnTab(tabName) {
    // Stash target tab so options.js picks it up on load
    chrome.storage.local.set({ openOptionsTab: tabName }).then(() => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  // ─── Upgrade CTA ──────────────────────────────────────────────────────────

  function bindUpgradeCta() {
    document.getElementById('upgradeCta')?.addEventListener('click', () => {
      openOptionsOnTab('upgrade');
    });
  }

  // ─── Collapsible settings card ────────────────────────────────────────────

  const COLLAPSE_KEY = 'sft-popup-settings-collapsed';

  function bindSettingsCollapse() {
    const header = document.getElementById('settingsCardToggle');
    const body = document.getElementById('settingsCardBody');
    if (!header || !body) return;

    // Restore persisted state
    const collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
    setCollapsed(collapsed);

    header.addEventListener('click', () => {
      const nowCollapsed = !body.classList.contains('is-collapsed');
      setCollapsed(nowCollapsed);
      try { localStorage.setItem(COLLAPSE_KEY, nowCollapsed ? '1' : '0'); } catch (_) {}
    });

    function setCollapsed(c) {
      body.classList.toggle('is-collapsed', c);
      header.setAttribute('aria-expanded', String(!c));
      // Hide any open tooltips when collapsing
      if (c) hideAllTooltips();
    }
  }

  // ─── Theme on/off toggle ──────────────────────────────────────────────────

  function bindThemeOnToggle() {
    const toggle = document.getElementById('themeOnToggle');
    if (!toggle) return;
    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        // Restore the user's last enabled theme
        const restore = _lastEnabledTheme || syncState.theme || 'connectry';
        await selectTheme(restore === 'none' ? 'connectry' : restore);
      } else {
        // Capture the current theme so we can restore it on toggle-on
        if (syncState.theme && syncState.theme !== 'none') {
          _lastEnabledTheme = syncState.theme;
        }
        await selectTheme('none');
      }
    });
  }

  // ─── Per-org toggle ───────────────────────────────────────────────────────

  function bindPerOrgToggle() {
    const toggle = document.getElementById('perOrgToggle');
    if (!toggle) return;
    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        await setOrgTheme();
      } else {
        await resetOrgTheme();
      }
    });
  }

  // ─── Reset all settings ───────────────────────────────────────────────────

  function bindResetSettings() {
    const btn = document.getElementById('resetSettingsBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const confirmed = confirm(
        'Reset Salesforce Themer to defaults?\n\n' +
        'This will:\n' +
        '• Switch back to the Connectry theme\n' +
        '• Turn off Follow System mode\n' +
        '• Apply theme to Both Lightning and Setup\n' +
        '• Turn off all effects\n' +
        '• Clear all per-org overrides\n\n' +
        'Custom themes you\'ve created will be kept.'
      );
      if (!confirmed) return;

      // Reset only the user-configurable settings — keep custom themes
      const defaults = {
        theme: 'connectry',
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
        themeScope: 'both',
        effectsConfig: null,
      };
      await chrome.storage.sync.set(defaults);
      // Re-apply to active tab
      await applyThemeToTab('connectry');
      // Reload the popup to reflect fresh state
      window.location.reload();
    });
  }

  // ─── Scope selector ──────────────────────────────────────────────────────

  function bindScopeSelector() {
    const pills = document.querySelectorAll('.scope-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', async () => {
        const scope = pill.dataset.scope;
        pills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        await chrome.storage.sync.set({ themeScope: scope });
      });
    });
  }

  function setScopeUI(scope) {
    const pills = document.querySelectorAll('.scope-pill');
    pills.forEach(p => {
      p.classList.toggle('is-active', p.dataset.scope === scope);
    });
  }

  // ─── Detect current org ───────────────────────────────────────────────────

  async function detectCurrentOrg() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return null;
      const url = new URL(tab.url);
      const host = url.hostname;
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
    await loadThemes();
    renderThemesSection();
    bindOptionsButton();
    bindHelpTooltip();
    bindScopeSelector();
    bindEffectsSelector();
    bindUpgradeCta();
    bindSettingsCollapse();
    bindThemeOnToggle();
    bindPerOrgToggle();
    bindResetSettings();

    const [result, orgHostname] = await Promise.all([
      chrome.storage.sync.get({
        theme: 'connectry',
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
        themeScope: 'both',
        effectsConfig: null,
      }),
      detectCurrentOrg(),
    ]);

    syncState = result;
    currentOrgHostname = orgHostname;
    setScopeUI(result.themeScope || 'both');

    // Set effects UI — show active preset or 'none' if not configured
    const activePreset = result.effectsConfig?.preset || 'none';
    setEffectsUI(activePreset);

    let effectiveTheme = result.theme;
    if (orgHostname && result.orgThemes[orgHostname]) {
      effectiveTheme = result.orgThemes[orgHostname];
    } else if (result.autoMode) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = isDark
        ? (result.lastDarkTheme || 'connectry-dark')
        : (result.lastLightTheme || 'connectry');
    }

    // Seed _lastEnabledTheme so the on/off toggle has something to restore to
    if (effectiveTheme && effectiveTheme !== 'none') {
      _lastEnabledTheme = effectiveTheme;
    } else if (result.theme && result.theme !== 'none') {
      _lastEnabledTheme = result.theme;
    }

    setActiveUI(effectiveTheme);
    setAutoModeUI(result.autoMode);
    updateOrgRow(result.orgThemes, effectiveTheme);

    document.getElementById('autoModeToggle')?.addEventListener('change', handleAutoModeToggle);
  }

  init();
})();

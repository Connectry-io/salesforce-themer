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

  // Local copy of theme → shipped effects map for the popup. Mirrors the
  // canonical map in effects/presets.js (popup runs in a different script
  // context so it can't import from there).
  const POPUP_THEME_EFFECTS = {
    'connectry':       ['hoverLift'],
    'connectry-dark':  ['hoverLift', 'ambientGlow'],
    'midnight':        ['hoverLift', 'aurora', 'particles'],
    'slate':           ['hoverLift'],
    'tron':            ['hoverLift', 'ambientGlow', 'borderShimmer', 'gradientBorders', 'cursorTrail', 'neonFlicker'],
    'obsidian':        ['hoverLift', 'ambientGlow'],
    'arctic':          ['hoverLift', 'ambientGlow', 'borderShimmer', 'aurora', 'particles'],
    'sakura':          ['hoverLift', 'borderShimmer'],
    'ember':           ['hoverLift', 'ambientGlow', 'particles'],
    'nord':            ['hoverLift', 'aurora'],
    'terminal':        ['hoverLift', 'ambientGlow', 'borderShimmer', 'neonFlicker', 'particles'],
    'high-contrast':   [],
    'dracula':         ['hoverLift', 'ambientGlow', 'borderShimmer'],
    'solarized-light': ['hoverLift'],
    'solarized-dark':  ['hoverLift', 'ambientGlow'],
  };

  const POPUP_EFFECT_LABELS = {
    hoverLift: 'Hover lift',
    ambientGlow: 'Glow',
    borderShimmer: 'Shimmer',
    gradientBorders: 'Gradient',
    aurora: 'Aurora',
    neonFlicker: 'Neon',
    particles: 'Particles',
    cursorTrail: 'Cursor trail',
  };

  // ─── Theme group collapse persistence ─────────────────────────────────────
  // Stored as a comma-separated list of collapsed group keys in localStorage.
  // Light + Dark are tracked independently so the user can fold either one.
  const POPUP_GROUP_COLLAPSE_KEY = 'sft-popup-collapsed-groups';

  function _isGroupCollapsed(key) {
    try {
      const raw = localStorage.getItem(POPUP_GROUP_COLLAPSE_KEY) || '';
      return raw.split(',').includes(key);
    } catch (_) {
      return false;
    }
  }

  function _setGroupCollapsed(key, collapsed) {
    try {
      const raw = localStorage.getItem(POPUP_GROUP_COLLAPSE_KEY) || '';
      const set = new Set(raw.split(',').filter(Boolean));
      if (collapsed) set.add(key);
      else set.delete(key);
      localStorage.setItem(POPUP_GROUP_COLLAPSE_KEY, Array.from(set).join(','));
    } catch (_) {}
  }

  function buildPopupEffectPills(themeId) {
    const effects = POPUP_THEME_EFFECTS[themeId] || [];
    if (!effects.length) {
      return '<div class="theme-effects-pills is-empty">No effects</div>';
    }
    // 2 visible pills max — the row is a fixed height so a third pill would
    // overflow. The "+N" badge always shows the remainder.
    const VISIBLE = 2;
    const pills = effects.slice(0, VISIBLE).map(e =>
      `<span class="theme-effect-pill" title="${POPUP_EFFECT_LABELS[e] || e}">${POPUP_EFFECT_LABELS[e] || e}</span>`
    ).join('');
    const more = effects.length > VISIBLE
      ? `<span class="theme-effect-pill-more">+${effects.length - VISIBLE}</span>`
      : '';
    return `<div class="theme-effects-pills">${pills}${more}</div>`;
  }

  function renderThemesSection() {
    const section = document.getElementById('themesSection');
    section.innerHTML = '';

    const lightThemes = THEMES.filter(t => t.category === 'light');
    const darkThemes = THEMES.filter(t => t.category === 'dark');

    const groups = [
      { key: 'light', label: 'Light Themes', themes: lightThemes },
      { key: 'dark', label: 'Dark Themes', themes: darkThemes },
    ];

    for (const group of groups) {
      // Each group is a collapsible container: clickable label header +
      // grid body. Collapsed state persists in localStorage per group key.
      const groupKey = group.key;
      const collapsed = _isGroupCollapsed(groupKey);

      const groupEl = document.createElement('div');
      groupEl.className = `theme-group${collapsed ? ' is-collapsed' : ''}`;
      groupEl.dataset.groupKey = groupKey;

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'theme-group-label';
      label.setAttribute('aria-expanded', String(!collapsed));
      label.innerHTML = `
        <svg class="theme-group-label-chevron" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>${group.label}</span>
        <span class="theme-group-label-count">${group.themes.length}</span>
      `;
      label.addEventListener('click', () => {
        const nowCollapsed = !groupEl.classList.contains('is-collapsed');
        groupEl.classList.toggle('is-collapsed', nowCollapsed);
        label.setAttribute('aria-expanded', String(!nowCollapsed));
        _setGroupCollapsed(groupKey, nowCollapsed);
      });
      groupEl.appendChild(label);

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

        // No more DEFAULT badge — the active-ring already conveys which
        // theme is currently selected, and Connectry-as-default is implicit
        // because it's the first card on first install.

        btn.innerHTML = `
          <div class="theme-swatch">${swatchHtml}</div>
          <div class="theme-info">
            <div class="theme-name-row">
              <span class="theme-name">${theme.name}</span>
            </div>
            <div class="theme-desc-popup">${theme.description || ''}</div>
            ${buildPopupEffectPills(theme.id)}
          </div>
          <div class="theme-clone-row">
            <span class="theme-clone-btn" data-clone="${theme.id}" title="Clone & customize this theme">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/>
                <path d="M8.5 3.5v-1a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1" stroke="currentColor" stroke-width="1.2"/>
              </svg>
              Clone
            </span>
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

      groupEl.appendChild(grid);
      section.appendChild(groupEl);
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
      btn.addEventListener('click', (e) => {
        // Clone button → open Builder on the options page with this theme pre-selected
        const cloneBtn = e.target.closest('[data-clone]');
        if (cloneBtn) {
          e.stopPropagation();
          chrome.storage.local.set({
            openOptionsTab: 'builder',
            openBuilderClone: cloneBtn.dataset.clone,
          }).then(() => {
            chrome.runtime.openOptionsPage();
            window.close();
          });
          return;
        }
        selectTheme(btn.dataset.theme);
      });
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
    // The 4 buttons are the Volume knob: 'off' | 'subtle' | 'default' | 'immersive'.
    // They scale the active theme's SHIPPED effects rather than overwriting them.
    const pills = document.querySelectorAll('.effects-pill[data-volume]');
    pills.forEach(pill => {
      pill.addEventListener('click', async () => {
        const volume = pill.dataset.volume;
        await chrome.storage.sync.set({ effectsVolume: volume });
        setEffectsUI(volume);
      });
    });
  }

  function setEffectsUI(volume) {
    const pills = document.querySelectorAll('.effects-pill[data-volume]');
    pills.forEach(p => {
      const isActive = p.dataset.volume === volume;
      p.classList.toggle('is-active', isActive);
      p.setAttribute('aria-checked', String(isActive));
    });
  }

  // ─── Options page button ──────────────���───────────────────────────────────

  function bindOptionsButton() {
    document.getElementById('openOptionsBtn')?.addEventListener('click', () => {
      // Always land on the Themes tab from the More Settings button —
      // the popup is theme-centric, so the user expects the theme gallery
      // first. Effects has its own dedicated entry via the effects tooltip.
      openOptionsOnTab('themes');
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

  /**
   * Hide the popup's "Unlock Premium" CTA when the user is already premium
   * (real subscription or DEV override). Premium users shouldn't see upsells.
   */
  async function applyPremiumStateToPopup() {
    try {
      const { premiumOverride = false } = await chrome.storage.local.get({ premiumOverride: false });
      // TODO: when real auth ships, also check chrome.storage.local.premiumStatus
      const isPremium = !!premiumOverride;
      const cta = document.getElementById('upgradeCta');
      if (cta) cta.hidden = isPremium;
    } catch (_) {}
  }

  // ─── Collapsible settings card ────────────────────────────────────────────

  const COLLAPSE_KEY = 'sft-popup-settings-collapsed';

  function bindSettingsCollapse() {
    const header = document.getElementById('settingsCardToggle');
    const body = document.getElementById('settingsCardBody');
    if (!header || !body) return;

    // Restore persisted state — default to COLLAPSED so themes are the
    // first thing the user sees. The settings card is for configuration
    // they only touch occasionally; surfacing it expanded by default
    // pushes the theme grid below the fold.
    const stored = localStorage.getItem(COLLAPSE_KEY);
    const collapsed = stored === null ? true : stored === '1';
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
        '• Apply theme to Lightning pages only\n' +
        '• Set effects to the Subtle preset\n' +
        '• Clear all per-org overrides\n\n' +
        'Custom themes you\'ve created will be kept.'
      );
      if (!confirmed) return;

      // Reset to the same defaults the onInstalled handler uses
      const defaults = {
        theme: 'connectry',
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
        themeScope: 'lightning',
        effectsVolume: 'default',
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
    applyPremiumStateToPopup();

    const [result, orgHostname] = await Promise.all([
      chrome.storage.sync.get({
        theme: 'connectry',
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
        themeScope: 'lightning',
        effectsVolume: 'default',
      }),
      detectCurrentOrg(),
    ]);

    syncState = result;
    currentOrgHostname = orgHostname;
    setScopeUI(result.themeScope || 'both');

    // Set effects UI from the Volume knob (default = "as designer intended")
    setEffectsUI(result.effectsVolume || 'default');

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

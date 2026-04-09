(() => {
  'use strict';

  // ─── Premium gate ─────────────────────────────────────────────────────────
  //
  // Free tier gets: all themes, all presets (None/Subtle/Alive/Immersive),
  //   theme scope, auto mode, per-org themes, keyboard shortcuts, theme hints.
  //
  // Premium tier unlocks: individual effect toggles & intensity sliders,
  //   particle style selection, per-theme effects, the Builder (custom themes,
  //   AI generation, brand guide upload, URL matching), and Marketplace sharing.
  //
  // TODO: when auth ships, read from chrome.storage.local.premiumStatus set by
  // the backend session. For now this is a hardcoded flag that can be toggled
  // in dev via: chrome.storage.local.set({ premiumOverride: true })
  const IS_PREMIUM = false;

  function isPremium() {
    // Local override for dev/testing — set via:
    // chrome.storage.local.set({ premiumOverride: true })
    return IS_PREMIUM || _localPremiumOverride;
  }

  let _localPremiumOverride = false;

  let THEMES = [];
  let syncState = {};
  let activeFilter = 'all';
  let _tabsInstance = null;

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

  // Mini effect indicator icons — one per effect type. Used on theme cards
  // to communicate at a glance what effects ship with each theme.
  const EFFECT_ICONS = {
    hoverLift:       { svg: '<path d="M2 11l4-4 4 4 4-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>', label: 'Hover lift' },
    ambientGlow:     { svg: '<circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5"/>', label: 'Ambient glow' },
    borderShimmer:   { svg: '<path d="M2 8h12M5 5l2 3-2 3M11 5l-2 3 2 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>', label: 'Border shimmer' },
    gradientBorders: { svg: '<rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2" fill="none"/>', label: 'Gradient borders' },
    aurora:          { svg: '<path d="M2 11c2-3 4-3 6-1s4 2 6-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M2 8c2-3 4-3 6-1s4 2 6-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.6"/>', label: 'Aurora' },
    neonFlicker:     { svg: '<path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="currentColor" fill-opacity="0.4"/>', label: 'Neon flicker' },
    particles:       { svg: '<circle cx="4" cy="4" r="1" fill="currentColor"/><circle cx="11" cy="3" r="1" fill="currentColor"/><circle cx="6" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="9" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="13" r="1" fill="currentColor"/>', label: 'Particles' },
    cursorTrail:     { svg: '<path d="M3 3l5 9 1.5-3.5L13 7 3 3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="currentColor" fill-opacity="0.4"/>', label: 'Cursor trail' },
  };

  /**
   * Build the inline effect-indicator HTML for a theme card. Returns a row
   * of mini SVG icons with a hover tooltip listing the full set by name.
   */
  function buildEffectIndicators(themeId) {
    const cfg = getSuggestedEffectsFor(themeId);
    const enabled = [];
    for (const eff of ['hoverLift', 'ambientGlow', 'borderShimmer', 'gradientBorders', 'aurora', 'neonFlicker', 'particles', 'cursorTrail']) {
      if (cfg[eff]) enabled.push(eff);
    }
    if (!enabled.length) {
      return `<div class="theme-effects-indicators is-empty" title="No effects shipped"><span class="theme-effects-empty">No effects</span></div>`;
    }
    const tooltipLabel = enabled.map(e => EFFECT_ICONS[e]?.label || e).join(' · ');
    const icons = enabled.map(e => `
      <span class="theme-effect-icon" title="${EFFECT_ICONS[e]?.label || e}" aria-label="${EFFECT_ICONS[e]?.label || e}">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">${EFFECT_ICONS[e]?.svg || ''}</svg>
      </span>
    `).join('');
    return `<div class="theme-effects-indicators" title="Effects: ${tooltipLabel}">${icons}</div>`;
  }

  function renderThemeGrid(activeThemeId) {
    const lightGrid = document.getElementById('lightThemeGrid');
    const darkGrid = document.getElementById('darkThemeGrid');
    if (!lightGrid || !darkGrid) return;
    lightGrid.innerHTML = '';
    darkGrid.innerHTML = '';

    for (const theme of THEMES) {
      const isActive = theme.id === activeThemeId;

      const card = document.createElement('div');
      card.className = `theme-card${isActive ? ' is-active' : ''}`;
      card.dataset.theme = theme.id;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(isActive));
      card.setAttribute('tabindex', '0');
      card.setAttribute('title', theme.name);

      // Note: V3 model removed the "Try these effects" hint badge — themes
      // now ALWAYS ship with their effects (no opt-in nudge needed).
      // Theme card effect indicators (mini icons showing what each theme has)
      // come in Commit C.

      card.innerHTML = `
        <div class="theme-swatch">${buildSwatch(theme)}</div>
        <div class="theme-card-body">
          <div class="theme-card-header">
            <span class="theme-name">${theme.name}</span>
            <span class="theme-category-badge ${theme.category}">${theme.category === 'light' ? 'Light' : 'Dark'}</span>
          </div>
          <div class="theme-description">${theme.description}</div>
          ${buildEffectIndicators(theme.id)}
        </div>
        <div class="theme-card-actions">
          <div class="theme-card-status">
            <span class="theme-card-status-dot"></span>
            <span>${isActive ? 'Active' : 'Apply'}</span>
          </div>
          <button class="theme-card-clone-btn" data-clone="${theme.id}" title="Clone & customize this theme">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="2.5" y="5.5" width="7" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/>
              <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" stroke-width="1.3"/>
            </svg>
            Clone
          </button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        const cloneBtn = e.target.closest('[data-clone]');
        if (cloneBtn) {
          e.stopPropagation();
          // V3: Theme Builder is open to ALL users — free users can preview
          // and tweak everything but can't save until they upgrade.
          openCreationDialog(cloneBtn.dataset.clone);
          return;
        }
        selectTheme(theme.id);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTheme(theme.id);
        }
      });

      // Append to the matching group
      (theme.category === 'light' ? lightGrid : darkGrid).appendChild(card);
    }

    // Apply current filter to show/hide groups
    applyThemeFilter();
  }

  /**
   * Show/hide the Light Themes and Dark Themes groups based on the
   * activeFilter pill state. 'all' shows both; 'light'/'dark' shows one.
   */
  function applyThemeFilter() {
    const lightGroup = document.getElementById('lightThemeGroup');
    const darkGroup = document.getElementById('darkThemeGroup');
    if (!lightGroup || !darkGroup) return;
    lightGroup.hidden = activeFilter === 'dark';
    darkGroup.hidden = activeFilter === 'light';
  }

  function updateGridActiveState(activeThemeId) {
    document.querySelectorAll('#themeGrid .theme-card, #customThemeGrid .theme-card').forEach(card => {
      const id = card.dataset.theme;
      const isActive = id === activeThemeId;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-checked', String(isActive));
      const statusText = card.querySelector('.theme-card-status span:last-child');
      if (statusText) statusText.textContent = isActive ? 'Active' : 'Apply';
    });
  }

  function _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ─── Custom theme grid ───────────────────────────────────────────────────

  function renderCustomThemeGrid(activeThemeId) {
    const grid = document.getElementById('customThemeGrid');
    const empty = document.getElementById('customThemeEmpty');
    if (!grid || !empty) return;

    const customs = syncState.customThemes || [];

    if (!customs.length) {
      grid.innerHTML = '';
      grid.hidden = true;
      empty.hidden = false;
      return;
    }

    grid.hidden = false;
    empty.hidden = true;
    grid.innerHTML = '';

    for (const ct of customs) {
      const isActive = ct.id === activeThemeId;
      const base = getThemeById(ct.basedOn);
      const resolvedColors = { ...(base?.colors || {}), ...(ct.coreOverrides || {}), ...(ct.advancedOverrides || {}) };
      const swatchColors = [resolvedColors.background, resolvedColors.surface, resolvedColors.accent, resolvedColors.textPrimary];
      const swatchHtml = swatchColors.map(col => `<span style="background:${col};"></span>`).join('');

      const card = document.createElement('div');
      card.className = `theme-card${isActive ? ' is-active' : ''}`;
      card.dataset.theme = ct.id;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(isActive));
      card.setAttribute('tabindex', '0');
      card.setAttribute('title', ct.name);

      const category = ct.category || (resolvedColors.colorScheme === 'dark' ? 'dark' : 'light');
      const presetName = (ct.effects && ct.effects.preset) || 'none';

      card.innerHTML = `
        <div class="theme-swatch">${swatchHtml}</div>
        <div class="theme-card-body">
          <div class="theme-card-header">
            <span class="theme-name">${Connectry.Settings.escape(ct.name)}</span>
            <span class="theme-category-badge ${category}">${category === 'light' ? 'Light' : 'Dark'}</span>
          </div>
          <div class="theme-description">Based on ${base ? base.name : ct.basedOn} · Effects: ${_capitalize(presetName)}</div>
        </div>
        <div class="theme-card-actions">
          <div class="theme-card-status">
            <span class="theme-card-status-dot"></span>
            <span>${isActive ? 'Active' : 'Apply'}</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="theme-card-edit-btn" data-edit="${ct.id}" title="Edit this theme">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M8 1.5l2 2-7 7H1v-2l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
              Edit
            </button>
            <button class="theme-card-delete-btn" data-delete="${ct.id}" title="Delete this theme">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 3h8M4.5 3V2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M3 3l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L9 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit]');
        const deleteBtn = e.target.closest('[data-delete]');
        if (editBtn) {
          e.stopPropagation();
          openEditor(ct.basedOn, ct);
          return;
        }
        if (deleteBtn) {
          e.stopPropagation();
          deleteCustomTheme(ct.id);
          return;
        }
        selectTheme(ct.id);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTheme(ct.id);
        }
      });

      grid.appendChild(card);
    }
  }

  async function deleteCustomTheme(customId) {
    const customs = syncState.customThemes || [];
    const ct = customs.find(t => t.id === customId);
    if (!ct) return;
    if (!confirm(`Delete "${ct.name}"? This can't be undone.`)) return;

    const filtered = customs.filter(t => t.id !== customId);
    await chrome.storage.sync.set({ customThemes: filtered });
    syncState.customThemes = filtered;

    // If the deleted theme was active, fall back to connectry
    if (syncState.theme === customId) {
      await selectTheme('connectry');
    } else {
      renderCustomThemeGrid(syncState.theme);
    }
  }

  // ─── Filter pills ─────────────────────────────────────────────────────────

  function bindFilterPills() {
    const filterPills = document.querySelectorAll('.cx-pill[data-filter]');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        activeFilter = pill.dataset.filter;
        filterPills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        applyThemeFilter();
      });
    });
  }

  // ─── Theme selection ──────────────────────────────────────────────────────

  async function selectTheme(themeId) {
    const updates = { theme: themeId };
    const ootbTheme = getThemeById(themeId);
    if (ootbTheme) {
      if (ootbTheme.category === 'light') updates.lastLightTheme = themeId;
      if (ootbTheme.category === 'dark') updates.lastDarkTheme = themeId;
    }

    await chrome.storage.sync.set(updates);
    syncState = { ...syncState, ...updates };

    updateGridActiveState(themeId);
    updateHeaderMeta(themeId);
    updateEffectsContextBanner();
    renderEffectsTabForActiveTheme();

    // Push the theme to all open Salesforce tabs across all windows.
    // (We can't use {active: true, currentWindow: true} from the options page
    //  because that returns the options tab itself, which has no content
    //  script and would silently swallow the message.)
    pushThemeToAllSfTabs(themeId);
  }

  async function pushThemeToAllSfTabs(themeId) {
    try {
      const tabs = await chrome.tabs.query({
        url: [
          'https://*.lightning.force.com/*',
          'https://*.my.salesforce.com/*',
          'https://*.salesforce.com/*',
          'https://*.visualforce.com/*',
        ],
      });
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme: themeId }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  // (V3 removed: applySuggestedEffectsToGlobal — under the new model, themes
  // always ship with their own effects, so there's no "suggestion to apply".
  // The Volume knob in the Theme Application card replaces this control.)

  /**
   * Inline suggested-effects generator — mirrors effects/presets.js
   * THEME_EFFECTS_MAP. Options page doesn't load presets.js directly because
   * that's a content-script resource, so we duplicate the mapping here.
   */
  function getSuggestedEffectsFor(themeId) {
    const NONE = {
      preset: 'none',
      hoverLift: false, hoverLiftIntensity: 'medium',
      ambientGlow: false, ambientGlowIntensity: 'medium',
      borderShimmer: false, borderShimmerIntensity: 'medium',
      gradientBorders: false, gradientBordersIntensity: 'medium',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: false, cursorTrailIntensity: 'medium',
    };
    const SUBTLE = { ...NONE, preset: 'subtle', hoverLift: true, hoverLiftIntensity: 'subtle' };
    const ALIVE = {
      ...NONE, preset: 'alive',
      hoverLift: true, hoverLiftIntensity: 'medium',
      ambientGlow: true, ambientGlowIntensity: 'medium',
      borderShimmer: true, borderShimmerIntensity: 'medium',
    };
    const IMMERSIVE = {
      ...NONE, preset: 'immersive',
      hoverLift: true, hoverLiftIntensity: 'strong',
      ambientGlow: true, ambientGlowIntensity: 'strong',
      borderShimmer: true, borderShimmerIntensity: 'medium',
      gradientBorders: true, gradientBordersIntensity: 'strong',
      cursorTrail: true, cursorTrailIntensity: 'medium',
    };
    const MAP = {
      'connectry': SUBTLE,
      'connectry-dark': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'subtle' },
      'midnight': { ...SUBTLE, aurora: true, auroraIntensity: 'subtle', particles: 'dots', particlesIntensity: 'subtle' },
      'slate': SUBTLE,
      'tron': { ...IMMERSIVE, neonFlicker: true, neonFlickerIntensity: 'strong', ambientGlow: true, ambientGlowIntensity: 'strong' },
      'obsidian': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'subtle' },
      'arctic': { ...ALIVE, aurora: true, auroraIntensity: 'medium', particles: 'snow', particlesIntensity: 'medium' },
      'sakura': { ...SUBTLE, borderShimmer: true, borderShimmerIntensity: 'subtle' },
      'ember': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'medium', particles: 'embers', particlesIntensity: 'subtle' },
      'nord': { ...SUBTLE, aurora: true, auroraIntensity: 'subtle' },
      'terminal': { ...ALIVE, neonFlicker: true, neonFlickerIntensity: 'medium', particles: 'matrix', particlesIntensity: 'medium' },
      'high-contrast': NONE,
      'dracula': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'medium', borderShimmer: true, borderShimmerIntensity: 'medium' },
      'solarized-light': SUBTLE,
      'solarized-dark': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'subtle' },
    };
    return { ...(MAP[themeId] || NONE) };
  }

  function _flashToast(msg) {
    const el = document.createElement('div');
    el.className = 'cx-toast';
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed',
      top: '84px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--cx-text)',
      color: 'var(--cx-white)',
      padding: '10px 20px',
      borderRadius: 'var(--cx-radius-md)',
      fontSize: '13px',
      fontWeight: '600',
      boxShadow: 'var(--cx-shadow-lg)',
      zIndex: '2000',
      animation: 'cx-fade-in 220ms ease',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  // ─── Custom theme creation dialog ───────────────────────────────────────

  function openCreationDialog(baseThemeId) {
    const base = getThemeById(baseThemeId);
    const baseName = base ? base.name : baseThemeId;

    // Under V3, custom themes always start with their base theme's shipped
    // effects. The old "Copy my current global effects" option is gone —
    // there's no global effects config anymore.
    _pendingCreateEffects = getSuggestedEffectsFor(baseThemeId);
    openEditor(baseThemeId, null);
  }

  // Holds effects snapshot staged by the creation dialog — picked up by saveCustomTheme
  let _pendingCreateEffects = null;

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
      pushThemeToAllSfTabs(next);
    }
  }

  // ─── Theme Application tooltips ──────────────────────────────────────────
  // Mirrors the popup's floating-tooltip pattern: click a help icon to toggle
  // the matching tooltip, click outside or press Esc to dismiss. Tooltips are
  // absolute-positioned children of the .opt-settings-card so they overlay
  // without pushing rows down.

  const OPT_TOOLTIP_IDS = ['optAutoTooltip', 'optScopeTooltip', 'optOrgTooltip'];

  function bindOptThemeApplicationTooltips() {
    document.querySelectorAll('.opt-settings-help-btn[data-tooltip]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tipId = btn.dataset.tooltip;
        const tip = document.getElementById(tipId);
        if (!tip) return;
        const wasHidden = tip.hidden;
        _hideAllOptTooltips();
        if (wasHidden) {
          _positionOptTooltipBelow(tip, btn);
          tip.hidden = false;
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.opt-settings-tooltip') || e.target.closest('.opt-settings-help-btn')) return;
      _hideAllOptTooltips();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _hideAllOptTooltips();
    });
  }

  function _hideAllOptTooltips() {
    OPT_TOOLTIP_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function _positionOptTooltipBelow(tooltip, anchorBtn) {
    const card = anchorBtn.closest('.opt-settings-card');
    if (!card) return;
    const row = anchorBtn.closest('.opt-settings-row');
    if (!row) return;
    const cardRect = card.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.bottom - cardRect.top + 6;
    tooltip.style.top = `${top}px`;
  }

  // ─── Theme on/off toggle (matches popup) ─────────────────────────────────

  // Tracks the most recently picked non-'none' theme so we can restore it
  // when the user flips the toggle back on.
  let _optLastEnabledTheme = 'connectry';

  function bindOptThemeOnToggle() {
    const toggle = document.getElementById('optThemeOnToggle');
    if (!toggle) return;
    // Initial state — derived from current syncState.theme
    const isOn = syncState.theme && syncState.theme !== 'none';
    toggle.checked = !!isOn;
    if (isOn) _optLastEnabledTheme = syncState.theme;

    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        const restore = (_optLastEnabledTheme && _optLastEnabledTheme !== 'none')
          ? _optLastEnabledTheme : 'connectry';
        await selectTheme(restore);
      } else {
        if (syncState.theme && syncState.theme !== 'none') {
          _optLastEnabledTheme = syncState.theme;
        }
        await selectTheme('none');
      }
    });
  }

  // ─── Effects volume knob (matches popup) ─────────────────────────────────
  //
  // The 4 buttons are the Volume knob: 'off' | 'subtle' | 'default' | 'immersive'.
  // They scale the active theme's SHIPPED effects rather than overwriting them.
  // Free users can adjust volume; Premium can also clone themes to customize
  // individual effects in the Theme Builder.

  function bindOptEffectsPills() {
    const pills = document.querySelectorAll('#optEffectsPills .opt-scope-pill[data-effect-volume]');
    if (!pills.length) return;

    // Initial state from sync
    const activeVolume = syncState.effectsVolume || 'default';
    pills.forEach(p => p.classList.toggle('is-active', p.dataset.effectVolume === activeVolume));

    pills.forEach(pill => {
      pill.addEventListener('click', async () => {
        const volume = pill.dataset.effectVolume;
        pills.forEach(p => p.classList.toggle('is-active', p === pill));
        await chrome.storage.sync.set({ effectsVolume: volume });
        syncState.effectsVolume = volume;
        // Re-render the Effects tab (read-only) so it reflects new volume
        renderEffectsTabForActiveTheme();
      });
    });

    // Tooltip "Effects tab" link → switch tabs
    document.querySelectorAll('.opt-settings-tooltip-link[data-tab-link]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = link.dataset.tabLink;
        if (_tabsInstance && targetTab) {
          _tabsInstance.activate(targetTab);
          _hideAllOptTooltips();
        }
      });
    });
  }

  // ─── Reset all settings (matches popup) ──────────────────────────────────

  function bindOptResetSettings() {
    const btn = document.getElementById('optResetSettingsBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const confirmed = confirm(
        'Reset Salesforce Themer to defaults?\n\n' +
        'This will:\n' +
        '• Switch back to the Connectry theme\n' +
        '• Turn off Follow System mode\n' +
        '• Apply theme to Lightning pages only\n' +
        '• Set effects volume to Default\n' +
        '• Clear all per-org overrides\n\n' +
        'Custom themes you\'ve created will be kept.'
      );
      if (!confirmed) return;

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
      pushThemeToAllSfTabs('connectry');
      window.location.reload();
    });
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
    if (!meta) return;
    const theme = getThemeById(activeThemeId) || (syncState.customThemes || []).find(t => t.id === activeThemeId);
    const name = theme ? theme.name : activeThemeId;
    // Compact DEV badge — placed AFTER the active theme so it doesn't push
    // the tabs out of view. Just "DEV" instead of "DEV · Premium unlocked".
    const devBadge = _localPremiumOverride
      ? `<span class="dev-mode-badge" title="DEV mode: Premium override is active. Disable in About tab.">DEV</span>`
      : '';
    meta.innerHTML = `<span class="header-meta-active">Active: <strong>${Connectry.Settings.escape(name)}</strong></span>${devBadge}`;
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

    // Load dev premium override from local storage (hidden dev toggle)
    try {
      const local = await chrome.storage.local.get({ premiumOverride: false });
      _localPremiumOverride = !!local.premiumOverride;
    } catch (_) {}

    syncState = await chrome.storage.sync.get({
      theme: 'connectry',
      autoMode: false,
      lastLightTheme: 'connectry',
      lastDarkTheme: 'connectry-dark',
      orgThemes: {},
      themeScope: 'lightning',
      effectsVolume: 'default',
      customThemes: [],
    });

    let activeTheme = syncState.theme;
    if (syncState.autoMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = prefersDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
    }

    // Themes tab
    renderThemeGrid(activeTheme);
    renderCustomThemeGrid(activeTheme);
    bindFilterPills();
    updateHeaderMeta(activeTheme);
    renderOrgList(syncState.orgThemes);
    setVersion();

    // Auto mode toggle
    const autoToggle = document.getElementById('autoModeToggle');
    autoToggle.checked = syncState.autoMode;
    autoToggle.addEventListener('change', handleAutoModeToggle);

    // Theme scope pills (segmented control matching popup pattern)
    const scopePills = document.querySelectorAll('#optionsScopePills .opt-scope-pill');
    const currentScope = syncState.themeScope || 'lightning';
    scopePills.forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.scope === currentScope);
      pill.addEventListener('click', async () => {
        const scope = pill.dataset.scope;
        scopePills.forEach(p => p.classList.toggle('is-active', p === pill));
        await chrome.storage.sync.set({ themeScope: scope });
        syncState.themeScope = scope;
      });
    });

    // Theme Application tooltips (mirror popup floating tooltip pattern)
    bindOptThemeApplicationTooltips();

    // Theme on/off toggle (mirrors popup row)
    bindOptThemeOnToggle();

    // Effects preset pills (mirrors popup row)
    bindOptEffectsPills();

    // Reset to defaults link
    bindOptResetSettings();

    // Effects tab
    renderEffectsTabForActiveTheme();

    // Listen for storage changes from other windows/tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.theme) {
        syncState.theme = changes.theme.newValue;
        updateGridActiveState(syncState.theme);
        updateHeaderMeta(syncState.theme);
        updateEffectsContextBanner();
        renderEffectsTabForActiveTheme();
        // Sync the Theme Application on/off toggle
        const optThemeToggle = document.getElementById('optThemeOnToggle');
        if (optThemeToggle) {
          const on = syncState.theme && syncState.theme !== 'none';
          optThemeToggle.checked = !!on;
          if (on) _optLastEnabledTheme = syncState.theme;
        }
      }
      if (changes.autoMode) {
        syncState.autoMode = changes.autoMode.newValue;
        autoToggle.checked = changes.autoMode.newValue;
      }
      if (changes.orgThemes) {
        syncState.orgThemes = changes.orgThemes.newValue;
        renderOrgList(syncState.orgThemes);
      }
      if (changes.customThemes) {
        syncState.customThemes = changes.customThemes.newValue || [];
        renderCustomThemeGrid(syncState.theme);
        renderEffectsTabForActiveTheme();
      }
      if (changes.effectsVolume) {
        syncState.effectsVolume = changes.effectsVolume.newValue;
        renderEffectsTabForActiveTheme();
        // Sync the Theme Application effects volume pills
        const activeVolume = syncState.effectsVolume || 'default';
        document.querySelectorAll('#optEffectsPills .opt-scope-pill[data-effect-volume]').forEach(p => {
          p.classList.toggle('is-active', p.dataset.effectVolume === activeVolume);
        });
      }
      if (changes.customThemes) {
        // Already handled above; ensure we re-render effects when a custom theme's snapshot changes
      }
      if (changes.themeScope) {
        syncState.themeScope = changes.themeScope.newValue;
        document.querySelectorAll('#optionsScopePills .opt-scope-pill').forEach(p => {
          p.classList.toggle('is-active', p.dataset.scope === syncState.themeScope);
        });
      }
    });

    // Initialize tabs (must happen after all content is rendered)
    if (window.Connectry && Connectry.Settings && Connectry.Settings.Tabs) {
      const tabContainer = document.querySelector('.cx-tabs');
      if (tabContainer) {
        _tabsInstance = new Connectry.Settings.Tabs(tabContainer, {
          storageKey: 'cx-themer-active-tab',
          onChange: (tabName) => {
            // Auto-close the theme editor on any tab change. The editor is
            // a top-level overlay (not a tabpanel), so without this it would
            // remain visible underneath every tab's content.
            if (editorState && editorState.active) {
              closeEditor();
            }
            // Start/stop preview canvases when leaving/entering Effects tab
            if (tabName === 'effects') {
              startEffectPreviews();
            } else {
              stopEffectPreviews();
            }
          },
        });
      }
    }

    // Handoff from popup: if popup set openOptionsTab, honour it and clear the flag
    try {
      const handoff = await chrome.storage.local.get({ openOptionsTab: null });
      if (handoff.openOptionsTab && _tabsInstance) {
        _tabsInstance.activate(handoff.openOptionsTab);
        await chrome.storage.local.remove('openOptionsTab');
      }
    } catch (_) {}

    // Bind Upgrade tab plan CTAs
    bindUpgradePlanCtas();

    // Dev panel: Easter-egg unlock + premium override toggle
    bindDevPanel();

    // Mark <body> with the current premium state so CSS can hide gating
    syncPremiumBodyClass();

    // Empty-state buttons in custom themes section.
    // V3: builder is open to all — no premium gate at entry, only on Save.
    document.getElementById('createThemeBtnEmpty')?.addEventListener('click', () => {
      _pendingCreateEffects = getSuggestedEffectsFor('connectry');
      openEditor('connectry', null);
    });
    document.getElementById('cloneFirstBtn')?.addEventListener('click', () => {
      openCreationDialog('connectry');
    });

    // Builder tab: create-method cards.
    // V3: Manual is open to all (Save is gated). AI/brand-guide/url stay
    // coming-soon and still show the upgrade dialog as a fallback.
    document.querySelectorAll('.create-method-card[data-method]').forEach(card => {
      card.addEventListener('click', () => {
        const method = card.dataset.method;
        if (method === 'manual') {
          openCreationDialog('connectry');
          return;
        }
        // AI, brand-guide, url are still coming-soon — show upgrade dialog
        // for free users; no-op for premium until they ship.
        if (!isPremium()) {
          openUpgradeDialog();
        }
      });
    });
  }

  /**
   * Check if the user is premium; open the upgrade dialog if not.
   * @returns {boolean} true if user is premium and the caller can proceed
   */
  function _guardPremium() {
    if (isPremium()) return true;
    openUpgradeDialog();
    return false;
  }

  /**
   * Reflect the current premium state on <body>. CSS rules under
   * `body.is-premium` hide free-tier visual gating (lock badges, gold
   * Premium pills, etc.) so unlocked users get a clean experience that
   * matches what a paying customer would see.
   */
  function syncPremiumBodyClass() {
    document.body.classList.toggle('is-premium', isPremium());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Theme Editor
  // ═══════════════════════════════════════════════════════════════════════════

  // Inline derivation utilities (subset — matches themes/derive.js)
  function _pc(color) {
    if (!color || typeof color !== 'string') return null;
    color = color.trim();
    if (color[0] === '#') {
      const h = color.slice(1);
      if (h.length === 3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
      if (h.length >= 6) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
    }
    return null;
  }
  function _hex(r,g,b) {
    const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
    return '#'+c(r)+c(g)+c(b);
  }
  function _toHsl(r,g,b) {
    r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;
    if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}
    return{h:h*360,s:s*100,l:l*100};
  }
  function _fromHsl(h,s,l) {
    h/=360;s/=100;l/=100;if(s===0){const v=Math.round(l*255);return{r:v,g:v,b:v};}
    const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
    const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
    return{r:Math.round(hue2rgb(p,q,h+1/3)*255),g:Math.round(hue2rgb(p,q,h)*255),b:Math.round(hue2rgb(p,q,h-1/3)*255)};
  }
  function _lighten(hex,amt){const c=_pc(hex);if(!c)return hex;const h=_toHsl(c.r,c.g,c.b);h.l=Math.min(100,h.l+amt);const r=_fromHsl(h.h,h.s,h.l);return _hex(r.r,r.g,r.b);}
  function _darken(hex,amt){const c=_pc(hex);if(!c)return hex;const h=_toHsl(c.r,c.g,c.b);h.l=Math.max(0,h.l-amt);const r=_fromHsl(h.h,h.s,h.l);return _hex(r.r,r.g,r.b);}
  function _alpha(hex,op){const c=_pc(hex);if(!c)return hex;return `rgba(${c.r}, ${c.g}, ${c.b}, ${op})`;}
  function _contrast(hex){const c=_pc(hex);if(!c)return '#ffffff';const[rs,gs,bs]=[c.r,c.g,c.b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return(0.2126*rs+0.7152*gs+0.0722*bs)>0.35?'#1a1a1a':'#ffffff';}
  function _mix(h1,h2,w){const c1=_pc(h1),c2=_pc(h2);if(!c1||!c2)return h1;w=Math.max(0,Math.min(1,w));return _hex(c1.r+(c2.r-c1.r)*w,c1.g+(c2.g-c1.g)*w,c1.b+(c2.b-c1.b)*w);}

  const CORE_KEYS = [
    'colorScheme','background','surface','surfaceAlt','accent','link',
    'nav','navText','textPrimary','textSecondary','textPlaceholder',
    'border','borderInput','buttonBrandText','buttonNeutralBg',
    'tableHeaderBg','modalBg','dropdownBg','success','warning','error',
    'focusRing','scrollThumb',
  ];

  const ADVANCED_GROUPS = {
    'Surfaces': ['surfaceHover','surfaceHighlight','surfaceSelection'],
    'Accent Variants': ['accentHover','accentActive','accentLight'],
    'Text': ['textMuted'],
    'Navigation': ['navHover','navActive','navActiveBorder','navBorder','navIcon','navActiveText','navAppName','navAppBorder','navWaffleDot'],
    'Links': ['linkHover'],
    'Borders': ['borderSeparator'],
    'Buttons': ['buttonBrandBg','buttonBrandBorder','buttonBrandHover','buttonNeutralBorder','buttonNeutralHover','buttonNeutralText'],
    'Tables': ['tableHeaderText','tableAltRow','tableHoverRow','tableBorderRow','tableColBorder'],
    'Modals': ['modalHeaderBg','modalFooterBg','modalBackdrop','modalShadow'],
    'Dropdowns': ['dropdownItemHoverBg','dropdownItemHoverText'],
    'Tabs': ['tabNavBorder','tabActiveColor','tabActiveBorder','tabInactiveColor','tabContentBg'],
    'Scrollbar': ['scrollTrack','scrollThumbHover'],
    'Badges & Pills': ['badgeBg','badgeText','badgeBorder','pillBg','pillBorder','pillText'],
    'Panels': ['panelBg','panelBorder'],
  };

  // Derivation engine (mirrors themes/derive.js)
  function deriveFullTheme(input) {
    const c = { ...input };
    const isDark = c.colorScheme === 'dark';
    const d = (k, fn) => { if (c[k] === undefined || c[k] === null) c[k] = fn(); };

    d('surfaceHover', () => isDark ? _lighten(c.surface, 5) : _darken(c.surface, 3));
    d('surfaceHighlight', () => _alpha(c.accent, 0.10));
    d('surfaceSelection', () => _alpha(c.accent, 0.15));
    d('accentHover', () => _darken(c.accent, isDark ? 15 : 10));
    d('accentActive', () => _darken(c.accent, isDark ? 25 : 20));
    d('accentLight', () => _alpha(c.accent, 0.15));
    d('textMuted', () => _mix(c.textSecondary, c.textPlaceholder, isDark ? 0.6 : 0.4));
    d('navHover', () => 'rgba(255, 255, 255, 0.12)');
    d('navActive', () => 'rgba(255, 255, 255, 0.2)');
    d('navActiveBorder', () => c.navText);
    d('navBorder', () => _mix(c.nav, '#000000', isDark ? 0.3 : 0.15));
    d('navIcon', () => c.navText);
    d('navActiveText', () => c.navText);
    d('navAppName', () => c.navText);
    d('navAppBorder', () => 'rgba(255, 255, 255, 0.2)');
    d('navWaffleDot', () => c.navText);
    d('linkHover', () => isDark ? _lighten(c.link, 12) : _darken(c.link, 20));
    d('borderSeparator', () => c.border);
    d('buttonBrandBg', () => c.accent);
    d('buttonBrandBorder', () => c.accent);
    d('buttonBrandHover', () => _darken(c.accent, 10));
    d('buttonNeutralBorder', () => c.borderInput);
    d('buttonNeutralHover', () => isDark ? _lighten(c.surface, 5) : _darken(c.surface, 3));
    d('buttonNeutralText', () => c.textPrimary);
    d('tableHeaderText', () => c.textSecondary);
    d('tableAltRow', () => isDark ? _lighten(c.surface, 2) : _darken(c.surface, 1));
    d('tableHoverRow', () => _alpha(c.accent, 0.10));
    d('tableBorderRow', () => c.border);
    d('tableColBorder', () => isDark ? c.border : _lighten(c.border, 5));
    d('modalHeaderBg', () => isDark ? _darken(c.surface, 5) : c.surface);
    d('modalFooterBg', () => isDark ? _darken(c.surface, 5) : c.background);
    d('modalBackdrop', () => isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.4)');
    d('modalShadow', () => isDark ? '0 20px 60px rgba(0, 0, 0, 0.6)' : '0 20px 60px rgba(0, 0, 0, 0.12)');
    d('dropdownItemHoverBg', () => _alpha(c.accent, 0.10));
    d('dropdownItemHoverText', () => c.textPrimary);
    d('tabNavBorder', () => c.border);
    d('tabActiveColor', () => c.accent);
    d('tabActiveBorder', () => c.accent);
    d('tabInactiveColor', () => c.textSecondary);
    d('tabContentBg', () => c.surface);
    d('focusRing', () => `0 0 0 3px ${_alpha(c.accent, 0.3)}`);
    d('scrollTrack', () => isDark ? _darken(c.background, 10) : _darken(c.background, 2));
    d('scrollThumbHover', () => c.textPlaceholder);
    d('badgeBg', () => isDark ? _alpha(c.accent, 0.15) : c.accent);
    d('badgeText', () => isDark ? c.accent : _contrast(c.accent));
    d('badgeBorder', () => isDark ? `1px solid ${_alpha(c.accent, 0.3)}` : 'none');
    d('pillBg', () => _alpha(c.accent, 0.10));
    d('pillBorder', () => c.borderInput);
    d('pillText', () => c.textPrimary);
    d('panelBg', () => c.surface);
    d('panelBorder', () => c.border);
    d('searchBg', () => isDark ? _darken(c.surface, 10) : c.surface);
    d('searchText', () => c.textPrimary);
    d('searchBorder', () => isDark ? c.border : c.borderInput);
    d('searchPlaceholder', () => isDark ? c.textSecondary : c.textPlaceholder);
    d('searchFocusBorder', () => c.accent);
    d('searchFocusShadow', () => `0 0 0 2px ${_alpha(c.accent, 0.25)}`);
    d('globalHeaderWhite', () => true);
    return c;
  }

  // ─── Editor State ─────────────────────────────────────────────────────────

  let editorState = {
    active: false,
    basedOn: null,          // OOTB theme id
    customId: null,         // custom-TIMESTAMP or null (new)
    coreOverrides: {},
    advancedOverrides: {},
  };

  function getEditorCoreValues() {
    const base = getThemeById(editorState.basedOn);
    if (!base) return {};
    const core = {};
    for (const k of CORE_KEYS) {
      core[k] = editorState.coreOverrides[k] ?? base.colors[k];
    }
    return core;
  }

  function getFullEditorTheme() {
    const core = getEditorCoreValues();
    const derived = deriveFullTheme(core);
    Object.assign(derived, editorState.advancedOverrides);
    return derived;
  }

  // ─── Open / Close Editor ──────────────────────────────────────────────────

  function openEditor(baseThemeId, customTheme) {
    editorState.active = true;
    editorState.basedOn = customTheme ? customTheme.basedOn : baseThemeId;

    if (customTheme) {
      editorState.customId = customTheme.id;
      editorState.coreOverrides = { ...(customTheme.coreOverrides || {}) };
      editorState.advancedOverrides = { ...(customTheme.advancedOverrides || {}) };
      // Existing custom theme: load its effects snapshot
      editorState.effects = customTheme.effects
        ? { ...customTheme.effects }
        : getSuggestedEffectsFor(customTheme.basedOn || baseThemeId);
      document.getElementById('editorName').value = customTheme.name;
    } else {
      editorState.customId = null;
      editorState.coreOverrides = {};
      editorState.advancedOverrides = {};
      // New theme: seed effects from base theme's shipped effects, OR from
      // _pendingCreateEffects if the creation dialog staged something
      editorState.effects = _pendingCreateEffects
        ? { ..._pendingCreateEffects }
        : getSuggestedEffectsFor(baseThemeId);
      const base = getThemeById(baseThemeId);
      document.getElementById('editorName').value = base ? `My ${base.name}` : 'My Custom Theme';
    }

    document.getElementById('galleryView').hidden = true;
    document.getElementById('editorView').hidden = false;

    // Show the free preview banner only when not premium
    const freeBanner = document.getElementById('editorFreeBanner');
    if (freeBanner) freeBanner.hidden = isPremium();

    // Always start on the Colors sub-tab
    switchEditorSubtab('colors');

    populateEditorFields();
    renderAdvancedPanel();
    updatePreview();
  }

  function closeEditor() {
    editorState.active = false;
    document.getElementById('galleryView').hidden = false;
    document.getElementById('editorView').hidden = true;
  }

  // ─── Populate Fields ──────────────────────────────────────────────────────

  function populateEditorFields() {
    const full = getFullEditorTheme();

    // Color scheme dropdown
    document.getElementById('editorColorScheme').value = full.colorScheme || 'light';

    // All color fields
    document.querySelectorAll('#editorView .editor-group .editor-field[data-key]').forEach(field => {
      const key = field.dataset.key;
      if (key === 'colorScheme') return;
      const val = full[key] || '#000000';
      const swatch = field.querySelector('.color-swatch-input');
      const hex = field.querySelector('.color-hex-input');
      if (swatch && hex) {
        // color input only accepts #rrggbb
        const parsed = _pc(val);
        const hexVal = parsed ? _hex(parsed.r, parsed.g, parsed.b) : val;
        swatch.value = hexVal;
        hex.value = hexVal;
      }
    });
  }

  // ─── Render Advanced Panel ────────────────────────────────────────────────

  function renderAdvancedPanel() {
    const body = document.getElementById('advancedBody');
    body.innerHTML = '';
    const full = getFullEditorTheme();

    for (const [groupName, keys] of Object.entries(ADVANCED_GROUPS)) {
      const group = document.createElement('div');
      group.className = 'editor-group';
      group.innerHTML = `<h3 class="editor-group-title">${groupName}</h3>`;

      for (const key of keys) {
        const val = full[key];
        if (val === undefined) continue;
        const isOverridden = editorState.advancedOverrides[key] !== undefined;
        const parsed = _pc(typeof val === 'string' ? val : '');
        const isColorVal = parsed !== null;

        const field = document.createElement('div');
        field.className = `editor-field${isOverridden ? ' is-overridden' : ''}`;
        field.dataset.key = key;
        field.dataset.advanced = 'true';

        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

        if (isColorVal) {
          const hexVal = _hex(parsed.r, parsed.g, parsed.b);
          field.innerHTML = `
            <label>${label}</label>
            <div class="color-input-wrap">
              <input type="color" class="color-swatch-input" value="${hexVal}" />
              <input type="text" class="color-hex-input" value="${hexVal}" spellcheck="false" />
              <span class="advanced-auto-badge">auto</span>
              <button class="advanced-clear-btn" title="Reset to derived">&times;</button>
            </div>
          `;
        } else {
          field.innerHTML = `
            <label>${label}</label>
            <div class="color-input-wrap">
              <input type="text" class="color-hex-input" value="${val}" spellcheck="false" style="width:140px" />
              <span class="advanced-auto-badge">auto</span>
              <button class="advanced-clear-btn" title="Reset to derived">&times;</button>
            </div>
          `;
        }

        group.appendChild(field);
      }

      body.appendChild(group);
    }

    // Bind advanced field events
    bindAdvancedEvents();
  }

  // ─── Preview Update ───────────────────────────────────────────────────────

  function updatePreview() {
    const full = getFullEditorTheme();
    const frame = document.getElementById('editorPreview');

    // Background for the whole preview
    frame.style.backgroundColor = full.background;

    // data-bind="key" → set background-color
    frame.querySelectorAll('[data-bind]').forEach(el => {
      const key = el.dataset.bind;
      if (full[key]) el.style.backgroundColor = full[key];
    });

    // data-bind-color="key" → set color
    frame.querySelectorAll('[data-bind-color]').forEach(el => {
      const key = el.dataset.bindColor;
      if (full[key]) el.style.color = full[key];
    });

    // data-bind-border-color="key" → set border-color
    frame.querySelectorAll('[data-bind-border-color]').forEach(el => {
      const key = el.dataset.bindBorderColor;
      if (full[key]) el.style.borderColor = full[key];
    });

    // data-bind-border="key" → set border-bottom-color
    frame.querySelectorAll('[data-bind-border]').forEach(el => {
      const key = el.dataset.bindBorder;
      if (full[key]) el.style.borderBottomColor = full[key];
    });
  }

  // ─── Event Binding ────────────────────────────────────────────────────────

  function bindEditorEvents() {
    // Back button
    document.getElementById('editorBackBtn').addEventListener('click', closeEditor);

    // Color scheme dropdown
    document.getElementById('editorColorScheme').addEventListener('change', (e) => {
      editorState.coreOverrides.colorScheme = e.target.value;
      onEditorChange();
    });

    // Core color fields
    document.querySelectorAll('#editorView .editor-group:not(.editor-advanced-body .editor-group) .editor-field[data-key]').forEach(field => {
      const key = field.dataset.key;
      if (key === 'colorScheme') return;

      const swatch = field.querySelector('.color-swatch-input');
      const hex = field.querySelector('.color-hex-input');

      if (swatch) {
        swatch.addEventListener('input', () => {
          hex.value = swatch.value;
          editorState.coreOverrides[key] = swatch.value;
          onEditorChange();
        });
      }

      if (hex) {
        hex.addEventListener('change', () => {
          let val = hex.value.trim();
          if (val && val[0] !== '#') val = '#' + val;
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            if (swatch) swatch.value = val;
            editorState.coreOverrides[key] = val;
            onEditorChange();
          }
        });
      }
    });

    // Save button
    document.getElementById('editorSaveBtn').addEventListener('click', saveCustomTheme);

    // Reset button
    document.getElementById('editorResetBtn').addEventListener('click', () => {
      editorState.coreOverrides = {};
      editorState.advancedOverrides = {};
      populateEditorFields();
      renderAdvancedPanel();
      updatePreview();
    });

    // Export button
    document.getElementById('editorExportBtn').addEventListener('click', exportThemeJSON);

    // Import button
    document.getElementById('editorImportBtn').addEventListener('click', () => {
      document.getElementById('editorImportFile').click();
    });
    document.getElementById('editorImportFile').addEventListener('change', importThemeJSON);

    // Create theme button
    document.getElementById('createThemeBtn').addEventListener('click', () => {
      openEditor('connectry', null);
    });

    // Editor sub-tabs (Colors / Effects)
    document.querySelectorAll('.editor-subtab[data-editor-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.editorSubtab;
        switchEditorSubtab(target);
      });
    });

    // Free preview banner upgrade CTA
    document.getElementById('editorFreeBannerUpgrade')?.addEventListener('click', () => {
      closeEditor();
      if (_tabsInstance) _tabsInstance.activate('upgrade');
    });
  }

  /**
   * Switch the editor's left panel between Colors and Effects. The right
   * preview pane stays put — both sub-tabs preview against the same theme.
   */
  function switchEditorSubtab(target) {
    const colorsPanel = document.querySelector('.editor-colors');
    const effectsPanel = document.getElementById('editorEffectsPanel');
    if (!colorsPanel || !effectsPanel) return;

    const isEffects = target === 'effects';
    colorsPanel.hidden = isEffects;
    effectsPanel.hidden = !isEffects;

    document.querySelectorAll('.editor-subtab[data-editor-subtab]').forEach(b => {
      const active = b.dataset.editorSubtab === target;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });

    if (isEffects) {
      renderEditorEffectsGrid();
    }
  }

  /**
   * Render the per-effect grid inside the Theme Builder. Reads from
   * editorState.effects (the cloned theme's effects being edited) and
   * writes back to it. Free users can interact freely; the gate fires
   * on Save, not on individual edits.
   */
  function renderEditorEffectsGrid() {
    const grid = document.getElementById('editorEffectsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const config = editorState.effects || { ...NONE_EFFECTS };

    for (const effect of EFFECT_CATALOG) {
      const isOn = !!config[effect.id];
      const intensity = config[effect.id + 'Intensity'] || 'medium';

      const card = document.createElement('div');
      card.className = `effect-card${isOn ? ' is-enabled' : ''}`;
      card.dataset.effect = effect.id;

      const particleType = typeof config.particles === 'string' ? config.particles : 'snow';
      const particleSelectRow = effect.id === 'particles' ? `
        <div class="effect-slider-row">
          <span class="effect-select-label">Style</span>
          <select class="effect-select" data-effect-select="particles">
            <option value="snow" ${particleType === 'snow' ? 'selected' : ''}>Snow</option>
            <option value="dots" ${particleType === 'dots' ? 'selected' : ''}>Floating Dots</option>
            <option value="matrix" ${particleType === 'matrix' ? 'selected' : ''}>Matrix Rain</option>
            <option value="embers" ${particleType === 'embers' ? 'selected' : ''}>Embers</option>
            <option value="rain" ${particleType === 'rain' ? 'selected' : ''}>Rain</option>
          </select>
        </div>
      ` : '';

      const intensityButtons = ['subtle', 'medium', 'strong'].map(level => `
        <button type="button"
                class="intensity-btn${intensity === level ? ' is-active' : ''}"
                data-effect-intensity="${effect.id}"
                data-level="${level}">${_capitalize(level)}</button>
      `).join('');

      card.innerHTML = `
        <div class="effect-card-header">
          <div class="effect-info">
            <div class="effect-name">
              ${effect.name}
              <span class="effect-card-status">${isOn ? 'On' : 'Off'}</span>
            </div>
            <div class="effect-short">${effect.short}</div>
          </div>
          <label class="cx-toggle">
            <input type="checkbox" data-effect-toggle="${effect.id}" ${isOn ? 'checked' : ''} />
            <span class="cx-toggle-track"><span class="cx-toggle-thumb"></span></span>
          </label>
        </div>
        <div class="effect-controls">
          <div class="effect-slider-row">
            <span class="effect-slider-label">Intensity</span>
            <div class="intensity-segmented" role="group" aria-label="Effect intensity for ${effect.name}">
              ${intensityButtons}
            </div>
          </div>
          ${particleSelectRow}
        </div>
      `;

      // Toggle wiring
      const toggle = card.querySelector(`[data-effect-toggle="${effect.id}"]`);
      toggle?.addEventListener('change', () => {
        if (effect.id === 'particles') {
          editorState.effects.particles = toggle.checked ? (particleType || 'snow') : false;
        } else {
          editorState.effects[effect.id] = toggle.checked;
        }
        renderEditorEffectsGrid();
      });

      // Intensity buttons
      card.querySelectorAll(`[data-effect-intensity="${effect.id}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          editorState.effects[effect.id + 'Intensity'] = btn.dataset.level;
          renderEditorEffectsGrid();
        });
      });

      // Particle style select
      const pSelect = card.querySelector('[data-effect-select="particles"]');
      pSelect?.addEventListener('change', () => {
        if (editorState.effects.particles) {
          editorState.effects.particles = pSelect.value;
        }
      });

      grid.appendChild(card);
    }
  }

  function bindAdvancedEvents() {
    document.querySelectorAll('#advancedBody .editor-field').forEach(field => {
      const key = field.dataset.key;

      const swatch = field.querySelector('.color-swatch-input');
      const hex = field.querySelector('.color-hex-input');
      const clearBtn = field.querySelector('.advanced-clear-btn');

      if (swatch) {
        swatch.addEventListener('input', () => {
          hex.value = swatch.value;
          editorState.advancedOverrides[key] = swatch.value;
          field.classList.add('is-overridden');
          updatePreview();
        });
      }

      if (hex) {
        hex.addEventListener('change', () => {
          let val = hex.value.trim();
          if (val && val[0] !== '#') val = '#' + val;
          editorState.advancedOverrides[key] = val;
          if (swatch && /^#[0-9a-fA-F]{6}$/.test(val)) swatch.value = val;
          field.classList.add('is-overridden');
          updatePreview();
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          delete editorState.advancedOverrides[key];
          field.classList.remove('is-overridden');
          // Recalculate derived value
          const full = getFullEditorTheme();
          const val = full[key] || '';
          const parsed = _pc(val);
          if (hex) hex.value = parsed ? _hex(parsed.r, parsed.g, parsed.b) : val;
          if (swatch && parsed) swatch.value = _hex(parsed.r, parsed.g, parsed.b);
          updatePreview();
        });
      }
    });
  }

  function onEditorChange() {
    // Reset advanced overrides that are now stale
    // (user changed a core value — derived values should recalculate)
    populateEditorFields();
    renderAdvancedPanel();
    updatePreview();
  }

  // ─── Save / Export / Import ───────────────────────────────────────────────

  async function saveCustomTheme() {
    // V3: builder is open to all but Save is the Premium gate.
    // Show the upgrade dialog and bail without losing any in-progress edits.
    if (!isPremium()) {
      _showSaveUpgradePrompt();
      return;
    }

    const name = document.getElementById('editorName').value.trim() || 'My Custom Theme';
    const id = editorState.customId || `custom-${Date.now()}`;
    const base = getThemeById(editorState.basedOn);

    // Load existing custom themes first so we can preserve existing effects on update
    const { customThemes = [] } = await chrome.storage.sync.get('customThemes');
    const existing = customThemes.find(t => t.id === id);

    // Determine the effects snapshot for this custom theme
    //   - Update: preserve existing effects (edit flow shouldn't wipe them)
    //   - New from creation dialog: use the staged _pendingCreateEffects
    //   - New without dialog (edge case): use base theme's suggested effects
    let effects;
    if (existing && existing.effects) {
      effects = existing.effects;
    } else if (_pendingCreateEffects) {
      effects = _pendingCreateEffects;
      _pendingCreateEffects = null;
    } else {
      effects = getSuggestedEffectsFor(editorState.basedOn);
    }

    const custom = {
      id,
      name,
      basedOn: editorState.basedOn,
      category: (editorState.coreOverrides.colorScheme || base?.colors?.colorScheme) || 'light',
      author: 'User',
      createdVia: 'manual',
      coreOverrides: { ...editorState.coreOverrides },
      advancedOverrides: { ...editorState.advancedOverrides },
      effects,
    };

    const idx = customThemes.findIndex(t => t.id === id);
    if (idx >= 0) customThemes[idx] = custom;
    else customThemes.push(custom);

    await chrome.storage.sync.set({ customThemes });
    syncState.customThemes = customThemes;
    editorState.customId = id;

    // Apply the theme
    await selectTheme(id);

    // Visual feedback
    const btn = document.getElementById('editorSaveBtn');
    if (btn) {
      btn.textContent = 'Saved!';
      setTimeout(() => { btn.textContent = 'Save Theme'; }, 1500);
    }
  }

  function exportThemeJSON() {
    const full = getFullEditorTheme();
    const name = document.getElementById('editorName').value.trim() || 'custom-theme';
    const data = {
      name,
      basedOn: editorState.basedOn,
      category: full.colorScheme || 'light',
      coreOverrides: editorState.coreOverrides,
      advancedOverrides: editorState.advancedOverrides,
      fullColors: full,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importThemeJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.coreOverrides) {
          editorState.coreOverrides = data.coreOverrides;
          editorState.advancedOverrides = data.advancedOverrides || {};
          document.getElementById('editorName').value = data.name || 'Imported Theme';
          if (data.basedOn && getThemeById(data.basedOn)) {
            editorState.basedOn = data.basedOn;
          }
          populateEditorFields();
          renderAdvancedPanel();
          updatePreview();
        } else if (data.fullColors) {
          // Full theme import — extract core, rest goes to advanced
          editorState.coreOverrides = {};
          editorState.advancedOverrides = {};
          for (const [k, v] of Object.entries(data.fullColors)) {
            if (CORE_KEYS.includes(k)) editorState.coreOverrides[k] = v;
            else editorState.advancedOverrides[k] = v;
          }
          document.getElementById('editorName').value = data.name || 'Imported Theme';
          populateEditorFields();
          renderAdvancedPanel();
          updatePreview();
        }
      } catch (err) {
        console.error('[Themer] Import error:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Theme customize buttons are built directly into the theme card markup
  // now (Clone for OOTB, Edit for custom themes) — no post-render pass needed.

  // ═══════════════════════════════════════════════════════════════════════════
  // Effects Tab
  // ═══════════════════════════════════════════════════════════════════════════

  const INTENSITY_TO_VAL = { subtle: 1, medium: 2, strong: 3 };
  const VAL_TO_INTENSITY = { 1: 'subtle', 2: 'medium', 3: 'strong' };

  const PRESET_CATALOG = [
    { id: 'none', name: 'None', tagline: 'No animations', body: 'Clean and focused. Recommended for accessibility needs, low-power devices, or distraction-free work.', icon: '○' },
    { id: 'subtle', name: 'Subtle', tagline: 'Gentle hover lift on cards', body: 'Cards and buttons lift slightly on hover. Nothing else. Perfect for everyday use — adds polish without distraction.', icon: '◐' },
    { id: 'alive', name: 'Alive', tagline: 'Hover lift, ambient glow, border shimmer', body: 'Adds pulsing glow on active elements and a shimmer line across card tops. Best for dashboards and visual interest.', icon: '◉' },
    { id: 'immersive', name: 'Immersive', tagline: 'Full effects pack + cursor trail', body: 'The works: hover lift, glow, shimmer, rotating gradient borders, and a light cursor trail. Best for demos, dark themes, and dramatic moments.', icon: '✦' },
  ];

  const EFFECT_CATALOG = [
    { id: 'hoverLift',       name: 'Hover Lift',        short: 'Cards lift on hover',             long: 'Cards, buttons, and list items gently float up when you hover. Modals and dropdowns are never affected.' },
    { id: 'ambientGlow',     name: 'Ambient Glow',      short: 'Pulsing glow on accent elements', long: 'Brand buttons, active nav items, and focused inputs gain a slow pulsing glow in your theme accent color.' },
    { id: 'borderShimmer',   name: 'Border Shimmer',    short: 'Animated light sweep on cards',   long: 'A thin line of light sweeps across the top of each card, giving a subtle animated edge.' },
    { id: 'gradientBorders', name: 'Gradient Borders',  short: 'Rotating gradient card edges',    long: 'Card borders become animated conic gradients that slowly rotate around the edge.' },
    { id: 'aurora',          name: 'Aurora Background', short: 'Slow-moving ambient background',  long: 'A soft, slow-moving gradient glow sits behind all content. Colors derive from your theme accent.' },
    { id: 'neonFlicker',     name: 'Neon Flicker',      short: 'Glowing text with flicker',       long: 'Page titles and active navigation gain a neon text glow with occasional flicker, like a sign.' },
    { id: 'particles',       name: 'Particles',         short: 'Snow, rain, matrix, dots, embers', long: 'Animated background particles. Pick from snow, rain, matrix rain, floating dots, or rising embers.' },
    { id: 'cursorTrail',     name: 'Cursor Trail',      short: 'Light trail follows your mouse',  long: 'A short glowing trail follows your mouse pointer, fading as it goes.' },
  ];

  const NONE_EFFECTS = {
    preset: 'none',
    hoverLift: false, hoverLiftIntensity: 'medium',
    ambientGlow: false, ambientGlowIntensity: 'medium',
    borderShimmer: false, borderShimmerIntensity: 'medium',
    gradientBorders: false, gradientBordersIntensity: 'medium',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: false, cursorTrailIntensity: 'medium',
  };

  const PRESET_CONFIGS = {
    none: { ...NONE_EFFECTS, preset: 'none' },
    subtle: { ...NONE_EFFECTS, preset: 'subtle', hoverLift: true, hoverLiftIntensity: 'subtle' },
    alive: {
      ...NONE_EFFECTS, preset: 'alive',
      hoverLift: true, hoverLiftIntensity: 'medium',
      ambientGlow: true, ambientGlowIntensity: 'medium',
      borderShimmer: true, borderShimmerIntensity: 'medium',
    },
    immersive: {
      ...NONE_EFFECTS, preset: 'immersive',
      hoverLift: true, hoverLiftIntensity: 'strong',
      ambientGlow: true, ambientGlowIntensity: 'strong',
      borderShimmer: true, borderShimmerIntensity: 'medium',
      gradientBorders: true, gradientBordersIntensity: 'strong',
      cursorTrail: true, cursorTrailIntensity: 'medium',
    },
  };

  // Effects tab state
  let effectsEditingMode = 'global';    // 'global' | 'custom'
  let effectsEditingCustomId = null;
  let previewCanvases = new Map();      // effectId -> { canvas, raf, cleanup? }

  /**
   * V3 model: effects belong to themes.
   *   - OOTB themes: shipped effects scaled by user's Volume knob (READ-ONLY in this tab)
   *   - Custom themes: snapshot in customTheme.effects (still editable here for now;
   *                    will move to the Theme Builder Effects sub-tab in Commit B)
   */
  function resolveEffectsEditingTarget() {
    const activeId = syncState.theme;
    const customs = syncState.customThemes || [];
    const custom = customs.find(t => t.id === activeId);
    if (custom) {
      effectsEditingMode = 'custom';
      effectsEditingCustomId = custom.id;
      return { config: custom.effects || { ...NONE_EFFECTS }, mode: 'custom', theme: custom };
    }
    effectsEditingMode = 'ootb';
    effectsEditingCustomId = null;
    // Resolve the OOTB theme's shipped effects, then scale by current Volume.
    // This is what the user actually sees on the Salesforce tab right now.
    const shipped = (typeof getThemeEffects === 'function')
      ? getThemeEffects(activeId)
      : { ...NONE_EFFECTS };
    const volume = syncState.effectsVolume || 'default';
    const scaled = (typeof applyVolume === 'function')
      ? applyVolume(shipped, volume)
      : shipped;
    return { config: scaled, mode: 'ootb', theme: null };
  }

  function updateEffectsContextBanner() {
    const banner = document.getElementById('effectsContextBanner');
    const text = document.getElementById('effectsContextText');
    const actions = document.getElementById('effectsContextActions');
    if (!banner || !text) return;

    const { mode, theme } = resolveEffectsEditingTarget();
    const activeThemeObj = getThemeById(syncState.theme);
    const themeName = activeThemeObj?.name || syncState.theme;
    const volume = syncState.effectsVolume || 'default';

    if (mode === 'custom' && theme) {
      // Custom themes still editable here for now (Commit B will move this
      // into the Theme Builder)
      banner.className = 'cx-banner cx-banner-info';
      text.innerHTML = `Editing effects for <strong>${Connectry.Settings.escape(theme.name)}</strong>. These effects are saved with this theme only.`;
      actions.innerHTML = `<button class="cx-btn cx-btn-sm cx-btn-ghost" id="effectsResetBtn">Reset ▾</button>`;
      document.getElementById('effectsResetBtn')?.addEventListener('click', openEffectsResetMenu);
      return;
    }

    // OOTB theme — read-only V3 view
    banner.className = 'cx-banner cx-banner-info';
    text.innerHTML = `
      <strong>${Connectry.Settings.escape(themeName)}</strong> ships with these effects, currently at
      <strong>${_capitalize(volume)}</strong> volume. To change the volume, use the Effects row in the
      Theme Application card on the Themes tab. To customize <em>which</em> effects this theme has,
      clone it in the Theme Builder.
    `;
    actions.innerHTML = `<button class="cx-btn cx-btn-sm cx-btn-primary" id="effectsCloneCta">Clone & customize</button>`;
    document.getElementById('effectsCloneCta')?.addEventListener('click', () => {
      // Switch to the Builder tab — user will pick a starting point there
      if (_tabsInstance) _tabsInstance.activate('builder');
    });
  }

  /**
   * Save-time upgrade prompt for free users in the Theme Builder. The
   * builder is open to everyone so users can preview the full editor; the
   * Save button is the Premium gate. Shows a focused dialog that explains
   * what they're about to unlock and lets them either upgrade or stay in
   * preview mode (their work is preserved).
   */
  function _showSaveUpgradePrompt() {
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:12px;">Saving custom themes is a <strong>Premium</strong> feature.</p>
      <p style="margin-bottom:16px; font-size:13px; color: var(--cx-text-muted); line-height:1.6;">
        Your changes are still here in the editor — feel free to keep tweaking. When you're ready,
        upgrade to save this theme to your library, switch to it from any popup, and unlock all
        the per-effect personalization options.
      </p>
      <p style="font-size:12px; color: var(--cx-text-subtle); margin-bottom:0;">
        Premium starts at <strong>$5/month</strong>. Yearly is $45 (save 25%) and Lifetime is
        $200 while the Early Supporter window is open.
      </p>
    `;

    const dialog = new Connectry.Settings.Dialog({
      title: 'Upgrade to save your themes',
      body,
      actions: [
        { label: 'Keep editing', variant: 'secondary' },
        {
          label: 'See plans',
          variant: 'primary',
          onClick: () => {
            // Close the editor and jump to the Upgrade tab
            closeEditor();
            if (_tabsInstance) _tabsInstance.activate('upgrade');
          },
        },
      ],
    });
    dialog.open();
  }

  /**
   * Switch to the Upgrade tab. Replaces the old modal dialog — a full-tab
   * experience is a better sales pitch than a popup.
   */
  function openUpgradeDialog() {
    if (_tabsInstance) {
      _tabsInstance.activate('upgrade');
      // Scroll main content to top so the hero is visible
      const main = document.querySelector('.cx-main');
      if (main) main.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Bind the "Choose X" buttons on the Upgrade tab. Stub for now — when
   * Stripe is wired up this will kick off a checkout session.
   * TODO: when auth ships, POST to the backend to create a Stripe Checkout
   * session and redirect to the returned URL.
   */
  function bindUpgradePlanCtas() {
    document.querySelectorAll('.upgrade-plan-cta[data-plan], .upgrade-footer-cta-actions [data-plan]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = btn.dataset.plan;
        _showCheckoutPlaceholder(plan);
      });
    });
  }

  /**
   * Wire up the hidden dev panel in the About tab. Click the version label
   * 7 times to reveal it. The premium override toggle persists in
   * chrome.storage.local.premiumOverride and unlocks all Premium UI gates
   * without a real subscription. Reload the page after toggling.
   */
  function bindDevPanel() {
    const versionEl = document.getElementById('aboutVersion') || document.getElementById('versionLabel');
    const panel = document.getElementById('devPanel');
    const toggle = document.getElementById('devPremiumToggle');
    if (!panel || !toggle) return;

    // Reflect current override state
    toggle.checked = !!_localPremiumOverride;

    // Easter-egg unlock: click version 7 times within 4 seconds
    let clickCount = 0;
    let resetTimer = null;
    const unlock = () => {
      clickCount++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { clickCount = 0; }, 4000);
      if (clickCount >= 7) {
        panel.hidden = false;
        clickCount = 0;
        // Scroll the dev panel into view
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    versionEl?.addEventListener('click', unlock);
    versionEl?.style.setProperty('cursor', 'default');

    // If override is already set, reveal the panel automatically (so the
    // user can see what's enabled and turn it off without re-doing the gesture)
    if (_localPremiumOverride) {
      panel.hidden = false;
    }

    // Toggle handler
    toggle.addEventListener('change', async () => {
      const enabled = toggle.checked;
      await chrome.storage.local.set({ premiumOverride: enabled });
      _localPremiumOverride = enabled;
      // Re-render anything that depends on premium state
      syncPremiumBodyClass();
      renderEffectsTabForActiveTheme();
      updateHeaderMeta(syncState.theme);
      // Re-render theme grid so clone button gates update too
      renderThemeGrid(syncState.theme);
    });
  }

  function _showCheckoutPlaceholder(plan) {
    const planLabels = {
      monthly: { name: 'Monthly', price: '$5/month' },
      yearly:  { name: 'Yearly',  price: '$45/year' },
      lifetime:{ name: 'Lifetime',price: '$200 one-time' },
    };
    const info = planLabels[plan] || { name: 'Premium', price: '' };

    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:12px;">You selected the <strong>${info.name}</strong> plan (${info.price}).</p>
      <p style="margin-bottom:16px; font-size:13px; color: var(--cx-text-muted); line-height:1.6;">
        Checkout isn't wired up yet — Stripe integration is on the roadmap and will arrive alongside the Connectry account system. For now, this button is a placeholder so we can validate the UI and pricing.
      </p>
      <p style="font-size:12px; color: var(--cx-text-subtle); margin-bottom:0;">
        Dev tip: set <code style="background:var(--cx-surface-alt); padding:2px 6px; border-radius:4px;">premiumOverride: true</code> in <code style="background:var(--cx-surface-alt); padding:2px 6px; border-radius:4px;">chrome.storage.local</code> to unlock Premium features for testing.
      </p>
    `;

    const dialog = new Connectry.Settings.Dialog({
      title: `Checkout — ${info.name}`,
      body,
      actions: [
        { label: 'Close', variant: 'secondary' },
      ],
    });
    dialog.open();
  }

  function openEffectsResetMenu() {
    if (effectsEditingMode !== 'custom') return;
    const custom = (syncState.customThemes || []).find(t => t.id === effectsEditingCustomId);
    if (!custom) return;

    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:16px;">Reset the effects for this custom theme to:</p>
      <label class="cx-option-card">
        <input type="radio" name="reset-mode" value="suggested" checked />
        <div class="cx-option-card-title">Effects shipped with ${Connectry.Settings.escape(getThemeById(custom.basedOn)?.name || custom.basedOn)}</div>
        <div class="cx-option-card-desc">Restore the base theme's curated effects.</div>
      </label>
      <label class="cx-option-card">
        <input type="radio" name="reset-mode" value="none" />
        <div class="cx-option-card-title">Clear all effects</div>
        <div class="cx-option-card-desc">Turn every effect off for this theme.</div>
      </label>
    `;

    const dialog = new Connectry.Settings.Dialog({
      title: 'Reset effects',
      body,
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Reset',
          variant: 'primary',
          onClick: async () => {
            const mode = body.querySelector('input[name="reset-mode"]:checked')?.value || 'suggested';
            let newEffects;
            if (mode === 'none') newEffects = { ...NONE_EFFECTS };
            else newEffects = getSuggestedEffectsFor(custom.basedOn);

            const customs = [...(syncState.customThemes || [])];
            const idx = customs.findIndex(t => t.id === custom.id);
            if (idx >= 0) {
              customs[idx] = { ...customs[idx], effects: newEffects };
              await chrome.storage.sync.set({ customThemes: customs });
              syncState.customThemes = customs;
              renderEffectsTabForActiveTheme();
              renderCustomThemeGrid(syncState.theme);
            }
          },
        },
      ],
    });
    dialog.open();
  }

  function renderEffectsTabForActiveTheme() {
    const { config, mode } = resolveEffectsEditingTarget();
    updateEffectsContextBanner();
    // Hide the preset grid section entirely on OOTB themes — the volume knob
    // in the Theme Application card replaces it. Custom themes still see the
    // 4-preset selector for quick "apply this preset to my theme" actions.
    const presetSection = document.getElementById('presetGrid')?.closest('.cx-section');
    if (presetSection) presetSection.hidden = (mode === 'ootb');
    if (mode !== 'ootb') {
      renderPresetGrid(config);
    }
    renderEffectsGrid(config, mode === 'ootb');
  }

  function renderPresetGrid(config) {
    const grid = document.getElementById('presetGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const activePreset = config.preset || 'none';
    for (const p of PRESET_CATALOG) {
      const card = document.createElement('button');
      card.className = `preset-card${activePreset === p.id ? ' is-active' : ''}`;
      card.dataset.preset = p.id;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(activePreset === p.id));
      card.innerHTML = `
        <div class="preset-card-icon">${p.icon}</div>
        <div class="preset-card-name">${p.name}</div>
        <div class="preset-card-tagline">${p.tagline}</div>
        <div class="preset-card-body">${p.body}</div>
      `;
      card.addEventListener('click', () => selectPreset(p.id));
      grid.appendChild(card);
    }
  }

  async function selectPreset(presetId) {
    const base = PRESET_CONFIGS[presetId] || PRESET_CONFIGS.none;
    await saveEffectsConfig({ ...base });
  }

  async function saveEffectsConfig(newConfig) {
    // V3: only custom themes have an editable effects snapshot. The OOTB
    // path is read-only — saveEffectsConfig should never be called in that
    // mode. Guard with a no-op so any stale callers fail safely.
    if (effectsEditingMode !== 'custom' || !effectsEditingCustomId) return;

    const customs = [...(syncState.customThemes || [])];
    const idx = customs.findIndex(t => t.id === effectsEditingCustomId);
    if (idx >= 0) {
      customs[idx] = { ...customs[idx], effects: newConfig };
      await chrome.storage.sync.set({ customThemes: customs });
      syncState.customThemes = customs;
    }
    renderEffectsTabForActiveTheme();
  }

  function renderEffectsGrid(config, readOnly = false) {
    const grid = document.getElementById('effectsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    stopEffectPreviews();

    // Read-only mode (V3 default for OOTB themes): cards are display-only.
    // Custom themes still have the existing edit path until Commit B moves
    // it into the Theme Builder.
    const locked = readOnly || !isPremium();

    for (const effect of EFFECT_CATALOG) {
      const isOn = !!config[effect.id];
      const intensity = config[effect.id + 'Intensity'] || 'medium';

      const card = document.createElement('div');
      card.className = `effect-card${isOn ? ' is-enabled' : ''}${locked ? ' is-locked' : ''}${readOnly ? ' is-readonly' : ''}`;
      card.dataset.effect = effect.id;

      const particleType = typeof config.particles === 'string' ? config.particles : 'snow';
      const particleSelectRow = effect.id === 'particles' ? `
        <div class="effect-slider-row">
          <span class="effect-select-label">Style</span>
          <select class="effect-select" data-effect-select="particles" ${locked ? 'disabled' : ''}>
            <option value="snow" ${particleType === 'snow' ? 'selected' : ''}>Snow</option>
            <option value="dots" ${particleType === 'dots' ? 'selected' : ''}>Floating Dots</option>
            <option value="matrix" ${particleType === 'matrix' ? 'selected' : ''}>Matrix Rain</option>
            <option value="embers" ${particleType === 'embers' ? 'selected' : ''}>Embers</option>
            <option value="rain" ${particleType === 'rain' ? 'selected' : ''}>Rain</option>
          </select>
        </div>
      ` : '';

      const intensityButtons = ['subtle', 'medium', 'strong'].map(level => `
        <button type="button"
                class="intensity-btn${intensity === level ? ' is-active' : ''}"
                data-effect-intensity="${effect.id}"
                data-level="${level}"
                ${locked ? 'disabled' : ''}>${_capitalize(level)}</button>
      `).join('');

      // Read-only mode (V3 OOTB) shows no lock badge — the cards are
      // documentation, not gated. Premium gating still uses the gold badge.
      const lockBadge = (locked && !readOnly) ? `
        <div class="effect-lock-badge" title="Upgrade to Premium to control this effect individually">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="2.5" y="5.5" width="7" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/>
            <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          Premium
        </div>
      ` : '';

      card.innerHTML = `
        <div class="effect-preview" data-effect="${effect.id}">
          <div class="effect-preview-card">${_previewLabel(effect.id)}</div>
        </div>
        <div class="effect-card-header">
          <div class="effect-info">
            <div class="effect-name">
              ${effect.name}
              <span class="effect-card-status">${isOn ? 'On' : 'Off'}</span>
            </div>
            <div class="effect-short">${effect.short}</div>
            <div class="effect-long">${effect.long}</div>
          </div>
          ${locked ? lockBadge : `
            <label class="cx-toggle">
              <input type="checkbox" data-effect-toggle="${effect.id}" ${isOn ? 'checked' : ''} />
              <span class="cx-toggle-track"><span class="cx-toggle-thumb"></span></span>
            </label>
          `}
        </div>
        <div class="effect-controls">
          <div class="effect-slider-row">
            <span class="effect-slider-label">Intensity</span>
            <div class="intensity-segmented" role="group" aria-label="Effect intensity for ${effect.name}">
              ${intensityButtons}
            </div>
          </div>
          ${particleSelectRow}
        </div>
      `;

      if (readOnly) {
        // V3 read-only mode: cards are documentation. No click handlers.
        // The Clone & Customize CTA in the banner is the entry point.
      } else if (locked) {
        // Clicking anywhere on a locked card opens the upgrade dialog
        card.addEventListener('click', (e) => {
          // Don't hijack the hover preview interaction
          if (e.target.closest('.effect-preview')) return;
          openUpgradeDialog();
        });
      } else {
        // Toggle
        const toggle = card.querySelector(`[data-effect-toggle="${effect.id}"]`);
        toggle?.addEventListener('change', async () => {
          const { config: current } = resolveEffectsEditingTarget();
          const next = { ...current, preset: 'custom' };
          if (effect.id === 'particles') {
            next.particles = toggle.checked ? (particleType || 'snow') : false;
          } else {
            next[effect.id] = toggle.checked;
          }
          await saveEffectsConfig(next);
        });

        // Intensity segmented buttons
        const intensityBtns = card.querySelectorAll(`[data-effect-intensity="${effect.id}"]`);
        intensityBtns.forEach(btn => {
          btn.addEventListener('click', async () => {
            const level = btn.dataset.level;
            const { config: current } = resolveEffectsEditingTarget();
            const next = { ...current, preset: 'custom' };
            next[effect.id + 'Intensity'] = level;
            // Optimistic UI: highlight clicked, unhighlight siblings
            intensityBtns.forEach(b => b.classList.toggle('is-active', b === btn));
            await saveEffectsConfig(next);
          });
        });

        // Particle select
        const pSelect = card.querySelector('[data-effect-select="particles"]');
        pSelect?.addEventListener('change', async () => {
          const { config: current } = resolveEffectsEditingTarget();
          const next = { ...current, preset: 'custom' };
          if (next.particles) next.particles = pSelect.value;
          await saveEffectsConfig(next);
        });
      }

      grid.appendChild(card);
      // Apply intensity + theme-accent CSS variables to the preview
      _applyPreviewVars(card.querySelector('.effect-preview'), effect.id, intensity);
    }

    startEffectPreviews();
  }

  /**
   * Set CSS custom properties on a preview element so its CSS animation
   * reflects the current intensity AND the current theme accent. Without
   * this, all previews use hardcoded blue and a fixed intensity.
   *
   * Variables set:
   *   --fx-accent       hex string of theme accent
   *   --fx-accent-rgb   "r, g, b" comma-separated for use in rgba()
   *   --fx-mult         numeric multiplier (subtle 0.5, medium 1.0, strong 1.5)
   *   --fx-speed-mult   inverse — animations get faster as intensity grows
   */
  function _applyPreviewVars(previewEl, effectId, intensity) {
    if (!previewEl) return;
    const theme = getThemeById(syncState.theme) || (syncState.customThemes || []).find(t => t.id === syncState.theme);
    const accent = theme?.colors?.accent || '#4a6fa5';
    const accentRgb = _hexToRgbCsv(accent);
    const mult = intensity === 'subtle' ? 0.5 : intensity === 'strong' ? 1.5 : 1.0;
    const speedMult = intensity === 'subtle' ? 1.6 : intensity === 'strong' ? 0.65 : 1.0;
    previewEl.style.setProperty('--fx-accent', accent);
    previewEl.style.setProperty('--fx-accent-rgb', accentRgb);
    previewEl.style.setProperty('--fx-mult', String(mult));
    previewEl.style.setProperty('--fx-speed-mult', String(speedMult));
  }

  function _hexToRgbCsv(hex) {
    if (!hex) return '74, 111, 165';
    const clean = hex.replace('#', '');
    const expand = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean;
    if (expand.length < 6) return '74, 111, 165';
    const r = parseInt(expand.slice(0, 2), 16);
    const g = parseInt(expand.slice(2, 4), 16);
    const b = parseInt(expand.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }

  function _previewLabel(effectId) {
    const labels = {
      hoverLift: 'Hover me',
      ambientGlow: 'Glow',
      borderShimmer: 'Shimmer',
      gradientBorders: 'Border',
      aurora: '',
      neonFlicker: 'NEON',
      particles: 'Particles',
      cursorTrail: 'Hover me',
    };
    return labels[effectId] || '';
  }

  // ─── Mini preview canvas runtime (particles + cursor trail) ──────────────

  function startEffectPreviews() {
    stopEffectPreviews();

    const particlesPreview = document.querySelector('.effect-preview[data-effect="particles"]');
    if (particlesPreview) {
      const canvas = document.createElement('canvas');
      canvas.className = 'fx-preview-canvas';
      canvas.width = particlesPreview.clientWidth || 240;
      canvas.height = particlesPreview.clientHeight || 96;
      particlesPreview.insertBefore(canvas, particlesPreview.firstChild);

      const { config } = resolveEffectsEditingTarget();
      const pType = typeof config.particles === 'string' ? config.particles : 'snow';
      const theme = getThemeById(syncState.theme) || (syncState.customThemes || []).find(t => t.id === syncState.theme);
      const accent = theme?.colors?.accent || '#4a6fa5';

      previewCanvases.set('particles', _spawnMiniParticles(canvas, pType, accent));
    }

    const trailPreview = document.querySelector('.effect-preview[data-effect="cursorTrail"]');
    if (trailPreview) {
      const canvas = document.createElement('canvas');
      canvas.className = 'fx-preview-canvas';
      canvas.width = trailPreview.clientWidth || 240;
      canvas.height = trailPreview.clientHeight || 96;
      trailPreview.insertBefore(canvas, trailPreview.firstChild);
      previewCanvases.set('cursorTrail', _spawnMiniCursorTrail(trailPreview, canvas));
    }
  }

  function stopEffectPreviews() {
    for (const runtime of previewCanvases.values()) {
      if (runtime.raf) cancelAnimationFrame(runtime.raf);
      if (runtime.canvas) runtime.canvas.remove();
      if (runtime.cleanup) runtime.cleanup();
    }
    previewCanvases.clear();
  }

  function _spawnMiniParticles(canvas, type, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const count = type === 'matrix' ? 10 : 16;
    const particles = [];

    for (let i = 0; i < count; i++) {
      if (type === 'snow') particles.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.6, vx: (Math.random() * 0.4 - 0.2), vy: (Math.random() * 0.4 + 0.25) });
      else if (type === 'rain') particles.push({ x: Math.random() * w, y: Math.random() * h, len: Math.random() * 6 + 3, vy: Math.random() * 3 + 1.5 });
      else if (type === 'matrix') particles.push({ x: Math.random() * w, y: Math.random() * h, char: String.fromCharCode(0x30A0 + Math.random() * 96), vy: Math.random() * 1 + 0.4, size: Math.random() * 3 + 7, opacity: Math.random() });
      else if (type === 'dots') particles.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1 + 0.4, vx: (Math.random() * 0.3 - 0.15), vy: (Math.random() * 0.3 - 0.15), opacity: Math.random() * 0.5 + 0.3, pulse: Math.random() * Math.PI * 2 });
      else if (type === 'embers') particles.push({ x: Math.random() * w, y: h + Math.random() * 10, r: Math.random() * 1.2 + 0.4, vx: (Math.random() - 0.5) * 0.4, vy: -(Math.random() * 0.6 + 0.2), life: Math.random(), decay: Math.random() * 0.006 + 0.003 });
    }

    const runtime = { canvas, raf: null };
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (type === 'snow') {
          p.x += p.vx; p.y += p.vy;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.globalAlpha = 0.6; ctx.fill();
          if (p.y > h) { p.y = -2; p.x = Math.random() * w; }
        } else if (type === 'rain') {
          p.y += p.vy;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len);
          ctx.strokeStyle = color; ctx.globalAlpha = 0.45; ctx.lineWidth = 0.7; ctx.stroke();
          if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
        } else if (type === 'matrix') {
          p.y += p.vy; p.opacity -= 0.005;
          ctx.font = `${p.size}px monospace`;
          ctx.fillStyle = color; ctx.globalAlpha = p.opacity;
          ctx.fillText(p.char, p.x, p.y);
          if (p.y > h || p.opacity <= 0) { p.y = -5; p.x = Math.random() * w; p.opacity = 1; p.char = String.fromCharCode(0x30A0 + Math.random() * 96); }
        } else if (type === 'dots') {
          p.pulse += 0.012;
          p.x += p.vx; p.y += p.vy;
          const pulse = 0.6 + Math.sin(p.pulse) * 0.4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.globalAlpha = p.opacity * pulse; ctx.fill();
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        } else if (type === 'embers') {
          p.x += p.vx; p.y += p.vy; p.life -= p.decay;
          if (p.life <= 0) { p.life = 1; p.y = h + 5; p.x = Math.random() * w; }
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.globalAlpha = p.life * 0.75; ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      runtime.raf = requestAnimationFrame(loop);
    };
    loop();
    return runtime;
  }

  function _spawnMiniCursorTrail(container, canvas) {
    const ctx = canvas.getContext('2d');
    const theme = getThemeById(syncState.theme) || (syncState.customThemes || []).find(t => t.id === syncState.theme);
    const color = theme?.colors?.accent || '#4a6fa5';
    const points = [];
    let active = true;

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      points.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, life: 1 });
      if (points.length > 14) points.shift();
    };
    container.addEventListener('mousemove', onMove);

    const runtime = {
      canvas,
      raf: null,
      cleanup: () => {
        active = false;
        container.removeEventListener('mousemove', onMove);
      },
    };

    const loop = () => {
      if (!active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const progress = (i + 1) / points.length;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * progress, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = progress * 0.55;
        ctx.fill();
        p.life -= 0.02;
      }
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].life <= 0) points.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      runtime.raf = requestAnimationFrame(loop);
    };
    loop();
    return runtime;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Boot
  // ═══════════════════════════════════════════════════════════════════════════

  init().catch(err => console.error('[Themer options] Init error:', err));

  // Bind editor after DOM is ready
  setTimeout(() => {
    bindEditorEvents();
    document.getElementById('createThemeBtn')?.addEventListener('click', () => {
      // V3: builder open to all — Save is the gate
      openCreationDialog('connectry');
    });
  }, 100);
})();

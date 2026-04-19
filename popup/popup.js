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
    const customIds = (syncState.customThemes || []).map(ct => ct.id);
    return [...THEMES.map(t => t.id), ...customIds];
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
    'salesforce':        [],
    'salesforce-cosmos': [],
    'salesforce-dark':   [],
    'connectry':         ['hoverLift'],
    'connectry-dark':    ['hoverLift', 'ambientGlow'],
    'slate':             ['hoverLift'],
    'tron':              ['hoverLift', 'ambientGlow', 'borderEffect', 'cursorTrail', 'neonFlicker'],
    'obsidian':          ['hoverLift', 'ambientGlow'],
    'graphite':          ['hoverLift'],
    'arctic':            ['hoverLift', 'ambientGlow', 'borderEffect', 'aurora', 'particles'],
    'sakura':            ['hoverLift', 'borderEffect'],
    'boardroom':         ['hoverLift'],
    'carbon':            ['hoverLift'],
    'nord':              ['hoverLift', 'aurora'],
    'high-contrast':     [],
    'dracula':           ['hoverLift', 'ambientGlow', 'borderEffect'],
  };

  const POPUP_EFFECT_LABELS = {
    hoverLift: 'Hover lift',
    ambientGlow: 'Glow',
    borderEffect: 'Border',
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

    // Exclude Builder templates (SF baselines) — those live in the Builder's
    // "From scratch" picker only, not in the user-facing popup.
    const visible = THEMES.filter(t => t.role !== 'template');
    const lightThemes = visible.filter(t => t.category === 'light');
    const darkThemes = visible.filter(t => t.category === 'dark');

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

        const presetFavCfg = theme.favicon
          || (self.ConnectryFavicon?.defaultForTheme(theme.id, theme.colors?.accent))
          || { shape: 'circle', color: (theme.colors && theme.colors.accent) || '#4A6FA5', icon: 'connectry' };
        const presetFavSvg = self.ConnectryFavicon ? self.ConnectryFavicon.buildSVG(presetFavCfg, 16) : '';
        btn.innerHTML = `
          <span class="theme-card-hover-actions" aria-hidden="false">
            <span class="theme-card-hover-btn" data-edit="${theme.id}" title="Edit (creates a copy)">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M8 1.5l2 2-7 7H1v-2l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="theme-card-hover-btn" data-share="${theme.id}" title="Share this theme">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M3 7v3a.75.75 0 00.75.75h4.5A.75.75 0 009 10V7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6 1.5v6M4 3.5l2-2 2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </span>
          <div class="theme-swatch">${swatchHtml}</div>
          <div class="theme-info">
            <div class="theme-name-row">
              <span class="theme-name">${theme.name}</span>
              <span class="theme-card-favicon" aria-hidden="true">${presetFavSvg}</span>
            </div>
            <div class="theme-desc-popup">${theme.description || ''}</div>
            ${buildPopupEffectPills(theme.id)}
            ${_popupTypeRow(null)}
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
        // Edit → opens Builder. For presets this clones into a new custom
        // ("My <theme name>"); for customs it loads the theme for editing.
        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) {
          e.stopPropagation();
          chrome.storage.local.set({
            openOptionsTab: 'builder',
            openBuilderClone: editBtn.dataset.edit,
          }).then(() => {
            chrome.runtime.openOptionsPage();
            window.close();
          });
          return;
        }
        // Share → show share menu
        const shareBtn = e.target.closest('[data-share]');
        if (shareBtn) {
          e.stopPropagation();
          const themeId = shareBtn.dataset.share;
          const theme = THEMES.find(t => t.id === themeId)
            || (syncState.customThemes || []).find(t => t.id === themeId);
          if (theme) _showPopupShareMenu(shareBtn, theme);
          return;
        }
        selectTheme(btn.dataset.theme);
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTheme(btn.dataset.theme); }
      });
    });
  }

  // ─── Share menu (popup version) ────────────────────────────────────────────

  function _showPopupShareMenu(anchor, theme) {
    document.querySelector('.popup-share-menu')?.remove();

    const text = `Check out the "${theme.name}" theme for Salesforce Themer by Connectry!`;
    const SHARE_BASE = 'https://connectry-io.github.io/salesforce-themer/share';
    const url = theme.isCustom
      ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}`
      : `${SHARE_BASE}/${theme.id}`;
    const fullText = `${text}\n${url}`;

    const menu = document.createElement('div');
    menu.className = 'popup-share-menu';
    menu.innerHTML = `
      <button class="popup-share-menu-item" data-popup-share="whatsapp">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 0 0-6.1 10.4L1 15l3.7-.9A7 7 0 1 0 8 1z" stroke="currentColor" stroke-width="1.2"/></svg>
        WhatsApp
      </button>
      <button class="popup-share-menu-item" data-popup-share="email">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 4.5L8 9l6.5-4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        Email
      </button>
      <button class="popup-share-menu-item" data-popup-share="copy">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.2"/></svg>
        Copy link
      </button>
    `;

    anchor.style.position = 'relative';
    anchor.appendChild(menu);

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-popup-share]');
      if (!item) return;
      const type = item.dataset.popupShare;
      if (type === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`, '_blank');
      } else if (type === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(`${theme.name} — Salesforce Themer`)}&body=${encodeURIComponent(fullText)}`;
      } else if (type === 'copy') {
        await navigator.clipboard.writeText(fullText);
        _popupToast('Link copied!');
      }
      menu.remove();
    });

    const close = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function _popupToast(msg) {
    const existing = document.querySelector('.popup-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'popup-toast';
    toast.textContent = msg;
    document.querySelector('.popup').appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // ─── Theme tab strip (Presets vs My Themes) ──────────────────────────────
  // Persists which tab is active in localStorage. Presets is the default
  // because the popup is theme-centric and most users live in the gallery.

  const POPUP_THEME_TAB_KEY = 'sft-popup-theme-tab';

  function _getActiveThemeTab() {
    try {
      const v = localStorage.getItem(POPUP_THEME_TAB_KEY);
      return v === 'custom' ? 'custom' : 'builtin';
    } catch (_) {
      return 'builtin';
    }
  }

  function _setActiveThemeTab(tab) {
    try { localStorage.setItem(POPUP_THEME_TAB_KEY, tab); } catch (_) {}
  }

  function bindThemeTabs() {
    const tabs = document.querySelectorAll('.theme-tab[data-theme-tab]');
    if (!tabs.length) return;

    // Restore last-used tab
    const initial = _getActiveThemeTab();
    activateThemeTab(initial);

    tabs.forEach(tab => {
      tab.addEventListener('click', () => activateThemeTab(tab.dataset.themeTab));
    });
  }

  function activateThemeTab(tabName) {
    document.querySelectorAll('.theme-tab[data-theme-tab]').forEach(t => {
      const active = t.dataset.themeTab === tabName;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.theme-tab-panel[data-theme-tab-panel]').forEach(p => {
      p.hidden = p.dataset.themeTabPanel !== tabName;
    });
    _setActiveThemeTab(tabName);
  }

  /**
   * Render the My Themes panel. Three states based on premium + custom count:
   *   - Free user                       → Premium upsell card
   *   - Premium user, no custom themes  → Empty state with Open Builder CTA
   *   - Premium user with custom themes → Compact grid of custom theme cards
   */
  async function renderCustomThemesPanel() {
    const panel = document.getElementById('customThemesPanel');
    if (!panel) return;

    // Detect premium (DEV override for now — real entitlement comes later)
    const { premiumOverride = false } = await chrome.storage.local.get({ premiumOverride: false });
    const isPremium = !!premiumOverride;

    // Fetch any saved custom themes
    const { customThemes = [] } = await chrome.storage.sync.get({ customThemes: [] });

    // Update the tab badge count (shows the actual saved count for premium,
    // hides entirely for free users since they can't have any yet)
    const tabCount = document.getElementById('customTabCount');
    if (tabCount) {
      if (isPremium && customThemes.length > 0) {
        tabCount.textContent = String(customThemes.length);
        tabCount.hidden = false;
      } else {
        tabCount.hidden = true;
      }
    }

    if (!isPremium) {
      panel.innerHTML = _renderUpsellHtml();
      panel.querySelector('.custom-themes-upsell-cta')?.addEventListener('click', () => {
        openOptionsOnTab('upgrade');
      });
      return;
    }

    if (!customThemes.length) {
      panel.innerHTML = `
        <div class="custom-themes-empty">
          <div class="custom-themes-empty-icon">✨</div>
          <div class="custom-themes-empty-title">No custom themes yet</div>
          <p class="custom-themes-empty-body">Clone any preset theme to start, or create one from scratch in the Theme Builder.</p>
          <button type="button" class="custom-themes-empty-cta" id="customThemesEmptyCta">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Open Theme Builder
          </button>
        </div>
      `;
      panel.querySelector('#customThemesEmptyCta')?.addEventListener('click', () => {
        openOptionsOnTab('builder');
      });
      return;
    }

    // Premium user WITH custom themes — render compact card grid
    panel.innerHTML = `<div class="themes-grid" id="customThemesGrid" role="radiogroup" aria-label="Select a custom theme"></div>`;
    const grid = panel.querySelector('#customThemesGrid');
    for (const ct of customThemes) {
      grid.appendChild(_buildCustomThemeCard(ct));
    }

    // V2.5 Migration B: reconcile with Supabase — any server-known themes not
    // yet mirrored into local customThemes (e.g. saved on another browser and
    // Google sync hasn't propagated yet) show up as lightweight "remote" cards.
    // Clicking one sets activeThemeId; content.js loader fetches the CSS on
    // demand with ETag caching.
    _appendRemoteCustomThemes(grid, customThemes).catch(() => {});

    // Re-sync the is-active state onto the freshly-rendered custom cards —
    // setActiveUI ran at init before these cards existed, so they'd open
    // without the active ring even though their theme IS the active one.
    setActiveUI(syncState.theme);
  }

  async function _appendRemoteCustomThemes(grid, localThemes) {
    if (!self.ConnectryIntel?.listUserThemes) return;
    const localIds = new Set(localThemes.map(t => t.id));
    const res = await self.ConnectryIntel.listUserThemes();
    if (!res || res.error || !Array.isArray(res.themes)) return;
    for (const t of res.themes) {
      if (localIds.has(t.slug)) continue;
      const card = _buildCustomThemeCard({
        id: t.slug,
        name: t.name || t.slug,
        category: 'light',
        coreOverrides: {},
        advancedOverrides: {},
        basedOn: 'connectry',
        _remote: true,
      });
      grid.appendChild(card);
    }
  }

  function _renderUpsellHtml() {
    return `
      <div class="custom-themes-upsell">
        <div class="custom-themes-upsell-header">
          <div class="custom-themes-upsell-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5l1.9 4.2 4.6.5-3.5 3.2 1 4.6L8 11.8 3.9 14l1-4.6L1.5 6.2l4.6-.5L8 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.25"/>
            </svg>
          </div>
          <div>
            <h3 class="custom-themes-upsell-title">Make it yours</h3>
            <p class="custom-themes-upsell-sub">Custom themes are a Premium feature.</p>
          </div>
        </div>
        <div class="custom-themes-upsell-features">
          <div class="custom-themes-upsell-feature">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Clone any preset theme &amp; tweak it</span>
          </div>
          <div class="custom-themes-upsell-feature">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Pick exact effects &amp; intensities</span>
          </div>
          <div class="custom-themes-upsell-feature">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>AI generation, brand-guide upload</span>
          </div>
        </div>
        <button type="button" class="custom-themes-upsell-cta">
          Premium
        </button>
      </div>
    `;
  }

  // ─── Typography row helper ──────────────────────────────────────────────
  const POPUP_FONT_STACKS = {
    'system-ui':      'system-ui, sans-serif',
    'neo-grotesque':  "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif",
    'humanist':       "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
    'geometric':      "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
    'classic-serif':  "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
  };
  const POPUP_FONT_LABELS = {
    'system-ui': 'System Default', 'neo-grotesque': 'Neo-Grotesque',
    'humanist': 'Humanist', 'geometric': 'Geometric', 'classic-serif': 'Classic Serif',
  };

  function _popupTypeRow(typo) {
    const key = typo?.fontFamily || 'system-ui';
    const stack = POPUP_FONT_STACKS[key] || POPUP_FONT_STACKS['system-ui'];
    const label = POPUP_FONT_LABELS[key] || 'System Default';
    const sizeLabels = { compact: 'Sm', normal: 'Md', comfortable: 'Lg', large: 'XL' };
    const sizeLabel = sizeLabels[typo?.sizePreset || 'normal'] || 'Md';
    const lh = typo?.lineHeight || 1.375;
    const ls = typo?.letterSpacing || 0;
    const lsStr = ls === 0 ? '0' : String(ls);
    return `
      <div class="theme-card-type-row">
        <span class="theme-card-type-sample" style="font-family:${stack}">Aa</span>
        <span class="theme-card-type-label">${label} · ${sizeLabel} · ${lh}/${lsStr}</span>
      </div>`;
  }

  /**
   * Build a compact theme card for a custom theme. Custom themes carry
   * coreOverrides + advancedOverrides on top of their base theme's colors,
   * so we resolve them inline here.
   */
  function _buildCustomThemeCard(ct) {
    const base = THEMES.find(t => t.id === ct.basedOn) || THEMES[0];
    const resolvedColors = {
      ...(base?.colors || {}),
      ...(ct.coreOverrides || {}),
      ...(ct.advancedOverrides || {}),
    };
    const swatchHtml = [
      resolvedColors.background,
      resolvedColors.surface,
      resolvedColors.accent,
      resolvedColors.textPrimary,
    ].map(col => `<span style="background:${col};"></span>`).join('');

    const btn = document.createElement('button');
    btn.className = 'theme-card';
    btn.dataset.theme = ct.id;
    btn.role = 'radio';
    btn.setAttribute('aria-checked', 'false');
    btn.title = `${ct.name} — ${ct.description || 'Custom theme'}`;

    const subline = ct.description
      ? ct.description
      : `Based on ${base?.name || ct.basedOn}`;

    const ctFavCfg = ct.favicon
      || (self.ConnectryFavicon?.defaultForTheme(ct.basedOn, resolvedColors.accent))
      || { shape: 'circle', color: resolvedColors.accent || '#4A6FA5', icon: 'connectry' };
    const ctFavSvg = self.ConnectryFavicon ? self.ConnectryFavicon.buildSVG(ctFavCfg, 16) : '';
    btn.innerHTML = `
      <span class="theme-card-hover-actions" aria-hidden="false">
        <span class="theme-card-hover-btn" data-edit="${ct.id}" title="Edit in Builder">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M8 1.5l2 2-7 7H1v-2l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="theme-card-hover-btn" data-share="${ct.id}" title="Share this theme">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 7v3a.75.75 0 00.75.75h4.5A.75.75 0 009 10V7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 1.5v6M4 3.5l2-2 2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </span>
      <div class="theme-swatch">${swatchHtml}</div>
      <div class="theme-info">
        <div class="theme-name-row">
          <span class="theme-name">${ct.name}</span>
          <span class="theme-card-favicon" aria-hidden="true">${ctFavSvg}</span>
        </div>
        <div class="theme-desc-popup">${subline}</div>
        <div class="theme-effects-pills is-empty">Custom effects</div>
        ${_popupTypeRow(ct.typography)}
      </div>
      <div class="theme-check" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    btn.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) {
        e.stopPropagation();
        chrome.storage.local.set({
          openOptionsTab: 'builder',
          openBuilderClone: editBtn.dataset.edit,
        }).then(() => {
          chrome.runtime.openOptionsPage();
          window.close();
        });
        return;
      }
      selectTheme(ct.id);
    });

    return btn;
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

      // Render the per-theme favicon next to each name. Carries the theme's
      // accent colour so the indicators are visually distinct (and tie back
      // to what the user sees on the theme card itself).
      const renderFav = (themeId) => {
        const t = THEMES.find(x => x.id === themeId);
        if (!t) return '';
        const cfg = t.favicon
          || (self.ConnectryFavicon?.defaultForTheme(t.id, t.colors?.accent))
          || { shape: 'circle', color: (t.colors && t.colors.accent) || '#4A6FA5', icon: 'connectry' };
        return self.ConnectryFavicon ? self.ConnectryFavicon.buildSVG(cfg, 12) : '';
      };
      const lightIconEl = document.getElementById('autoLightIcon');
      const darkIconEl = document.getElementById('autoDarkIcon');
      if (lightIconEl) lightIconEl.innerHTML = renderFav(lightTheme);
      if (darkIconEl) darkIconEl.innerHTML = renderFav(darkTheme);
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
    const customThemes = syncState.customThemes || [];
    const customIds = new Set(customThemes.map(t => t.id));
    if (theme !== 'none' && !allIds.includes(theme) && !customIds.has(theme)) return;

    const updates = { theme };
    // Update lastLightTheme / lastDarkTheme for presets AND customs so
    // autoMode doesn't snap back to an old theme on refresh. The preset
    // category sets cover built-ins; customThemes carry their own category
    // field (defaults to light when luminance detection is inconclusive).
    const customMatch = customThemes.find(t => t.id === theme);
    if (LIGHT_THEME_IDS.has(theme) || customMatch?.category === 'light') {
      updates.lastLightTheme = theme;
    }
    if (DARK_THEME_IDS.has(theme) || customMatch?.category === 'dark') {
      updates.lastDarkTheme = theme;
    }

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
      borderEffect: 'none', borderEffectIntensity: 'medium',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: false, cursorTrailIntensity: 'medium',
    },
    subtle: {
      preset: 'subtle',
      hoverLift: true, hoverLiftIntensity: 'subtle',
      ambientGlow: false, ambientGlowIntensity: 'subtle',
      borderEffect: 'none', borderEffectIntensity: 'subtle',
      aurora: false, auroraIntensity: 'subtle',
      neonFlicker: false, neonFlickerIntensity: 'subtle',
      particles: false, particlesIntensity: 'subtle',
      cursorTrail: false, cursorTrailIntensity: 'subtle',
    },
    alive: {
      preset: 'alive',
      hoverLift: true, hoverLiftIntensity: 'medium',
      ambientGlow: true, ambientGlowIntensity: 'medium',
      borderEffect: 'shimmer', borderEffectIntensity: 'medium',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: false, cursorTrailIntensity: 'medium',
    },
    immersive: {
      preset: 'immersive',
      hoverLift: true, hoverLiftIntensity: 'strong',
      ambientGlow: true, ambientGlowIntensity: 'strong',
      borderEffect: 'gradient', borderEffectIntensity: 'strong',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: true, cursorTrailIntensity: 'medium',
    },
  };

  // Inlined volume normalizer — popup runs in its own script context and
  // can't import from effects/presets.js. Mirrors _normalizeVolume there.
  function _normalizeStoredVolume(v) {
    if (v === 'default' || v === 'alive') return 'medium';
    if (v === 'immersive') return 'strong';
    if (v === 'none') return 'off';
    if (v === 'off' || v === 'subtle' || v === 'medium' || v === 'strong') return v;
    return 'medium';
  }

  function bindEffectsSelector() {
    // The 4 buttons are the Volume knob: 'off' | 'subtle' | 'medium' | 'strong'.
    // They set every enabled effect on the active theme to that intensity
    // (or disable all for 'off'). Everything scales together for cohesion.
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
      // Land on the Guide tab (data-tab="effects" internally).
      openOptionsOnTab('effects');
    });
  }

  // ─── Diagnostic button ────────────────────────────────────────────────────

  function bindDiagnosticButton() {
    document.getElementById('diagnosticBtn')?.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleDiagnostic' });
        }
      } catch (_) {}
      window.close();
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

    // Effects tooltip → open Guide tab, scrolled to effects section
    document.getElementById('effectsTooltipLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.storage.local.set({
        openOptionsTab: 'effects',
        openOptionsScroll: 'guide-effects',
      }).then(() => {
        chrome.runtime.openOptionsPage();
        window.close();
      });
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
      // Hide the Premium badge on the per-org row once they're unlocked
      const perOrgBadge = document.getElementById('perOrgBadge');
      if (perOrgBadge) perOrgBadge.hidden = isPremium;
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
      // Premium gate — feature is locked until paid; defer the actual override
      // write and bounce them to the upgrade tab instead.
      const { premiumOverride = false } = await chrome.storage.local.get({ premiumOverride: false });
      const isPremium = !!premiumOverride;
      if (!isPremium) {
        toggle.checked = false; // revert the visual flip
        openOptionsOnTab('upgrade');
        return;
      }
      if (toggle.checked) {
        await setOrgTheme();
      } else {
        await resetOrgTheme();
      }
    });
  }

  // (Reset-all-settings removed: only 3 toggles + per-org gate left in the
   // popup, all individually adjustable. Background.js onInstalled still owns
   // first-install defaults; nuclear reset can come back in Studio if asked.)

  // ─── Scope toggle (Also theme Setup pages) ───────────────────────────────
  // Storage stays as themeScope: 'lightning' | 'both'. The deprecated
  // 'setup'-only state migrates to 'both' silently on read so legacy users
  // keep their Setup theming after the UI collapse.

  function bindScopeToggle() {
    const toggle = document.getElementById('setupScopeToggle');
    if (!toggle) return;
    toggle.addEventListener('change', async () => {
      const scope = toggle.checked ? 'both' : 'lightning';
      await chrome.storage.sync.set({ themeScope: scope });
    });
  }

  function setScopeUI(scope) {
    const toggle = document.getElementById('setupScopeToggle');
    if (!toggle) return;
    // 'both' or legacy 'setup' → ON; 'lightning' or undefined → OFF
    toggle.checked = scope === 'both' || scope === 'setup';
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
        host.endsWith('.visualforce.com') ||
        host.endsWith('.salesforce-setup.com') ||
        host.endsWith('.cloudforce.com') ||
        host.endsWith('.force.com')
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
    // Presets tab badge count = total OOTB theme count
    const builtinCount = document.getElementById('builtinTabCount');
    if (builtinCount) builtinCount.textContent = String(THEMES.length);

    bindThemeTabs();
    renderCustomThemesPanel();

    bindOptionsButton();
    bindDiagnosticButton();
    bindHelpTooltip();
    bindScopeToggle();
    bindEffectsSelector();
    bindUpgradeCta();
    bindSettingsCollapse();
    bindThemeOnToggle();
    bindPerOrgToggle();
    applyPremiumStateToPopup();

    // Footer version — pulled from manifest so it never drifts
    const verEl = document.getElementById('footerVersion');
    if (verEl) {
      try {
        const v = chrome.runtime.getManifest().version;
        verEl.textContent = `v${v}`;
      } catch (_) {}
    }

    const [result, orgHostname] = await Promise.all([
      chrome.storage.sync.get({
        theme: 'connectry',
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
        themeScope: 'both',
        effectsVolume: 'medium',
        customThemes: [],
      }),
      detectCurrentOrg(),
    ]);

    syncState = result;
    currentOrgHostname = orgHostname;

    // One-time silent migration: the deprecated 'setup'-only scope (theme on
    // Setup but NOT Lightning) maps to 'both' under the new toggle model.
    if (result.themeScope === 'setup') {
      result.themeScope = 'both';
      syncState.themeScope = 'both';
      chrome.storage.sync.set({ themeScope: 'both' }).catch(() => {});
    }

    setScopeUI(result.themeScope || 'lightning');

    // Set effects UI from the Volume knob — normalize legacy values so old
    // users on 'default' / 'immersive' / 'alive' / 'none' map cleanly.
    setEffectsUI(_normalizeStoredVolume(result.effectsVolume));

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

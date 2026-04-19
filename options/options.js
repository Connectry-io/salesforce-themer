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

  /** Resolve a custom theme's full color map by merging base + overrides. */
  function resolveCustomColors(ct) {
    const base = getThemeById(ct.basedOn) || THEMES[0];
    return { ...(base?.colors || {}), ...(ct.coreOverrides || {}), ...(ct.advancedOverrides || {}) };
  }

  // ─── Swatch generation ────────────────────────────────────────────────────

  function buildSwatch(theme) {
    const c = theme.colors;
    // Pick 4 representative colors: bg, surface, accent, text
    const colors = [c.background, c.surface, c.accent, c.textPrimary];
    return colors.map(col => `<span style="background:${col};"></span>`).join('');
  }

  // ─── Typography constants ──────────────────────────────────────────────────

  const FONT_STACKS = {
    'system-ui':      'system-ui, sans-serif',
    'neo-grotesque':  "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif",
    'humanist':       "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
    'geometric':      "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
    'classic-serif':  "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
    'ibm-plex':       "'IBM Plex Sans', Inter, 'Segoe UI', system-ui, sans-serif",
  };

  const TYPE_SIZE_PRESETS = {
    compact:     0.9,
    normal:      1.0,
    comfortable: 1.1,
    large:       1.2,
  };

  function defaultTypography() {
    return {
      fontFamily: 'system-ui',
      fontFamilyHeading: '',
      sizePreset: 'normal',
      sizeScale: 1.0,
      weightBody: 400,
      weightHeading: 700,
      lineHeight: 1.375,
      letterSpacing: 0,
    };
  }

  // ─── Shared preview component ────────────────────────────────────────────
  //
  // Reusable Salesforce page mockup used by:
  //   - Builder (full size, interactive)
  //   - Theme Manager hero (medium size)
  //   - Theme Manager expanded card detail (compact)
  //   - Future: Marketplace detail view
  //
  // Usage: renderThemePreview(container, colors, { size, effects, interactive })

  const PREVIEW_HTML_TEMPLATE = `
    <div class="preview-browser-bar">
      <div class="preview-browser-dots">
        <span style="background:#ff5f57"></span>
        <span style="background:#febc2e"></span>
        <span style="background:#28c840"></span>
      </div>
      <div class="preview-browser-tabs">
        <div class="preview-browser-tab is-active">
          <span class="preview-browser-tab-fav">
            <svg width="10" height="10" viewBox="0 0 32 32" fill="none"><circle cx="8" cy="16" r="4" fill="#2D2D2D"/><line x1="12" y1="16" x2="20" y2="16" stroke="#4A6FA5" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="16" r="4" fill="#4A6FA5"/></svg>
          </span>
          <span class="preview-browser-tab-text">Jack Popescu | Lead | S...</span>
          <span class="preview-browser-tab-x">&times;</span>
        </div>
        <div class="preview-browser-tab-new">+</div>
      </div>
    </div>
    <div class="editor-preview-frame">
      <div class="preview-particles">
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
        <div class="preview-particle"></div><div class="preview-particle"></div>
      </div>
      <div class="preview-cursor-trail"></div>
      <div class="preview-topbar" data-bind="surface" data-bind-border-color="border">
        <div class="preview-topbar-left">
          <svg class="preview-sf-logo" width="18" height="13" viewBox="0 0 23 16" fill="none" aria-hidden="true">
            <path d="M9.5 3.1a3.4 3.4 0 016.2-.3 3.8 3.8 0 015 3.6 3.8 3.8 0 01-3.8 3.8h-.2a3.5 3.5 0 01-6.5 1.2A3.2 3.2 0 017 13a3.2 3.2 0 01-3.2-3.2v-.1A3.5 3.5 0 011 6.4 3.5 3.5 0 014.5 3c.3 0 .6 0 .9.1a4 4 0 014.1 0z" fill="#00A1E0"/>
          </svg>
        </div>
        <div class="preview-topbar-search" data-bind="background" data-bind-border-color="borderInput">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
            <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
          </svg>
          <span data-bind-color="textPlaceholder">Search...</span>
        </div>
        <div class="preview-topbar-actions" data-bind-color="textSecondary">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8.5 1.3A6.5 6.5 0 002 7.6a6.5 6.5 0 005.2 6.4l.3-1.2A5.3 5.3 0 013.2 7.6a5.3 5.3 0 015.3-5.1 5.3 5.3 0 015.3 5.1 5.3 5.3 0 01-2.6 4.5l.4 1.1A6.5 6.5 0 0015 7.6a6.5 6.5 0 00-6.5-6.3z" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1.8" fill="currentColor"/></svg>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5l2 4.5h4.5l-3.5 3 1.2 4.5L8 11l-4.2 2.5L5 9 1.5 6H6l2-4.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/></svg>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill="currentColor" transform="translate(5.5 0)"/></svg>
          <span class="preview-topbar-avatar" data-bind="accent" data-bind-color="buttonBrandText">N</span>
        </div>
      </div>
      <div class="preview-nav" data-bind="nav">
        <span class="preview-nav-waffle" data-bind-color="navText">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="3" cy="3" r="1.5" fill="currentColor"/><circle cx="8" cy="3" r="1.5" fill="currentColor"/><circle cx="13" cy="3" r="1.5" fill="currentColor"/>
            <circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="3" cy="13" r="1.5" fill="currentColor"/><circle cx="8" cy="13" r="1.5" fill="currentColor"/><circle cx="13" cy="13" r="1.5" fill="currentColor"/>
          </svg>
        </span>
        <span class="preview-nav-app" data-bind-color="navText">Sales</span>
        <span class="preview-nav-item" data-bind-color="navText">Home</span>
        <span class="preview-nav-item preview-nav-active" data-bind-color="navActiveText" data-bind-border="accent">Leads</span>
        <span class="preview-nav-item" data-bind-color="navText">Contacts</span>
        <span class="preview-nav-item" data-bind-color="navText">Accounts</span>
      </div>
      <div class="preview-content">
      <div class="preview-header" data-bind="background">
        <div class="preview-header-top">
          <div>
            <div class="preview-header-title" data-bind-color="textPrimary">Lead: John Smith</div>
            <div class="preview-header-meta" data-bind-color="textSecondary">Senior Account Executive</div>
          </div>
          <div class="preview-header-actions">
            <button class="preview-btn-neutral preview-btn-sm" data-bind="buttonNeutralBg" data-bind-color="textPrimary" data-bind-border-color="borderInput">Clone</button>
            <button class="preview-btn-brand preview-btn-sm" data-bind="accent" data-bind-color="buttonBrandText">Convert</button>
          </div>
        </div>
      </div>
      <div class="preview-highlights" data-bind="surface" data-bind-border-color="border">
        <div class="preview-highlight">
          <span class="preview-highlight-label" data-bind-color="textSecondary">Phone</span>
          <span class="preview-highlight-value" data-bind-color="link">(415) 555-1234</span>
        </div>
        <div class="preview-highlight">
          <span class="preview-highlight-label" data-bind-color="textSecondary">Company</span>
          <span class="preview-highlight-value" data-bind-color="textPrimary">Acme Corp</span>
        </div>
        <div class="preview-highlight">
          <span class="preview-highlight-label" data-bind-color="textSecondary">Lead Source</span>
          <span class="preview-highlight-value" data-bind-color="textPrimary">Web</span>
        </div>
        <div class="preview-highlight">
          <span class="preview-highlight-label" data-bind-color="textSecondary">Rating</span>
          <span class="preview-highlight-value" data-bind-color="warning">Hot</span>
        </div>
      </div>
      <div class="preview-path-wrap" data-bind="surface" data-bind-border-color="border">
        <div class="preview-path">
          <span class="preview-path-item preview-path-complete" data-bind="accent" data-bind-color="buttonBrandText">New</span>
          <span class="preview-path-item preview-path-current" data-bind="accent" data-bind-color="buttonBrandText">Working</span>
          <span class="preview-path-item" data-bind="surfaceAlt" data-bind-color="textPrimary">Converted</span>
        </div>
      </div>
      <div class="preview-card" data-bind="surface" data-bind-border-color="border">
        <div class="preview-card-tabs">
          <span class="preview-tab-active" data-bind-color="accent">Details</span>
          <span class="preview-tab" data-bind-color="textSecondary">Activity</span>
          <span class="preview-tab" data-bind-color="textSecondary">Chatter</span>
        </div>
        <div class="preview-card-body preview-card-body-2col">
          <div class="preview-field">
            <span class="preview-field-label" data-bind-color="textSecondary">Name</span>
            <span class="preview-field-value" data-bind-color="textPrimary">John Smith</span>
          </div>
          <div class="preview-field">
            <span class="preview-field-label" data-bind-color="textSecondary">Title</span>
            <span class="preview-field-value" data-bind-color="textPrimary">Sr. Account Exec</span>
          </div>
          <div class="preview-field">
            <span class="preview-field-label" data-bind-color="textSecondary">Email</span>
            <span class="preview-field-value preview-link" data-bind-color="link">john@example.com</span>
          </div>
          <div class="preview-field">
            <span class="preview-field-label" data-bind-color="textSecondary">Phone</span>
            <span class="preview-field-value" data-bind-color="textPrimary">(415) 555-1234</span>
          </div>
          <div class="preview-field">
            <span class="preview-field-label" data-bind-color="textSecondary">Company</span>
            <span class="preview-field-value" data-bind-color="textPrimary">Acme Corp</span>
          </div>
          <div class="preview-field">
            <span class="preview-field-label" data-bind-color="textSecondary">Industry</span>
            <span class="preview-field-value" data-bind-color="textPrimary">Technology</span>
          </div>
        </div>
        <div class="preview-card-actions">
          <button class="preview-btn-neutral" data-bind="buttonNeutralBg" data-bind-color="textPrimary" data-bind-border-color="borderInput">Edit</button>
          <button class="preview-btn-neutral" data-bind="buttonNeutralBg" data-bind-color="textPrimary" data-bind-border-color="borderInput">Delete</button>
        </div>
      </div>
      <div class="preview-related-list" data-bind="surface" data-bind-border-color="border">
        <div class="preview-related-header">
          <span class="preview-related-title" data-bind-color="textPrimary">Contacts (2)</span>
          <button class="preview-btn-neutral preview-btn-xs" data-bind="buttonNeutralBg" data-bind-color="textPrimary" data-bind-border-color="borderInput">New</button>
        </div>
        <div class="preview-related-table">
          <div class="preview-related-row preview-related-row-header" data-bind="tableHeaderBg">
            <span data-bind-color="textSecondary">Name</span>
            <span data-bind-color="textSecondary">Email</span>
            <span data-bind-color="textSecondary">Status</span>
          </div>
          <div class="preview-related-row" data-bind="surface">
            <span data-bind-color="link">Jane Doe</span>
            <span data-bind-color="textPrimary">jane@acme.com</span>
            <span class="preview-badge" data-bind-color="success">Active</span>
          </div>
          <div class="preview-related-row" data-bind="surface">
            <span data-bind-color="link">Bob Lee</span>
            <span data-bind-color="textPrimary">bob@acme.com</span>
            <span class="preview-badge" data-bind-color="warning">Pending</span>
          </div>
        </div>
      </div>
      <div class="preview-toast" data-bind="surface" data-bind-border-color="border">
        <span class="preview-toast-icon" data-bind-color="success">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="preview-toast-text" data-bind-color="textPrimary">Lead "John Smith" was saved.</span>
        <span class="preview-toast-link" data-bind-color="link">Undo</span>
      </div>
      </div>
      <div class="preview-utilbar" data-bind="nav">
        <span class="preview-utilbar-item" data-bind-color="navText">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Notes
        </span>
        <span class="preview-utilbar-item" data-bind-color="navText">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          History
        </span>
        <span class="preview-utilbar-item" data-bind-color="navText">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M13 10.5V12a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 12V4a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0113 4v1.5M6 8h7m0 0l-2.5-2.5M13 8l-2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Open CTI
        </span>
      </div>
    </div>`;

  /**
   * Apply theme colors to a preview frame using data-bind attributes.
   * Works on any container that holds the PREVIEW_HTML_TEMPLATE markup.
   */
  function applyPreviewColors(frame, colors) {
    if (!frame || !colors) return;
    frame.style.backgroundColor = colors.background || '';
    frame.querySelectorAll('[data-bind]').forEach(el => {
      const key = el.dataset.bind;
      if (colors[key]) el.style.backgroundColor = colors[key];
    });
    frame.querySelectorAll('[data-bind-color]').forEach(el => {
      const key = el.dataset.bindColor;
      if (colors[key]) el.style.color = colors[key];
    });
    frame.querySelectorAll('[data-bind-border-color]').forEach(el => {
      const key = el.dataset.bindBorderColor;
      if (colors[key]) el.style.borderColor = colors[key];
    });
    frame.querySelectorAll('[data-bind-border]').forEach(el => {
      const key = el.dataset.bindBorder;
      if (colors[key]) el.style.borderBottomColor = colors[key];
    });
  }

  /**
   * Apply effects config to a preview frame via CSS custom properties
   * and data attributes. Shared between Builder and Theme Manager.
   */
  function applyPreviewEffects(frame, effects, accentColor, surfaceColor) {
    if (!frame) return;
    const accent = accentColor || '#4a6fa5';
    const rgb = _hexToRgbCsv(accent);
    frame.style.setProperty('--fx-accent', accent);
    frame.style.setProperty('--fx-accent-rgb', rgb);
    // Background color used as the "content mat" behind the bg pattern frame.
    // Lets the pattern show only at outer edges, matching real SF behavior
    // where pattern frames the chrome and the content canvas covers the middle.
    if (surfaceColor) {
      frame.style.setProperty('--fx-preview-surface', surfaceColor);
    }

    const LADDER = {
      subtle: { mult: 0.5, speed: 1.6 },
      medium: { mult: 1.0, speed: 1.0 },
      strong: { mult: 1.6, speed: 0.65 },
    };
    const FX_KEYS = ['hoverLift', 'ambientGlow', 'neonFlicker', 'aurora'];
    // camelCase → kebab-case for CSS var names (hoverLift → hover-lift).
    const _kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase();
    for (const key of FX_KEYS) {
      const on = !!effects[key];
      const attr = 'fx' + key.charAt(0).toUpperCase() + key.slice(1);
      const multVar = `--fx-${_kebab(key)}-mult`;
      const speedVar = `--fx-${_kebab(key)}-speed`;
      if (on) {
        frame.dataset[attr] = 'on';
        // Per-effect multiplier — each effect's intensity knob is independent,
        // so emitting a single --fx-mult masked per-effect differences (the
        // max of all active effects won; subtle hoverLift alongside strong
        // shimmer rendered as strong). Scope each knob to its own var.
        const v = LADDER[effects[key + 'Intensity']] || LADDER.medium;
        frame.style.setProperty(multVar, String(v.mult));
        frame.style.setProperty(speedVar, String(v.speed));
      } else {
        delete frame.dataset[attr];
        frame.style.removeProperty(multVar);
        frame.style.removeProperty(speedVar);
      }
    }
    // Border effect — shimmer | gradient | none (mutually exclusive).
    // Sets data-fx-border-effect on the frame for CSS selection and also
    // emits its own per-effect mult/speed vars so the intensity knob
    // stays independent like every other effect.
    const _borderLegacy = effects.gradientBorders
      ? 'gradient'
      : (effects.borderShimmer ? 'shimmer' : 'none');
    // Legacy-shaped configs merged with the new default stamp
    // borderEffect='none' over the legacy boolean, so treat 'none' the same
    // as undefined for fallback purposes.
    const borderStyle = (effects.borderEffect && effects.borderEffect !== 'none')
      ? effects.borderEffect
      : _borderLegacy;
    if (borderStyle && borderStyle !== 'none') {
      frame.dataset.fxBorderEffect = borderStyle;
      const beIntensity = effects.borderEffectIntensity
        || effects.gradientBordersIntensity
        || effects.borderShimmerIntensity
        || 'medium';
      const v = LADDER[beIntensity] || LADDER.medium;
      frame.style.setProperty('--fx-border-effect-mult', String(v.mult));
      frame.style.setProperty('--fx-border-effect-speed', String(v.speed));
    } else {
      delete frame.dataset.fxBorderEffect;
      frame.style.removeProperty('--fx-border-effect-mult');
      frame.style.removeProperty('--fx-border-effect-speed');
    }

    // Aurora complementary colors — derive 2 extra hues via HSL rotation
    if (effects.aurora) {
      const parsed = _parseHexRgb(accent);
      if (parsed) {
        const hsl = _rgbToHslSimple(parsed.r, parsed.g, parsed.b);
        const h2 = (hsl.h + 60) % 360, h3 = (hsl.h + 180) % 360;
        const s = Math.max(40, hsl.s);
        const aurora2 = _hslToRgbCsv(h2, s, 55);
        const aurora3 = _hslToRgbCsv(h3, s, 55);
        frame.style.setProperty('--fx-aurora2-rgb', aurora2);
        frame.style.setProperty('--fx-aurora3-rgb', aurora3);
      }
    }
    // Particles — pass style as data attribute
    if (effects.particles) {
      frame.dataset.fxParticles = 'on';
      // Resolve particle style: boolean true defaults to 'snow', string value is the style
      const pStyle = typeof effects.particles === 'string' ? effects.particles : 'snow';
      frame.dataset.fxParticlesStyle = pStyle;
      const level = effects.particlesIntensity || 'medium';
      const v = LADDER[level] || LADDER.medium;
      frame.style.setProperty('--fx-mult', String(v.mult));
      frame.style.setProperty('--fx-speed-mult', String(v.speed));
    } else {
      delete frame.dataset.fxParticles;
      delete frame.dataset.fxParticlesStyle;
    }
    // Cursor trail — JS trail history
    if (effects.cursorTrail) {
      frame.dataset.fxCursorTrail = 'on';
      frame.dataset.fxCursorTrailStyle = effects.cursorTrailStyle || 'glow';
      _initBuilderCursorTrail(frame, accent, effects.cursorTrailStyle || 'glow');
    } else {
      delete frame.dataset.fxCursorTrail;
      delete frame.dataset.fxCursorTrailStyle;
      _destroyBuilderCursorTrail(frame);
    }
    // Background pattern — delegated to core engine
    // (core/effects/engine.js is the single source of truth for magnitudes,
    // thickness scaling, and opacity math across all surfaces)
    if (effects.backgroundPattern && effects.backgroundPattern !== 'none') {
      frame.dataset.fxBackgroundPattern = effects.backgroundPattern;
      // Mirror the data attribute onto .preview-content so the pattern can
      // frame the record content area (excluding the preview topbar, nav,
      // and utility bar).
      const content = frame.querySelector('.preview-content');
      if (content) content.dataset.fxBackgroundPattern = effects.backgroundPattern;
      const engine = window.SFThemerEffectsEngine;
      if (engine && window.__EFFECTS_ENGINE_V2 !== false) {
        const ir = engine.renderRules('backgroundPattern', effects, accent);
        const rule = ir && ir.cssRules && ir.cssRules.find(r => r.selectorRole === 'bodyWrapper');
        if (rule) {
          // Declarations are applied via CSS custom properties that the
          // editor-preview-frame::after rule reads. This lets us keep
          // positioning/z-index in the stylesheet while the engine owns the
          // visual properties.
          const d = rule.declarations;
          frame.style.setProperty('--fx-bg-pattern-image', d['background-image'] || 'none');
          frame.style.setProperty('--fx-bg-pattern-size', d['background-size'] || 'auto');
          frame.style.setProperty('--fx-bg-pattern-position', d['background-position'] || '0 0');
        }
      }
    } else {
      delete frame.dataset.fxBackgroundPattern;
      const content = frame.querySelector('.preview-content');
      if (content) delete content.dataset.fxBackgroundPattern;
      frame.style.removeProperty('--fx-bg-pattern-image');
      frame.style.removeProperty('--fx-bg-pattern-size');
      frame.style.removeProperty('--fx-bg-pattern-position');
    }
    // Master intensity vars
    const allFxKeys = [...FX_KEYS, 'particles', 'cursorTrail'];
    const activeMults = allFxKeys
      .filter(k => effects[k])
      .map(k => (LADDER[effects[k + 'Intensity']] || LADDER.medium).mult);
    const masterMult = activeMults.length ? Math.max(...activeMults) : 1;
    const masterSpeed = activeMults.length
      ? Math.min(...allFxKeys.filter(k => effects[k])
          .map(k => (LADDER[effects[k + 'Intensity']] || LADDER.medium).speed))
      : 1;
    frame.style.setProperty('--fx-mult', String(masterMult));
    frame.style.setProperty('--fx-speed-mult', String(masterSpeed));
  }

  /**
   * Render a theme preview into a container element.
   *
   * @param {HTMLElement} container - Target element to render into
   * @param {object} colors - Full theme color map (60+ keys)
   * @param {object} [opts] - Options
   * @param {string} [opts.size='full'] - 'full' | 'hero' | 'card'
   * @param {object} [opts.effects] - Effects config (from getSuggestedEffectsFor or custom)
   * @param {boolean} [opts.interactive=false] - Enable cursor trail mouse tracking
   */
  function renderThemePreview(container, colors, opts) {
    const { size = 'full', effects = null, interactive = false } = opts || {};
    container.innerHTML = PREVIEW_HTML_TEMPLATE;
    container.classList.add(`preview-size-${size}`);

    const frame = container.querySelector('.editor-preview-frame');
    if (!frame) return;

    applyPreviewColors(frame, colors);

    if (effects) {
      applyPreviewEffects(frame, effects, colors.accent, colors.background);
    }

    // Cursor trail mouse tracking (Builder only)
    if (interactive) {
      const trail = frame.querySelector('.preview-cursor-trail');
      if (trail) {
        frame.addEventListener('mousemove', (e) => {
          const rect = frame.getBoundingClientRect();
          trail.style.left = (e.clientX - rect.left) + 'px';
          trail.style.top = (e.clientY - rect.top) + 'px';
        });
      }
    }
  }

  // ─── Palette Preview (compact, for detail panel) ──────────────────────────
  //
  // Lightweight color-relationship strip showing how nav, surface, accent,
  // text, and buttons relate. ~100px tall vs the full SF mockup's 300-640px.
  // Used in the Theme Manager detail panel. The full mockup stays in the
  // Builder via renderThemePreview().

  function renderPalettePreview(container, colors) {
    const c = colors || {};
    container.innerHTML = `
      <div class="palette-preview">
        <div class="palette-preview-nav" style="background:${c.nav || '#4a6fa5'}">
          <span class="palette-preview-nav-app" style="color:${c.navText || '#fff'}">Sales</span>
          <span class="palette-preview-nav-item" style="color:${c.navText || '#fff'}">Home</span>
          <span class="palette-preview-nav-item palette-preview-nav-active" style="color:${c.navActiveText || '#fff'}; border-color:${c.accent || '#fff'}">Leads</span>
          <span class="palette-preview-nav-item" style="color:${c.navText || '#fff'}">Accounts</span>
        </div>
        <div class="palette-preview-body" style="background:${c.background || '#f7f7f5'}">
          <div class="palette-preview-card" style="background:${c.surface || '#fff'}; border-color:${c.border || '#e8e8e6'}">
            <div class="palette-preview-card-header">
              <span class="palette-preview-title" style="color:${c.textPrimary || '#2d2d2d'}">Record Name</span>
              <span class="palette-preview-btn" style="background:${c.accent || '#4a6fa5'}; color:${c.buttonBrandText || '#fff'}">Action</span>
            </div>
            <div class="palette-preview-fields">
              <div class="palette-preview-field">
                <span style="color:${c.textSecondary || '#4a5568'}">Label</span>
                <span style="color:${c.textPrimary || '#2d2d2d'}">Value</span>
              </div>
              <div class="palette-preview-field">
                <span style="color:${c.textSecondary || '#4a5568'}">Email</span>
                <span style="color:${c.link || '#4a6fa5'}">link@example.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ─── Theme grid rendering ─────────────────────────────────────────────────

  // Effect display names — used by the theme card pills and the Guide tab.
  const EFFECT_LABELS = {
    hoverLift:       'Hover lift',
    ambientGlow:     'Glow',
    borderEffect:    'Border',
    aurora:          'Aurora',
    neonFlicker:     'Neon',
    particles:       'Particles',
    cursorTrail:     'Cursor trail',
  };

  /**
   * Build the effect text pills for a theme card. Each pill is clickable —
   * clicking jumps to the Effects/Guide tab so the user can read about it.
   * Accepts either an OOTB theme ID (looks up shipped effects) or a raw
   * effects config object (used by custom themes which carry their own snapshot).
   */
  function buildEffectIndicators(themeIdOrConfig) {
    const cfg = (typeof themeIdOrConfig === 'string')
      ? getSuggestedEffectsFor(themeIdOrConfig)
      : (themeIdOrConfig || {});
    const enabled = [];
    for (const eff of ['hoverLift', 'ambientGlow', 'borderEffect', 'aurora', 'neonFlicker', 'particles', 'cursorTrail']) {
      // borderEffect is a string (shimmer|gradient|none), not a boolean.
      // Treat anything truthy-and-not-'none' as enabled; legacy booleans
      // (borderShimmer / gradientBorders) also count.
      if (eff === 'borderEffect') {
        const v = cfg.borderEffect
          || (cfg.gradientBorders ? 'gradient' : (cfg.borderShimmer ? 'shimmer' : 'none'));
        if (v && v !== 'none') enabled.push('borderEffect');
        continue;
      }
      if (cfg[eff]) enabled.push(eff);
    }
    if (!enabled.length) {
      return `<div class="theme-effects-indicators is-empty"><span class="theme-effects-empty">No effects</span></div>`;
    }
    const DOTS = { subtle: '•', medium: '••', strong: '•••' };
    const pills = enabled.map(e => {
      const label = EFFECT_LABELS[e] || e;
      const intensity = cfg[e + 'Intensity'] || 'medium';
      const dots = DOTS[intensity] || '··';
      const intensityLabel = intensity.charAt(0).toUpperCase() + intensity.slice(1);
      return `<button type="button" class="theme-effect-pill" data-effect-pill="${e}" title="${label} — ${intensityLabel}">${label}<span class="theme-effect-dots">${dots}</span></button>`;
    }).join('');
    return `<div class="theme-effects-indicators">${pills}</div>`;
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
          <div class="theme-card-type-row">
            <span class="theme-card-type-icon">Aa</span>
            <span class="theme-card-type-text">System Default · Md · 1.375/0</span>
          </div>
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
        const effectPill = e.target.closest('[data-effect-pill]');
        if (effectPill) {
          e.stopPropagation();
          // Jump to the Guide tab and highlight the specific effect card.
          // The Tabs activate() trigger will fire renderGuideTab via the
          // existing onChange handler.
          const effectId = effectPill.dataset.effectPill;
          if (_tabsInstance) _tabsInstance.activate('effects');
          // Wait one frame for the tab to render before scrolling
          setTimeout(() => highlightGuideEffect(effectId), 80);
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

  /**
   * Light/Dark group collapsible. Click the section header to toggle.
   * State persists per group in localStorage so it stays the way you left it.
   */
  const THEME_GROUP_COLLAPSE_KEYS = {
    light: 'sft-light-group-collapsed',
    dark:  'sft-dark-group-collapsed',
  };

  function bindThemeGroupCollapse() {
    document.querySelectorAll('.theme-group-label[data-group-toggle]').forEach(btn => {
      const groupKey = btn.dataset.groupToggle;
      const group = btn.closest('.theme-group');
      // Restore persisted state (default: expanded)
      const stored = localStorage.getItem(THEME_GROUP_COLLAPSE_KEYS[groupKey]);
      const collapsed = stored === '1';
      applyGroupCollapse(group, btn, collapsed);

      btn.addEventListener('click', () => {
        const nowCollapsed = group.dataset.collapsed !== 'true';
        applyGroupCollapse(group, btn, nowCollapsed);
        try { localStorage.setItem(THEME_GROUP_COLLAPSE_KEYS[groupKey], nowCollapsed ? '1' : '0'); } catch (_) {}
      });
    });

    // Update theme counts in each header
    const lightCount = document.querySelectorAll('#lightThemeGrid .theme-card').length;
    const darkCount = document.querySelectorAll('#darkThemeGrid .theme-card').length;
    const lightLabel = document.getElementById('lightThemeCount');
    const darkLabel = document.getElementById('darkThemeCount');
    if (lightLabel) lightLabel.textContent = `${lightCount}`;
    if (darkLabel) darkLabel.textContent = `${darkCount}`;
  }

  function applyGroupCollapse(group, btn, collapsed) {
    if (!group || !btn) return;
    group.dataset.collapsed = String(collapsed);
    btn.setAttribute('aria-expanded', String(!collapsed));
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

  // ─── Custom theme grid (LEGACY HIDDEN HOST) ──────────────────────────────
  // V3.2: this used to render visible custom-theme cards in the Builder tab.
  // The Builder sidebar list is now the source of truth — this function still
  // populates the legacy #customThemeGrid host so older event-binding paths
  // (delete, edit, active-state updates) keep working, but the host itself
  // stays HIDDEN unconditionally. Don't bring back grid.hidden = false here
  // unless you're tearing the sidebar list out and reverting to the grid.

  function renderCustomThemeGrid(activeThemeId) {
    const grid = document.getElementById('customThemeGrid');
    const empty = document.getElementById('customThemeEmpty');
    if (!grid || !empty) return;

    // Always hidden — the sidebar in the Builder tab is the visible source.
    grid.hidden = true;
    empty.hidden = true;

    const customs = syncState.customThemes || [];
    if (!customs.length) {
      grid.innerHTML = '';
      return;
    }

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
          <div class="theme-description">Based on ${base ? base.name : ct.basedOn}</div>
          ${buildEffectIndicators(ct.effects || {})}
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

  // ─── Builder top bar: theme switcher dropdown ────────────────────────────
  // The top bar shows the current theme being edited via a dropdown.
  // Click the dropdown → list of custom themes, one-click to switch.
  // Also updates the swatch in the trigger button.

  function renderBuilderSidebar(activeThemeId) {
    // Update the trigger button's label + swatch
    _updateThemeSwitcherTrigger();

    // Rebuild the dropdown menu items
    const menu = document.getElementById('builderThemeSwitcherMenu');
    if (!menu) return;

    const customs = syncState.customThemes || [];
    menu.innerHTML = '';

    if (!isPremium()) {
      menu.innerHTML = `<div class="builder-theme-switcher-empty">Saving custom themes is a <strong>Premium</strong> feature, coming soon.</div>`;
      return;
    }

    if (!customs.length) {
      menu.innerHTML = `<div class="builder-theme-switcher-empty">No saved themes yet. Click + New to create one.</div>`;
      return;
    }

    // Unsaved draft — show at the top if the current editor session is a new
    // theme that hasn't been saved yet. Makes it obvious the live preview
    // isn't in My Themes.
    if (editorState.active && !editorState.customId) {
      const draftLabel = document.createElement('div');
      draftLabel.className = 'builder-theme-switcher-menu-label';
      draftLabel.textContent = 'Current draft';
      menu.appendChild(draftLabel);

      const draftName = document.getElementById('editorName')?.value || 'Untitled draft';
      const draftItem = document.createElement('div');
      draftItem.className = 'builder-theme-switcher-item is-draft is-active';
      draftItem.innerHTML = `
        <span class="builder-theme-switcher-item-swatch"></span>
        <span><em>${Connectry.Settings.escape(draftName)}</em></span>
        <span class="builder-theme-switcher-item-pill">Unsaved</span>
      `;
      menu.appendChild(draftItem);
    }

    const label = document.createElement('div');
    label.className = 'builder-theme-switcher-menu-label';
    label.textContent = 'My Themes';
    menu.appendChild(label);

    for (const ct of customs) {
      const isActive = ct.id === activeThemeId;
      const base = getThemeById(ct.basedOn);
      const resolvedColors = { ...(base?.colors || {}), ...(ct.coreOverrides || {}), ...(ct.advancedOverrides || {}) };
      const swatchColors = [resolvedColors.background, resolvedColors.surface, resolvedColors.accent, resolvedColors.textPrimary];
      const swatchHtml = swatchColors.map(col => `<span style="background:${col};"></span>`).join('');

      const item = document.createElement('button');
      item.type = 'button';
      item.className = `builder-theme-switcher-item${isActive ? ' is-active' : ''}`;
      item.dataset.theme = ct.id;
      item.innerHTML = `
        <span class="builder-theme-switcher-item-swatch">${swatchHtml}</span>
        <span>${Connectry.Settings.escape(ct.name)}</span>
      `;

      item.addEventListener('click', () => {
        // Guard against silently losing in-flight edits when the user jumps
        // between themes in the switcher.
        if (!_confirmDiscardIfDirty()) return;
        _closeThemeSwitcher();
        openEditor(ct.basedOn, ct);
      });

      menu.appendChild(item);
    }
  }

  /**
   * Update the theme switcher trigger button to reflect whatever theme
   * is currently loaded in the editor (or the active theme if no editor
   * state). Shows the name + swatch in the button.
   */
  function _updateThemeSwitcherTrigger() {
    const nameEl = document.getElementById('builderThemeSwitcherName');
    const swatchEl = document.getElementById('builderThemeSwitcherSwatch');
    if (!nameEl || !swatchEl) return;

    const editorName = document.getElementById('editorName');
    const name = editorName ? editorName.value : 'New Theme';
    nameEl.textContent = name;

    // Resolve colors for the swatch
    const full = typeof getFullEditorTheme === 'function' && editorState.active
      ? getFullEditorTheme()
      : null;
    if (full) {
      const colors = [full.background, full.surface, full.accent, full.textPrimary];
      swatchEl.innerHTML = colors.map(c => `<span style="background:${c || '#ddd'}"></span>`).join('');
    }
  }

  function _closeThemeSwitcher() {
    const menu = document.getElementById('builderThemeSwitcherMenu');
    const btn = document.getElementById('builderThemeSwitcherBtn');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
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
      renderCollectionGrid(syncState.theme);
    }
    renderBuilderSidebar(syncState.theme);
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

  // ─── Theme Manager: Grids (My Themes + Presets) ────────────────────────────

  let _activePresetsFilter = 'all';
  let _openDetailId = null;

  /** Build a theme card element for any grid. */
  function _buildThemeCard(theme, activeThemeId) {
    const isActive = theme.id === activeThemeId;
    const card = document.createElement('div');
    card.className = `theme-card${isActive ? ' is-active' : ''}`;
    card.dataset.theme = theme.id;
    card.dataset.category = theme.isCustom ? 'custom' : theme.category;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(isActive));
    card.setAttribute('tabindex', '0');
    card.setAttribute('title', theme.name);

    const c = theme.colors || {};
    const swatchColors = [c.background, c.surface, c.accent, c.textPrimary];
    const swatchHtml = swatchColors.map(col => `<span style="background:${col || '#ddd'}"></span>`).join('');

    // Favicon chip — pulls the theme's favicon config if set, otherwise
    // renders the per-theme default (thematic glyph + theme accent) from
    // the canonical favicon engine.
    const favCfg = theme.favicon
      || (self.ConnectryFavicon?.defaultForTheme(theme.basedOn || theme.id, c.accent))
      || { shape: 'circle', color: c.accent || '#4A6FA5', icon: 'connectry' };
    const faviconSvg = self.ConnectryFavicon ? self.ConnectryFavicon.buildSVG(favCfg, 18) : '';

    const deleteBtnHtml = theme.isCustom
      ? `<button type="button" class="theme-card-delete-btn" data-theme-delete title="Delete theme" aria-label="Delete ${Connectry.Settings.escape(theme.name)}">
           <svg width="12" height="12" viewBox="0 0 22 22" fill="none" aria-hidden="true">
             <path d="M3 6h16M8 6V3h6v3M6 6l1 13a2 2 0 002 2h4a2 2 0 002-2l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
         </button>`
      : '';

    card.innerHTML = `
      ${deleteBtnHtml}
      <div class="theme-swatch">${swatchHtml}</div>
      <div class="theme-card-body">
        <div class="theme-card-header">
          <span class="theme-name">${theme.name}</span>
          <span class="theme-card-favicon" aria-hidden="true">${faviconSvg}</span>
          ${isActive ? '<span class="theme-active-badge">✓ Active</span>' : ''}
          <span class="theme-category-badge ${theme.isCustom ? (theme.category || 'light') : theme.category}">${theme.isCustom ? 'Custom' : (theme.category === 'light' ? 'Light' : 'Dark')}</span>
        </div>
        <div class="theme-description">${theme.description || ''}</div>
        ${theme.isCustom ? buildEffectIndicators(theme.effects || getSuggestedEffectsFor(theme.basedOn || 'connectry')) : buildEffectIndicators(theme.id)}
        <div class="theme-card-type-row">
          <span class="theme-card-type-icon">Aa</span>
          <span class="theme-card-type-text">System Default · Md · 1.375/0</span>
        </div>
      </div>
    `;

    card.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('[data-theme-delete]');
      if (delBtn) {
        e.stopPropagation();
        if (!confirm(`Delete "${theme.name}"? This cannot be undone.`)) return;
        await deleteCustomTheme(theme.id);
        renderCollectionGrid(syncState.theme);
        _flashToast('Theme deleted.');
        return;
      }
      const effectPill = e.target.closest('[data-effect-pill]');
      if (effectPill) {
        e.stopPropagation();
        const effectId = effectPill.dataset.effectPill;
        if (_tabsInstance) _tabsInstance.activate('effects');
        setTimeout(() => highlightGuideEffect(effectId), 80);
        return;
      }
      toggleDetailPanel(theme);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDetailPanel(theme);
      }
    });

    return card;
  }

  /** Render the My Themes grid (custom themes only). */
  function renderMyThemesGrid(activeThemeId) {
    const grid = document.getElementById('optMyThemesGrid');
    const empty = document.getElementById('optMyThemesEmpty');
    const premiumGate = document.getElementById('optMyThemesPremiumGate');
    const newBtn = document.getElementById('optMyThemesNewBtn');
    if (!grid) return;
    grid.innerHTML = '';
    _preserveOrCloseDetail();

    // Free users: hide grid, show premium gate
    if (!isPremium()) {
      grid.hidden = true;
      if (empty) empty.hidden = true;
      if (premiumGate) premiumGate.hidden = false;
      if (newBtn) newBtn.hidden = true;
      return;
    }

    grid.hidden = false;
    if (premiumGate) premiumGate.hidden = true;
    if (newBtn) newBtn.hidden = false;

    const customs = (syncState.customThemes || []).map(ct => ({
      ...ct,
      isCustom: true,
      colors: resolveCustomColors(ct),
      category: ct.category || (_detectThemeCategory(resolveCustomColors(ct).background) === 'dark' ? 'dark' : 'light'),
    }));

    if (empty) empty.hidden = customs.length > 0;

    for (const theme of customs) {
      grid.appendChild(_buildThemeCard(theme, activeThemeId));
    }
  }

  /** Render the Presets grid (preset themes only). */
  function renderPresetsGrid(activeThemeId) {
    const grid = document.getElementById('optPresetsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    _preserveOrCloseDetail();

    for (const theme of THEMES) {
      const t = { ...theme, isCustom: false };
      const card = _buildThemeCard(t, activeThemeId);
      grid.appendChild(card);
    }

    applyPresetsFilter();
  }

  /** Convenience: render both grids. */
  function renderCollectionGrid(activeThemeId) {
    renderMyThemesGrid(activeThemeId);
    renderPresetsGrid(activeThemeId);
  }

  function applyPresetsFilter() {
    const grid = document.getElementById('optPresetsGrid');
    if (!grid) return;
    grid.querySelectorAll('.theme-card').forEach(card => {
      const cat = card.dataset.category;
      const show = _activePresetsFilter === 'all' || cat === _activePresetsFilter;
      card.classList.toggle('is-hidden', !show);
    });
    if (_openDetailId) {
      const openCard = grid.querySelector(`.theme-card[data-theme="${_openDetailId}"]`);
      if (openCard && openCard.classList.contains('is-hidden')) closeDetailPanel();
    }
  }

  function bindPresetsFilterPills() {
    const section = document.getElementById('opt-presets-heading');
    if (!section) return;
    const sectionEl = section.closest('.cx-section');
    if (!sectionEl) return;
    const pills = sectionEl.querySelectorAll('.cx-pill[data-filter]');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        _activePresetsFilter = pill.dataset.filter;
        pills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        applyPresetsFilter();
      });
    });
  }

  function updateCollectionActiveState(activeThemeId) {
    // Update both grids
    document.querySelectorAll('#optMyThemesGrid .theme-card, #optPresetsGrid .theme-card').forEach(card => {
      const id = card.dataset.theme;
      const isActive = id === activeThemeId;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-selected', String(isActive));
      const statusText = card.querySelector('.theme-card-status span:last-child');
      if (statusText) statusText.textContent = isActive ? 'Active' : 'Apply';
    });
  }

  // ─── Theme Manager: Side Detail Panel ──────────────────────────────────────

  function toggleDetailPanel(theme) {
    if (_openDetailId === theme.id) {
      closeDetailPanel();
      return;
    }
    openDetailPanel(theme);
  }

  function openDetailPanel(theme) {
    const panel = document.getElementById('optDetailPanel');
    if (!panel) return;

    // Clear expanded highlight from all cards
    document.querySelectorAll('.theme-card.is-expanded').forEach(c => c.classList.remove('is-expanded'));

    // Highlight the clicked card
    const card = document.querySelector(`#optMyThemesGrid .theme-card[data-theme="${theme.id}"], #optPresetsGrid .theme-card[data-theme="${theme.id}"]`);
    if (card) card.classList.add('is-expanded');

    _openDetailId = theme.id;

    // Header — name + small favicon chip showing the theme's tab mark
    const detailNameEl = document.getElementById('optDetailName');
    detailNameEl.textContent = theme.name;
    const detailFavHost = document.getElementById('optDetailFavicon');
    if (detailFavHost) {
      const favC = theme.colors || {};
      const favCfg = theme.favicon
        || (self.ConnectryFavicon?.defaultForTheme(theme.basedOn || theme.id, favC.accent))
        || { shape: 'circle', color: favC.accent || '#4A6FA5', icon: 'connectry' };
      detailFavHost.innerHTML = self.ConnectryFavicon ? self.ConnectryFavicon.buildSVG(favCfg, 22) : '';
    }

    // Toolbar: actions above the preview (always visible, no scrolling)
    const toolbar = document.getElementById('optDetailToolbar');
    const isBuiltIn = !theme.isCustom;
    const applyLabel = theme.id === syncState.theme ? 'Active' : 'Apply';
    const applyDisabled = theme.id === syncState.theme ? ' disabled' : '';

    // Consolidated toolbar: [Apply] [Edit/Clone] ──spacer── [⋮]
    // Primary + Secondary stay visible; overflow owns Export, Share, and
    // (custom-only) Delete so the row isn't a buffet of five equal buttons.
    let toolbarHtml = `<button class="cx-btn cx-btn-primary cx-btn-sm" data-detail-apply="${theme.id}"${applyDisabled}>${applyLabel}</button>`;
    const secondaryLabel = isBuiltIn ? 'Clone' : 'Edit';
    const secondaryAttr = isBuiltIn ? 'data-detail-clone' : 'data-detail-edit';
    toolbarHtml += `<button class="cx-btn cx-btn-secondary cx-btn-sm" ${secondaryAttr}="${theme.id}">${secondaryLabel}</button>`;

    toolbarHtml += `<span class="opt-toolbar-spacer"></span>`;

    toolbarHtml += `<div class="opt-detail-overflow">
      <button class="cx-btn cx-btn-ghost cx-btn-sm opt-detail-overflow-btn" data-detail-overflow="${theme.id}" aria-haspopup="true" aria-expanded="false" title="More">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" fill="currentColor"/>
          <circle cx="8" cy="8" r="1.4" fill="currentColor"/>
          <circle cx="13" cy="8" r="1.4" fill="currentColor"/>
        </svg>
      </button>
      <div class="opt-detail-overflow-menu" hidden role="menu">
        ${!isBuiltIn ? `<button type="button" class="opt-detail-overflow-item" role="menuitem" data-detail-export="${theme.id}"${isPremium() ? '' : ' disabled title="Premium feature"'}>
          <span>Export JSON</span>
        </button>` : ''}
        <button type="button" class="opt-detail-overflow-item" role="menuitem" data-detail-share="${theme.id}">
          <span>Share</span>
        </button>
        ${!isBuiltIn ? `<div class="opt-detail-overflow-divider"></div>
        <button type="button" class="opt-detail-overflow-item opt-detail-overflow-item-danger" role="menuitem" data-detail-delete="${theme.id}">
          <span>Delete</span>
        </button>` : ''}
      </div>
    </div>`;
    toolbar.innerHTML = toolbarHtml;

    // Wire the overflow dropdown open/close
    const overflowBtn = toolbar.querySelector('[data-detail-overflow]');
    const overflowMenu = toolbar.querySelector('.opt-detail-overflow-menu');
    if (overflowBtn && overflowMenu) {
      overflowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willShow = overflowMenu.hidden;
        overflowMenu.hidden = !willShow;
        overflowBtn.setAttribute('aria-expanded', String(willShow));
      });
      document.addEventListener('click', (e) => {
        if (!overflowMenu.hidden && !overflowMenu.contains(e.target) && !overflowBtn.contains(e.target)) {
          overflowMenu.hidden = true;
          overflowBtn.setAttribute('aria-expanded', 'false');
        }
      });
      overflowMenu.querySelectorAll('.opt-detail-overflow-item').forEach((item) => {
        item.addEventListener('click', () => {
          overflowMenu.hidden = true;
          overflowBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Compact preview with live effects
    const previewHost = document.getElementById('optDetailPreview');
    previewHost.innerHTML = '';
    const colors = theme.isCustom ? theme.colors : theme.colors;
    const effects = theme.isCustom
      ? (theme.effects || getSuggestedEffectsFor(theme.basedOn || 'connectry'))
      : getSuggestedEffectsFor(theme.id);
    renderThemePreview(previewHost, colors, { size: 'compact', effects });

    // Body: base-theme label for custom themes only
    // Effects + intensity are shown on the cards via dots — no controls in panel
    const body = document.getElementById('optDetailBody');
    const basedOn = !isBuiltIn ? `<p class="opt-detail-bestfor">Based on: ${(getThemeById(theme.basedOn) || THEMES[0]).name}</p>` : '';
    body.innerHTML = basedOn;

    // Wire action handlers on the body
    _wireDetailActions(toolbar, body, theme);

    // Show panel
    panel.hidden = false;
  }

  function _wireDetailActions(toolbar, body, theme) {
    // Toolbar actions (above preview)
    const applyBtn = toolbar.querySelector('[data-detail-apply]');
    if (applyBtn && !applyBtn.disabled) {
      applyBtn.addEventListener('click', () => {
        selectTheme(theme.id);
        updateCollectionActiveState(theme.id);
        applyBtn.textContent = 'Active';
        applyBtn.disabled = true;
      });
    }
    const cloneBtn = toolbar.querySelector('[data-detail-clone]');
    if (cloneBtn) cloneBtn.addEventListener('click', () => openCreationDialog(theme.id));

    const editBtn = toolbar.querySelector('[data-detail-edit]');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        chrome.storage.local.set({ openOptionsTab: 'builder', openBuilderClone: theme.id });
        if (_tabsInstance) _tabsInstance.activate('builder');
      });
    }
    const exportBtn = toolbar.querySelector('[data-detail-export]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${theme.name || 'theme'}.json`; a.click();
        URL.revokeObjectURL(url);
      });
    }
    const deleteBtn = toolbar.querySelector('[data-detail-delete]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${theme.name}"? This cannot be undone.`)) return;
        await deleteCustomTheme(theme.id);
        closeDetailPanel();
        renderCollectionGrid(syncState.theme);
      });
    }
    // Share — custom dropdown menu with explicit options
    const shareBtn = toolbar.querySelector('[data-detail-share]');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _showShareMenu(shareBtn, theme);
      });
    }

    // Body: intensity pills (below preview)
    body.querySelectorAll('[data-detail-volume]').forEach(pill => {
      pill.addEventListener('click', async () => {
        const volume = pill.dataset.detailVolume;
        body.querySelectorAll('[data-detail-volume]').forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        await chrome.storage.sync.set({ effectsVolume: volume });
        syncState.effectsVolume = volume;
        // Live-update the preview effects
        const frame = document.querySelector('#optDetailPreview .editor-preview-frame');
        if (frame && theme.id) {
          const baseEffects = getSuggestedEffectsFor(theme.id);
          const scaled = (typeof applyVolume === 'function')
            ? applyVolume(baseEffects, volume)
            : baseEffects;
          applyPreviewEffects(frame, scaled, (theme.colors || {}).accent, (theme.colors || {}).background);
        }
      });
    });
  }

  // ─── Share menu (WhatsApp, Email, Copy link) ────────────────────────────

  function _showShareMenu(anchor, theme) {
    // Remove any existing share menu
    document.querySelector('.opt-share-menu')?.remove();

    const text = `Check out the "${theme.name}" theme for Salesforce Themer by Connectry!`;
    // Presets get a share page with OG meta (rich previews in iMessage/WhatsApp/Slack).
    // Custom themes fall back to the Chrome Web Store URL until we have a backend.
    const SHARE_BASE = 'https://connectry-io.github.io/salesforce-themer/share';
    const url = theme.isCustom
      ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}`
      : `${SHARE_BASE}/${theme.id}`;
    const fullText = `${text}\n${url}`;

    const menu = document.createElement('div');
    menu.className = 'opt-share-menu';
    menu.innerHTML = `
      <button class="opt-share-menu-item" data-share="whatsapp">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 0 0-6.1 10.4L1 15l3.7-.9A7 7 0 1 0 8 1z" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 4.8c.2-.4.4-.5.6-.5s.3 0 .4.1l.8 1.8c.1.1 0 .3-.1.5l-.4.5c-.1.1-.1.2 0 .4.3.5.7.9 1.2 1.2.2.1.3.1.4 0l.5-.5c.1-.1.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .5-.2 1-.6 1.3-.5.3-1.2.3-1.8 0A8 8 0 0 1 5.5 7c-.4-.8-.5-1.3-.3-1.7l.3-.5z" fill="currentColor"/></svg>
        WhatsApp
      </button>
      <button class="opt-share-menu-item" data-share="email">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 4.5L8 9l6.5-4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Email
      </button>
      <div class="opt-share-menu-sep"></div>
      <button class="opt-share-menu-item" data-share="image">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2"/><circle cx="5.5" cy="6" r="1.5" stroke="currentColor" stroke-width="1"/><path d="M1.5 11l3-3 2.5 2.5L10 8l4.5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download image
      </button>
      <button class="opt-share-menu-item" data-share="copy">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.2"/></svg>
        Copy link
      </button>
    `;

    // Position below anchor
    anchor.style.position = 'relative';
    anchor.appendChild(menu);

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-share]');
      if (!item) return;
      const type = item.dataset.share;
      if (type === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`, '_blank');
      } else if (type === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(`${theme.name} — Salesforce Themer`)}&body=${encodeURIComponent(fullText)}`;
      } else if (type === 'image') {
        shareThemeAsImage(theme);
      } else if (type === 'copy') {
        await navigator.clipboard.writeText(fullText);
        _flashToast('Link copied to clipboard');
      }
      menu.remove();
    });

    // Close on outside click
    const close = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function closeDetailPanel() {
    const panel = document.getElementById('optDetailPanel');
    if (panel) panel.hidden = true;
    document.querySelectorAll('.theme-card.is-expanded').forEach(c => c.classList.remove('is-expanded'));
    _openDetailId = null;
  }

  // Keep the detail preview open across grid re-renders as long as the
  // previewed theme still exists. Called at the top of each grid render
  // instead of the unconditional closeDetailPanel() that used to live there.
  function _preserveOrCloseDetail() {
    if (!_openDetailId) return;
    const stillExists = _findAnyThemeById(_openDetailId);
    if (!stillExists) {
      closeDetailPanel();
      return;
    }
    // Re-highlight the card after the grid rebuild paints it.
    setTimeout(() => {
      const card = document.querySelector(
        `#optMyThemesGrid .theme-card[data-theme="${_openDetailId}"], #optPresetsGrid .theme-card[data-theme="${_openDetailId}"]`,
      );
      if (card) card.classList.add('is-expanded');
    }, 0);
  }

  function _findAnyThemeById(id) {
    return getThemeById(id) || (syncState.customThemes || []).find(t => t.id === id);
  }

  function bindDetailPanelClose() {
    const btn = document.getElementById('optDetailClose');
    if (btn) btn.addEventListener('click', closeDetailPanel);
  }

  // ─── Theme Manager: Status Bar + Config Drawer ────────────────────────────

  function bindStatusBar() {
    // No-op — all controls are inline in the status bar now.
    // Scope pills, theme toggle, and follow-system are wired separately.
  }

  // ─── Theme Manager: Smart Apply (stub) ────────────────────────────────────

  function renderSmartApply() {
    const host = document.getElementById('optSmartModes');
    if (!host) return;

    const modes = [
      { id: 'rotation', name: 'Daily Rotation', desc: 'A different theme each day from your playlist',
        icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v6l4 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4"/></svg>' },
      { id: 'timeofday', name: 'Time of Day', desc: 'Light by day, dark by night — on a schedule',
        icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' },
      { id: 'weather', name: 'Weather', desc: 'Match your theme to the weather outside',
        icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 12a4 4 0 1 1 6.5-3.1A3 3 0 0 1 13 12H5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>' },
      { id: 'season', name: 'Season', desc: 'Themes that follow the calendar',
        icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1c0 3-3 5-3 8a3 3 0 0 0 6 0c0-3-3-5-3-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>' },
      { id: 'focus', name: 'Focus Mode', desc: 'A dedicated minimal theme when you need to concentrate',
        icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 3"/></svg>' },
      { id: 'reports', name: 'Reports & Dashboards', desc: 'A separate theme just for reports and dashboards — e.g. dark mode for data, light everywhere else',
        icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="3" height="8" rx="0.5" stroke="currentColor" stroke-width="1.3"/><rect x="6.5" y="3" width="3" height="11" rx="0.5" stroke="currentColor" stroke-width="1.3"/><rect x="12" y="1" width="3" height="13" rx="0.5" stroke="currentColor" stroke-width="1.3"/></svg>' },
    ];

    host.innerHTML = modes.map(m => `
      <div class="opt-smart-mode-card" data-mode="${m.id}">
        <div class="opt-smart-mode-header">
          <span class="opt-smart-mode-icon">${m.icon}</span>
          <div class="opt-smart-mode-text">
            <div class="opt-smart-mode-name">${m.name}</div>
            <div class="opt-smart-mode-desc">${m.desc}</div>
          </div>
          <label class="cx-toggle">
            <input type="checkbox" data-smart-toggle="${m.id}" disabled />
            <span class="cx-toggle-track"><span class="cx-toggle-thumb"></span></span>
          </label>
        </div>
      </div>
    `).join('');
  }

  // ─── Theme Manager: Smart Apply collapse ──────────────────────────────────

  function bindSmartApplyCollapse() {
    const toggle = document.getElementById('optSmartApplyToggle');
    const body = document.getElementById('optSmartApplyBody');
    if (!toggle || !body) return;
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      body.classList.toggle('is-collapsed', expanded);
    });
  }

  // ─── Theme Manager: Smart Apply popover ───────────────────────────────────

  function bindSmartApplyPopover() {
    const btn = document.getElementById('optSmartApplyLink');
    const popover = document.getElementById('optSmartPopover');
    if (!btn || !popover) return;

    function toggle(show) {
      const open = typeof show === 'boolean' ? show : popover.hidden;
      popover.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    document.addEventListener('click', (e) => {
      if (!popover.hidden && !popover.contains(e.target) && !btn.contains(e.target)) {
        toggle(false);
      }
    });

    const upgradeBtn = document.getElementById('optSmartUpgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        toggle(false);
        const upgradeTab = document.querySelector('[data-tab="upgrade"]');
        if (upgradeTab) upgradeTab.click();
      });
    }
  }

  // ─── Theme Manager: Share as Image ────────────────────────────────────────

  function _drawConnectryLogo(ctx, cx, cy, size) {
    const r = size * 0.29;
    const gap = size * 0.5;
    ctx.fillStyle = '#2D2D2D';
    ctx.beginPath(); ctx.arc(cx - gap, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4A6FA5';
    ctx.lineWidth = size * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - gap + r, cy); ctx.lineTo(cx + gap - r, cy); ctx.stroke();
    ctx.fillStyle = '#4A6FA5';
    ctx.beginPath(); ctx.arc(cx + gap, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  function shareThemeAsImage(theme) {
    const c = (theme.isCustom ? theme.colors : theme.colors) || {};
    const W = 1200, H = 630;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ─── Dark Connectry backdrop ──────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Dot grid
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 20; x < W; x += 28) {
      for (let y = 20; y < H; y += 28) {
        ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Accent blobs
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = c.accent || '#4a6fa5';
    ctx.beginPath(); ctx.arc(60, 60, 160, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 60, H - 60, 120, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // ─── Left: theme info ────────────────────────────────────────
    const leftX = 56;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px Inter, system-ui, sans-serif';
    ctx.fillText(theme.name, leftX, 80);

    if (theme.tagline) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '15px Inter, system-ui, sans-serif';
      const words = theme.tagline.split(' ');
      let line = '', lineY = 112;
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > 360) {
          ctx.fillText(line, leftX, lineY); line = word; lineY += 20;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, leftX, lineY);
    }

    // Palette dots
    const dotColors = [c.nav, c.accent, c.surface, c.background, c.textPrimary].filter(Boolean);
    dotColors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(leftX + i * 34 + 12, 175, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // Logo + branding
    _drawConnectryLogo(ctx, leftX + 22, H - 52, 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.fillText('Salesforce Themer', leftX + 52, H - 46);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText('Built with care by Connectry', leftX + 52, H - 28);

    // ─── Right: browser preview ──────────────────────────────────
    const pX = 430, pY = 36, pW = W - pX - 36, pH = H - 72;

    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.roundRect(pX, pY, pW, 32, [10, 10, 0, 0]); ctx.fill();
    ['#ff5f57','#ffbd2e','#28c840'].forEach((col, i) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pX+18+i*16, pY+16, 4.5, 0, Math.PI*2); ctx.fill();
    });
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.roundRect(pX+64, pY+6, 140, 20, [5,5,0,0]); ctx.fill();
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText('Salesforce | Leads', pX+74, pY+20);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    const aY = pY + 32, aH = pH - 32;
    ctx.fillStyle = c.background || '#f7f7f5';
    ctx.beginPath(); ctx.roundRect(pX, aY, pW, aH, [0,0,10,10]); ctx.fill();
    ctx.fillStyle = c.nav || '#4a6fa5'; ctx.fillRect(pX, aY, pW, 38);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ['Sales','Home','Leads','Contacts'].forEach((item, i) => { ctx.fillText(item, pX+20+i*68, aY+24); });
    ctx.fillRect(pX+20+2*68, aY+32, 40, 2.5);

    const hY = aY + 48;
    ctx.fillStyle = c.textPrimary || '#2d2d2d'; ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.fillText('Lead: John Smith', pX+24, hY+20);
    ctx.fillStyle = c.textSecondary || '#4a5568'; ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText('Senior Account Executive', pX+24, hY+36);
    ctx.fillStyle = c.buttonBrandBg || c.accent || '#4a6fa5';
    ctx.beginPath(); ctx.roundRect(pX+pW-90, hY+8, 68, 24, 5); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.fillText('Convert', pX+pW-78, hY+24);

    const sX = pX+18, sY = hY+52, sW = pW-36, sH = aH-110;
    ctx.fillStyle = c.surface || '#ffffff';
    ctx.beginPath(); ctx.roundRect(sX, sY, sW, sH, 6); ctx.fill();
    ctx.strokeStyle = c.border || '#e8e8e6'; ctx.lineWidth = 0.8; ctx.stroke();

    ['New','Working','Converted'].forEach((l, i) => {
      const px = sX+16+i*90;
      ctx.fillStyle = i<2 ? (c.accent||'#4a6fa5') : (c.surfaceAlt||'#eee');
      ctx.beginPath(); ctx.roundRect(px, sY+18, 82, 22, 11); ctx.fill();
      ctx.fillStyle = i<2 ? '#fff' : (c.textSecondary||'#4a5568');
      ctx.font = '9px Inter, system-ui, sans-serif'; ctx.fillText(l, px+(i===2?22:26), sY+32);
    });

    const tY = sY + 52;
    ctx.fillStyle = c.tabActiveColor || c.accent || '#4a6fa5'; ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText('Details', sX+16, tY+4); ctx.fillRect(sX+16, tY+8, 36, 2);
    ctx.fillStyle = c.tabInactiveColor || c.textSecondary || '#4a5568';
    ctx.fillText('Activity', sX+70, tY+4); ctx.fillText('Chatter', sX+126, tY+4);

    [['Name','John Smith'],['Email','john@example.com'],['Company','Acme Corp'],['Phone','+1 (555) 123-4567']].forEach(([l,v], i) => {
      const ry = tY+28+i*28;
      ctx.fillStyle = c.textSecondary || '#64748b'; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillText(l, sX+16, ry);
      ctx.fillStyle = l==='Email' ? (c.link||c.accent||'#4a6fa5') : (c.textPrimary||'#1e293b'); ctx.fillText(v, sX+120, ry);
    });

    // ─── Download ────────────────────────────────────────────────
    canvas.toBlob((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${theme.name || 'theme'}-salesforce-themer.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      _flashToast('Image downloaded — attach it to your message');
    }, 'image/png');
  }

  // ─── Theme Manager: Button bindings ────────────────────────────────────────

  function bindMyThemesNewBtn() {
    const btn = document.getElementById('optMyThemesNewBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (_tabsInstance) _tabsInstance.activate('builder');
    });
  }

  function bindEmptyBuilderBtn() {
    const btn = document.getElementById('optEmptyBuilderBtn');
    if (btn) btn.addEventListener('click', () => {
      if (_tabsInstance) _tabsInstance.activate('builder');
    });
    const upgradeBtn = document.getElementById('optMyThemesUpgradeBtn');
    if (upgradeBtn) upgradeBtn.addEventListener('click', () => {
      if (_tabsInstance) _tabsInstance.activate('upgrade');
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

    updateCollectionActiveState(themeId);
    updateHeaderMeta(themeId);
    updateEffectsContextBanner();
    renderEffectsTabForActiveTheme();
    // Reflect active state in the Builder sidebar list (cheap re-render)
    renderBuilderSidebar(themeId);

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
      borderEffect: 'none', borderEffectIntensity: 'medium',
      aurora: false, auroraIntensity: 'medium',
      neonFlicker: false, neonFlickerIntensity: 'medium',
      particles: false, particlesIntensity: 'medium',
      cursorTrail: false, cursorTrailIntensity: 'medium',
      backgroundPattern: 'none', backgroundPatternIntensity: 'medium',
    };
    const SUBTLE = { ...NONE, preset: 'subtle', hoverLift: true, hoverLiftIntensity: 'subtle' };
    const ALIVE = {
      ...NONE, preset: 'alive',
      hoverLift: true, hoverLiftIntensity: 'medium',
      ambientGlow: true, ambientGlowIntensity: 'medium',
      borderEffect: 'shimmer', borderEffectIntensity: 'medium',
    };
    const IMMERSIVE = {
      ...NONE, preset: 'immersive',
      hoverLift: true, hoverLiftIntensity: 'strong',
      ambientGlow: true, ambientGlowIntensity: 'strong',
      borderEffect: 'gradient', borderEffectIntensity: 'strong',
      cursorTrail: true, cursorTrailIntensity: 'medium',
    };
    const MAP = {
      'connectry': SUBTLE,
      'connectry-dark': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'subtle' },
      'slate': SUBTLE,
      'tron': { ...IMMERSIVE, neonFlicker: true, neonFlickerIntensity: 'strong', ambientGlow: true, ambientGlowIntensity: 'strong' },
      'obsidian': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'subtle' },
      'graphite': SUBTLE,
      'arctic': { ...ALIVE, aurora: true, auroraIntensity: 'medium', particles: 'snow', particlesIntensity: 'medium' },
      'sakura': { ...SUBTLE, borderEffect: 'shimmer', borderEffectIntensity: 'subtle' },
      'boardroom': SUBTLE,
      'carbon': SUBTLE,
      'nord': { ...SUBTLE, aurora: true, auroraIntensity: 'subtle' },
      'high-contrast': NONE,
      'dracula': { ...SUBTLE, ambientGlow: true, ambientGlowIntensity: 'medium', borderEffect: 'shimmer', borderEffectIntensity: 'medium' },
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

    // Update header to show both themes or single theme
    updateHeaderMeta(syncState.theme);
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

  // ─── Theme Application card collapse toggle ──────────────────────────────

  const OPT_SETTINGS_COLLAPSE_KEY = 'sft-opt-settings-collapsed';

  function bindOptSettingsCardCollapse() {
    const header = document.getElementById('optSettingsCardToggle');
    const body = document.getElementById('optSettingsCardBody');
    if (!header || !body) return;

    // Default collapsed (mirrors popup pattern)
    const stored = localStorage.getItem(OPT_SETTINGS_COLLAPSE_KEY);
    const collapsed = stored === null ? true : stored === '1';
    applyCollapse(collapsed);

    header.addEventListener('click', () => {
      const nowCollapsed = !body.classList.contains('is-collapsed');
      applyCollapse(nowCollapsed);
      try { localStorage.setItem(OPT_SETTINGS_COLLAPSE_KEY, nowCollapsed ? '1' : '0'); } catch (_) {}
    });

    function applyCollapse(c) {
      body.classList.toggle('is-collapsed', c);
      header.setAttribute('aria-expanded', String(!c));
      // Hide tooltips when collapsing
      if (c) _hideAllOptTooltips();
    }
  }

  /**
   * Reflect the current theme on/off state in the collapsed-card header.
   * Called whenever the active theme changes.
   */
  function syncOptSettingsCardStatus(activeThemeId) {
    const dot = document.getElementById('optStatusDot');
    const text = document.getElementById('optStatusText');
    if (!dot || !text) return;
    const isOn = activeThemeId && activeThemeId !== 'none';
    dot.classList.toggle('opt-status-dot--on', !!isOn);
    text.textContent = isOn ? 'Theme on' : 'Theme off';
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
  // The 4 buttons are the Volume knob: 'off' | 'subtle' | 'medium' | 'strong'.
  // They set every enabled effect on the active theme to that intensity
  // (or disable all for 'off'). Everything scales together for cohesion.
  // Free users can adjust volume; Premium can also clone themes to customize
  // individual effects in the Theme Builder.

  function bindOptEffectsPills() {
    const pills = document.querySelectorAll('#optEffectsPills .opt-scope-pill[data-effect-volume]');
    if (!pills.length) return;

    // Initial state from sync
    const activeVolume = syncState.effectsVolume || 'medium';
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
        '• Set effects volume to Medium\n' +
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
        themeScope: 'both',
        effectsVolume: 'medium',
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

  function _buildMiniSwatch(themeObj) {
    if (!themeObj?.colors) return '';
    const c = themeObj.colors;
    const four = [c.background, c.surface, c.accent, c.textPrimary].map(v => v || '#ddd');
    return `<span class="header-meta-swatch">${four.map(v => `<span style="background:${v}"></span>`).join('')}</span>`;
  }

  function _resolveThemeForMeta(id) {
    const preset = getThemeById(id);
    if (preset) return preset;
    // Custom themes store deltas (coreOverrides + advancedOverrides) on top of
    // a base preset, not a flat .colors object. Resolve it so the header
    // mini-swatch, anatomy card, etc. all see a consistent shape.
    const custom = (syncState.customThemes || []).find(t => t.id === id);
    if (!custom) return null;
    return { ...custom, colors: resolveCustomColors(custom) };
  }

  function updateHeaderMeta(activeThemeId) {
    const meta = document.getElementById('headerMeta');
    if (!meta) return;
    const devBadge = _localPremiumOverride
      ? `<span class="dev-mode-badge" title="DEV mode: Premium override is active. Disable in About tab.">DEV</span>`
      : '';

    // When auto-mode is on, show current theme with mode toggle
    if (syncState.autoMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const lightId = syncState.lastLightTheme || 'connectry';
      const darkId = syncState.lastDarkTheme || 'connectry-dark';
      const lightTheme = _resolveThemeForMeta(lightId);
      const darkTheme = _resolveThemeForMeta(darkId);
      const lightName = lightTheme ? lightTheme.name : lightId;
      const darkName = darkTheme ? darkTheme.name : darkId;

      // Show the OS-active theme prominently, with a toggle to peek at the other
      const activeTheme = prefersDark ? darkTheme : lightTheme;
      const activeName = prefersDark ? darkName : lightName;

      meta.innerHTML = `
        <span class="header-meta-active header-meta-auto-wrap">
          ${_buildMiniSwatch(activeTheme)}<strong>${Connectry.Settings.escape(activeName)}</strong>
          <span class="header-meta-mode-toggle" id="headerAutoModeToggle">
            <button class="header-mode-btn${!prefersDark ? ' is-active' : ''}" data-mode="light" title="${Connectry.Settings.escape(lightName)}">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
            <button class="header-mode-btn${prefersDark ? ' is-active' : ''}" data-mode="dark" title="${Connectry.Settings.escape(darkName)}">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M12.5 9.5A5.5 5.5 0 016.5 3.5 6.5 6.5 0 1012.5 9.5z" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
          </span>
          <span class="header-meta-auto-badge">Auto</span>
        </span>${devBadge}`;

      // Wire the toggle buttons to show the other theme's info
      meta.querySelectorAll('.header-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.mode;
          const t = mode === 'dark' ? darkTheme : lightTheme;
          const n = mode === 'dark' ? darkName : lightName;
          const swatch = meta.querySelector('.header-meta-swatch');
          const nameEl = meta.querySelector('strong');
          if (swatch && t?.colors) {
            const four = [t.colors.background, t.colors.surface, t.colors.accent, t.colors.textPrimary];
            swatch.innerHTML = four.map(v => `<span style="background:${v}"></span>`).join('');
          }
          if (nameEl) nameEl.textContent = n;
          meta.querySelectorAll('.header-mode-btn').forEach(b => b.classList.toggle('is-active', b === btn));
        });
      });
      return;
    }

    const theme = _resolveThemeForMeta(activeThemeId);
    const name = theme ? theme.name : activeThemeId;
    meta.innerHTML = `<span class="header-meta-active">${_buildMiniSwatch(theme)}<strong>${Connectry.Settings.escape(name)}</strong></span>${devBadge}`;
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
      themeScope: 'both',
      effectsVolume: 'medium',
      customThemes: [],
    });

    // One-time silent migration: deprecated 'setup'-only scope → 'both' under
    // the new toggle model (mirrors popup migration).
    if (syncState.themeScope === 'setup') {
      syncState.themeScope = 'both';
      chrome.storage.sync.set({ themeScope: 'both' }).catch(() => {});
    }

    let activeTheme = syncState.theme;
    if (syncState.autoMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = prefersDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
    }

    // Themes tab — Theme Manager
    renderCollectionGrid(activeTheme);
    bindPresetsFilterPills();
    bindStatusBar();
    renderSmartApply();
    bindSmartApplyPopover();
    bindDetailPanelClose();
    bindMyThemesNewBtn();
    bindEmptyBuilderBtn();
    renderBuilderSidebar(activeTheme);
    updateHeaderMeta(activeTheme);
    syncOptSettingsCardStatus(activeTheme);
    renderOrgList(syncState.orgThemes);
    setVersion();

    // Auto mode toggle
    const autoToggle = document.getElementById('autoModeToggle');
    autoToggle.checked = syncState.autoMode;
    autoToggle.addEventListener('change', handleAutoModeToggle);

    // Setup-scope toggle (replaces 3-pill picker — see popup.js comment block).
    // Storage stays as themeScope: 'lightning' | 'both'. Legacy 'setup'-only
    // value migrates to 'both' silently below in init.
    const scopeToggle = document.getElementById('optSetupScopeToggle');
    if (scopeToggle) {
      const currentScope = syncState.themeScope || 'lightning';
      scopeToggle.checked = currentScope === 'both' || currentScope === 'setup';
      scopeToggle.addEventListener('change', async () => {
        const scope = scopeToggle.checked ? 'both' : 'lightning';
        await chrome.storage.sync.set({ themeScope: scope });
        syncState.themeScope = scope;
      });
    }

    // Theme Application tooltips (mirror popup floating tooltip pattern)
    bindOptThemeApplicationTooltips();

    // Theme Application card collapse toggle
    bindOptSettingsCardCollapse();

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
        updateCollectionActiveState(syncState.theme);
        updateHeaderMeta(syncState.theme);
        syncOptSettingsCardStatus(syncState.theme);
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
        updateHeaderMeta(syncState.theme);
      }
      if (changes.orgThemes) {
        syncState.orgThemes = changes.orgThemes.newValue;
        renderOrgList(syncState.orgThemes);
      }
      if (changes.customThemes) {
        syncState.customThemes = changes.customThemes.newValue || [];
        renderCollectionGrid(syncState.theme);
        renderEffectsTabForActiveTheme();
      }
      if (changes.effectsVolume) {
        syncState.effectsVolume = changes.effectsVolume.newValue;
        renderEffectsTabForActiveTheme();
        // Sync the Theme Application effects volume pills
        const activeVolume = syncState.effectsVolume || 'medium';
        document.querySelectorAll('#optEffectsPills .opt-scope-pill[data-effect-volume]').forEach(p => {
          p.classList.toggle('is-active', p.dataset.effectVolume === activeVolume);
        });
      }
      if (changes.customThemes) {
        // Already handled above; ensure we re-render effects when a custom theme's snapshot changes
      }
      if (changes.themeScope) {
        syncState.themeScope = changes.themeScope.newValue;
        const scopeToggle = document.getElementById('optSetupScopeToggle');
        if (scopeToggle) {
          scopeToggle.checked = syncState.themeScope === 'both' || syncState.themeScope === 'setup';
        }
      }
    });

    // Move the editor markup from the document root into the Builder
    // tab's main column. The editor lives at the root in HTML for legacy
    // reasons (it used to be a modal-style overlay) — we mount it once
    // here so it sits inline as the right side of the Builder layout.
    _embedEditorInBuilder();

    // Initialize tabs (must happen after all content is rendered)
    if (window.Connectry && Connectry.Settings && Connectry.Settings.Tabs) {
      const tabContainer = document.querySelector('.cx-tabs');
      if (tabContainer) {
        _tabsInstance = new Connectry.Settings.Tabs(tabContainer, {
          storageKey: 'cx-themer-active-tab',
          onChange: (tabName) => {
            // When the user enters the Builder tab, make sure the editor
            // is loaded with the current active theme. The editor is now
            // embedded in the Builder layout, so this is just a state sync
            // (no show/hide).
            if (tabName === 'builder') {
              _ensureEditorLoaded();
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

    // If Builder is the active tab on first paint, prime the editor.
    // (The Tabs onChange above only fires on user-initiated switches.)
    if (document.querySelector('[data-tabpanel="builder"]:not([hidden])')) {
      _ensureEditorLoaded();
    }

    // Handoff from popup: if popup set openOptionsTab, honour it and clear
    // the flag. openBuilderClone is a follow-up flag that the popup's Clone
    // button sets to pre-load the editor with a specific theme as the base.
    try {
      const handoff = await chrome.storage.local.get({
        openOptionsTab: null,
        openBuilderClone: null,
      });
      if (handoff.openOptionsTab && _tabsInstance) {
        _tabsInstance.activate(handoff.openOptionsTab);
        await chrome.storage.local.remove('openOptionsTab');
      }
      if (handoff.openBuilderClone) {
        const targetThemeId = handoff.openBuilderClone;
        await chrome.storage.local.remove('openBuilderClone');
        // Defer one tick so the Builder tab has rendered before the editor
        // overlay opens on top of it.
        setTimeout(() => {
          if (getThemeById(targetThemeId)) {
            openCreationDialog(targetThemeId);
          }
        }, 0);
      }
      // Scroll to a specific section (e.g. Guide effects)
      const scrollTarget = await chrome.storage.local.get({ openOptionsScroll: null });
      if (scrollTarget.openOptionsScroll) {
        await chrome.storage.local.remove('openOptionsScroll');
        setTimeout(() => {
          const el = document.getElementById(scrollTarget.openOptionsScroll)
            || document.querySelector(`[data-scroll-id="${scrollTarget.openOptionsScroll}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch (_) {}

    // Bind Upgrade tab plan CTAs
    bindUpgradePlanCtas();

    // Dev panel: Easter-egg unlock + premium override toggle
    bindDevPanel();

    // Guide tab — Builder CTA button
    document.getElementById('guideBuilderCta')?.addEventListener('click', () => {
      if (_tabsInstance) _tabsInstance.activate('builder');
    });

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

    // Builder top bar: + New ▾ popover
    _bindBuilderCreateMenu();

    // Builder top bar: theme switcher dropdown
    _bindThemeSwitcher();

    // Typography controls (font picker, size presets, fine-tune sliders)
    _bindTypographyControls();

    // Favicon toggle + popout builder
    _bindFaviconToggle();
    _bindEditorFaviconPanel();

    // (Top bar Save is wired in bindEditorEvents via builderTopbarSave)

    // Builder top bar: Build with AI → toggles the right-side chat drawer
    _bindChatDrawer();
  }

  /**
   * Wire the theme switcher dropdown in the Builder top bar.
   */
  function _bindThemeSwitcher() {
    const btn = document.getElementById('builderThemeSwitcherBtn');
    const menu = document.getElementById('builderThemeSwitcherMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = menu.hidden;
      if (opening) {
        menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      } else {
        _closeThemeSwitcher();
      }
    });

    document.addEventListener('click', (e) => {
      if (menu.hidden) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      _closeThemeSwitcher();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) _closeThemeSwitcher();
    });
  }

  /**
   * Wire the AI chat drawer — right-side slide-in panel (Cursor pattern).
   * Build with AI button toggles it, ✕ closes it, Escape closes it.
   */
  function _bindChatDrawer() {
    const drawer = document.getElementById('builderChatDrawer');
    const toggleBtn = document.getElementById('editorBuildWithAiBtn');
    const closeBtn = document.getElementById('builderChatDrawerClose');
    if (!drawer || !toggleBtn) return;

    const openDrawer = () => { drawer.hidden = false; };
    const closeDrawer = () => { drawer.hidden = true; };

    toggleBtn.addEventListener('click', () => {
      if (drawer.hidden) openDrawer();
      else closeDrawer();
    });

    closeBtn?.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
    });
  }

  /**
   * Wire up the "+ New ▾" sidebar popover. The trigger toggles the menu;
   * an outside click or Escape closes it; selecting an option closes it
   * and dispatches the create action.
   */
  function _bindTopbarActions() {
    // Reset button (inside save dropdown)
    document.getElementById('topbarResetBtn')?.addEventListener('click', () => {
      if (saveDropMenu) saveDropMenu.hidden = true;
      editorState.coreOverrides = {};
      editorState.advancedOverrides = {};
      populateEditorFields();
      renderAdvancedPanel();
      updatePreview();
    });

    // Save dropdown (Export JSON)
    const saveDropBtn = document.getElementById('builderSaveDropdownBtn');
    const saveDropMenu = document.getElementById('builderSaveDropdown');
    if (saveDropBtn && saveDropMenu) {
      saveDropBtn.addEventListener('click', (e) => { e.stopPropagation(); saveDropMenu.hidden = !saveDropMenu.hidden; });
      document.addEventListener('click', (e) => {
        if (!saveDropMenu.hidden && !saveDropMenu.contains(e.target) && !saveDropBtn.contains(e.target)) saveDropMenu.hidden = true;
      });
    }

    document.getElementById('topbarExportBtn')?.addEventListener('click', () => {
      if (saveDropMenu) saveDropMenu.hidden = true;
      if (!isPremium()) { openUpgradeDialog(); return; }
      exportThemeJSON();
    });

    document.getElementById('topbarDuplicateBtn')?.addEventListener('click', () => {
      if (saveDropMenu) saveDropMenu.hidden = true;
      if (!isPremium()) { _showSaveUpgradePrompt(); return; }
      // Duplicate = forget the current id so saveCustomTheme mints a new slug
      // and keeps all current edits. Also prepend "Copy of " to the name.
      editorState.customId = null;
      const nameEl = document.getElementById('editorName');
      if (nameEl && !nameEl.value.toLowerCase().startsWith('copy of ')) {
        nameEl.value = `Copy of ${nameEl.value}`;
      }
      refreshBuilderState();
      _flashToast('Duplicated — save to keep this copy.');
    });

    document.getElementById('topbarDeleteBtn')?.addEventListener('click', async () => {
      if (saveDropMenu) saveDropMenu.hidden = true;
      if (!editorState.customId) {
        _flashToast('Nothing to delete — this draft was never saved.');
        return;
      }
      const nameEl = document.getElementById('editorName');
      const niceName = nameEl?.value || 'this theme';
      if (!confirm(`Delete "${niceName}"? This cannot be undone.`)) return;
      const deletedId = editorState.customId;
      await deleteCustomTheme(deletedId);
      // Reset the editor to a clean state on the base theme so the user isn't
      // looking at the ghost of the deleted theme's edits.
      openEditor(editorState.basedOn || 'connectry', null);
      renderCollectionGrid(syncState.theme);
      renderBuilderSidebar(syncState.theme);
      _flashToast('Theme deleted.');
    });

    // Free notice visibility
    const freeNotice = document.getElementById('builderTopbarFreeNotice');
    if (freeNotice) freeNotice.hidden = isPremium();
  }

  // ─── Builder state pill + Save button copy (Unsaved / Edited / clean) ────

  let _editorBaseline = '';

  function _serializeEditorState() {
    return JSON.stringify({
      basedOn: editorState.basedOn,
      coreOverrides: editorState.coreOverrides,
      advancedOverrides: editorState.advancedOverrides,
      effects: editorState.effects,
      typography: editorState.typography,
      name: document.getElementById('editorName')?.value || '',
      description: document.getElementById('editorDescription')?.value || '',
      favicon: _editorFaviconState,
    });
  }

  function snapshotEditorBaseline() {
    _editorBaseline = _serializeEditorState();
    refreshBuilderState();
  }

  function refreshBuilderState() {
    const pill = document.getElementById('builderStatePill');
    const saveBtn = document.getElementById('builderTopbarSave');
    if (!pill || !saveBtn) return;
    if (!editorState.active) { pill.hidden = true; return; }

    const isNew = !editorState.customId;
    const isDirty = _serializeEditorState() !== _editorBaseline;
    const pillText = pill.querySelector('.builder-state-pill-text');

    if (isNew) {
      pill.hidden = false;
      pill.dataset.state = 'unsaved';
      if (pillText) pillText.textContent = 'Unsaved';
      saveBtn.textContent = 'Save as new';
    } else if (isDirty) {
      pill.hidden = false;
      pill.dataset.state = 'edited';
      if (pillText) pillText.textContent = 'Edited';
      saveBtn.textContent = 'Save changes';
    } else {
      pill.hidden = true;
      saveBtn.textContent = 'Save & Apply';
    }
  }

  function _confirmDiscardIfDirty() {
    if (!editorState.active) return true;
    const isNew = !editorState.customId;
    const isDirty = _serializeEditorState() !== _editorBaseline;
    if (!isNew && !isDirty) return true;
    const msg = isNew
      ? 'Discard this unsaved draft?'
      : 'You have unsaved changes. Discard them?';
    return confirm(msg);
  }

  // Fire refreshBuilderState whenever the user interacts with the editor.
  // Delegated on document — cheap and captures everything without threading
  // refresh calls through every setter.
  // Ctrl+S / Cmd+S → save current theme when the Builder is active.
  // Swallows the browser's default "save page" prompt. No-op on other tabs.
  function _bindBuilderSaveHotkey() {
    window.addEventListener('keydown', (e) => {
      const isSaveKey = (e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
      if (!isSaveKey) return;
      if (!editorState?.active) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof saveCustomTheme === 'function') saveCustomTheme();
    });
  }

  function _bindBuilderDirtyTracking() {
    const handler = () => {
      if (editorState.active) refreshBuilderState();
    };
    document.addEventListener('input', handler);
    document.addEventListener('change', handler);
    // beforeunload guard: warn on tab close / reload when a draft has unsaved
    // work. Chrome ignores custom text in modern versions but still shows the
    // default "Leave site?" prompt.
    window.addEventListener('beforeunload', (e) => {
      if (!editorState.active) return;
      const isNew = !editorState.customId;
      const isDirty = _serializeEditorState() !== _editorBaseline;
      if (isNew || isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function _bindBuilderCreateMenu() {
    const trigger = document.getElementById('builderSidebarCreateBtn');
    const menu = document.getElementById('builderCreateMenu');
    if (!trigger || !menu) return;

    const closeMenu = () => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    // Click outside the menu (or its trigger) closes it
    document.addEventListener('click', (e) => {
      if (menu.hidden) return;
      if (menu.contains(e.target) || trigger.contains(e.target)) return;
      closeMenu();
    });

    // Escape closes the menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) closeMenu();
    });

    // Clone picker sub-panel
    const clonePicker = document.getElementById('builderClonePicker');
    const cloneGrid = document.getElementById('builderClonePickerGrid');

    // Scratch picker sub-panel — SF baselines + Blank
    const scratchPicker = document.getElementById('builderScratchPicker');

    function populateScratchPicker() {
      const grid = document.getElementById('builderScratchPickerGrid');
      if (!grid || grid.children.length > 0) return;

      function addScratchBadge(id, name, desc, category, colors) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'builder-clone-badge';
        btn.dataset.scratchTheme = id;
        btn.dataset.category = category || 'light';
        btn.title = desc;
        const c = colors || {};
        const swatchColors = [c.background || '#ddd', c.accent || '#ddd', c.textPrimary || '#ddd'];
        btn.innerHTML = `
          <span class="builder-clone-badge-swatch">${swatchColors.map(col => `<span style="background:${col}"></span>`).join('')}</span>
          <span>${Connectry.Settings.escape(name)}</span>
        `;
        btn.addEventListener('click', () => {
          closeMenu();
          if (scratchPicker) scratchPicker.hidden = true;
          _pendingCreateEffects = getSuggestedEffectsFor(id);
          openEditor(id, null);
        });
        grid.appendChild(btn);
      }

      // SF baselines (role === 'template')
      for (const theme of THEMES) {
        if (theme.role !== 'template') continue;
        addScratchBadge(theme.id, theme.name, theme.tagline || '', theme.category, theme.colors);
      }
      // Blank = Connectry baseline (the previous "From scratch" behavior)
      const connectry = getThemeById('connectry');
      if (connectry) {
        addScratchBadge('connectry', 'Blank (Connectry)', 'Connectry default palette', 'light', connectry.colors);
      }
    }

    function populateClonePicker() {
      const standardGrid = document.getElementById('builderCloneStandardGrid');
      const customGrid = document.getElementById('builderCloneCustomGrid');
      const customSection = document.getElementById('builderCloneCustom');
      if (!standardGrid) return;
      if (standardGrid.children.length > 0) return; // already populated

      function addCloneBadge(grid, id, name, category, colors, isCustom) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'builder-clone-badge';
        btn.dataset.cloneTheme = id;
        btn.dataset.category = category || 'light';
        const c = colors || {};
        const swatchColors = [c.background || '#ddd', c.accent || '#ddd', c.textPrimary || '#ddd'];
        btn.innerHTML = `
          <span class="builder-clone-badge-swatch">${swatchColors.map(col => `<span style="background:${col}"></span>`).join('')}</span>
          <span>${Connectry.Settings.escape(name)}</span>
        `;
        btn.addEventListener('click', () => {
          closeMenu();
          if (clonePicker) clonePicker.hidden = true;
          if (isCustom) {
            const customs = syncState.customThemes || [];
            const ct = customs.find(t => t.id === id);
            if (ct) { openEditor(ct.basedOn, ct); }
          } else {
            _pendingCreateEffects = getSuggestedEffectsFor(id);
            openEditor(id, null);
          }
        });
        grid.appendChild(btn);
      }

      // Standard (preset) themes — skip Builder templates (SF baselines),
      // those are surfaced via the "From scratch" picker only.
      for (const theme of THEMES) {
        if (theme.role === 'template') continue;
        addCloneBadge(standardGrid, theme.id, theme.name, theme.category, theme.colors, false);
      }

      // Custom themes
      const customs = syncState.customThemes || [];
      if (customs.length && customGrid && customSection) {
        customSection.hidden = false;
        for (const ct of customs) {
          const base = getThemeById(ct.basedOn);
          const resolved = base ? { ...base.colors, ...ct.coreOverrides } : ct.coreOverrides;
          const cat = ct.category || (base ? base.category : 'light');
          addCloneBadge(customGrid, ct.id, ct.name, cat, resolved, true);
        }
      }

      // Tab filtering
      clonePicker.querySelectorAll('.builder-clone-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const filter = tab.dataset.filter;
          clonePicker.querySelectorAll('.builder-clone-tab').forEach(t => t.classList.toggle('is-active', t === tab));
          // Show/hide badges based on category
          clonePicker.querySelectorAll('.builder-clone-badge').forEach(badge => {
            if (filter === 'all') { badge.hidden = false; return; }
            badge.hidden = badge.dataset.category !== filter;
          });
        });
      });
    }

    // Menu items
    menu.querySelectorAll('.builder-create-menu-item[data-startfrom]').forEach(item => {
      item.addEventListener('click', (e) => {
        const which = item.dataset.startfrom;

        if (which === 'clone') {
          // Toggle the clone picker sub-panel instead of closing the menu
          e.stopPropagation();
          populateClonePicker();
          if (scratchPicker) scratchPicker.hidden = true;
          if (clonePicker) clonePicker.hidden = !clonePicker.hidden;
          return;
        }

        if (which === 'manual') {
          // Toggle the scratch picker — user picks an SF baseline or Blank
          e.stopPropagation();
          populateScratchPicker();
          if (clonePicker) clonePicker.hidden = true;
          if (scratchPicker) scratchPicker.hidden = !scratchPicker.hidden;
          return;
        }

        closeMenu();
        if (clonePicker) clonePicker.hidden = true;
        if (scratchPicker) scratchPicker.hidden = true;
        if (which === 'import') {
          if (!isPremium()) { openUpgradeDialog(); return; }
          document.getElementById('editorImportFile')?.click();
          return;
        }
        // AI / brand-guide / URL — all Premium
        openUpgradeDialog();
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

  /**
   * Auto-classify a theme as 'light' or 'dark' based on the WCAG relative
   * luminance of its background color. Returns null if the input can't be
   * parsed (caller should fall back to the user's colorScheme dropdown).
   *
   * Threshold of 0.5 is the standard split — anything brighter is "light",
   * anything darker is "dark". This is the same heuristic OS dark-mode
   * detection uses.
   */
  function _detectThemeCategory(bgColor) {
    const c = _pc(bgColor);
    if (!c) return null;
    const srgb = (v) => {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * srgb(c.r) + 0.7152 * srgb(c.g) + 0.0722 * srgb(c.b);
    return L < 0.5 ? 'dark' : 'light';
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
    typography: defaultTypography(),
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

  /**
   * One-time DOM move: relocate #editorView from the document root into
   * the Builder tab's main column. The HTML still lives at the root for
   * legacy reasons (it used to be a fixed-overlay modal). We mount it
   * once at init so it sits inline as the Builder's right column.
   */
  function _embedEditorInBuilder() {
    const editor = document.getElementById('editorView');
    const main = document.getElementById('builderMain');
    if (!editor || !main) return;
    if (editor.parentElement === main) return; // already mounted
    main.appendChild(editor);
    // The editor is always visible inside the Builder tab now.
    editor.hidden = false;
  }

  /**
   * Ensure the editor is loaded with the user's currently active theme
   * (or a sensible default). Called on Builder tab activation and on
   * first paint if Builder is the landing tab. Idempotent — if a custom
   * theme is already loaded that the user might be editing, we don't
   * clobber it.
   */
  function _ensureEditorLoaded() {
    // Don't trample an in-progress edit
    if (editorState.active && editorState.basedOn) return;

    const activeId = (syncState.theme && syncState.theme !== 'none') ? syncState.theme : 'connectry';
    const customs = syncState.customThemes || [];
    const customMatch = customs.find(c => c.id === activeId);
    if (customMatch) {
      openEditor(customMatch.basedOn, customMatch);
    } else {
      openEditor(activeId, null);
    }
  }

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
      const descEl = document.getElementById('editorDescription');
      if (descEl) descEl.value = customTheme.description || '';
      editorState.typography = customTheme.typography
        ? { ...defaultTypography(), ...customTheme.typography }
        : defaultTypography();
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
      const descEl = document.getElementById('editorDescription');
      if (descEl) descEl.value = base?.description ? base.description : '';
      editorState.typography = defaultTypography();
    }

    // Load favicon state from custom theme or base theme defaults
    _loadEditorFaviconState(customTheme);

    // The editor is permanently embedded in the Builder layout — no
    // show/hide needed. Just make sure the Builder tab is the visible
    // one in case the caller didn't switch first (popup handoff path
    // does, but in-page calls might not).
    if (_tabsInstance) {
      _tabsInstance.activate('builder');
    }

    // Update free preview notice in top bar
    const freeNotice = document.getElementById('builderTopbarFreeNotice');
    if (freeNotice) freeNotice.hidden = isPremium();

    // Always start on the Colors sub-tab
    switchEditorSubtab('colors');

    populateEditorFields();
    renderAdvancedPanel();
    populateTypographyUI();
    updatePreview();

    // Sync the top bar theme switcher trigger — the swatch + name need
    // to reflect whatever we just loaded into the editor.
    _updateThemeSwitcherTrigger();

    // Snapshot the baseline so dirty-tracking knows what "unchanged" means
    // for this editing session.
    snapshotEditorBaseline();
  }

  /**
   * Clear the editor's "in-progress edit" flag so the next Builder tab
   * activation re-syncs to whatever the active theme is. The editor
   * markup itself stays mounted and visible — closing now means "I'm
   * done editing this theme," not "hide the UI."
   */
  function closeEditor() {
    editorState.active = false;
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

    // Use shared color-binding function
    applyPreviewColors(frame, full);

    // Apply typography to preview
    applyEditorPreviewTypography();

    // Apply effects (CSS-driven, sandboxed to the preview frame)
    applyEditorPreviewEffects();

    // Update the live mini theme card in the editor header
    updateMiniCard(full);
  }

  function updateMiniCard(full) {
    const card = document.getElementById('editorMiniCard');
    if (!card || !full) return;

    // Swatch — 4 color bars (uses .theme-swatch class now)
    const swatch = card.querySelector('.theme-swatch');
    if (swatch) {
      const four = [full.background, full.surface, full.accent, full.textPrimary];
      swatch.innerHTML = four.map(c => `<span style="background:${c || '#ddd'}"></span>`).join('');
    }
    // Category badge
    const badge = document.getElementById('editorCategoryBadge');
    if (badge) {
      const cat = _detectThemeCategory(full.background) || 'light';
      badge.textContent = cat === 'dark' ? 'Dark' : 'Light';
      badge.className = `theme-category-badge ${cat}`;
    }
    // Effect pills
    const effectsEl = document.getElementById('editorMiniEffects');
    if (effectsEl) {
      effectsEl.innerHTML = buildEffectIndicators(editorState.effects || {});
    }
    // Favicon dot next to name
    const faviconDot = document.getElementById('editorCardFaviconDot');
    if (faviconDot && full) {
      faviconDot.innerHTML = _connectryDotSvg(full.accent);
    }
    // Typography hint — Aa rendered in actual font + "FontName · Size · LH/LS"
    const typeIcon = document.querySelector('#editorMiniCard .theme-card-type-icon');
    const typeHint = document.getElementById('editorMiniTypeHint');
    if (typeHint) {
      const t = editorState.typography || {};
      const fontLabel = { 'system-ui': 'System Default', 'neo-grotesque': 'Neo-Grotesque', 'humanist': 'Humanist', 'geometric': 'Geometric', 'classic-serif': 'Classic Serif', 'ibm-plex': 'IBM Plex Sans' }[t.fontFamily] || 'System Default';
      const sizeLabels = { compact: 'Sm', normal: 'Md', comfortable: 'Lg', large: 'XL' };
      const sizeLabel = sizeLabels[t.sizePreset || 'normal'] || 'Md';
      const lh = t.lineHeight || 1.375;
      const ls = t.letterSpacing || 0;
      const lsStr = ls === 0 ? '0' : String(ls);
      typeHint.textContent = `${fontLabel} · ${sizeLabel} · ${lh}/${lsStr}`;
      if (typeIcon) {
        const stack = FONT_STACKS[t.fontFamily] || FONT_STACKS['system-ui'];
        typeIcon.style.fontFamily = t.fontFamily !== 'system-ui' ? stack : '';
      }
    }
  }

  function applyEditorPreviewTypography() {
    const frame = document.getElementById('editorPreview');
    if (!frame) return;
    const t = editorState.typography;
    const bodyStack = FONT_STACKS[t.fontFamily] || FONT_STACKS['system-ui'];
    const headingStack = t.fontFamilyHeading ? (FONT_STACKS[t.fontFamilyHeading] || bodyStack) : bodyStack;
    const scale = t.sizeScale || 1.0;

    // Body styles on the frame container
    frame.style.fontFamily = t.fontFamily !== 'system-ui' ? bodyStack : '';
    frame.style.letterSpacing = t.letterSpacing ? t.letterSpacing + 'em' : '';
    frame.style.lineHeight = t.lineHeight !== 1.375 ? t.lineHeight : '';
    frame.style.fontWeight = t.weightBody !== 400 ? t.weightBody : '';

    // Size scaling — preview uses hardcoded px values so we need to
    // set a CSS custom property and override each text tier individually.
    // Using CSS zoom on the frame's inner content is the cleanest way
    // to scale all text proportionally without breaking layout.
    frame.style.setProperty('--typo-scale', scale);
    // Apply scaled font-sizes to the key text tiers
    const tiers = [
      { sel: '.preview-header-title', base: 16 },
      { sel: '.preview-header-meta', base: 12 },
      { sel: '.preview-topbar-search', base: 10 },
      { sel: '.preview-nav-app', base: 13 },
      { sel: '.preview-nav-item', base: 12 },
      { sel: '.preview-highlight-label', base: 10 },
      { sel: '.preview-highlight-value', base: 12 },
      { sel: '.preview-tab, .preview-tab-active', base: 12 },
      { sel: '.preview-field-label', base: 11 },
      { sel: '.preview-field-value', base: 12 },
      { sel: '.preview-btn-neutral, .preview-btn-brand', base: 12 },
      { sel: '.preview-related-row-header', base: 11 },
      { sel: '.preview-related-title', base: 13 },
      { sel: '.preview-toast-text', base: 12 },
    ];
    for (const { sel, base } of tiers) {
      frame.querySelectorAll(sel).forEach(el => {
        el.style.fontSize = scale !== 1.0 ? `${(base * scale).toFixed(1)}px` : '';
      });
    }

    // Headings (record title in the preview)
    const title = frame.querySelector('.preview-header-title');
    if (title) {
      title.style.fontFamily = t.fontFamilyHeading ? headingStack : '';
      title.style.fontWeight = t.weightHeading !== 700 ? t.weightHeading : '';
    }
  }

  /**
   * Push the editor's effect state into CSS custom properties + data
   * attributes on the preview frame. Sandboxed CSS rules under
   * `.editor-preview-frame[data-fx-X]` then animate the preview live
   * without touching the real engine or storage.
   *
   * Only the visually-clean effects are mirrored here (hoverLift,
   * ambientGlow, borderShimmer, gradientBorders, neonFlicker, aurora).
   * Particles + cursor trail + background patterns stay engine-only —
   * they're either canvas-based or full-page.
   */
  function applyEditorPreviewEffects() {
    const frame = document.getElementById('editorPreview');
    if (!frame) return;
    const effects = editorState.effects || {};
    const full = getFullEditorTheme();
    // Delegate to the shared effects function
    applyPreviewEffects(frame, effects, full.accent, full.background);
  }

  // ─── Event Binding ────────────────────────────────────────────────────────

  function bindEditorEvents() {
    // Cursor trail: move the glow dot to follow the mouse inside the preview
    const previewFrame = document.getElementById('editorPreview');
    const trailDot = document.getElementById('previewCursorTrail');
    if (previewFrame && trailDot) {
      previewFrame.addEventListener('mousemove', (e) => {
        const rect = previewFrame.getBoundingClientRect();
        trailDot.style.left = (e.clientX - rect.left) + 'px';
        trailDot.style.top = (e.clientY - rect.top) + 'px';
      });
    }

    // Color scheme dropdown
    document.getElementById('editorColorScheme')?.addEventListener('change', (e) => {
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

    // Save button (may live in editor card OR top bar — wire both)
    document.getElementById('editorSaveBtn')?.addEventListener('click', saveCustomTheme);
    document.getElementById('builderTopbarSave')?.addEventListener('click', saveCustomTheme);

    // Top bar actions — Reset, Save dropdown, free notice
    _bindTopbarActions();
    _bindBuilderDirtyTracking();
    _bindBuilderSaveHotkey();

    document.getElementById('editorImportFile')?.addEventListener('change', importThemeJSON);

    // Create theme button (legacy hidden host)
    document.getElementById('createThemeBtn')?.addEventListener('click', () => {
      openEditor('connectry', null);
    });

    // Editor sub-tabs (Colors / Effects / Type) —
    // horizontal bar at the top of the editor content area
    document.querySelectorAll('.editor-subtab[data-editor-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled || btn.classList.contains('is-disabled')) return;
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
    const typePanel = document.getElementById('editorTypePanel');
    const faviconPanel = document.getElementById('editorFaviconPanel');
    if (!colorsPanel || !effectsPanel) return;

    colorsPanel.hidden = target !== 'colors';
    effectsPanel.hidden = target !== 'effects';
    if (typePanel) typePanel.hidden = target !== 'type';
    if (faviconPanel) faviconPanel.hidden = target !== 'favicon';

    document.querySelectorAll('.editor-subtab[data-editor-subtab]').forEach(b => {
      const active = b.dataset.editorSubtab === target;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });

    if (target === 'effects') {
      renderEditorEffectsGrid();
    }
    if (target === 'favicon') {
      _bindEditorFaviconPanel();
      _syncEditorFaviconControls();
    }
  }

  // ─── Typography controls ───────────────────────────────────────────────────

  function populateTypographyUI() {
    const t = editorState.typography;
    const el = (id) => document.getElementById(id);

    // Font family dropdowns
    const ff = el('editorTypeFontFamily');
    if (ff) ff.value = t.fontFamily;
    const ffh = el('editorTypeFontFamilyHeading');
    if (ffh) ffh.value = t.fontFamilyHeading || '';

    // Size presets
    document.querySelectorAll('#editorTypeSizePresets .editor-type-preset').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.preset === t.sizePreset);
    });

    // Weight/spacing controls
    const wb = el('editorTypeWeightBody');
    if (wb) wb.value = String(t.weightBody);
    const wh = el('editorTypeWeightHeading');
    if (wh) wh.value = String(t.weightHeading);
    const lh = el('editorTypeLineHeight');
    if (lh) { lh.value = t.lineHeight; el('editorTypeLineHeightValue').textContent = t.lineHeight; }
    const ls = el('editorTypeLetterSpacing');
    if (ls) { ls.value = t.letterSpacing; el('editorTypeLetterSpacingValue').textContent = t.letterSpacing + 'em'; }
  }

  // ─── Favicon toggle ─────────────────────────────────────────────────────

  async function _bindFaviconToggle() {
    // New UI: "Use standard Salesforce cloud favicon" (inverted semantics).
    // Checked = SF default → customization controls greyed out.
    // Unchecked = custom theme favicon → controls active.
    const useDefault = document.getElementById('editorFaviconUseDefault');
    const toggle = document.getElementById('editorFaviconToggle'); // hidden mirror
    const slot = document.getElementById('editorFaviconSlot');
    if (!useDefault || !toggle || !slot) return;

    const applyUiState = (customEnabled) => {
      useDefault.checked = !customEnabled;
      toggle.checked = customEnabled;
      slot.classList.toggle('is-off', !customEnabled);
      _updatePreviewFavicon(customEnabled);
      _updateFaviconPanelDisabled(!customEnabled);
      _updateEditorFaviconPreview();
    };

    const { faviconEnabled = true } = await chrome.storage.sync.get('faviconEnabled');
    applyUiState(faviconEnabled);

    useDefault.addEventListener('change', async () => {
      const customEnabled = !useDefault.checked;
      await chrome.storage.sync.set({ faviconEnabled: customEnabled });
      applyUiState(customEnabled);
      try {
        const tabs = await chrome.tabs.query({
          url: ['https://*.lightning.force.com/*', 'https://*.my.salesforce.com/*', 'https://*.salesforce.com/*'],
        });
        for (const tab of tabs) {
          if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'setFavicon', enabled: customEnabled }).catch(() => {});
        }
      } catch (_) {}
    });
  }

  function _updateFaviconPanelDisabled(useDefault) {
    const panel = document.getElementById('editorFaviconPanel');
    if (!panel) return;
    // Grey out every customization group except the toggle row itself.
    panel.querySelectorAll('.editor-group').forEach((group, i) => {
      // First group holds the toggle; keep it active.
      if (i === 0) return;
      group.classList.toggle('is-disabled', useDefault);
      group.querySelectorAll('input, button, textarea, select').forEach(el => { el.disabled = useDefault; });
    });
  }

  function _updatePreviewFavicon(_enabled) {
    // The tab favicon renders fully opaque in both states — the visual
    // difference is already carried by the glyph itself (user's design vs
    // the SF blue cloud). Fading to 30% made the SF cloud look washed out.
    const tabFav = document.getElementById('previewBrowserTabFav');
    if (tabFav) tabFav.style.opacity = '';
  }

  // ─── Favicon panel (Builder sub-tab) ───────────────────────────────────────

  let _editorFaviconState = { shape: 'circle', color: '#4A6FA5', icon: 'connectry', iconColor: '#ffffff' };
  let _editorFaviconBound = false;

  function _bindEditorFaviconPanel() {
    if (_editorFaviconBound) return;
    _editorFaviconBound = true;

    // Populate icon grid (reuses .guide-favicon-icon-btn styling from Guide)
    const iconGrid = document.getElementById('editorFaviconIconGrid');
    if (iconGrid && !iconGrid.children.length) {
      for (const icon of FAVICON_ICONS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `guide-favicon-icon-btn${icon.id === 'connectry' ? ' is-active' : ''}`;
        b.dataset.icon = icon.id;
        b.title = icon.label;
        b.innerHTML = _renderFaviconSVG('circle', '#4A6FA5', icon.id, 22);
        b.addEventListener('click', () => {
          _editorFaviconState.icon = icon.id;
          iconGrid.querySelectorAll('.guide-favicon-icon-btn').forEach(x => x.classList.toggle('is-active', x.dataset.icon === icon.id));
          _updateEditorFaviconPreview();
        });
        iconGrid.appendChild(b);
      }
    }

    // Shape buttons
    document.querySelectorAll('#editorFaviconShapes .editor-type-preset').forEach(sb => {
      sb.addEventListener('click', () => {
        _editorFaviconState.shape = sb.dataset.shape;
        document.querySelectorAll('#editorFaviconShapes .editor-type-preset').forEach(x => x.classList.toggle('is-active', x === sb));
        _updateEditorFaviconBgDisabled();
        _updateEditorFaviconPreview();
      });
    });

    _bindFaviconColorPair('editorFaviconColor', 'editorFaviconColorHex', (v) => { _editorFaviconState.color = v; });
    _bindFaviconColorPair('editorFaviconIconColor', 'editorFaviconIconColorHex', (v) => { _editorFaviconState.iconColor = v; });

    _updateEditorFaviconBgDisabled();
    _updateEditorFaviconPreview();
  }

  function _bindFaviconColorPair(swatchId, hexId, set) {
    const swatch = document.getElementById(swatchId);
    const hex = document.getElementById(hexId);
    swatch?.addEventListener('input', (e) => {
      set(e.target.value);
      if (hex) hex.value = e.target.value;
      // Guide and editor both listen; call both preview fns safely.
      _updateEditorFaviconPreview?.();
      _updateGuideFaviconPreview?.();
    });
    hex?.addEventListener('input', (e) => {
      const v = (e.target.value || '').trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
      set(v);
      if (swatch) swatch.value = v;
      _updateEditorFaviconPreview?.();
      _updateGuideFaviconPreview?.();
    });
  }

  function _updateEditorFaviconBgDisabled() {
    const field = document.getElementById('editorFaviconBgField');
    if (!field) return;
    const disabled = _editorFaviconState.shape === 'none';
    field.classList.toggle('is-disabled', disabled);
    field.querySelectorAll('input').forEach(i => { i.disabled = disabled; });
  }

  function _updateEditorFaviconPreview() {
    const { shape, color, icon, iconColor } = _editorFaviconState;
    // Mini-card and hero always show the design — even if the global
    // "Replace SF cloud" toggle is off, the user is still authoring these.
    const miniIcon = document.getElementById('editorFaviconPreview');
    if (miniIcon) miniIcon.innerHTML = _renderFaviconSVG(shape, color, icon, 18, iconColor);
    const hero = document.getElementById('editorFaviconLivePreview');
    if (hero) {
      hero.innerHTML = _renderFaviconSVG(shape, color, icon, 56, iconColor);
      hero.classList.toggle('is-transparent', shape === 'none');
    }
    // The fake browser tab in the live preview represents the *actual* SF
    // tab, so if the global toggle is off it should show SF's real cloud.
    const tabFav = document.getElementById('previewBrowserTabFav');
    if (tabFav) {
      const enabled = document.getElementById('editorFaviconToggle')?.checked !== false;
      tabFav.innerHTML = enabled
        ? _renderFaviconSVG(shape, color, icon, 14, iconColor)
        : self.ConnectryFavicon.buildSVG({ shape: 'none', icon: 'cloud', iconColor: '#00A1E0' }, 14);
    }
  }

  function _loadEditorFaviconState(customTheme) {
    const defaults = { shape: 'circle', color: '#4A6FA5', icon: 'connectry', iconColor: '#ffffff' };
    if (customTheme?.favicon) {
      _editorFaviconState = { ...defaults, ...customTheme.favicon };
    } else {
      const baseId = customTheme?.basedOn || editorState.basedOn || 'connectry';
      const themeObj = getThemeById(baseId);
      _editorFaviconState = {
        ...defaults,
        color: themeObj?.colors?.accent || defaults.color,
      };
    }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('editorFaviconColor', _editorFaviconState.color);
    set('editorFaviconColorHex', _editorFaviconState.color);
    set('editorFaviconIconColor', _editorFaviconState.iconColor);
    set('editorFaviconIconColorHex', _editorFaviconState.iconColor);
    _syncEditorFaviconControls();
    _updateEditorFaviconBgDisabled();
    _updateEditorFaviconPreview();
  }

  function _syncEditorFaviconControls() {
    const { shape, icon } = _editorFaviconState;
    document.querySelectorAll('#editorFaviconShapes .editor-type-preset').forEach(b =>
      b.classList.toggle('is-active', b.dataset.shape === shape)
    );
    document.querySelectorAll('#editorFaviconIconGrid .guide-favicon-icon-btn').forEach(b =>
      b.classList.toggle('is-active', b.dataset.icon === icon)
    );
  }

  // ─── Typography controls ───────────────────────────────────────────────────

  let _typographyBound = false;
  function _bindTypographyControls() {
    if (_typographyBound) return;
    _typographyBound = true;

    const el = (id) => document.getElementById(id);

    // Font family
    el('editorTypeFontFamily')?.addEventListener('change', (e) => {
      editorState.typography.fontFamily = e.target.value;
      updatePreview();
    });
    el('editorTypeFontFamilyHeading')?.addEventListener('change', (e) => {
      editorState.typography.fontFamilyHeading = e.target.value;
      updatePreview();
    });

    // Size presets
    document.querySelectorAll('#editorTypeSizePresets .editor-type-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        editorState.typography.sizePreset = preset;
        editorState.typography.sizeScale = TYPE_SIZE_PRESETS[preset] || 1.0;
        document.querySelectorAll('#editorTypeSizePresets .editor-type-preset').forEach(b =>
          b.classList.toggle('is-active', b.dataset.preset === preset)
        );
        updatePreview();
      });
    });

    // Weight selects
    el('editorTypeWeightBody')?.addEventListener('change', (e) => {
      editorState.typography.weightBody = parseInt(e.target.value, 10);
      updatePreview();
    });
    el('editorTypeWeightHeading')?.addEventListener('change', (e) => {
      editorState.typography.weightHeading = parseInt(e.target.value, 10);
      updatePreview();
    });

    // Fine-tune: line height slider
    el('editorTypeLineHeight')?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      editorState.typography.lineHeight = v;
      el('editorTypeLineHeightValue').textContent = v;
      updatePreview();
    });

    // Fine-tune: letter spacing slider
    el('editorTypeLetterSpacing')?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      editorState.typography.letterSpacing = v;
      el('editorTypeLetterSpacingValue').textContent = v + 'em';
      updatePreview();
    });
  }

  /**
   * Render the per-effect grid inside the Theme Builder. Reads from
   * editorState.effects (the cloned theme's effects being edited) and
   * writes back to it. Free users can interact freely; the gate fires
   * on Save, not on individual edits.
   */
  /**
   * Preview HTML for each effect — small CSS-animated box that shows
   * what the effect looks like. Adapted from the Guide tab's proven
   * live previews at a smaller scale (~60×44px).
   */
  const EFFECT_PREVIEW_HTML = {
    hoverLift:       '<div class="fx-prev-card fx-prev-lift">Aa</div>',
    ambientGlow:     '<div class="fx-prev-card fx-prev-glow">Aa</div>',
    borderEffect:    '<div class="fx-prev-card fx-prev-shimmer">Aa</div>',
    aurora:          '<div class="fx-prev-aurora"></div><div class="fx-prev-card">Aa</div>',
    neonFlicker:     '<div class="fx-prev-neon">NEON</div>',
    particles:       '<div class="fx-prev-dot"></div><div class="fx-prev-dot"></div><div class="fx-prev-dot"></div><div class="fx-prev-card">Aa</div>',
    cursorTrail:     '<div class="fx-prev-trail"></div><div class="fx-prev-trail fx-prev-trail-2"></div>',
  };

  function renderEditorEffectsGrid() {
    const grid = document.getElementById('editorEffectsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const config = editorState.effects || { ...NONE_EFFECTS };

    for (const effect of EFFECT_CATALOG) {
      // String-valued effects (backgroundPattern, borderEffect) are ON when
      // their config value is a valid style, not 'none' or falsy.
      let isOn;
      if (effect.id === 'backgroundPattern') {
        isOn = !!(config[effect.id] && config[effect.id] !== 'none');
      } else if (effect.id === 'borderEffect') {
        const v = config.borderEffect
          || (config.gradientBorders ? 'gradient' : (config.borderShimmer ? 'shimmer' : 'none'));
        isOn = !!(v && v !== 'none');
      } else {
        isOn = !!config[effect.id];
      }
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

      const cursorTrailStyle = config.cursorTrailStyle || 'glow';
      const cursorTrailSelectRow = effect.id === 'cursorTrail' ? `
        <div class="effect-slider-row">
          <span class="effect-select-label">Style</span>
          <select class="effect-select" data-effect-select="cursorTrailStyle">
            <option value="glow"    ${cursorTrailStyle === 'glow'    ? 'selected' : ''}>Glow</option>
            <option value="comet"   ${cursorTrailStyle === 'comet'   ? 'selected' : ''}>Comet</option>
            <option value="sparkle" ${cursorTrailStyle === 'sparkle' ? 'selected' : ''}>Sparkle</option>
            <option value="line"    ${cursorTrailStyle === 'line'    ? 'selected' : ''}>Line</option>
          </select>
        </div>
      ` : '';

      // borderEffect style dropdown — Shimmer or Gradient (mutually exclusive).
      // Legacy booleans (borderShimmer / gradientBorders) are read as a
      // fallback so unmigrated saved configs still light up correctly.
      const _legacyBorderVal = config.gradientBorders
        ? 'gradient'
        : (config.borderShimmer ? 'shimmer' : 'shimmer');
      const borderStyle = (typeof config.borderEffect === 'string' && config.borderEffect !== 'none')
        ? config.borderEffect : _legacyBorderVal;
      const borderEffectSelectRow = effect.id === 'borderEffect' ? `
        <div class="effect-slider-row">
          <span class="effect-select-label">Style</span>
          <select class="effect-select" data-effect-select="borderEffect">
            <option value="shimmer"  ${borderStyle === 'shimmer'  ? 'selected' : ''}>Shimmer</option>
            <option value="gradient" ${borderStyle === 'gradient' ? 'selected' : ''}>Gradient</option>
          </select>
        </div>
      ` : '';

      // backgroundPattern style dropdown — 6 styles driven by engine metadata
      const bgPatternStyle = (typeof config.backgroundPattern === 'string' && config.backgroundPattern !== 'none')
        ? config.backgroundPattern : 'dotGrid';
      const backgroundPatternSelectRow = effect.id === 'backgroundPattern' ? `
        <div class="effect-slider-row">
          <span class="effect-select-label">Style</span>
          <select class="effect-select" data-effect-select="backgroundPattern">
            <option value="dotGrid"    ${bgPatternStyle === 'dotGrid'    ? 'selected' : ''}>Dot Grid</option>
            <option value="lineGrid"   ${bgPatternStyle === 'lineGrid'   ? 'selected' : ''}>Line Grid</option>
            <option value="hatch"      ${bgPatternStyle === 'hatch'      ? 'selected' : ''}>Hatch</option>
            <option value="noise"      ${bgPatternStyle === 'noise'      ? 'selected' : ''}>Noise</option>
            <option value="subway"     ${bgPatternStyle === 'subway'     ? 'selected' : ''}>Subway Tile</option>
            <option value="crosshatch" ${bgPatternStyle === 'crosshatch' ? 'selected' : ''}>Crosshatch</option>
          </select>
        </div>
      ` : '';

      const intensityButtons = ['subtle', 'medium', 'strong'].map(level => `
        <button type="button"
                class="intensity-btn${intensity === level ? ' is-active' : ''}"
                data-effect-intensity="${effect.id}"
                data-level="${level}">${_capitalize(level)}</button>
      `).join('');

      // Preview always visible (dimmed when OFF). Controls only visible when ON.
      const previewHtml = EFFECT_PREVIEW_HTML[effect.id] || '';

      card.innerHTML = `
        <div class="effect-card-row">
          <div class="effect-preview-mini" data-effect="${effect.id}">
            ${previewHtml}
          </div>
          <div class="effect-info">
            <span class="effect-name">${effect.name}</span>
            <span class="effect-short">${effect.short}</span>
          </div>
          <label class="cx-toggle">
            <input type="checkbox" data-effect-toggle="${effect.id}" ${isOn ? 'checked' : ''} />
            <span class="cx-toggle-track"><span class="cx-toggle-thumb"></span></span>
          </label>
        </div>
        ${isOn ? `<div class="effect-controls">
          <div class="effect-slider-row">
            <span class="effect-slider-label">Intensity</span>
            <div class="intensity-segmented" role="group" aria-label="Effect intensity for ${effect.name}">
              ${intensityButtons}
            </div>
          </div>
          ${particleSelectRow}
          ${cursorTrailSelectRow}
          ${backgroundPatternSelectRow}
          ${borderEffectSelectRow}
        </div>` : ''}
      `;

      // Toggle wiring
      const toggle = card.querySelector(`[data-effect-toggle="${effect.id}"]`);
      toggle?.addEventListener('change', () => {
        if (effect.id === 'particles') {
          editorState.effects.particles = toggle.checked ? (particleType || 'snow') : false;
        } else if (effect.id === 'backgroundPattern') {
          editorState.effects.backgroundPattern = toggle.checked ? bgPatternStyle : 'none';
        } else if (effect.id === 'borderEffect') {
          // Clear the deprecated booleans on first write so we don't carry
          // them forward into saves.
          delete editorState.effects.borderShimmer;
          delete editorState.effects.borderShimmerIntensity;
          delete editorState.effects.gradientBorders;
          delete editorState.effects.gradientBordersIntensity;
          editorState.effects.borderEffect = toggle.checked ? borderStyle : 'none';
        } else {
          editorState.effects[effect.id] = toggle.checked;
        }
        renderEditorEffectsGrid();
        applyEditorPreviewEffects();
        updateMiniCard(getFullEditorTheme());
      });

      // Intensity buttons
      card.querySelectorAll(`[data-effect-intensity="${effect.id}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          editorState.effects[effect.id + 'Intensity'] = btn.dataset.level;
          renderEditorEffectsGrid();
          applyEditorPreviewEffects();
          updateMiniCard(getFullEditorTheme());
        });
      });

      // Particle style select
      const pSelect = card.querySelector('[data-effect-select="particles"]');
      pSelect?.addEventListener('change', () => {
        if (editorState.effects.particles) {
          editorState.effects.particles = pSelect.value;
        }
        applyEditorPreviewEffects();
      });

      // Cursor trail style select
      const ctSelect = card.querySelector('[data-effect-select="cursorTrailStyle"]');
      ctSelect?.addEventListener('change', () => {
        editorState.effects.cursorTrailStyle = ctSelect.value;
        applyEditorPreviewEffects();
      });

      // Background pattern style select
      const bgSelect = card.querySelector('[data-effect-select="backgroundPattern"]');
      bgSelect?.addEventListener('change', () => {
        editorState.effects.backgroundPattern = bgSelect.value;
        applyEditorPreviewEffects();
      });

      // Border effect style select (shimmer | gradient)
      const beSelect = card.querySelector('[data-effect-select="borderEffect"]');
      beSelect?.addEventListener('change', () => {
        editorState.effects.borderEffect = beSelect.value;
        applyEditorPreviewEffects();
        renderEditorEffectsGrid();
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

  // Inline profanity filter — small wordlist + simple normalization. Catches
  // the obvious cases without bundling a 5KB library. Production hardening
  // (leetspeak, multilingual) can come from a backend moderation pass later.
  const PROFANITY_LIST = [
    'fuck','shit','bitch','cunt','asshole','dick','pussy','cock','bastard',
    'slut','whore','fag','faggot','nigger','nigga','retard','retarded',
    'twat','wank','wanker','jackass','douchebag','motherfucker','mf',
  ];
  function _containsProfanity(text) {
    if (!text) return false;
    const norm = String(text)
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!norm) return false;
    const words = norm.split(' ');
    for (const w of words) {
      if (PROFANITY_LIST.includes(w)) return true;
    }
    // Catch substring inside compound tokens (e.g. "fuckface" with no space)
    for (const bad of PROFANITY_LIST) {
      if (norm.includes(bad)) return true;
    }
    return false;
  }

  // 12-char url-safe slug appended to the `theme_` prefix. Matches the server
  // regex in supabase/functions/themes/index.ts.
  function _generateThemeSlug() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    let s = '';
    for (const b of bytes) s += alphabet[b % 36];
    return `theme_${s}`;
  }

  // Delete a custom theme everywhere it lives: chrome.storage.sync (so Google
  // sync propagates the removal), chrome.storage.local (cached CSS blobs), and
  // Supabase (so it doesn't reappear in the popup's remote-merge list). If
  // the deleted theme was active, fall back to 'connectry'.
  async function deleteCustomTheme(id) {
    const customs = (syncState.customThemes || []).filter(ct => ct.id !== id);
    await chrome.storage.sync.set({ customThemes: customs });
    syncState.customThemes = customs;

    try {
      await chrome.storage.local.remove([`themeCSS_${id}`, `themeCache:${id}`]);
    } catch (_) {}

    if (syncState.theme === id) {
      await selectTheme('connectry');
    }

    if (id.startsWith('theme_') && self.ConnectryIntel?.deleteTheme) {
      const owner = await self.ConnectryIntel.getAnonUserId();
      self.ConnectryIntel.deleteTheme({ slug: id, owner }).catch((err) => {
        console.warn('[Themer] Supabase deleteTheme failed:', err);
      });
    }
  }

  async function _mirrorCustomThemeToSupabase(slug, custom) {
    if (!self.ConnectryIntel?.saveTheme) return;
    // Studio renders locally via the engine loaded directly in options.html
    // (post-A2 — no more round-trip through background.js). renderTheme()
    // returns { css, faviconSvg }: both artifacts pre-rendered at save time,
    // cached to storage.local for zero-flash apply on SF tabs, and the CSS
    // mirrors to Supabase for cross-device fetch.
    const base = getThemeById(custom.basedOn);
    if (!base) {
      console.warn('[Themer] base theme not found for mirror:', custom.basedOn);
      return;
    }
    const resolvedColors = (typeof resolveCustomTheme === 'function')
      ? resolveCustomTheme(base.colors, custom.coreOverrides || {}, custom.advancedOverrides || {})
      : base.colors;
    const themeObj = {
      id: slug,
      colors: resolvedColors,
      typography: custom.typography || null,
      favicon: custom.favicon || null,
    };
    let css, faviconSvg;
    try {
      const rendered = (self.ConnectryThemer?.renderTheme || renderTheme)(themeObj);
      css = rendered.css;
      faviconSvg = rendered.faviconSvg;
    } catch (err) {
      console.warn('[Themer] renderTheme failed; skipping Supabase mirror', err);
      return;
    }
    // Cache both artifacts locally so content.js apply is zero-flash.
    try {
      await chrome.storage.local.set({
        [`themeCSS_${slug}`]: css,
        [`faviconSvg_${slug}`]: faviconSvg,
      });
    } catch (_) {}
    // Split the stored config into base_tokens (input) + overrides (post-
    // derivation tweaks). Engine treats overrides as authoritative on
    // re-render (see ARCHITECTURE.md § V2.5 design note).
    const { advancedOverrides = {}, ...rest } = custom;
    const owner = await self.ConnectryIntel.getAnonUserId();
    const result = await self.ConnectryIntel.saveTheme({
      slug,
      owner,
      name: custom.name,
      baseTokens: rest,
      overrides: advancedOverrides,
      renderedCss: css,
    });
    if (result?.error) {
      console.warn('[Themer] Supabase saveTheme returned error:', result.error);
    }
  }

  async function saveCustomTheme() {
    // V3: builder is open to all but Save is the Premium gate.
    // Show the upgrade dialog and bail without losing any in-progress edits.
    if (!isPremium()) {
      _showSaveUpgradePrompt();
      return;
    }

    const name = document.getElementById('editorName').value.trim() || 'My Custom Theme';
    const description = (document.getElementById('editorDescription')?.value || '').trim();

    // Profanity guard — names and descriptions are user-facing and may be
    // shared via marketplace later. Reject before any storage write.
    if (_containsProfanity(name) || _containsProfanity(description)) {
      _flashToast('Please pick a name and description without profanity.');
      return;
    }

    // V2.5 Migration B: new saves get a server-compatible slug
    // (`theme_<12 chars>`). Legacy `custom-<timestamp>` ids get migrated to
    // the slug format on first re-save — the old entry is dropped so we don't
    // carry two copies.
    const priorId = editorState.customId || null;
    const isLegacyId = priorId && !priorId.startsWith('theme_');
    const id = (priorId && !isLegacyId) ? priorId : _generateThemeSlug();
    const base = getThemeById(editorState.basedOn);

    // Load existing custom themes first so we can preserve existing effects on update
    let { customThemes = [] } = await chrome.storage.sync.get('customThemes');
    if (isLegacyId) {
      // Drop the legacy entry; the new slug-based one will replace it below.
      customThemes = customThemes.filter(t => t.id !== priorId);
    }
    const existing = customThemes.find(t => t.id === id);

    // Effects snapshot: prefer the live editor state (user's in-flight edits),
    // fall back to stored, staged creation effects, or base-theme suggestions.
    let effects;
    if (editorState.effects) {
      effects = editorState.effects;
    } else if (existing && existing.effects) {
      effects = existing.effects;
    } else if (_pendingCreateEffects) {
      effects = _pendingCreateEffects;
      _pendingCreateEffects = null;
    } else {
      effects = getSuggestedEffectsFor(editorState.basedOn);
    }

    // Auto-derive light/dark from the resolved background color's luminance.
    // Users shouldn't have to manually classify their custom theme — the
    // computer can read the colors and figure it out. Falls back to the
    // colorScheme dropdown if luminance can't be parsed.
    const fullEditorTheme = getFullEditorTheme();
    const autoCategory = _detectThemeCategory(fullEditorTheme.background)
      || editorState.coreOverrides.colorScheme
      || base?.colors?.colorScheme
      || 'light';

    // Only persist typography if the user changed it from defaults
    const typo = editorState.typography;
    const typoDefault = defaultTypography();
    const hasTypography = Object.keys(typo).some(k => typo[k] !== typoDefault[k]);

    const custom = {
      id,
      name,
      description,
      basedOn: editorState.basedOn,
      category: autoCategory,
      author: 'User',
      createdVia: 'manual',
      coreOverrides: { ...editorState.coreOverrides },
      advancedOverrides: { ...editorState.advancedOverrides },
      effects,
      ...(hasTypography ? { typography: { ...typo } } : {}),
      favicon: { ..._editorFaviconState },
    };

    const idx = customThemes.findIndex(t => t.id === id);
    if (idx >= 0) customThemes[idx] = custom;
    else customThemes.push(custom);

    await chrome.storage.sync.set({ customThemes });
    syncState.customThemes = customThemes;
    editorState.customId = id;

    // Apply the theme + refresh both the collection grid and the builder sidebar
    await selectTheme(id);
    renderCollectionGrid(id);
    renderBuilderSidebar(id);

    // Save succeeded — reset the dirty baseline so the pill clears and the
    // Save button reverts to "Save Theme".
    snapshotEditorBaseline();

    // V2.5 Migration B: mirror the save to Supabase so the theme can be loaded
    // on other browsers / machines and (later) published as a paid preset. The
    // Supabase write is best-effort — local save is the source of truth for
    // this session; a failure here just means the cross-device sync lags until
    // the next save. Non-blocking toast on failure.
    _mirrorCustomThemeToSupabase(id, custom).catch((err) => {
      console.warn('[Themer] Supabase theme mirror failed:', err);
    });

    // Visual feedback — topbar button flashes, toast confirms
    _flashToast(`Saved "${name}"`);
    const topbarBtn = document.getElementById('builderTopbarSave');
    if (topbarBtn) {
      const origText = topbarBtn.textContent;
      topbarBtn.textContent = 'Saved!';
      topbarBtn.classList.add('is-saved');
      setTimeout(() => {
        topbarBtn.textContent = origText;
        topbarBtn.classList.remove('is-saved');
      }, 1500);
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
    { id: 'borderEffect',    name: 'Border',            short: 'Animated card border — Shimmer or Gradient', long: 'Adds motion to card edges. Shimmer is a thin sweep of light along the top; Gradient is a rotating color ring around the perimeter. Pick one style per theme.', styles: [
      { value: 'shimmer',  label: 'Shimmer' },
      { value: 'gradient', label: 'Gradient' },
    ] },
    { id: 'aurora',          name: 'Aurora Background', short: 'Slow-moving ambient background',  long: 'A soft, slow-moving gradient glow sits behind all content. Colors derive from your theme accent.' },
    { id: 'neonFlicker',     name: 'Neon Flicker',      short: 'Glowing text with flicker',       long: 'Page titles and active navigation gain a neon text glow with occasional flicker, like a sign.' },
    { id: 'particles',       name: 'Particles',         short: 'Snow, rain, matrix, dots, embers', long: 'Animated background particles. Pick from snow, rain, matrix rain, floating dots, or rising embers.' },
    { id: 'cursorTrail',     name: 'Cursor Trail',      short: 'Light trail follows your mouse',  long: 'A short glowing trail follows your mouse pointer, fading as it goes.' },
    { id: 'backgroundPattern', name: 'Background Border', short: 'Textured frame around the page chrome', long: 'A textured frame visible at the outer edges of Salesforce, around the content canvas. Six pattern styles: dot grid, line grid, hatch, noise, subway tile, crosshatch.' },
  ];

  const NONE_EFFECTS = {
    preset: 'none',
    hoverLift: false, hoverLiftIntensity: 'medium',
    ambientGlow: false, ambientGlowIntensity: 'medium',
    borderEffect: 'none', borderEffectIntensity: 'medium',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: false, cursorTrailIntensity: 'medium',
    backgroundPattern: 'none', backgroundPatternIntensity: 'medium',
  };

  const PRESET_CONFIGS = {
    none: { ...NONE_EFFECTS, preset: 'none' },
    subtle: { ...NONE_EFFECTS, preset: 'subtle', hoverLift: true, hoverLiftIntensity: 'subtle' },
    alive: {
      ...NONE_EFFECTS, preset: 'alive',
      hoverLift: true, hoverLiftIntensity: 'medium',
      ambientGlow: true, ambientGlowIntensity: 'medium',
      borderEffect: 'shimmer', borderEffectIntensity: 'medium',
    },
    immersive: {
      ...NONE_EFFECTS, preset: 'immersive',
      hoverLift: true, hoverLiftIntensity: 'strong',
      ambientGlow: true, ambientGlowIntensity: 'strong',
      borderEffect: 'gradient', borderEffectIntensity: 'strong',
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
    const volume = syncState.effectsVolume || 'medium';
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
    const volume = syncState.effectsVolume || 'medium';

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
   * Save-time prompt for free users in the Theme Builder. V1 ships with
   * free features only — Premium (and the backend that powers Save) is
   * coming after launch. The Builder is open to everyone for preview;
   * the Save button shows this dialog explaining the situation.
   *
   * When Premium ships, this dialog will switch to a real checkout flow.
   */
  function _showSaveUpgradePrompt() {
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:12px;">Saving custom themes is a <strong>Premium</strong> feature.</p>
      <p style="margin-bottom:16px; font-size:13px; color: var(--cx-text-muted); line-height:1.6;">
        Your changes are still here in the editor — feel free to keep tweaking.
        Upgrade to Premium to save custom themes, use AI generation, brand-guide
        upload, and access the marketplace.
      </p>
    `;

    const dialog = new Connectry.Settings.Dialog({
      title: 'Saving themes requires Premium',
      body,
      actions: [
        { label: 'Keep editing', variant: 'secondary' },
        {
          label: 'Learn more',
          variant: 'primary',
          onClick: () => {
            // Jump to the Upgrade tab so the user can read about what's coming
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
   * Bind the plan CTAs on the Upgrade tab. V1 ships with the buttons
   * disabled and labeled "Premium" — there's nothing to bind. When
   * Premium ships, restore the [data-plan] attributes in HTML and have
   * this function POST to the backend to create a Stripe Checkout
   * session.
   */
  function bindUpgradePlanCtas() {
    // No-op for V1. Plan buttons are disabled in HTML.
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
        syncOptSettingsCardStatus(syncState.theme);
      // Re-render collection grid so clone button gates update too
      renderCollectionGrid(syncState.theme);
    });

    // ── Theme Diagnostic ────────────────────────────────────────────────
    const diagBtn = document.getElementById('devDiagnosticBtn');
    const diagResults = document.getElementById('devDiagnosticResults');
    if (diagBtn && diagResults) {
      diagBtn.addEventListener('click', async () => {
        diagBtn.disabled = true;
        diagBtn.textContent = 'Scanning…';
        diagResults.hidden = true;

        // Tokens to check — color tokens (SLDS 1 + 2) + typography tokens
        const colorTokens = [
          '--lwc-colorBackground', '--lwc-colorBackgroundAlt',
          '--lwc-colorTextDefault', '--lwc-colorTextLink',
          '--lwc-colorBorder', '--lwc-brandPrimary',
          '--lwc-headerColorBackground',
          '--slds-g-color-surface-1', '--slds-g-color-surface-2',
          '--slds-g-color-brand-1', '--slds-g-color-on-surface-1',
          '--slds-g-color-border-1',
        ];
        const typoTokens = [
          '--lwc-fontFamily', '--slds-g-font-family',
          '--lwc-fontSizeSmall', '--lwc-fontSizeMedium', '--lwc-fontSizeLarge',
          '--lwc-fontWeightRegular', '--lwc-fontWeightBold',
          '--lwc-lineHeightText', '--lwc-lineHeightHeading',
          '--slds-g-font-size-base', '--slds-g-font-weight-4', '--slds-g-font-weight-7',
        ];
        const allTokens = [...colorTokens, ...typoTokens];

        try {
          const tabs = await chrome.tabs.query({
            url: ['https://*.lightning.force.com/*', 'https://*.my.salesforce.com/*', 'https://*.salesforce.com/*'],
          });
          if (!tabs.length) {
            diagResults.innerHTML = '<div class="diag-summary has-issues">No Salesforce tabs found. Open a Salesforce org first.</div>';
            diagResults.hidden = false;
            diagBtn.disabled = false;
            diagBtn.textContent = 'Run Diagnostic';
            return;
          }

          const tab = tabs[0];
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'diagnose', tokens: allTokens });

          // Build results HTML
          let html = `<div style="margin-bottom:8px;"><strong>${response.url}</strong> — Theme: <code>${response.theme || 'none'}</code> — Style injected: ${response.styleInjected ? 'Yes' : 'No'} (${(response.styleLengthBytes / 1024).toFixed(1)} KB)</div>`;

          const renderSection = (title, tokens) => {
            let s = `<div class="diag-section"><div class="diag-section-title">${title}</div>`;
            let pass = 0, fail = 0;
            for (const t of tokens) {
              const val = response.tokens[t];
              const ok = val && val.length > 0;
              if (ok) pass++; else fail++;
              s += `<div class="diag-row"><span class="diag-status ${ok ? 'pass' : 'fail'}"></span><span class="diag-token">${t}</span><span class="diag-value">${val || '(empty)'}</span></div>`;
            }
            s += `</div>`;
            return { html: s, pass, fail };
          };

          const colorResult = renderSection('Color Tokens', colorTokens);
          const typoResult = renderSection('Typography Tokens', typoTokens);
          html += colorResult.html + typoResult.html;

          const totalPass = colorResult.pass + typoResult.pass;
          const totalFail = colorResult.fail + typoResult.fail;
          const allGood = totalFail === 0;
          html += `<div class="diag-summary ${allGood ? 'all-pass' : 'has-issues'}">${totalPass}/${totalPass + totalFail} tokens active${totalFail ? ` — ${totalFail} not set (may be normal for SLDS 1-only or 2-only orgs)` : ' — all tokens landing'}</div>`;

          diagResults.innerHTML = html;
          diagResults.hidden = false;
        } catch (err) {
          diagResults.innerHTML = `<div class="diag-summary has-issues">Error: ${err.message}. Make sure the Salesforce tab is fully loaded.</div>`;
          diagResults.hidden = false;
        }
        diagBtn.disabled = false;
        diagBtn.textContent = 'Run Diagnostic';
      });
    }
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
              renderCollectionGrid(syncState.theme);
            }
          },
        },
      ],
    });
    dialog.open();
  }

  /**
   * V3.1: the Effects tab is now the Guide tab (data-tabpanel="effects" is
   * kept for storage/handoff compatibility, only the visible label changed).
   * The Guide tab is purely documentation — anatomy diagram, effects gallery
   * with live previews, placeholder sections for V1 features, and a CTA
   * to open the Theme Builder. Per-effect editing lives ONLY in the Theme
   * Builder's Effects sub-tab.
   */
  function renderEffectsTabForActiveTheme() {
    renderGuideTab();
  }

  function renderGuideTab() {
    renderGuideAnatomyDiagram();
    renderGuideColorsMock();
    renderGuideEffectsGrid();
    _bindGuideTypeDemo();
    _bindGuideFaviconDemo();
  }

  /**
   * Render the sample theme card in the anatomy section. Each visible part
   * gets a `data-part="N"` attribute so the markers + callout list can
   * interactively highlight it on hover/click. Markers are now real buttons
   * with click/hover handlers — see _bindGuideAnatomyInteractions.
   *
   * Uses the user's currently active theme as the example so they recognize it.
   */
  function renderGuideAnatomyDiagram() {
    const target = document.getElementById('guideAnatomyDiagram');
    if (!target) return;
    // Resolve the actually-active theme, accounting for auto-mode
    let activeId = syncState.theme && syncState.theme !== 'none' ? syncState.theme : 'connectry';
    if (syncState.autoMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeId = prefersDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
    }
    const theme = _resolveThemeForMeta(activeId) || getThemeById('connectry');
    if (!theme) return;

    // Each data-part wraps its content and holds an .anatomy-marker as a
    // child. CSS absolute-positions the marker at the vertical center of
    // its data-part row, all on the LEFT edge of the card. Pure CSS so
    // there's no JS measuring (see feedback_themer_anatomy_pattern.md).
    //
    // NOTE: part #1 (color swatch) uses a wrapper around .theme-swatch
    // because .theme-swatch itself has overflow:hidden to clip the rounded
    // color bars — the marker would otherwise get clipped and vanish.
    //
    // Effect pills use buildEffectIndicators for the active theme so
    // the anatomy card matches the user's current theme and shows dots.
    const anatomyPills = buildEffectIndicators(theme.id);
    // Match the real theme card's typography row so the diagram example
    // mirrors what the user sees in the gallery (instead of a static
    // "System Default · Md · 1.375/0" placeholder).
    const typo = theme.typography || {};
    const typoFontKey = typo.fontFamily || 'system-ui';
    const typoFontStack = FONT_STACKS[typoFontKey] || FONT_STACKS['system-ui'];
    const FONT_LABELS_LOCAL = { 'system-ui': 'System Default', 'neo-grotesque': 'Neo-Grotesque', 'humanist': 'Humanist', 'geometric': 'Geometric', 'classic-serif': 'Classic Serif', 'ibm-plex': 'IBM Plex Sans' };
    const typoFontLabel = FONT_LABELS_LOCAL[typoFontKey] || 'System Default';
    const sizeLabels = { compact: 'Sm', normal: 'Md', comfortable: 'Lg', large: 'XL' };
    const typoSizeLabel = sizeLabels[typo.sizePreset || 'normal'] || 'Md';
    const typoLh = typo.lineHeight || 1.375;
    const typoLs = typo.letterSpacing == null ? 0 : typo.letterSpacing;
    const typoLsStr = typoLs === 0 ? '0' : String(typoLs);
    const typoLabelStr = `${typoFontLabel} · ${typoSizeLabel} · ${typoLh}/${typoLsStr}`;
    target.innerHTML = `
      <div class="guide-anatomy-card-wrap">
        <div class="theme-card is-active" style="width: 260px; cursor: default; pointer-events: none;">
          <div class="anatomy-swatch-wrap" data-part="1">
            <button type="button" class="anatomy-marker" data-marker="1" aria-label="Color swatch explainer">1</button>
            <div class="theme-swatch">${buildSwatch(theme)}</div>
          </div>
          <div class="theme-card-body">
            <div class="theme-card-header" data-part="2">
              <button type="button" class="anatomy-marker" data-marker="2" aria-label="Name, category, favicon explainer">2</button>
              <span class="anatomy-title-group">
                <span class="theme-name">${Connectry.Settings.escape(theme.name)}</span>
                <span class="anatomy-favicon-dot" title="Theme favicon (defaults to Connectry icon)">${self.ConnectryFavicon ? self.ConnectryFavicon.buildSVG({ shape: 'circle', color: theme.colors.accent, icon: 'connectry' }, 16) : _connectryDotSvg(theme.colors.accent)}</span>
              </span>
              <span class="theme-category-badge ${theme.category}">${theme.category === 'light' ? 'Light' : 'Dark'}</span>
            </div>
            <div class="theme-description" data-part="3">
              <button type="button" class="anatomy-marker" data-marker="3" aria-label="Description explainer">3</button>
              ${Connectry.Settings.escape(theme.description)}
            </div>
            <div class="anatomy-effects-row" data-part="4">
              <button type="button" class="anatomy-marker" data-marker="4" aria-label="Effect pills explainer">4</button>
              ${anatomyPills}
            </div>
            <!-- Typography row — uses the active theme's actual typography
                 so the anatomy mirrors what the user sees on real cards. -->
            <div class="guide-anatomy-placeholder-row" data-part="5">
              <button type="button" class="anatomy-marker" data-marker="5" aria-label="Typography explainer">5</button>
              <span class="guide-anatomy-placeholder-label" style="font-family:${typoFontStack}">Aa</span>
              <span class="guide-anatomy-placeholder-text">${typoLabelStr}</span>
            </div>
          </div>
          <!-- (Removed: data-part="6" theme-card-actions row + marker 6 —
               the Apply/Clone callout was retired during the V1 simplification
               since cards now Apply on click and Clone is a hover action.) -->
        </div>
      </div>
      <p class="guide-anatomy-hint">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.5 3.5l2.1 2.1M10.4 10.4l2.1 2.1M3.5 12.5l2.1-2.1M10.4 5.6l2.1-2.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Hover any number, row, or callout to highlight what it points to
      </p>
    `;

    _bindGuideAnatomyInteractions();
  }

  /**
   * Tiny inline SVG of the Connectry icon (the "dumbbell" / two-circle
   * connector mark) tinted with the theme accent. Used as the default
   * favicon dot next to the theme name in the anatomy diagram.
   */
  function _connectryDotSvg(accent) {
    const c = accent || '#4a6fa5';
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="3.5" fill="#2D2D2D"/>
      <line x1="9.5" y1="12" x2="14.5" y2="12" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="18" cy="12" r="3.5" fill="${c}"/>
    </svg>`;
  }

  /**
   * Wire the bidirectional hover/click sync between the diagram markers,
   * the highlighted card parts, and the callout list. State is held in the
   * DOM via .is-highlight classes so we don't need a separate model.
   */
  function _bindGuideAnatomyInteractions() {
    const root = document.getElementById('guideAnatomy');
    if (!root) return;

    const markers = root.querySelectorAll('.guide-anatomy-marker[data-marker]');
    const callouts = root.querySelectorAll('.guide-anatomy-callouts li[data-callout]');
    const parts = root.querySelectorAll('.guide-anatomy-card-wrap [data-part]');

    function highlight(id) {
      markers.forEach(m => m.classList.toggle('is-highlight', m.dataset.marker === id));
      callouts.forEach(c => c.classList.toggle('is-highlight', c.dataset.callout === id));
      parts.forEach(p => p.classList.toggle('is-highlight', p.dataset.part === id));
    }

    function clear() {
      markers.forEach(m => m.classList.remove('is-highlight'));
      callouts.forEach(c => c.classList.remove('is-highlight'));
      parts.forEach(p => p.classList.remove('is-highlight'));
    }

    // Markers — hover + click both highlight, click also persists until
    // the user hovers somewhere else
    markers.forEach(marker => {
      marker.addEventListener('mouseenter', () => highlight(marker.dataset.marker));
      marker.addEventListener('mouseleave', clear);
      marker.addEventListener('focus', () => highlight(marker.dataset.marker));
      marker.addEventListener('blur', clear);
      marker.addEventListener('click', () => highlight(marker.dataset.marker));
    });

    // Callouts — same pattern in reverse
    callouts.forEach(callout => {
      callout.addEventListener('mouseenter', () => highlight(callout.dataset.callout));
      callout.addEventListener('mouseleave', clear);
      callout.addEventListener('click', () => highlight(callout.dataset.callout));
    });

    // Parts — hovering the actual card section also highlights the marker
    // and the matching callout. The sample card has pointer-events:none on
    // the card itself but data-part rows override it below.
    parts.forEach(part => {
      part.addEventListener('mouseenter', () => highlight(part.dataset.part));
      part.addEventListener('mouseleave', clear);
    });
  }

  /**
   * Render the tiny SF mock for the "How a theme is built" section. Pulls
   * the active theme's 4 cardinal colors and applies them as inline CSS
   * vars on the mock root, then paints the swatch dots in the right-hand
   * callout list with the same values.
   *
   * The mock is a minimal SF chrome sketch: header strip + sidebar +
   * canvas with one card. Each visible region carries a `data-color`
   * attribute. Hover sync is wired in `_bindGuideColorsInteractions`.
   */
  function renderGuideColorsMock() {
    const target = document.getElementById('guideColorsMock');
    if (!target) return;
    const activeId = syncState.theme && syncState.theme !== 'none' ? syncState.theme : 'connectry';
    const theme = _resolveThemeForMeta(activeId) || getThemeById('connectry');
    if (!theme) return;

    const c = theme.colors;
    target.style.setProperty('--gcm-bg', c.background);
    target.style.setProperty('--gcm-surface', c.surface);
    target.style.setProperty('--gcm-accent', c.accent);
    target.style.setProperty('--gcm-text', c.textPrimary);

    // Tag every visible element with a data-color so highlight choreography
    // covers the full surface — previously only logo/tab/button had accent
    // and only the title had text, which made those highlights look like
    // "everything else greyed out". Now every line gets a colour identity:
    // sidebar items + card lines = text; non-active tabs = accent (echoing
    // the active one); etc.
    target.innerHTML = `
      <div class="gcm-header" data-color="surface">
        <span class="gcm-logo" data-color="accent"></span>
        <span class="gcm-tabs">
          <span class="gcm-tab is-active" data-color="accent"></span>
          <span class="gcm-tab" data-color="text"></span>
          <span class="gcm-tab" data-color="text"></span>
        </span>
      </div>
      <div class="gcm-body">
        <div class="gcm-sidebar" data-color="surface">
          <span class="gcm-sidebar-item" data-color="text"></span>
          <span class="gcm-sidebar-item" data-color="text"></span>
          <span class="gcm-sidebar-item" data-color="text"></span>
          <span class="gcm-sidebar-item" data-color="text"></span>
        </div>
        <div class="gcm-main" data-color="background">
          <div class="gcm-card" data-color="surface">
            <div class="gcm-card-title" data-color="text">Account name</div>
            <div class="gcm-card-line" data-color="text"></div>
            <div class="gcm-card-line short" data-color="text"></div>
            <button class="gcm-button" data-color="accent" type="button">Save</button>
          </div>
        </div>
      </div>
    `;

    // Paint the swatch dots in the right-hand callout list with the
    // active theme's colors so they match the mock 1:1.
    const callouts = document.getElementById('guideColorsCallouts');
    if (callouts) {
      const setSwatch = (key, color) => {
        const el = callouts.querySelector(`[data-color-key="${key}"]`);
        if (el) el.style.backgroundColor = color;
      };
      setSwatch('background', c.background);
      setSwatch('surface',    c.surface);
      setSwatch('accent',     c.accent);
      setSwatch('text',       c.textPrimary);
    }

    _bindGuideColorsInteractions();
  }

  /**
   * Bidirectional hover sync between the colors mock and the callout list.
   * Hover a callout (or any data-color region in the mock) → all matching
   * regions ring up, all non-matching regions dim.
   */
  function _bindGuideColorsInteractions() {
    const root = document.getElementById('guideColors');
    if (!root) return;
    const mock = document.getElementById('guideColorsMock');
    if (!mock) return;

    const callouts = root.querySelectorAll('[data-color-callout]');
    const targets = mock.querySelectorAll('[data-color]');

    function highlight(colorName) {
      mock.classList.add('is-focusing');
      callouts.forEach(c => c.classList.toggle('is-highlight', c.dataset.colorCallout === colorName));
      targets.forEach(t => t.classList.toggle('is-highlight', t.dataset.color === colorName));
    }

    function clear() {
      mock.classList.remove('is-focusing');
      callouts.forEach(c => c.classList.remove('is-highlight'));
      targets.forEach(t => t.classList.remove('is-highlight'));
    }

    callouts.forEach(callout => {
      callout.addEventListener('mouseenter', () => highlight(callout.dataset.colorCallout));
      callout.addEventListener('mouseleave', clear);
    });

    targets.forEach(target => {
      target.addEventListener('mouseenter', () => highlight(target.dataset.color));
      target.addEventListener('mouseleave', clear);
    });
  }

  /**
   * Tiny inline SVG placeholder for the favicon row in the anatomy diagram.
   * Mimics what a future curated favicon might look like (small accent dot
   * inside a circle).
   */
  function _faviconPlaceholderSvg(accent) {
    return `<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="#ffffff" stroke="#d8d8d6" stroke-width="0.5"/>
      <circle cx="8" cy="8" r="3.5" fill="${accent || '#4a6fa5'}"/>
    </svg>`;
  }

  /**
   * Render the 9 effect explainer cards (8 standard + background patterns).
   * Each card has a live CSS preview and a list of which themes ship with
   * that effect. Click jumps to the Theme Builder opened on the active theme.
   */
  const GUIDE_EFFECT_CATALOG = [
    { id: 'hoverLift',       name: 'Hover Lift',        desc: 'Cards, buttons, and list items gently float up when you hover. Modals and dropdowns are never affected.', preview: 'Hover me' },
    { id: 'ambientGlow',     name: 'Ambient Glow',      desc: 'Brand buttons, active nav items, and focused inputs gain a slow pulsing glow in your theme accent color.', preview: 'Glow' },
    { id: 'borderEffect',    name: 'Border',            desc: 'Animated card edges — Shimmer for a top-edge light sweep, or Gradient for a rotating color ring. Pick one style.', preview: 'Border',
      defaultStyle: 'shimmer',
      styles: [
        { value: 'shimmer',  label: 'Shimmer' },
        { value: 'gradient', label: 'Gradient' },
      ],
    },
    { id: 'aurora',          name: 'Aurora Background', desc: 'A soft, slow-moving gradient glow sits behind all content. Colors derive from your theme accent.', preview: '' },
    { id: 'neonFlicker',     name: 'Neon Flicker',      desc: 'Page titles and active navigation gain a neon text glow with occasional flicker, like a sign.', preview: 'NEON' },
    {
      id: 'particles',
      name: 'Particles',
      desc: 'Animated background particles. Pick a style and watch it fall.',
      preview: '',
      styles: [
        { value: 'snow',   label: 'Snow' },
        { value: 'rain',   label: 'Rain' },
        { value: 'matrix', label: 'Matrix' },
        { value: 'dots',   label: 'Floating Dots' },
        { value: 'embers', label: 'Embers' },
      ],
      defaultStyle: 'snow',
    },
    {
      id: 'cursorTrail',
      name: 'Cursor Trail',
      desc: 'A short glowing trail follows your mouse pointer, fading as it goes. Hover the preview to see it.',
      preview: 'Hover me',
      styles: [
        { value: 'glow',    label: 'Glow' },
        { value: 'comet',   label: 'Comet' },
        { value: 'sparkle', label: 'Sparkle' },
        { value: 'line',    label: 'Line' },
      ],
      defaultStyle: 'glow',
    },
    {
      id: 'backgroundPattern',
      name: 'Background Border',
      desc: 'A textured frame around the page chrome — visible at the outer edges of Salesforce, behind the content canvas. Six pattern styles.',
      preview: '',
      styles: [
        { value: 'dotGrid',    label: 'Dot Grid' },
        { value: 'lineGrid',   label: 'Line Grid' },
        { value: 'hatch',      label: 'Hatch' },
        { value: 'noise',      label: 'Noise' },
        { value: 'subway',     label: 'Subway Tile' },
        { value: 'crosshatch', label: 'Crosshatch' },
      ],
      defaultStyle: 'dotGrid',
    },
  ];

  function renderGuideEffectsGrid() {
    const grid = document.getElementById('guideEffectsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Build a reverse lookup: effect → list of themes that ship with it
    const effectToThemes = {};
    for (const t of THEMES) {
      const cfg = getSuggestedEffectsFor(t.id);
      for (const eff of GUIDE_EFFECT_CATALOG) {
        if (eff.id === 'backgroundPattern') continue; // not yet shipped per-theme
        if (cfg[eff.id]) {
          (effectToThemes[eff.id] = effectToThemes[eff.id] || []).push(t.name);
        }
      }
    }

    for (const eff of GUIDE_EFFECT_CATALOG) {
      const themeList = effectToThemes[eff.id] || [];
      const themeBlurb = themeList.length
        ? `Ships with: <strong>${themeList.slice(0, 3).join(', ')}</strong>${themeList.length > 3 ? ` and ${themeList.length - 3} more` : ''}`
        : 'New in V1 — no themes ship with this yet';

      const card = document.createElement('div');
      card.className = 'guide-effect-card';
      card.dataset.effect = eff.id;
      card.id = `guide-effect-${eff.id}`;

      // Particles preview gets a layer of 30 absolutely-positioned dots
      // that CSS animates per particle style. Built once and toggled via
      // data-style on the preview wrapper.
      const particleLayer = eff.id === 'particles'
        ? `<div class="guide-particle-layer" aria-hidden="true">${
            Array.from({ length: 30 }).map((_, i) => {
              // Pseudo-random vertical spread so the pre-animation paint
              // doesn't flash as a horizontal row at the top.
              const py = ((i * 37) % 100);
              return `<span class="guide-particle" style="--i: ${i}; --py: ${py}%;"></span>`;
            }).join('')
          }</div>`
        : '';

      // Style picker for effects that have variants (particles, background pattern)
      const stylePicker = eff.styles
        ? `<div class="guide-effect-style-row">
            <span class="guide-effect-style-label">Style:</span>
            <select class="guide-effect-style-select" data-style-select="${eff.id}">
              ${eff.styles.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
            </select>
          </div>`
        : '';

      const initialStyle = eff.defaultStyle || '';

      card.innerHTML = `
        <div class="guide-effect-preview" data-style="${initialStyle}">
          ${particleLayer}
          <div class="guide-effect-preview-card">${eff.preview}</div>
        </div>
        <div class="guide-effect-body">
          <div class="guide-effect-name">${eff.name}</div>
          <div class="guide-effect-desc">${eff.desc}</div>
          ${stylePicker}
          <div class="guide-effect-playground" data-playground="${eff.id}">
            <span class="guide-effect-playground-label">Try it:</span>
            <div class="guide-effect-playground-pills" role="radiogroup" aria-label="${eff.name} intensity">
              <button type="button" class="guide-effect-playground-pill" data-intensity="subtle">Subtle</button>
              <button type="button" class="guide-effect-playground-pill is-active" data-intensity="medium">Medium</button>
              <button type="button" class="guide-effect-playground-pill" data-intensity="strong">Strong</button>
            </div>
          </div>
          <div class="guide-effect-themes">${themeBlurb}</div>
        </div>
      `;

      // Wire the style picker dropdown — flips the data-style on the preview
      const styleSelect = card.querySelector('[data-style-select]');
      if (styleSelect) {
        styleSelect.addEventListener('change', (e) => {
          e.stopPropagation();
          const previewEl = card.querySelector('.guide-effect-preview');
          if (previewEl) previewEl.dataset.style = styleSelect.value;
          // Cursor trail: re-init JS trail with new style
          if (eff.id === 'cursorTrail') {
            const themeAccent = getThemeById(syncState.theme)?.colors?.brandPrimary || '#4a6fa5';
            _initBuilderCursorTrail(previewEl, themeAccent, styleSelect.value);
          }
          // Background pattern: re-apply engine-computed declarations
          if (eff.id === 'backgroundPattern') {
            const activePill = card.querySelector('.guide-effect-playground-pill.is-active');
            const level = activePill?.dataset.intensity || 'medium';
            _applyGuideBackgroundPattern(card, level);
          }
        });
      }

      // Cursor trail card: attach JS mouse-follow trail (reuse Builder's renderer)
      if (eff.id === 'cursorTrail') {
        const previewEl = card.querySelector('.guide-effect-preview');
        if (previewEl) {
          const themeAccent = getThemeById(syncState.theme)?.colors?.brandPrimary || '#4a6fa5';
          _initBuilderCursorTrail(previewEl, themeAccent, initialStyle || 'glow');
        }
      }

      // Apply the active theme's accent so previews match
      const theme = getThemeById(syncState.theme) || getThemeById('connectry');
      if (theme) {
        card.style.setProperty('--fx-accent', theme.colors.accent);
        card.style.setProperty('--fx-accent-rgb', _hexToRgbCsv(theme.colors.accent));
      }
      // Default playground state: medium
      _applyGuidePlaygroundIntensity(card, 'medium');

      // Intensity pills — sandbox mode: just tweak the live preview, don't
      // touch storage. Stop propagation so the card click doesn't fire.
      card.querySelectorAll('.guide-effect-playground-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const level = pill.dataset.intensity;
          card.querySelectorAll('.guide-effect-playground-pill').forEach(p => {
            p.classList.toggle('is-active', p === pill);
          });
          _applyGuidePlaygroundIntensity(card, level);
        });
      });

      // Click on the body (not the pills or style picker) → open Builder
      card.addEventListener('click', (e) => {
        if (e.target.closest('.guide-effect-playground')) return;
        if (e.target.closest('.guide-effect-style-row')) return;
        if (_tabsInstance) _tabsInstance.activate('builder');
        // Scroll to top of Builder — otherwise browser restores last scroll
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
          const fxSection = document.getElementById(`builder-effect-${eff.id}`);
          if (fxSection) fxSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });

      grid.appendChild(card);
    }
  }

  /**
   * Apply an intensity level to a Guide effect card by setting its CSS
   * custom properties. Mirrors the engine's intensity ladder so the
   * playground previews behave like the real thing.
   */
  function _applyGuidePlaygroundIntensity(card, level) {
    // Pull from core engine when available (feature flag allows legacy fallback)
    const engine = window.SFThemerEffectsEngine;
    const useEngine = engine && window.__EFFECTS_ENGINE_V2 !== false;
    const LADDER = useEngine ? engine.INTENSITY_LADDER : {
      subtle: { mult: 0.5, speed: 1.6 },
      medium: { mult: 1.0, speed: 1.0 },
      strong: { mult: 1.6, speed: 0.65 },
    };
    const v = LADDER[level] || LADDER.medium;
    card.style.setProperty('--fx-mult', String(v.mult));
    card.style.setProperty('--fx-speed-mult', String(v.speed));

    // If this card is backgroundPattern, re-derive the pattern declarations
    // from the engine so thickness+opacity scale correctly with intensity.
    const effectId = card.dataset.effect;
    if (useEngine && effectId === 'backgroundPattern') {
      _applyGuideBackgroundPattern(card, level);
    }
  }

  /**
   * Apply backgroundPattern CSS custom properties to a Guide card preview.
   * Delegates all magnitude math to core/effects/engine.js so Guide stays in
   * lock-step with Builder and Salesforce content script.
   */
  function _applyGuideBackgroundPattern(card, intensityLevel) {
    const engine = window.SFThemerEffectsEngine;
    if (!engine) return;
    const previewEl = card.querySelector('.guide-effect-preview');
    if (!previewEl) return;
    const style = previewEl.dataset.style || 'dotGrid';
    const themeAccent = (getThemeById(syncState.theme) || getThemeById('connectry'))?.colors?.accent || '#4a6fa5';
    const ir = engine.renderRules('backgroundPattern',
      { backgroundPattern: style, backgroundPatternIntensity: intensityLevel },
      themeAccent);
    const rule = ir && ir.cssRules && ir.cssRules.find(r => r.selectorRole === 'bodyWrapper');
    if (rule) {
      const d = rule.declarations;
      previewEl.style.setProperty('--fx-bg-pattern-image', d['background-image'] || 'none');
      previewEl.style.setProperty('--fx-bg-pattern-size', d['background-size'] || 'auto');
      previewEl.style.setProperty('--fx-bg-pattern-position', d['background-position'] || '0 0');
    } else {
      previewEl.style.removeProperty('--fx-bg-pattern-image');
      previewEl.style.removeProperty('--fx-bg-pattern-size');
      previewEl.style.removeProperty('--fx-bg-pattern-position');
    }
  }

  /**
   * Highlight a specific effect card in the Guide tab and scroll to it.
   * Called when a theme card pill is clicked, to deep-link the user
   * straight to the relevant explainer.
   */
  function highlightGuideEffect(effectId) {
    const card = document.getElementById(`guide-effect-${effectId}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('is-highlight');
    // Reflow then re-add so the animation replays on every click
    void card.offsetWidth;
    card.classList.add('is-highlight');
  }

  // ─── Guide: Interactive Typography demo ──────────────────────────────────

  let _guideTypeBound = false;
  function _bindGuideTypeDemo() {
    if (_guideTypeBound) return;
    _guideTypeBound = true;

    const fontSelect = document.getElementById('guideTypeFont');
    const headingFontSelect = document.getElementById('guideTypeHeadingFont');
    const headingWeightSelect = document.getElementById('guideTypeHeadingWeight');
    const bodyWeightSelect = document.getElementById('guideTypeBodyWeight');
    if (!fontSelect) return;

    function updateTypePreview() {
      const bodyKey = fontSelect.value;
      const headingKey = headingFontSelect?.value || '';
      const bodyStack = FONT_STACKS[bodyKey] || FONT_STACKS['system-ui'];
      const headingStack = headingKey ? (FONT_STACKS[headingKey] || bodyStack) : bodyStack;
      const headingWeight = headingWeightSelect?.value || '700';
      const bodyWeight = bodyWeightSelect?.value || '400';

      const activeBtn = document.querySelector('#guideTypeSizeBtns .editor-type-preset.is-active');
      const scale = activeBtn ? parseFloat(activeBtn.dataset.scale) : 1;

      const els = {
        heading: document.getElementById('guideTypeHeading'),
        meta: document.getElementById('guideTypeMeta'),
        body: document.getElementById('guideTypeBody'),
      };

      const lhSlider = document.getElementById('guideTypeLineHeight');
      const lsSlider = document.getElementById('guideTypeLetterSpacing');
      const lineHeight = lhSlider ? lhSlider.value : '1.375';
      const letterSpacing = lsSlider ? parseFloat(lsSlider.value) : 0;
      const lsStyle = letterSpacing ? letterSpacing + 'em' : '';

      const preview = document.getElementById('guideTypePreview');
      if (preview) { preview.style.lineHeight = lineHeight; preview.style.letterSpacing = lsStyle; }

      if (els.heading) { els.heading.style.fontFamily = headingStack; els.heading.style.fontSize = `${20 * scale}px`; els.heading.style.fontWeight = headingWeight; }
      if (els.meta) { els.meta.style.fontFamily = bodyStack; els.meta.style.fontSize = `${13 * scale}px`; }
      if (els.body) { els.body.style.fontFamily = bodyStack; els.body.style.fontSize = `${13 * scale}px`; els.body.style.fontWeight = bodyWeight; }

      // Update the "Reading the card" example row below the demo
      // Update stencil type row — individual spans for hover highlighting
      const exAa = document.getElementById('guideTypeExampleAa');
      const stencilRow = document.getElementById('guideTypeExampleLabel');
      if (exAa && stencilRow) {
        const fontLabels = { 'system-ui': 'System Default', 'neo-grotesque': 'Neo-Grotesque', 'humanist': 'Humanist', 'geometric': 'Geometric', 'classic-serif': 'Classic Serif', 'ibm-plex': 'IBM Plex Sans' };
        const sizePresets = { '0.9': 'Sm', '1': 'Md', '1.1': 'Lg', '1.2': 'XL' };
        const label = fontLabels[bodyKey] || 'System Default';
        const sizeLabel = sizePresets[String(scale)] || 'Md';
        const lh = parseFloat(lineHeight);
        const ls = letterSpacing;
        const lsStr = ls === 0 ? '0' : String(ls);
        exAa.style.fontFamily = bodyKey !== 'system-ui' ? bodyStack : '';
        const fontSpan = stencilRow.querySelector('[data-type-seg="font"]');
        const sizeSpan = stencilRow.querySelector('[data-type-seg="size"]');
        const spacingSpan = stencilRow.querySelector('[data-type-seg="spacing"]');
        if (fontSpan) fontSpan.textContent = label;
        if (sizeSpan) sizeSpan.textContent = sizeLabel;
        if (spacingSpan) spacingSpan.textContent = `${lh}/${lsStr}`;
      }
    }

    fontSelect.addEventListener('change', updateTypePreview);
    headingFontSelect?.addEventListener('change', updateTypePreview);
    headingWeightSelect?.addEventListener('change', updateTypePreview);
    bodyWeightSelect?.addEventListener('change', updateTypePreview);

    document.querySelectorAll('#guideTypeSizeBtns .editor-type-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#guideTypeSizeBtns .editor-type-preset').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updateTypePreview();
      });
    });

    // Spacing sliders
    const guideLineHeight = document.getElementById('guideTypeLineHeight');
    const guideLetterSpacing = document.getElementById('guideTypeLetterSpacing');
    guideLineHeight?.addEventListener('input', (e) => {
      document.getElementById('guideTypeLineHeightValue').textContent = e.target.value;
      updateTypePreview();
    });
    guideLetterSpacing?.addEventListener('input', (e) => {
      document.getElementById('guideTypeLetterSpacingValue').textContent = parseFloat(e.target.value) + 'em';
      updateTypePreview();
    });

    // ─── Interactive hover highlighting across stencil / legend / config ───
    const stencilWrap = document.getElementById('guideTypeStencilWrap');
    const editorPanel = document.getElementById('guideTypeEditor');
    if (stencilWrap && editorPanel) {
      function setHighlight(seg) {
        stencilWrap.dataset.highlight = seg;
        editorPanel.querySelectorAll('[data-type-seg]').forEach(g => {
          g.classList.toggle('is-type-highlight', g.dataset.typeSeg === seg);
        });
      }
      function clearHighlight() {
        delete stencilWrap.dataset.highlight;
        editorPanel.querySelectorAll('.is-type-highlight').forEach(g => g.classList.remove('is-type-highlight'));
      }
      // Bind all [data-type-seg] elements in stencil + legend
      stencilWrap.querySelectorAll('[data-type-seg]').forEach(el => {
        el.addEventListener('mouseenter', () => setHighlight(el.dataset.typeSeg));
        el.addEventListener('mouseleave', clearHighlight);
      });
      // Also bind config panel groups → highlight matching stencil/legend
      editorPanel.querySelectorAll('[data-type-seg]').forEach(g => {
        g.addEventListener('mouseenter', () => setHighlight(g.dataset.typeSeg));
        g.addEventListener('mouseleave', clearHighlight);
      });
    }
  }

  // ─── Guide: Interactive Favicon demo ────────────────────────────────────

  // Canonical icon library lives in core/favicon/engine.js. Alias here so
  // existing call sites don't have to change shape.
  const FAVICON_ICONS = (self.ConnectryFavicon && self.ConnectryFavicon.ICONS) || [];

  let _guideFaviconState = { shape: 'circle', color: '#4A6FA5', icon: 'connectry', iconColor: '#ffffff' };
  let _guideFaviconBound = false;

  function _updateGuideFaviconBgDisabled() {
    const field = document.getElementById('guideFaviconBgField');
    if (!field) return;
    const disabled = _guideFaviconState.shape === 'none';
    field.classList.toggle('is-disabled', disabled);
    field.querySelectorAll('input').forEach(i => { i.disabled = disabled; });
  }

  /**
   * Swap this Studio tab's OWN favicon to the preview config. Customer
   * sees the change live in the Chrome tab of the Theme Studio page they
   * are currently looking at — a cheap, honest preview.
   */
  function _applyFaviconToThisTab(config) {
    const svg = self.ConnectryFavicon.buildSVG(config, 32);
    const href = 'data:image/svg+xml;base64,' + btoa(svg);
    // Nuke any existing icon links — Chrome is sticky about the same node.
    document.querySelectorAll('link[rel*="icon"]').forEach(l => l.remove());
    const link = document.createElement('link');
    link.id = 'cx-studio-favicon';
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.setAttribute('sizes', 'any');
    link.href = href;
    document.head.appendChild(link);
  }

  // Thin pass-through to the canonical engine so existing call sites (size
  // last, positional) keep working during the monocode migration.
  function _renderFaviconSVG(shape, color, iconId, size, iconColor) {
    return self.ConnectryFavicon.buildSVG({ shape, color, icon: iconId, iconColor }, size);
  }

  function _updateGuideFaviconPreview() {
    const { shape, color, icon, iconColor } = _guideFaviconState;
    const main = document.getElementById('guideFaviconLivePreview');
    if (main) {
      main.innerHTML = _renderFaviconSVG(shape, color, icon, 128, iconColor);
      main.classList.toggle('is-transparent', shape === 'none');
    }
    const tab1 = document.getElementById('guideFaviconTabIcon1');
    if (tab1) tab1.innerHTML = _renderFaviconSVG(shape, color, icon, 12, iconColor);
    const tab2 = document.getElementById('guideFaviconTabIcon2');
    if (tab2) tab2.innerHTML = _renderFaviconSVG(shape, color, icon, 12, iconColor);
  }

  function _bindGuideFaviconDemo() {
    if (_guideFaviconBound) return;
    _guideFaviconBound = true;

    // Populate icon picker
    const iconGrid = document.getElementById('guideFaviconIconGrid');
    if (iconGrid && !iconGrid.children.length) {
      for (const icon of FAVICON_ICONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `guide-favicon-icon-btn${icon.id === 'connectry' ? ' is-active' : ''}`;
        btn.dataset.icon = icon.id;
        btn.title = icon.label;
        btn.innerHTML = _renderFaviconSVG('circle', '#4A6FA5', icon.id, 22);
        btn.addEventListener('click', () => {
          _guideFaviconState.icon = icon.id;
          iconGrid.querySelectorAll('.guide-favicon-icon-btn').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          _updateGuideFaviconPreview();
        });
        iconGrid.appendChild(btn);
      }
    }

    // Shape buttons
    document.querySelectorAll('#guideFaviconShapeBtns .editor-type-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        _guideFaviconState.shape = btn.dataset.shape;
        document.querySelectorAll('#guideFaviconShapeBtns .editor-type-preset').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        _updateGuideFaviconBgDisabled();
        _updateGuideFaviconPreview();
      });
    });

    // Color pickers (swatch + hex, mirrored). Uses the same helper as the
    // editor panel so both surfaces stay in lockstep.
    const bindGuide = (swatchId, hexId, set) => {
      const swatch = document.getElementById(swatchId);
      const hex = document.getElementById(hexId);
      swatch?.addEventListener('input', (e) => {
        set(e.target.value);
        if (hex) hex.value = e.target.value;
        _updateGuideFaviconPreview();
      });
      hex?.addEventListener('input', (e) => {
        const v = (e.target.value || '').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
        set(v);
        if (swatch) swatch.value = v;
        _updateGuideFaviconPreview();
      });
    };
    bindGuide('guideFaviconColor', 'guideFaviconColorHex', (v) => { _guideFaviconState.color = v; });
    bindGuide('guideFaviconIconColor', 'guideFaviconIconColorHex', (v) => { _guideFaviconState.iconColor = v; });
    _updateGuideFaviconBgDisabled();

    // "Preview on this tab" — swaps the Studio tab's own favicon so the
    // customer sees their design in the real Chrome tab they're already
    // looking at. Ephemeral: reload restores the default Studio favicon.
    document.getElementById('guideFaviconApplyBtn')?.addEventListener('click', () => {
      const btn = document.getElementById('guideFaviconApplyBtn');
      try {
        _applyFaviconToThisTab({ ..._guideFaviconState });
        if (btn) {
          btn.textContent = 'Previewing — reload to reset';
          btn.classList.add('is-success');
          setTimeout(() => { btn.textContent = 'Preview on this tab'; btn.classList.remove('is-success'); }, 2200);
        }
      } catch (err) {
        console.error('[themer] favicon preview failed', err);
        if (btn) {
          btn.textContent = 'Error — see console';
          btn.classList.add('is-error');
          setTimeout(() => { btn.textContent = 'Preview on this tab'; btn.classList.remove('is-error'); }, 2200);
        }
      }
    });

    // Initial render
    _updateGuideFaviconPreview();
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

      const cursorTrailStyle = config.cursorTrailStyle || 'glow';
      const cursorTrailSelectRow = effect.id === 'cursorTrail' ? `
        <div class="effect-slider-row">
          <span class="effect-select-label">Style</span>
          <select class="effect-select" data-effect-select="cursorTrailStyle" ${locked ? 'disabled' : ''}>
            <option value="glow"    ${cursorTrailStyle === 'glow'    ? 'selected' : ''}>Glow</option>
            <option value="comet"   ${cursorTrailStyle === 'comet'   ? 'selected' : ''}>Comet</option>
            <option value="sparkle" ${cursorTrailStyle === 'sparkle' ? 'selected' : ''}>Sparkle</option>
            <option value="line"    ${cursorTrailStyle === 'line'    ? 'selected' : ''}>Line</option>
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
          ${cursorTrailSelectRow}
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

        // Cursor trail style select
        const ctSelect = card.querySelector('[data-effect-select="cursorTrailStyle"]');
        ctSelect?.addEventListener('change', async () => {
          const { config: current } = resolveEffectsEditingTarget();
          const next = { ...current, preset: 'custom', cursorTrailStyle: ctSelect.value };
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

  function _parseHexRgb(hex) {
    if (!hex) return null;
    const clean = hex.replace('#', '');
    const expand = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    if (expand.length < 6) return null;
    return {
      r: parseInt(expand.slice(0, 2), 16),
      g: parseInt(expand.slice(2, 4), 16),
      b: parseInt(expand.slice(4, 6), 16),
    };
  }

  function _rgbToHslSimple(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function _hslToRgbCsv(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
  }

  // ─── Builder cursor trail (JS trail history) ─────────────────────────────
  const _builderTrailState = new WeakMap();

  function _initBuilderCursorTrail(frame, accent, style) {
    // If already initialized, tear down so we can re-init with new style/accent
    if (_builderTrailState.has(frame)) _destroyBuilderCursorTrail(frame);
    const trailPoints = [];
    const MAX_POINTS = 15;
    const container = document.createElement('div');
    container.className = 'preview-cursor-trail-container';
    container.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;overflow:hidden;';
    frame.appendChild(container);

    const rgb = _hexToRgbCsv(accent);
    const activeStyle = style || 'glow';

    // For line style, use an SVG path instead of dots
    let svg = null, pathEl = null;
    if (activeStyle === 'line') {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', `rgb(${rgb})`);
      pathEl.setAttribute('stroke-width', '3');
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathEl);
      container.appendChild(svg);
    }

    function onMove(e) {
      const rect = frame.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      trailPoints.push({ x, y, t: Date.now() });
      if (trailPoints.length > MAX_POINTS) trailPoints.shift();
      renderTrail();
    }

    function renderTrail() {
      const now = Date.now();
      const alive = trailPoints.filter(pt => (now - pt.t) / 400 < 1);
      // Read --fx-mult from nearest ancestor that has it set (pills live on card)
      const mult = parseFloat(getComputedStyle(frame).getPropertyValue('--fx-mult')) || 1;

      if (activeStyle === 'line') {
        const pts = alive.map(p => `${p.x},${p.y}`).join(' ');
        pathEl.setAttribute('points', pts);
        pathEl.setAttribute('stroke-width', String(Math.max(1, 3 * mult)));
        pathEl.setAttribute('opacity', alive.length ? String(Math.min(1, 0.5 + 0.25 * mult)) : '0');
        return;
      }

      container.querySelectorAll('.sf-trail-dot').forEach(n => n.remove());
      alive.forEach((pt, i) => {
        const age = (now - pt.t) / 400;
        const progress = i / Math.max(1, alive.length);
        const dot = document.createElement('div');
        dot.className = 'sf-trail-dot';
        if (activeStyle === 'comet') {
          const size = (3 + progress * 22) * mult;
          const opacity = (1 - age) * 0.85 * progress;
          dot.style.cssText = `position:absolute;left:${pt.x}px;top:${pt.y}px;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,rgba(${rgb},${opacity.toFixed(2)}) 0%,rgba(${rgb},${(opacity * 0.4).toFixed(2)}) 40%,transparent 80%);transform:translate(-50%,-50%);`;
        } else if (activeStyle === 'sparkle') {
          const size = (6 + progress * 8) * mult;
          const halo = size * 3;
          const opacity = (1 - age) * 0.9 * progress;
          dot.style.cssText = `position:absolute;left:${pt.x}px;top:${pt.y}px;width:${halo}px;height:${halo}px;border-radius:50%;background:radial-gradient(circle,#fff ${(size/halo*100).toFixed(0)}%,rgba(${rgb},${opacity.toFixed(2)}) ${((size*1.5)/halo*100).toFixed(0)}%,transparent 100%);transform:translate(-50%,-50%);mix-blend-mode:screen;`;
        } else {
          // glow (default)
          const size = (4 + progress * 12) * mult;
          const opacity = (1 - age) * 0.6 * progress;
          dot.style.cssText = `position:absolute;left:${pt.x}px;top:${pt.y}px;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,rgba(${rgb},${opacity.toFixed(2)}) 0%,transparent 70%);transform:translate(-50%,-50%);`;
        }
        container.appendChild(dot);
      });
    }

    frame.addEventListener('mousemove', onMove);
    _builderTrailState.set(frame, { container, onMove, interval: setInterval(renderTrail, 50) });
  }

  function _destroyBuilderCursorTrail(frame) {
    const state = _builderTrailState.get(frame);
    if (!state) return;
    frame.removeEventListener('mousemove', state.onMove);
    clearInterval(state.interval);
    state.container.remove();
    _builderTrailState.delete(frame);
  }

  function _previewLabel(effectId) {
    const labels = {
      hoverLift: 'Hover me',
      ambientGlow: 'Glow',
      borderEffect: 'Border',
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

  init().then(() => {
    // Bind editor events AFTER init completes (not in a fragile
    // setTimeout) so the editor is definitely embedded in the DOM
    // and all storage reads have resolved.
    bindEditorEvents();
    document.getElementById('createThemeBtn')?.addEventListener('click', () => {
      openCreationDialog('connectry');
    });
  }).catch(err => console.error('[Themer options] Init error:', err));
})();

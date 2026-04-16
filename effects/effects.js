/**
 * Salesforce Themer — Effects Engine
 * Generates CSS for visual effects (hover lift, glow, shimmer, aurora, neon, gradient borders)
 * and manages canvas-based particle systems + cursor trails.
 *
 * This is a SEPARATE layer from the color theme engine. Effects are toggled independently
 * via body classes (body.sf-themer-fx-*) and a dedicated <style id="sf-themer-effects">.
 *
 * Design principles:
 *   - Per-effect intensity (hoverLiftIntensity, ambientGlowIntensity, ...)
 *   - Effect colors derived from current theme accent at render time (auto-adapt on theme switch)
 *   - All CSS respects prefers-reduced-motion
 *   - Canvas systems auto-pause when tab is hidden, reduce density on battery
 *   - Never touches .slds-modal, .slds-dropdown, .slds-combobox, .slds-popover (breaks SF positioning)
 */

'use strict';

// ─── Intensity helper ────────────────────────────────────────────────────────

const INTENSITY_MULT = { subtle: 0.5, medium: 1.0, strong: 1.5 };

function _intensityMult(config, effect, fallback = 'medium') {
  const lvl = (config && config[effect + 'Intensity']) || fallback;
  return INTENSITY_MULT[lvl] || 1.0;
}

// Particle density/speed/opacity derived from intensity level
const PARTICLE_INTENSITY = {
  subtle: { density: 25, speed: 0.6, opacity: 0.35 },
  medium: { density: 50, speed: 1.0, opacity: 0.5 },
  strong: { density: 100, speed: 1.3, opacity: 0.7 },
};


// ─── Color utilities ────────────────────────────────────────────────────────

function _hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '128, 128, 128';
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '128, 128, 128';
}

function _parseHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

function _rgbToHsl(r, g, b) {
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

function _hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
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
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Derive a 3-stop aurora color palette from theme accent.
 * Uses HSL rotations to create related colors that feel intentional.
 */
function _deriveAuroraColors(accent, isDark) {
  const rgb = _parseHex(accent);
  if (!rgb) {
    return isDark
      ? ['#1a1a2e', '#16213e', '#0f3460']
      : ['#e8f4fd', '#f0e6ff', '#e6fff0'];
  }
  const hsl = _rgbToHsl(rgb.r, rgb.g, rgb.b);
  const s = isDark ? Math.max(40, hsl.s) : Math.max(25, Math.min(50, hsl.s));
  const baseL = isDark ? 18 : 88;

  return [
    _hslToHex(hsl.h, s, baseL),
    _hslToHex((hsl.h + 60) % 360, s, baseL + (isDark ? 4 : -2)),
    _hslToHex((hsl.h + 180) % 360, s, baseL + (isDark ? 2 : -1)),
  ];
}


// ─── Effect CSS Generator ─────────────────────────────────────────────────────

/**
 * Generate all effects CSS based on the active effects config.
 * @param {Object} config - Effects configuration (flat keys with per-effect intensity)
 * @param {Object} themeColors - Current theme's color values
 * @returns {string} CSS string
 */
function generateEffectsCSS(config, themeColors) {
  if (!config) return '';

  // Bail only if truly nothing is enabled. Individual toggles can be active
  // even when preset is 'none' or 'custom' — don't gate on preset value alone.
  const hasBackground = config.backgroundPattern && config.backgroundPattern !== 'none';
  const hasBorder = (config.borderEffect && config.borderEffect !== 'none')
    || config.borderShimmer || config.gradientBorders;
  const anyOn = !!(
    config.hoverLift || config.ambientGlow || hasBorder ||
    config.aurora || config.neonFlicker ||
    config.particles || config.cursorTrail || hasBackground
  );
  if (!anyOn) return '';

  const c = themeColors || {};
  const accent = c.accent || '#4a6fa5';
  const accentRgb = _hexToRgb(accent);
  const isDark = c.colorScheme === 'dark';

  let css = `/* Salesforce Themer — Effects Layer */\n`;

  // Reduced motion: disable all animations
  css += `
@media (prefers-reduced-motion: reduce) {
  body[class*="sf-themer-fx"] *,
  body[class*="sf-themer-fx"] *::before,
  body[class*="sf-themer-fx"] *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;

  // ─── Hover Lift (via core engine) ──────────────────────────────────────────
  // All lift/shadow math lives in core/effects/engine.js — this block just
  // binds the engine's declarations to the SF DOM selectors. Fullscreen
  // scale is 1.0 for hoverLift (transforms feel right at the same magnitude
  // on both small previews and real SF cards; unlike backgroundPattern, the
  // saturation doesn't scale with area).
  if (config.hoverLift) {
    const engine = (typeof self !== 'undefined' && self.SFThemerEffectsEngine) ||
                   (typeof window !== 'undefined' && window.SFThemerEffectsEngine);
    const ir = engine && engine.renderRules('hoverLift', config, accent);
    if (ir && ir.cssRules) {
      const byRole = {};
      for (const r of ir.cssRules) byRole[r.selectorRole] = r.declarations;
      const imp = { important: true };
      css += `
/* ─── Hover Lift (intensity ${(config.hoverLiftIntensity || 'medium')}, via core engine) ─── */

body.sf-themer-fx-hover .slds-card,
body.sf-themer-fx-hover .forceRelatedListSingleContainer,
body.sf-themer-fx-hover .forceRecordCard {
${engine.cssFromDeclarations(byRole.cardTransition, imp)}
}

body.sf-themer-fx-hover .slds-card:hover,
body.sf-themer-fx-hover .forceRelatedListSingleContainer:hover,
body.sf-themer-fx-hover .forceRecordCard:hover {
${engine.cssFromDeclarations(byRole.cardHover, imp)}
}

body.sf-themer-fx-hover .slds-button:not(.slds-button_icon):hover {
${engine.cssFromDeclarations(byRole.buttonHover, imp)}
}

body.sf-themer-fx-hover .slds-table tbody tr {
${engine.cssFromDeclarations(byRole.rowTransition, imp)}
}

body.sf-themer-fx-hover .slds-table tbody tr:hover {
${engine.cssFromDeclarations(byRole.rowHover, imp)}
}

/* NEVER lift modals, dropdowns, comboboxes, popovers — breaks SF positioning */
body.sf-themer-fx-hover .slds-modal,
body.sf-themer-fx-hover .slds-modal__container,
body.sf-themer-fx-hover .slds-dropdown,
body.sf-themer-fx-hover .slds-combobox,
body.sf-themer-fx-hover .slds-combobox__input,
body.sf-themer-fx-hover .slds-popover {
  transform: none !important;
}
`;
    }
  }

  // ─── Ambient Glow / Border Shimmer / Gradient Borders (via core engine) ──
  // All three effects pull their keyframes + declarations from the canonical
  // engine. Adapter maps IR selector roles → SF DOM selectors. The engine
  // returns cssPrelude (keyframes / @property) separately from cssRules.
  const engine = (typeof self !== 'undefined' && self.SFThemerEffectsEngine) ||
                 (typeof window !== 'undefined' && window.SFThemerEffectsEngine);

  function _appendEngineEffect(effectKey, selectorRoles) {
    const ir = engine && engine.renderRules(effectKey, config, accent);
    if (!ir || !ir.cssRules) return;
    const imp = { important: true };
    if (ir.cssPrelude) css += `\n/* ─── ${effectKey} prelude (engine) ─── */\n${ir.cssPrelude}\n`;
    for (const rule of ir.cssRules) {
      const sel = selectorRoles[rule.selectorRole];
      if (!sel) continue;
      css += `\n${sel} {\n${engine.cssFromDeclarations(rule.declarations, imp)}\n}\n`;
    }
  }

  if (config.ambientGlow) {
    _appendEngineEffect('ambientGlow', {
      brandButton: 'body.sf-themer-fx-glow .slds-button_brand,\nbody.sf-themer-fx-glow .slds-button--brand',
      // Active tab coverage across the three common SLDS tab patterns:
      // app nav bar (.slds-context-bar__item.slds-is-active), record
      // subtabs (Details/Activity/Chatter — .slds-tabs_default__item.slds-is-active,
      // .slds-tabs_scoped__item.slds-is-active), and workspace pinned
      // tabs (.slds-context-bar__item_tab.slds-is-active).
      navActive:   'body.sf-themer-fx-glow .slds-context-bar__item.slds-is-active,\nbody.sf-themer-fx-glow .slds-context-bar__item_tab.slds-is-active,\nbody.sf-themer-fx-glow .slds-tabs_default__item.slds-is-active,\nbody.sf-themer-fx-glow .slds-tabs_default__item.slds-active,\nbody.sf-themer-fx-glow .slds-tabs_scoped__item.slds-is-active,\nbody.sf-themer-fx-glow .slds-tabs--default__item.slds-active',
      inputFocus:  'body.sf-themer-fx-glow .slds-input:focus,\nbody.sf-themer-fx-glow .slds-textarea:focus,\nbody.sf-themer-fx-glow .slds-select:focus',
    });
  }

  // Border Effect — consolidated Shimmer | Gradient (mutually exclusive).
  // Accepts the new `borderEffect` string config OR falls back to the legacy
  // booleans (borderShimmer / gradientBorders) so unmigrated saved themes
  // still render correctly.
  const _legacyBorder = config.gradientBorders
    ? 'gradient'
    : (config.borderShimmer ? 'shimmer' : 'none');
  // Treat the new 'none' the same as undefined for fallback purposes — a
  // legacy-shaped config merged over a new default stamps borderEffect='none'
  // on top of the legacy boolean, which otherwise kills the border silently.
  const _borderStyle = (config.borderEffect && config.borderEffect !== 'none')
    ? config.borderEffect
    : _legacyBorder;
  // Card selector — matches hoverLift's scope so the two stay in agreement
  // about "what counts as a card." Modern SF record pages rarely use raw
  // `.slds-card`; `.forceRecordCard` and `.forceRelatedListSingleContainer`
  // are where the actual record/related-list panels live.
  const CARD_SEL = '.slds-card, .forceRecordCard, .forceRelatedListSingleContainer';

  if (_borderStyle === 'shimmer') {
    // Pass the right intensity key through to the engine via a merged config.
    const mergedConfig = {
      borderEffect: 'shimmer',
      borderEffectIntensity: config.borderEffectIntensity || config.borderShimmerIntensity || 'medium',
    };
    const ir = engine && engine.renderRules('borderEffect', mergedConfig, accent);
    if (ir && ir.cssRules) {
      const imp = { important: true };
      if (ir.cssPrelude) css += `\n/* ─── borderEffect=shimmer prelude ─── */\n${ir.cssPrelude}\n`;
      const prefix = 'body.sf-themer-fx-shimmer';
      const expand = (suffix) => CARD_SEL.split(',')
        .map(s => `${prefix} ${s.trim()}${suffix}`)
        .join(',\n');
      for (const rule of ir.cssRules) {
        let sel = null;
        if (rule.selectorRole === 'cardShimmerContainer') sel = expand('');
        if (rule.selectorRole === 'cardShimmerEdge')      sel = expand('::before');
        if (sel) css += `\n${sel} {\n${engine.cssFromDeclarations(rule.declarations, imp)}\n}\n`;
      }
    }
  } else if (_borderStyle === 'gradient') {
    const mergedConfig = {
      borderEffect: 'gradient',
      borderEffectIntensity: config.borderEffectIntensity || config.gradientBordersIntensity || 'medium',
    };
    const ir = engine && engine.renderRules('borderEffect', mergedConfig, accent);
    if (ir && ir.cssRules) {
      const imp = { important: true };
      if (ir.cssPrelude) css += `\n/* ─── borderEffect=gradient prelude ─── */\n${ir.cssPrelude}\n`;
      const prefix = 'body.sf-themer-fx-gradient-border';
      const expand = (suffix) => CARD_SEL.split(',')
        .map(s => `${prefix} ${s.trim()}${suffix}`)
        .join(',\n');
      for (const rule of ir.cssRules) {
        let sel = null;
        if (rule.selectorRole === 'cardGradientContainer') sel = expand('');
        if (rule.selectorRole === 'cardGradientEdge')      sel = expand('::after');
        if (sel) css += `\n${sel} {\n${engine.cssFromDeclarations(rule.declarations, imp)}\n}\n`;
      }
    }
  }

  // ─── Aurora Background (via core engine) ──────────────────────────────────
  // Same z-index fix pattern as backgroundPattern: body::before goes to
  // z-index: -1 inside body's own stacking context (set below). Drops the
  // old fragile wrapper-hoisting list; SF has too many wrapper layers to
  // enumerate reliably.
  if (config.aurora) {
    const ir = engine && engine.renderRules('aurora', config, accent, { scale: 1.0, isDark });
    if (ir && ir.cssRules) {
      const imp = { important: true };
      if (ir.cssPrelude) css += `\n/* ─── aurora prelude (engine) ─── */\n${ir.cssPrelude}\n`;
      const rule = ir.cssRules.find(r => r.selectorRole === 'bodyWrapper');
      if (rule) {
        // Aurora paints BEHIND the cards, visible in the gap regions
        // between them. For that to work, SF's viewport-filling wrappers
        // have to be made transparent — otherwise they paint opaque on
        // top of body::before and aurora is invisible.
        //
        // Transparentized layers (from SF-DOM-MAP 2026-04-16):
        //   body.sf-themer-fx-aurora          — theme-set bg
        //   .flexipagePage                    — Lightning page container
        //   .sellerHomeContainer              — Home-specific wrapper
        //   .responsiveContents               — generic wrapper
        //   .forceRecordLayout                — record-page wrapper
        //   .slds-template_default            — layout template
        // Cards (.slds-card, .forceRecordCard, .forceBaseCard) are NOT
        // touched — they keep their solid bg. Aurora only shows in
        // empty gaps between them.
        const rect = engine.cssFromDeclarations(rule.declarations, imp);
        css += `
/* ─── Aurora Background (intensity ${(config.auroraIntensity || 'medium')}, via core engine) ─── */

body.sf-themer-fx-aurora {
  position: relative !important;
  z-index: 0 !important;
  background: transparent !important;
  background-color: transparent !important;
}

body.sf-themer-fx-aurora .flexipagePage,
body.sf-themer-fx-aurora .sellerHomeContainer,
body.sf-themer-fx-aurora .responsiveContents,
body.sf-themer-fx-aurora .forceRecordLayout,
body.sf-themer-fx-aurora .slds-template_default,
body.sf-themer-fx-aurora .oneContent {
  background: transparent !important;
  background-color: transparent !important;
}

body.sf-themer-fx-aurora::before {
${rect}
}
`;
      }
    }
  }

  // ─── Neon Flicker (via core engine) ───────────────────────────────────────
  if (config.neonFlicker) {
    _appendEngineEffect('neonFlicker', {
      titleFlicker:      'body.sf-themer-fx-neon .slds-page-header__title,\nbody.sf-themer-fx-neon .slds-page-header__name-title',
      navBreathe:        'body.sf-themer-fx-neon .slds-context-bar__label-action,\nbody.sf-themer-fx-neon .slds-tabs_default__item.slds-is-active a,\nbody.sf-themer-fx-neon .slds-tabs--default__item.slds-active a',
      cardHeaderBreathe: 'body.sf-themer-fx-neon .slds-card__header-title',
    });
  }

  // ─── Cursor Trail (canvas container rules) ────────────────────────────────
  if (config.cursorTrail) {
    css += `
/* ─── Cursor Trail (canvas container rules) ─── */

#sf-themer-fx-canvas {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  pointer-events: none !important;
  z-index: 998 !important;
}
`;
  }

  // ─── Particles (canvas container rules) ───────────────────────────────────
  if (config.particles) {
    css += `
/* ─── Particles (canvas container rules) ─── */

#sf-themer-particles {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  pointer-events: none !important;
  z-index: 997 !important;
}
`;
  }

  // ─── Background Patterns ──────────────────────────────────────────────────
  // Delegates to core engine (core/effects/engine.js). Adapter maps IR role
  // `bodyWrapper` → `body::after`. This paints the pattern behind SF's
  // layered content surfaces, showing through only in the outer chrome /
  // scaffold between those surfaces. Tried painting inside the content
  // canvas (.oneContent, flexipage template) — SF composes multiple opaque
  // layers per page type, so wrapper-chasing wasn't tractable. Chrome-only
  // is intentional: subtle framing that complements SF's flat surfaces.
  if (config.backgroundPattern && config.backgroundPattern !== 'none') {
    const engine = (typeof self !== 'undefined' && self.SFThemerEffectsEngine) ||
                   (typeof window !== 'undefined' && window.SFThemerEffectsEngine);
    // Fullscreen scale factor — opacity is calibrated for the small Builder
    // preview frame; on the full SF viewport the same values read as
    // candy-stripe wallpaper. Damp to ~55% so the pattern reads as a subtle
    // backdrop, not a takeover.
    const ir = engine && engine.renderRules('backgroundPattern', config, accent, { scale: 0.55 });
    if (ir && ir.cssRules && ir.cssRules.length) {
      const rule = ir.cssRules.find(r => r.selectorRole === 'bodyWrapper');
      if (rule) {
        const decls = engine.cssFromDeclarations(rule.declarations, { important: true });
        // The pattern sits on body::after at z-index: -1, below body's
        // content. body itself becomes a stacking context (position:
        // relative; z-index: 0) so the negative z-index stays scoped and
        // doesn't sink below the page background. This replaces the old
        // wrapper-hoisting approach that was fragile — SF has dozens of
        // wrapper layers, and enumerating them to boost z-index:1 missed
        // many, so the pattern ended up painting over content on most
        // pages. See §BACKGROUND_PATTERN_FIX.
        css += `
/* ─── Background Pattern: ${config.backgroundPattern} (via core engine) ─── */

body.sf-themer-fx-background {
  position: relative !important;
  z-index: 0 !important;
}

body.sf-themer-fx-background::after {
  content: '' !important;
  position: fixed !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: -1 !important;
${decls}
}
`;
      }
    }
  }

  return css;
}

// backgroundPattern CSS generation migrated to core/effects/engine.js
// (see renderRules + buildBackgroundPatternDeclarations). Enforced by
// scripts/check-effects-drift.js.


// ─── Particle System ──────────────────────────────────────────────────────────

class SFThemerParticles {
  constructor(type, config) {
    this.type = type;
    this.config = {
      color: '#ffffff',
      density: 50,
      speed: 1,
      opacity: 0.6,
      ...config,
    };
    this.particles = [];
    this.canvas = null;
    this.ctx = null;
    this.raf = null;
    this.paused = false;
    this.onBattery = false;
    this._boundVisibility = null;
    this._resizeTimer = null;
  }

  init() {
    document.getElementById('sf-themer-particles')?.remove();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sf-themer-particles';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '997',
      opacity: String(this.config.opacity),
    });
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._detectBattery();
    this._spawn();
    this._loop();

    this._boundVisibility = () => {
      this.paused = document.hidden;
      if (!this.paused && !this.raf) this._loop();
    };
    document.addEventListener('visibilitychange', this._boundVisibility);

    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      }, 200);
    });
  }

  _detectBattery() {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        this.onBattery = !battery.charging;
        battery.addEventListener('chargingchange', () => {
          this.onBattery = !battery.charging;
          if (this.onBattery && this.particles.length > this.config.density * 0.5) {
            this.particles.length = Math.floor(this.config.density * 0.5);
          }
        });
      }).catch(() => {});
    }
  }

  _getDensity() {
    const base = this.config.density;
    return this.onBattery ? Math.floor(base * 0.5) : base;
  }

  _spawn() {
    const count = this._getDensity();
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this._createParticle(w, h, true));
    }
  }

  _createParticle(w, h, randomY) {
    const speed = this.config.speed;
    switch (this.type) {
      case 'snow':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -5,
          r: Math.random() * 3 + 1,
          vx: (Math.random() * 0.5 - 0.25) * speed,
          vy: (Math.random() * 1 + 0.3) * speed,
          wobble: Math.random() * Math.PI * 2,
        };
      case 'rain':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -20,
          len: Math.random() * 15 + 5,
          vy: (Math.random() * 8 + 4) * speed,
        };
      case 'matrix':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -20,
          char: String.fromCharCode(0x30A0 + Math.random() * 96),
          vy: (Math.random() * 3 + 1) * speed,
          size: Math.random() * 10 + 10,
          opacity: Math.random(),
        };
      case 'dots':
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2 + 0.5,
          vx: (Math.random() * 0.3 - 0.15) * speed,
          vy: (Math.random() * 0.3 - 0.15) * speed,
          opacity: Math.random() * 0.5 + 0.2,
          pulsePhase: Math.random() * Math.PI * 2,
        };
      case 'embers':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : h + 10,
          r: Math.random() * 2 + 0.5,
          vx: (Math.random() * 1 - 0.5) * speed,
          vy: -(Math.random() * 1.5 + 0.5) * speed,
          opacity: Math.random() * 0.7 + 0.3,
          life: 1.0,
          decay: Math.random() * 0.003 + 0.001,
        };
      default:
        return { x: 0, y: 0, r: 1, vx: 0, vy: 0 };
    }
  }

  _draw() {
    const { ctx, canvas, particles, type } = this;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = this.config.color;
    const w = canvas.width;
    const h = canvas.height;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      switch (type) {
        case 'snow':
          p.wobble += 0.01;
          p.x += p.vx + Math.sin(p.wobble) * 0.3;
          p.y += p.vy;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.fill();
          if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
          if (p.x < -5) p.x = w + 5;
          if (p.x > w + 5) p.x = -5;
          break;

        case 'rain':
          p.y += p.vy;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 0.5, p.y + p.len);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1;
          ctx.stroke();
          if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
          break;

        case 'matrix':
          p.y += p.vy;
          p.opacity -= 0.003;
          ctx.font = `${p.size}px monospace`;
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity;
          ctx.fillText(p.char, p.x, p.y);
          if (p.y > h || p.opacity <= 0) {
            p.y = -20;
            p.x = Math.random() * w;
            p.opacity = 1;
            p.char = String.fromCharCode(0x30A0 + Math.random() * 96);
          }
          break;

        case 'dots': {
          p.pulsePhase += 0.005;
          p.x += p.vx;
          p.y += p.vy;
          const pulse = 0.5 + Math.sin(p.pulsePhase) * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * pulse;
          ctx.fill();
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          break;
        }

        case 'embers': {
          p.x += p.vx + Math.sin(p.life * 10) * 0.3;
          p.y += p.vy;
          p.life -= p.decay;
          if (p.life <= 0) {
            particles[i] = this._createParticle(w, h, false);
            break;
          }
          const emberR = p.r * p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, emberR, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * p.life;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, emberR * 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * p.life * 0.2;
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  _loop() {
    if (this.paused) { this.raf = null; return; }
    this._draw();
    this.raf = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._boundVisibility) {
      document.removeEventListener('visibilitychange', this._boundVisibility);
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
  }
}


// ─── Cursor Trail ─────────────────────────────────────────────────────────────

class SFThemerCursorTrail {
  constructor(config) {
    this.config = {
      color: '#ffffff',
      length: 20,
      size: 4,
      opacity: 0.5,
      style: 'glow', // glow | comet | sparkle | line
      ...config,
    };
    this.points = [];
    this.canvas = null;
    this.ctx = null;
    this.active = false;
    this.raf = null;
    this._boundMove = null;
    this._boundVisibility = null;
  }

  init() {
    document.getElementById('sf-themer-fx-canvas')?.remove();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sf-themer-fx-canvas';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '998',
    });
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.active = true;
    this._boundMove = (e) => {
      this.points.push({ x: e.clientX, y: e.clientY, life: 1.0 });
      if (this.points.length > this.config.length) this.points.shift();
    };
    document.addEventListener('mousemove', this._boundMove, { passive: true });

    this._boundVisibility = () => {
      if (document.hidden) this.points = [];
    };
    document.addEventListener('visibilitychange', this._boundVisibility);

    this._draw();

    window.addEventListener('resize', () => {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
  }

  _draw() {
    if (!this.active || !this.ctx) return;
    const { ctx, canvas, points } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const style = this.config.style || 'glow';

    if (style === 'line' && points.length > 1) {
      // LINE: continuous stroke through points, tapered by progress
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1], p1 = points[i];
        const progress = i / points.length;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = this.config.color;
        ctx.lineWidth = this.config.size * progress;
        ctx.lineCap = 'round';
        ctx.globalAlpha = progress * this.config.opacity;
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const progress = (i + 1) / points.length;

        if (style === 'comet') {
          // COMET: elongated teardrop growing toward the head
          const size = this.config.size * progress * 2.2;
          const alpha = progress * this.config.opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fillStyle = this.config.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
          // Connect with a line to the previous point for streak effect
          if (i > 0) {
            const prev = points[i - 1];
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = this.config.color;
            ctx.lineWidth = size * 0.9;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * 0.7;
            ctx.stroke();
          }
        } else if (style === 'sparkle') {
          // SPARKLE: small bright core + radiating glow halo
          const size = this.config.size * (0.5 + progress * 0.7);
          const alpha = progress * this.config.opacity;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4);
          grad.addColorStop(0, this.config.color);
          grad.addColorStop(0.3, this.config.color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // GLOW (default): original soft dot behavior
          const size = this.config.size * progress;
          const alpha = progress * this.config.opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fillStyle = this.config.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }

        p.life -= 0.02;
      }
    }

    // Life decrement for line/other modes not in the inner loop
    if (style === 'line') {
      for (const p of points) p.life -= 0.02;
    }
    this.points = this.points.filter(p => p.life > 0);
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame(() => this._draw());
  }

  destroy() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._boundMove) document.removeEventListener('mousemove', this._boundMove);
    if (this._boundVisibility) document.removeEventListener('visibilitychange', this._boundVisibility);
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.points = [];
  }
}


// ─── Body Class Manager ──────────────────────────────────────────────────────

/**
 * Apply the correct body.sf-themer-fx-* classes based on effects config.
 * @param {Object} config - Effects configuration
 */
function applyEffectsClasses(config) {
  if (!document.body) return;
  const body = document.body;

  // Remove all existing fx classes
  const existing = [...body.classList].filter(c => c.startsWith('sf-themer-fx'));
  existing.forEach(c => body.classList.remove(c));

  if (!config) return;

  // Only bail if ALL effects are actually off — don't gate on preset name
  // because individual effects can be toggled on even with preset 'none'.
  const hasBorderFx = (config.borderEffect && config.borderEffect !== 'none')
    || config.borderShimmer || config.gradientBorders;
  const hasAnyEffect = !!(
    config.hoverLift || config.ambientGlow || hasBorderFx ||
    config.aurora || config.neonFlicker ||
    config.particles || config.cursorTrail ||
    (config.backgroundPattern && config.backgroundPattern !== 'none')
  );
  if (!hasAnyEffect) return;

  if (config.hoverLift) body.classList.add('sf-themer-fx-hover');
  if (config.ambientGlow) body.classList.add('sf-themer-fx-glow');
  // Border effect — consolidated shimmer|gradient via config.borderEffect
  // (falls back to the legacy booleans for unmigrated configs). Same 'none'
  // fallback trick as above so legacy saves still render correctly.
  const borderStyle = (config.borderEffect && config.borderEffect !== 'none')
    ? config.borderEffect
    : (config.gradientBorders ? 'gradient' : (config.borderShimmer ? 'shimmer' : 'none'));
  if (borderStyle === 'shimmer') body.classList.add('sf-themer-fx-shimmer');
  if (borderStyle === 'gradient') body.classList.add('sf-themer-fx-gradient-border');
  if (config.aurora) body.classList.add('sf-themer-fx-aurora');
  if (config.neonFlicker) body.classList.add('sf-themer-fx-neon');
  if (config.particles) body.classList.add('sf-themer-fx-particles');
  if (config.cursorTrail) body.classList.add('sf-themer-fx-cursor');
  if (config.backgroundPattern && config.backgroundPattern !== 'none') {
    body.classList.add('sf-themer-fx-background');
  }
}


/**
 * Build particle runtime config from effects config + theme.
 * Pulls density/speed/opacity from intensity level; color from theme accent.
 */
function buildParticleRuntimeConfig(effectsConfig, themeColors) {
  const level = effectsConfig.particlesIntensity || 'medium';
  const defaults = PARTICLE_INTENSITY[level] || PARTICLE_INTENSITY.medium;
  return {
    color: effectsConfig.particleColor || themeColors?.accent || '#ffffff',
    density: effectsConfig.particleDensity || defaults.density,
    speed: effectsConfig.particleSpeed || defaults.speed,
    opacity: effectsConfig.particleOpacity || defaults.opacity,
  };
}

/**
 * Build cursor trail runtime config from effects config + theme.
 */
function buildCursorTrailRuntimeConfig(effectsConfig, themeColors) {
  const level = effectsConfig.cursorTrailIntensity || 'medium';
  const m = INTENSITY_MULT[level] || 1.0;
  return {
    color: effectsConfig.cursorTrailColor || themeColors?.accent || '#ffffff',
    length: Math.round(20 * m),
    size: Math.round(4 * m),
    opacity: 0.4 + (m - 1) * 0.2,
    style: effectsConfig.cursorTrailStyle || 'glow',
  };
}


// Export for content.js + Node tests
if (typeof module !== 'undefined') {
  module.exports = {
    generateEffectsCSS,
    SFThemerParticles,
    SFThemerCursorTrail,
    applyEffectsClasses,
    buildParticleRuntimeConfig,
    buildCursorTrailRuntimeConfig,
    PARTICLE_INTENSITY,
    INTENSITY_MULT,
  };
}

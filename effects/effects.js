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
// INTENSITY_MULT kept only for legacy fallback compatibility in internal call
// sites that haven't been migrated off the old helper. The canonical ladder
// lives in core/effects/engine.js (INTENSITY_LADDER). Particle intensity
// (density/speed/opacity tuple) moved there too — see engine.PARTICLE_INTENSITY.

const INTENSITY_MULT = { subtle: 0.5, medium: 1.0, strong: 1.5 };


// ─── Color utilities ────────────────────────────────────────────────────────

// Color helpers moved to core/effects/engine.js (deriveColors, hexToRgbCsv,
// rgbToHsl, hslToRgbCsv, _hexToHsl, _hslToHex, _deriveAuroraBlobs).
// Aurora-specific color derivation is engine-side only now that the effect
// is canvas-based — the old local helpers here produced *different* blob
// palettes than the engine, which was drift waiting to happen.


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
      // Lift overflow:clip on card wrappers — the home-page record cards wrap
      // .slds-card in .forceBaseCard which has overflow:clip, hiding the
      // shimmer ::before that bleeds at the top edge. Without this the
      // shimmer is invisible on home-page tiles even though it renders fine
      // on record-detail pages.
      css += `\nbody.sf-themer-fx-shimmer .forceBaseCard,\nbody.sf-themer-fx-shimmer .slds-card_boundary,\nbody.sf-themer-fx-shimmer .forceRecordCard,\nbody.sf-themer-fx-shimmer .forceRelatedListSingleContainer { overflow: visible !important; }\n`;
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

  // ─── Aurora Background (CSS-gradient backdrop) ───────────────────────────
  // 2026-04-26 simplification — canvas approach abandoned.
  //
  // The previous approach painted aurora on a fullscreen <canvas> at
  // z-index:-1 behind body, then transparentized SF's outer wrappers
  // (.flexipagePage, .forceRecordLayout, etc.) so the canvas would peek
  // through. This was fragile because:
  //   - SF has many opaque wrapper layers — listing 4 missed others
  //     (oneContent, oneRecordHomeFlexipage, etc.), so aurora was
  //     invisible on most pages.
  //   - Body's own background-color paints in body's stacking context at
  //     z-index:0 (auto), covering the canvas at z-index:-1. The whole
  //     "make body a stacking context" trick fights itself.
  //   - Canvas adds RAF + resize lifecycle complexity for an effect that
  //     reads as static-ish anyway.
  //
  // New approach: paint aurora as background-image gradient layers ON
  // body (the same element that already carries c.background via the
  // `html, body, .desktop` rule in the engine). The gradient sits on top
  // of c.background within body — no z-index gymnastics, no wrapper
  // hunting, works on every SF page type unconditionally.
  //
  // Static for v1 — animating background-position on body causes
  // viewport-wide repaints. If we want drift later, we add a separate
  // pseudo-element with transform animation (GPU-accelerated).
  if (config.aurora) {
    const ir = engine && engine.renderRules('aurora', config, accent, { scale: 1.0, isDark });
    const blobs = ir && ir.runtimeConfig && ir.runtimeConfig.aurora && ir.runtimeConfig.aurora.blobs;
    const auroraOpacity = (ir && ir.runtimeConfig && ir.runtimeConfig.aurora && ir.runtimeConfig.aurora.opacity) || 0.35;
    if (blobs && blobs.length) {
      // Convert each blob's hex color + position into a radial-gradient
      // layer. color-mix bakes the opacity into the color so the gradient
      // fades naturally. Radius from runtimeConfig is in normalized canvas
      // coords (0..1 of max(w,h)); we approximate with vmax for CSS.
      // The blob alpha is ~0.4-0.6 at the center, fading to transparent.
      const blobAlphaPct = Math.round(Math.min(1, auroraOpacity * 1.6) * 100);
      const layers = blobs.map(b => {
        const xPct = Math.round((b.x || 0.5) * 100);
        const yPct = Math.round((b.y || 0.5) * 100);
        const rVmax = Math.round((b.radius || 0.55) * 100);
        return `radial-gradient(circle at ${xPct}% ${yPct}%, color-mix(in srgb, ${b.color} ${blobAlphaPct}%, transparent) 0%, transparent ${rVmax}%)`;
      }).join(',\n    ');

      css += `
/* ─── Aurora Background (intensity ${(config.auroraIntensity || 'medium')}, CSS gradient on body) ─── */
body.sf-themer-fx-aurora,
body.sf-themer-fx-aurora .desktop {
  background-image:
    ${layers} !important;
  background-attachment: fixed !important;
  background-size: 100% 100% !important;
  background-repeat: no-repeat !important;
}
`;
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

  // Canvas-based effects (aurora, particles, cursorTrail) style their
  // own canvas inline — see effects/canvas-runtime.js BaseRenderer.init.
  // No CSS is emitted here for canvas containers; SF sometimes overrides
  // IDs via its own stylesheets, but the inline-style !important-ish
  // equivalent (direct element.style properties) wins regardless.

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
 * Aggregate runtimeConfig across the three canvas-based effects (aurora,
 * particles, cursorTrail). Consumed by content.js, which passes the result
 * to SFThemerCanvasRuntime.manager.sync() to mount/unmount canvases and
 * drive their render loops. Per-effect math lives in core/effects/engine.js
 * — this function is just a thin aggregator.
 *
 * @param {Object} effectsConfig - Active effects config (flat keys)
 * @param {Object} themeColors   - Current theme colors (.accent, .colorScheme)
 * @returns {Object} runtimeConfig — keys: aurora? / particles? / cursorTrail?
 */
function generateEffectsRuntimeConfig(effectsConfig, themeColors) {
  if (!effectsConfig) return {};
  const engine = (typeof self !== 'undefined' && self.SFThemerEffectsEngine) ||
                 (typeof window !== 'undefined' && window.SFThemerEffectsEngine);
  if (!engine) return {};

  const accent = (themeColors && themeColors.accent) || '#4a6fa5';
  const isDark = !!(themeColors && themeColors.colorScheme === 'dark');
  const runtime = {};

  // Aurora is now CSS-gradient (2026-04-26) — no canvas runtime needed.
  // The CSS-gradient backdrop is emitted in generateEffectsCSS above; the
  // canvas-based AuroraRenderer is left in canvas-runtime.js for now but
  // never receives a config, so it stays inert. Can be deleted later.

  const particles = engine.renderRules('particles', effectsConfig, accent);
  if (particles && particles.runtimeConfig && particles.runtimeConfig.particles) {
    runtime.particles = particles.runtimeConfig.particles;
  }

  const cursor = engine.renderRules('cursorTrail', effectsConfig, accent);
  if (cursor && cursor.runtimeConfig && cursor.runtimeConfig.cursorTrail) {
    runtime.cursorTrail = cursor.runtimeConfig.cursorTrail;
  }

  return runtime;
}


// Export for content.js + Node tests. SFThemerParticles / SFThemerCursorTrail
// moved to effects/canvas-runtime.js (global.SFThemerCanvasRuntime).
// PARTICLE_INTENSITY moved to core/effects/engine.js.
if (typeof module !== 'undefined') {
  module.exports = {
    generateEffectsCSS,
    generateEffectsRuntimeConfig,
    applyEffectsClasses,
    INTENSITY_MULT,
  };
}

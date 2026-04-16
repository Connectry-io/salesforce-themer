/**
 * Salesforce Themer — Core Effects Engine (Primitives + Adapters)
 *
 * SINGLE SOURCE OF TRUTH for visual effect logic across all consumer surfaces:
 *   - Salesforce content script (real SLDS selectors, canvas renderers)
 *   - Builder + Hero preview (mock Salesforce mockup in options page)
 *   - Guide tab mini-cards (explainer previews)
 *   - Future: share cards, Figma plugin, web previews, other platforms (Jira/Dynamics)
 *
 * Architecture: primitives + adapters.
 *   - This file exports the PRIMITIVES — intensity ladder, effect metadata,
 *     color math, pairing matrix, and a renderRules(effect, config) function
 *     that returns a structured intermediate representation (IR).
 *   - Each consumer is a thin ADAPTER that maps IR "selector roles" to its
 *     actual DOM selectors and applies the resulting CSS/runtime config.
 *
 * Contract: NEVER hardcode effect-specific values outside this file. Use the
 * primitives. scripts/check-effects-drift.js enforces this mechanically.
 *
 * Load order (no bundler today): this file must load BEFORE any consumer.
 *   - Content script: manifest content_scripts array
 *   - Options/Popup: <script src> in HTML
 *   - Background SW: inlined via scripts/sync-engine.py (future)
 *
 * Exported as global SFThemerEffectsEngine in browser contexts, module.exports
 * in Node (for tests + drift detector).
 */

'use strict';

(function (global) {

// ────────────────────────────────────────────────────────────────────────────
// INTENSITY LADDER — The single authoritative mapping from named intensity
// levels to numeric multipliers. Consumed by every effect that supports
// Subtle/Medium/Strong pills. Handwritten values in consumers = drift.
// ────────────────────────────────────────────────────────────────────────────

const INTENSITY_LADDER = {
  subtle: { mult: 0.5, speed: 1.6 },
  medium: { mult: 1.0, speed: 1.0 },
  strong: { mult: 1.6, speed: 0.65 },
};

function getIntensity(config, effectId) {
  const level = (config && config[effectId + 'Intensity']) || 'medium';
  return INTENSITY_LADDER[level] || INTENSITY_LADDER.medium;
}


// ────────────────────────────────────────────────────────────────────────────
// EFFECT METADATA — Canonical list of effects, their display names, style
// options, and capability flags. Consumers read this to build UI (toggles,
// dropdowns, labels) instead of hardcoding.
// ────────────────────────────────────────────────────────────────────────────

const EFFECT_METADATA = {
  hoverLift: {
    name: 'Hover Lift',
    short: 'Cards lift on hover',
    supportsIntensity: true,
    canvasBased: false,
  },
  ambientGlow: {
    name: 'Ambient Glow',
    short: 'Pulsing glow on accent elements',
    supportsIntensity: true,
    canvasBased: false,
  },
  borderShimmer: {
    name: 'Border Shimmer',
    short: 'Animated light sweep on cards',
    supportsIntensity: true,
    canvasBased: false,
  },
  gradientBorders: {
    name: 'Gradient Borders',
    short: 'Rotating gradient card edges',
    supportsIntensity: true,
    canvasBased: false,
  },
  aurora: {
    name: 'Aurora Background',
    short: 'Slow-moving ambient background',
    supportsIntensity: true,
    canvasBased: false,
  },
  neonFlicker: {
    name: 'Neon Flicker',
    short: 'Glowing text with flicker',
    supportsIntensity: true,
    canvasBased: false,
  },
  particles: {
    name: 'Particles',
    short: 'Snow, rain, matrix, dots, embers',
    supportsIntensity: true,
    canvasBased: true,
    styles: [
      { value: 'snow',   label: 'Snow' },
      { value: 'rain',   label: 'Rain' },
      { value: 'matrix', label: 'Matrix Rain' },
      { value: 'dots',   label: 'Floating Dots' },
      { value: 'embers', label: 'Embers' },
    ],
    defaultStyle: 'snow',
  },
  cursorTrail: {
    name: 'Cursor Trail',
    short: 'Light trail follows your mouse',
    supportsIntensity: true,
    canvasBased: true,
    styles: [
      { value: 'glow',    label: 'Glow' },
      { value: 'comet',   label: 'Comet' },
      { value: 'sparkle', label: 'Sparkle' },
      { value: 'line',    label: 'Line' },
    ],
    defaultStyle: 'glow',
  },
  backgroundPattern: {
    name: 'Background Pattern',
    short: 'Subtle structural pattern behind all content',
    supportsIntensity: true,
    canvasBased: false,
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
};


// ────────────────────────────────────────────────────────────────────────────
// EFFECT PAIRING MATRIX — Rules that flag visually competing effect
// combinations. AI generation (V2) + future UI warnings consume this.
// ────────────────────────────────────────────────────────────────────────────

const EFFECT_PAIRING_MATRIX = {
  conflicts: [
    {
      pair: ['borderShimmer', 'gradientBorders'],
      reason: 'Both decorate the card perimeter. Shimmer is a one-edge sweep; gradient is a rotating conic glow. Together they muddle each other.',
      recommendation: 'Pick one.',
    },
  ],
};


// ────────────────────────────────────────────────────────────────────────────
// COLOR MATH — Pure functions for RGBA conversion, HSL rotation, complementary
// hue derivation. Used by aurora (3-blob derivation), pattern tinting, etc.
// ────────────────────────────────────────────────────────────────────────────

function hexToRgbCsv(hex) {
  if (!hex || typeof hex !== 'string') return '128, 128, 128';
  const clean = hex.replace('#', '');
  const expand = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  if (expand.length < 6) return '128, 128, 128';
  const r = parseInt(expand.slice(0, 2), 16);
  const g = parseInt(expand.slice(2, 4), 16);
  const b = parseInt(expand.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function rgbToHsl(r, g, b) {
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

function hslToRgbCsv(h, s, l) {
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

/**
 * Derive effect-related colors from a theme accent.
 * Returns:
 *   accentRgb   - "r, g, b" string for rgba() usage
 *   aurora2Rgb  - complementary hue #1 (60° rotation)
 *   aurora3Rgb  - complementary hue #2 (180° rotation)
 */
function deriveColors(accentHex) {
  const accentRgb = hexToRgbCsv(accentHex);
  const [r, g, b] = accentRgb.split(',').map(v => parseInt(v.trim(), 10));
  const hsl = rgbToHsl(r, g, b);
  const s = Math.max(40, hsl.s);
  return {
    accentRgb,
    aurora2Rgb: hslToRgbCsv((hsl.h + 60) % 360, s, 55),
    aurora3Rgb: hslToRgbCsv((hsl.h + 180) % 360, s, 55),
  };
}


// ────────────────────────────────────────────────────────────────────────────
// BACKGROUND PATTERN — CSS generator. Maps a pattern name + intensity + accent
// to a declarations object. Consumers apply these declarations to their
// surface's bodyWrapper role.
// ────────────────────────────────────────────────────────────────────────────

function buildBackgroundPatternDeclarations(pattern, accentHex, intensityLevel, scale) {
  const { accentRgb } = deriveColors(accentHex);
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;
  // `scale` is a context multiplier on opacity — small preview surfaces pass
  // 1.0 (their default visual impact is already calibrated); fullscreen
  // surfaces like the real SF viewport pass <1 to dampen what would
  // otherwise be wallpaper-level saturation at the same intensity level.
  const s = typeof scale === 'number' ? scale : 1.0;

  // Per-pattern base opacity scaled by intensity multiplier AND context scale.
  // Line/dot thickness scales with intensity only (thickness isn't the
  // saturation problem on fullscreen — density is).
  const opacity = (base) => (base * mult * s).toFixed(3);
  const thickness = (basePx) => `${(basePx * mult).toFixed(2)}px`;

  switch (pattern) {
    case 'dotGrid':
    case 'dot-grid':
      return {
        'background-image': `radial-gradient(rgba(${accentRgb}, ${opacity(0.55)}) ${thickness(1.4)}, transparent ${thickness(1.4)})`,
        'background-size': '18px 18px',
      };
    case 'lineGrid':
    case 'line-grid':
      return {
        'background-image':
          `linear-gradient(rgba(${accentRgb}, ${opacity(0.35)}) ${thickness(1)}, transparent ${thickness(1)}),` +
          `linear-gradient(90deg, rgba(${accentRgb}, ${opacity(0.35)}) ${thickness(1)}, transparent ${thickness(1)})`,
        'background-size': '24px 24px',
      };
    case 'hatch':
      return {
        'background-image': `repeating-linear-gradient(45deg, rgba(${accentRgb}, ${opacity(0.45)}) 0, rgba(${accentRgb}, ${opacity(0.45)}) ${thickness(1)}, transparent ${thickness(1)}, transparent 9px)`,
      };
    case 'noise': {
      // SVG noise via data URI. Opacity baked into the feColorMatrix alpha.
      const alpha = opacity(0.6);
      return {
        'background-image': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${alpha} 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
      };
    }
    case 'subway':
      return {
        'background-image':
          `linear-gradient(rgba(${accentRgb}, ${opacity(0.3)}) ${thickness(2)}, transparent ${thickness(2)}),` +
          `linear-gradient(90deg, rgba(${accentRgb}, ${opacity(0.3)}) ${thickness(2)}, transparent ${thickness(2)})`,
        'background-size': '60px 30px',
        'background-position': '0 0, 30px 15px',
      };
    case 'crosshatch':
      return {
        'background-image':
          `repeating-linear-gradient(45deg, rgba(${accentRgb}, ${opacity(0.35)}) 0, rgba(${accentRgb}, ${opacity(0.35)}) ${thickness(1)}, transparent ${thickness(1)}, transparent 9px),` +
          `repeating-linear-gradient(-45deg, rgba(${accentRgb}, ${opacity(0.35)}) 0, rgba(${accentRgb}, ${opacity(0.35)}) ${thickness(1)}, transparent ${thickness(1)}, transparent 9px)`,
      };
    default:
      return null;
  }
}


// ────────────────────────────────────────────────────────────────────────────
// Hover Lift — card/button/table-row transform on hover.
//
// Canonical values derived from the Builder preview calibration (which Noland
// tuned to feel right on a card): 4px lift, 8/20/0.14 shadow. Returns
// declarations for four adapter-bound roles so each surface can pick what it
// needs (preview surfaces use just card; content script uses all three).
// ────────────────────────────────────────────────────────────────────────────

function buildHoverLiftDeclarations(intensityLevel, scale) {
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;
  const s = typeof scale === 'number' ? scale : 1.0;
  const k = mult * s;

  const liftPx = (4 * k).toFixed(2);
  const btnLiftPx = (1.5 * k).toFixed(2);
  const rowShiftPx = (2 * k).toFixed(2);
  const shadowY = (8 * k).toFixed(2);
  const shadowSpread = (20 * k).toFixed(2);
  const shadowAlpha = (0.14 * k).toFixed(3);
  const shadowAlphaClose = (0.05 * k).toFixed(3);

  return {
    cardTransition: {
      'transition': 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease',
    },
    cardHover: {
      'transform': `translateY(-${liftPx}px)`,
      'box-shadow': `0 ${shadowY}px ${shadowSpread}px rgba(0, 0, 0, ${shadowAlpha}), 0 2px 6px rgba(0, 0, 0, ${shadowAlphaClose})`,
    },
    buttonHover: {
      'transform': `translateY(-${btnLiftPx}px)`,
      'transition': 'transform 150ms ease',
    },
    rowTransition: {
      'transition': 'transform 150ms ease, background-color 150ms ease',
    },
    rowHover: {
      'transform': `translateX(${rowShiftPx}px)`,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Ambient Glow — pulsing box-shadow on brand button + nav active + input focus.
// Exports keyframes as a CSS prelude string so adapters can emit them once,
// alongside role-bound declarations they apply to their own selectors.
// ────────────────────────────────────────────────────────────────────────────

function buildAmbientGlowRules(intensityLevel, accentHex, scale) {
  const { accentRgb } = deriveColors(accentHex);
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;
  const s = typeof scale === 'number' ? scale : 1.0;
  const k = mult * s;

  // IMPORTANT: brand buttons in SLDS ship with a default box-shadow whose
  // static rule carries `!important`. @keyframes values cannot use
  // !important (spec forbids it), so an animated box-shadow lost to SLDS
  // silently. Switch to `filter: drop-shadow()` for the button pulse —
  // SLDS doesn't style filter on buttons, so no collision. Also doubled
  // the opacity math because 0.15 peak on same-color-accent was borderline
  // even without the override problem.
  const glowMin = (0.25 * k).toFixed(3);
  const glowMax = (0.55 * k).toFixed(3);
  const glowSpeed = Math.round(3000 / mult);
  const focusSpeed = Math.round(2500 / mult);
  const innerA = (0.16 * k).toFixed(3);
  const innerPx = Math.round(15 * mult);

  const prelude = `
@keyframes sf-themer-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 ${Math.round(6 * mult)}px rgba(${accentRgb}, ${glowMin})); }
  50%      { filter: drop-shadow(0 0 ${Math.round(14 * mult)}px rgba(${accentRgb}, ${glowMax})); }
}
@keyframes sf-themer-focus-glow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(${accentRgb}, ${(0.35 * s).toFixed(3)}); }
  50%      { box-shadow: 0 0 0 4px rgba(${accentRgb}, ${(0.25 * s).toFixed(3)}),
                          0 0 ${innerPx}px rgba(${accentRgb}, ${innerA}); }
}`.trim();

  return {
    cssPrelude: prelude,
    cssRules: [
      { selectorRole: 'brandButton',
        declarations: { animation: `sf-themer-glow-pulse ${glowSpeed}ms ease-in-out infinite` } },
      { selectorRole: 'navActive',
        declarations: { animation: `sf-themer-glow-pulse ${Math.round(glowSpeed * 1.3)}ms ease-in-out infinite` } },
      { selectorRole: 'inputFocus',
        declarations: { animation: `sf-themer-focus-glow ${focusSpeed}ms ease-in-out infinite` } },
    ],
    runtimeConfig: null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Border Shimmer — animated gradient edge along card top.
// ────────────────────────────────────────────────────────────────────────────

function buildBorderShimmerRules(intensityLevel, accentHex, scale) {
  const { accentRgb } = deriveColors(accentHex);
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;
  const s = typeof scale === 'number' ? scale : 1.0;

  const shimmerSpeed = Math.round(3000 / mult);
  const shimmerAlpha = (0.6 * mult * s).toFixed(3);

  const prelude = `
@keyframes sf-themer-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}`.trim();

  return {
    cssPrelude: prelude,
    cssRules: [
      { selectorRole: 'cardShimmerContainer',
        declarations: { position: 'relative', overflow: 'clip' } },
      { selectorRole: 'cardShimmerEdge',
        declarations: {
          content: "''",
          position: 'absolute',
          top: '0', left: '0', right: '0',
          height: '1px',
          background: `linear-gradient(90deg, transparent 0%, transparent 40%, rgba(${accentRgb}, ${shimmerAlpha}) 50%, transparent 60%, transparent 100%)`,
          'background-size': '200% 100%',
          animation: `sf-themer-shimmer ${shimmerSpeed}ms ease-in-out infinite`,
          'z-index': '1',
          'pointer-events': 'none',
        } },
    ],
    runtimeConfig: null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Gradient Borders — rotating conic-gradient edge around cards (uses @property
// for smooth angle interpolation; needs Chrome 85+).
// ────────────────────────────────────────────────────────────────────────────

function buildGradientBordersRules(intensityLevel, accentHex, scale) {
  const { accentRgb } = deriveColors(accentHex);
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;
  const s = typeof scale === 'number' ? scale : 1.0;

  // gradientBorders-specific floor — subtle at mult=0.5 produced an alpha
  // of 0.4 on a thin ring, which reads as basically no effect on most
  // backgrounds. Clamp the effective multiplier so even subtle is visible
  // while medium/strong keep their full reach.
  const k = Math.max(0.7, mult * s);
  const rotateSpeed = Math.round(4000 / mult);
  const gradientAlpha = Math.min(1, (0.8 * k)).toFixed(3);

  const prelude = `
@property --sf-border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
@keyframes sf-themer-border-rotate {
  to { --sf-border-angle: 360deg; }
}`.trim();

  return {
    cssPrelude: prelude,
    cssRules: [
      { selectorRole: 'cardGradientContainer',
        declarations: { position: 'relative' } },
      { selectorRole: 'cardGradientEdge',
        declarations: {
          content: "''",
          position: 'absolute',
          inset: '0',
          padding: '1px',
          'border-radius': 'inherit',
          background: `conic-gradient(from var(--sf-border-angle), rgba(${accentRgb}, ${gradientAlpha}) 0%, transparent 25%, transparent 75%, rgba(${accentRgb}, ${gradientAlpha}) 100%)`,
          '-webkit-mask': 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          '-webkit-mask-composite': 'xor',
          'mask-composite': 'exclude',
          animation: `sf-themer-border-rotate ${rotateSpeed}ms linear infinite`,
          'pointer-events': 'none',
          'z-index': '1',
        } },
    ],
    runtimeConfig: null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Neon Flicker — erratic + breathing text-shadow glows on headings/nav.
// ────────────────────────────────────────────────────────────────────────────

function buildNeonFlickerRules(intensityLevel, accentHex, scale) {
  const { accentRgb } = deriveColors(accentHex);
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;
  const s = typeof scale === 'number' ? scale : 1.0;
  const k = mult * s;

  const a1 = Math.min(1, (0.8 * k)).toFixed(3);
  const a2 = (0.5 * k).toFixed(3);
  const a3 = (0.3 * k).toFixed(3);
  const a4 = (0.15 * k).toFixed(3);
  const b1 = (0.4 * k).toFixed(3);
  const b2 = (0.2 * k).toFixed(3);
  const b3 = (0.6 * k).toFixed(3);
  const b4 = (0.35 * k).toFixed(3);
  const b5 = (0.15 * k).toFixed(3);

  const prelude = `
@keyframes sf-themer-neon-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
    text-shadow:
      0 0 4px rgba(${accentRgb}, ${a1}),
      0 0 11px rgba(${accentRgb}, ${a2}),
      0 0 19px rgba(${accentRgb}, ${a3}),
      0 0 40px rgba(${accentRgb}, ${a4});
  }
  20%, 24%, 55% { text-shadow: none; }
}
@keyframes sf-themer-neon-breathe {
  0%, 100% {
    text-shadow:
      0 0 4px rgba(${accentRgb}, ${b1}),
      0 0 10px rgba(${accentRgb}, ${b2});
  }
  50% {
    text-shadow:
      0 0 8px rgba(${accentRgb}, ${b3}),
      0 0 20px rgba(${accentRgb}, ${b4}),
      0 0 35px rgba(${accentRgb}, ${b5});
  }
}`.trim();

  const flickerMs = Math.round(4000 / mult);
  const breatheMs = Math.round(3000 / mult);
  const cardMs    = Math.round(5000 / mult);

  return {
    cssPrelude: prelude,
    cssRules: [
      { selectorRole: 'titleFlicker',
        declarations: { animation: `sf-themer-neon-flicker ${flickerMs}ms ease-in-out infinite` } },
      { selectorRole: 'navBreathe',
        declarations: { animation: `sf-themer-neon-breathe ${breatheMs}ms ease-in-out infinite` } },
      { selectorRole: 'cardHeaderBreathe',
        declarations: { animation: `sf-themer-neon-breathe ${cardMs}ms ease-in-out infinite` } },
    ],
    runtimeConfig: null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Aurora — slow-moving ambient gradient behind content. Three accent-derived
// blobs, hue-rotated by the keyframe. isDark toggles between a dark-blob /
// dark-bg palette and a light-blob / light-bg palette.
// ────────────────────────────────────────────────────────────────────────────

function _hexToHsl(hex) {
  const clean = (hex || '#4a6fa5').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function _hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function _deriveAuroraBlobs(accent, isDark) {
  const hsl = _hexToHsl(accent);
  const s = isDark ? Math.max(50, hsl.s) : Math.max(35, Math.min(60, hsl.s));
  // Blobs need to CONTRAST with the page bg — not match it. Old logic had
  // dark blobs on dark themes (baseL 18) / light blobs on light themes
  // (baseL 88), which was invisible by design. Flip it: light blobs on
  // dark themes, mid-saturated blobs on light themes.
  const baseL = isDark ? 68 : 42;
  return [
    _hslToHex(hsl.h, s, baseL),
    _hslToHex((hsl.h + 60) % 360, s, baseL + (isDark ? -6 : 4)),
    _hslToHex((hsl.h + 180) % 360, s, baseL + (isDark ? -3 : 2)),
  ];
}

function buildAuroraRules(intensityLevel, accentHex, opts) {
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;
  const s = (opts && typeof opts.scale === 'number') ? opts.scale : 1.0;
  const isDark = !!(opts && opts.isDark);

  // Aurora sits BEHIND cards (adapter transparentizes SF's viewport-
  // filling wrappers so aurora shows through the gaps between cards).
  // 0.35 base → 0.56 peak. Higher than that and the 3 blobs merge
  // into a solid-looking wash; lower and the effect disappears.
  const auroraOpacity = (0.35 * mult * s).toFixed(3);
  const auroraSpeed = Math.round(25000 / mult);
  const [a1, a2, a3] = _deriveAuroraBlobs(accentHex, isDark);

  // IMPORTANT: do NOT animate filter here. Blur is one of the most
  // expensive CSS properties — re-running a 120px blur on a 200%-viewport
  // element every animation frame will stall Chrome and surface a "Page
  // Unresponsive" prompt. Static blur in the declarations + only animate
  // background-position. The effect still reads as moving ambient light;
  // dropping the hue-rotate is an acceptable simplification for stability.
  const prelude = `
@keyframes sf-themer-aurora {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`.trim();

  return {
    cssPrelude: prelude,
    cssRules: [
      { selectorRole: 'bodyWrapper',
        declarations: {
          content: "''",
          position: 'fixed',
          inset: '-50%',
          // pointer-events:none is load-bearing — aurora paints ABOVE SF
          // content at a max-ish z-index, so without this every click
          // would be swallowed by the overlay. Blob gradients fade to
          // transparent at 50% radius, so between blob centers the layer
          // is fully see-through; only the blob regions tint content.
          'pointer-events': 'none',
          // z-index: -1 puts aurora BEHIND body's content within body's
          // stacking context. Requires body + the viewport-filling
          // wrappers (.flexipagePage, .sellerHomeContainer, etc.) to be
          // transparentized by the SF adapter so aurora can peek through
          // the gaps between cards. Cards keep their opaque bg and paint
          // above aurora — the exact "behind cards" effect we want.
          'z-index': '-1',
          opacity: String(auroraOpacity),
          // Blob radius 35% (down from 50%) — tighter blobs with clear
          // gaps between them so the effect reads as 3 distinct colored
          // regions rather than a solid-color wash.
          background:
            `radial-gradient(ellipse at 20% 50%, ${a1} 0%, transparent 35%),` +
            `radial-gradient(ellipse at 80% 20%, ${a2} 0%, transparent 35%),` +
            `radial-gradient(ellipse at 50% 80%, ${a3} 0%, transparent 35%)`,
          'background-size': '200% 200%',
          animation: `sf-themer-aurora ${auroraSpeed}ms ease-in-out infinite`,
          // No filter:blur. Tried 120px and 80px — both caused "Page
          // Unresponsive" on SF pages with heavy DOM mutation (Aura/LWC
          // constantly update, even a static blur on a GPU-promoted layer
          // stalls compositing under load). The radial gradients fade to
          // transparent at 50% radius naturally, which provides the soft-
          // edge look without needing a filter.
          // Also dropped :has() on html (was triggering selector match on
          // every SF DOM mutation — O(n) cost, unacceptable on Aura pages).
          'will-change': 'background-position',
          // No blend mode — plain alpha compositing. See SF-DOM-MAP
          // 2026-04-16 blend-mode table: overlay fails on white cards
          // (screen math returns white regardless of blend color),
          // soft-light too subtle, multiply/screen are one-direction-only.
          // Plain alpha tints predictably on any bg.
        },
      },
    ],
    runtimeConfig: null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// renderRules — The primary adapter-facing API. Given an effect id + config,
// returns a structured IR the adapter walks and binds to its selectors.
//
// IR shape:
//   {
//     cssRules: [{ selectorRole, declarations, keyframes?, animation? }, ...],
//     runtimeConfig: { particles?, cursorTrail? }  // for canvas effects
//   }
//
// Selector roles (canonical vocabulary):
//   bodyWrapper   - root surface element (body for content script, preview frame for Builder)
//   card          - card containers (.slds-card / .preview-card / .guide-effect-preview-card)
//   brandButton   - primary brand buttons
//   headerTitle   - page/section titles
//   navActive     - active nav tab
//
// Only effects that have been migrated return populated cssRules. Others
// return null so adapters can fall through to legacy code paths during
// migration. This keeps the refactor incremental and reversible.
// ────────────────────────────────────────────────────────────────────────────

function renderRules(effectId, config, accentHex, opts) {
  if (!config) return null;
  const intensity = (config[effectId + 'Intensity']) || 'medium';
  // context.scale — preview=1.0 (default), fullscreen=~0.55. Adapters pass
  // their own context so the engine stays the single source of truth for
  // how patterns feel at each scale.
  const scale = (opts && typeof opts.scale === 'number') ? opts.scale : 1.0;

  switch (effectId) {
    case 'backgroundPattern': {
      const style = config.backgroundPattern;
      if (!style || style === 'none') return null;
      const declarations = buildBackgroundPatternDeclarations(style, accentHex, intensity, scale);
      if (!declarations) return null;
      return {
        cssRules: [
          {
            selectorRole: 'bodyWrapper',
            declarations,
            // Content script needs stacking context lift on direct children so
            // pattern sits behind them. Adapters for other surfaces may ignore.
            childrenLift: true,
          },
        ],
        runtimeConfig: null,
      };
    }

    case 'hoverLift': {
      if (!config.hoverLift) return null;
      const d = buildHoverLiftDeclarations(intensity, scale);
      return {
        cssRules: [
          { selectorRole: 'cardTransition', declarations: d.cardTransition },
          { selectorRole: 'cardHover',      declarations: d.cardHover },
          { selectorRole: 'buttonHover',    declarations: d.buttonHover },
          { selectorRole: 'rowTransition',  declarations: d.rowTransition },
          { selectorRole: 'rowHover',       declarations: d.rowHover },
        ],
        runtimeConfig: null,
      };
    }

    case 'ambientGlow':
      if (!config.ambientGlow) return null;
      return buildAmbientGlowRules(intensity, accentHex, scale);

    case 'borderShimmer':
      // DEPRECATED: subsumed by 'borderEffect' with style='shimmer'.
      // Kept so legacy configs that still set the old boolean work.
      if (!config.borderShimmer) return null;
      return buildBorderShimmerRules(intensity, accentHex, scale);

    case 'gradientBorders':
      // DEPRECATED: subsumed by 'borderEffect' with style='gradient'.
      if (!config.gradientBorders) return null;
      return buildGradientBordersRules(intensity, accentHex, scale);

    case 'borderEffect': {
      // Consolidated border effect. config.borderEffect is one of
      // 'none' | 'shimmer' | 'gradient'; config.borderEffectIntensity is the
      // intensity. Replaces the old mutually-exclusive-anyway pair of
      // borderShimmer + gradientBorders booleans.
      const style = config.borderEffect;
      if (!style || style === 'none') return null;
      const beIntensity = config.borderEffectIntensity || 'medium';
      if (style === 'shimmer') return buildBorderShimmerRules(beIntensity, accentHex, scale);
      if (style === 'gradient') return buildGradientBordersRules(beIntensity, accentHex, scale);
      return null;
    }

    case 'neonFlicker':
      if (!config.neonFlicker) return null;
      return buildNeonFlickerRules(intensity, accentHex, scale);

    case 'aurora':
      if (!config.aurora) return null;
      return buildAuroraRules(intensity, accentHex, { scale, isDark: !!(opts && opts.isDark) });

    // Other effects not yet migrated — fall through to legacy in consumers.
    default:
      return null;
  }
}

/**
 * cssFromDeclarations — turn a declarations object into a CSS string, respecting
 * an optional `important` flag (content script needs !important to override
 * Salesforce's own inline styles; preview surfaces don't).
 */
function cssFromDeclarations(declarations, opts) {
  const important = opts && opts.important ? ' !important' : '';
  return Object.entries(declarations)
    .map(([prop, val]) => `  ${prop}: ${val}${important};`)
    .join('\n');
}


// ────────────────────────────────────────────────────────────────────────────
// Exports — global for browsers, module.exports for Node (tests + drift script)
// ────────────────────────────────────────────────────────────────────────────

const API = {
  // Primitives
  INTENSITY_LADDER,
  EFFECT_METADATA,
  EFFECT_PAIRING_MATRIX,
  // Helpers
  getIntensity,
  hexToRgbCsv,
  deriveColors,
  // Effect-specific
  buildBackgroundPatternDeclarations,
  buildHoverLiftDeclarations,
  buildAmbientGlowRules,
  buildBorderShimmerRules,
  buildGradientBordersRules,
  buildNeonFlickerRules,
  buildAuroraRules,
  // Main adapter API
  renderRules,
  cssFromDeclarations,
  // Version marker — consumers check this exists before using new paths
  VERSION: '1.0.0',
};

global.SFThemerEffectsEngine = API;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}

})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));

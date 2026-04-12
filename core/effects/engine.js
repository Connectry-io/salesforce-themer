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

function buildBackgroundPatternDeclarations(pattern, accentHex, intensityLevel) {
  const { accentRgb } = deriveColors(accentHex);
  const mult = (INTENSITY_LADDER[intensityLevel] || INTENSITY_LADDER.medium).mult;

  // Per-pattern base opacity scaled by intensity multiplier.
  // Also scales line/dot thickness so Subtle/Medium/Strong are perceivable on
  // thin-line patterns (was an issue that prompted this refactor).
  const opacity = (base) => (base * mult).toFixed(3);
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

function renderRules(effectId, config, accentHex) {
  if (!config) return null;
  const intensity = (config[effectId + 'Intensity']) || 'medium';

  switch (effectId) {
    case 'backgroundPattern': {
      const style = config.backgroundPattern;
      if (!style || style === 'none') return null;
      const declarations = buildBackgroundPatternDeclarations(style, accentHex, intensity);
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

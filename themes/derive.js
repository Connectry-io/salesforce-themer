/**
 * Salesforce Themer — Theme Derivation Engine
 * Takes 23 core color values and derives the full ~81 keys needed by generateThemeCSS().
 *
 * Usage:
 *   const fullColors = deriveFullTheme(coreValues);
 *   const css = generateThemeCSS({ id: 'custom', colors: fullColors });
 *
 * The derivation engine respects overrides: if a derived key is already present
 * in the input, it won't be recalculated. This allows the Advanced panel to
 * override any derived value.
 */

'use strict';

// Color utilities — inlined here for service worker compatibility (no imports).
// Canonical source: themes/color-utils.js

function _parseColor(color) {
  if (!color || typeof color !== 'string') return null;
  color = color.trim();
  if (color[0] === '#') {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
    }
    if (hex.length >= 6) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
    }
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}

function _rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
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

function _hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q-p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q-p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1+s) : l + s - l*s;
  const p = 2*l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

function _lighten(hex, amount) {
  const c = _parseColor(hex); if (!c) return hex;
  const hsl = _rgbToHsl(c.r, c.g, c.b);
  hsl.l = Math.min(100, hsl.l + amount);
  const rgb = _hslToRgb(hsl.h, hsl.s, hsl.l);
  return _rgbToHex(rgb.r, rgb.g, rgb.b);
}

function _darken(hex, amount) {
  const c = _parseColor(hex); if (!c) return hex;
  const hsl = _rgbToHsl(c.r, c.g, c.b);
  hsl.l = Math.max(0, hsl.l - amount);
  const rgb = _hslToRgb(hsl.h, hsl.s, hsl.l);
  return _rgbToHex(rgb.r, rgb.g, rgb.b);
}

function _alpha(hex, opacity) {
  const c = _parseColor(hex); if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
}

function _contrast(hex) {
  const c = _parseColor(hex); if (!c) return '#ffffff';
  const [rs, gs, bs] = [c.r, c.g, c.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return (0.2126*rs + 0.7152*gs + 0.0722*bs) > 0.35 ? '#1a1a1a' : '#ffffff';
}

function _mix(hex1, hex2, weight) {
  const c1 = _parseColor(hex1), c2 = _parseColor(hex2);
  if (!c1 || !c2) return hex1;
  const w = Math.max(0, Math.min(1, weight));
  return _rgbToHex(c1.r+(c2.r-c1.r)*w, c1.g+(c2.g-c1.g)*w, c1.b+(c2.b-c1.b)*w);
}

// ─── Derivation Engine ───────────────────────────────────────────────────────

/**
 * The 23 core keys that users set directly.
 * Everything else is derived from these.
 */
const CORE_KEYS = [
  'colorScheme', 'background', 'surface', 'surfaceAlt',
  'accent', 'link',
  'nav', 'navText',
  'textPrimary', 'textSecondary', 'textPlaceholder',
  'border', 'borderInput',
  'buttonBrandText', 'buttonNeutralBg',
  'tableHeaderBg',
  'modalBg', 'dropdownBg',
  'success', 'warning', 'error',
  'focusRing', 'scrollThumb',
];

/**
 * Derive a full theme colors object from core values.
 *
 * @param {Object} input - Object containing some or all of the 81 color keys.
 *   At minimum, the 23 core keys should be present.
 *   Any additional keys are treated as explicit overrides and won't be recalculated.
 * @returns {Object} Full colors object with all ~81 keys populated.
 */
function deriveFullTheme(input) {
  const c = { ...input };
  const isDark = c.colorScheme === 'dark';

  // Helper: set a key only if not already present (respects overrides)
  const derive = (key, valueFn) => {
    if (c[key] === undefined || c[key] === null) {
      c[key] = valueFn();
    }
  };

  // ── Surfaces ──────────────────────────────────────────────────────────────
  derive('surfaceHover',     () => isDark ? _lighten(c.surface, 5) : _darken(c.surface, 3));
  derive('surfaceHighlight', () => _alpha(c.accent, 0.10));
  derive('surfaceSelection', () => _alpha(c.accent, 0.15));

  // ── Accent variants ───────────────────────────────────────────────────────
  derive('accentHover',  () => _darken(c.accent, isDark ? 15 : 10));
  derive('accentActive', () => _darken(c.accent, isDark ? 25 : 20));
  derive('accentLight',  () => _alpha(c.accent, 0.15));

  // ── Text ──────────────────────────────────────────────────────────────────
  derive('textMuted', () => _mix(c.textSecondary, c.textPlaceholder, isDark ? 0.6 : 0.4));

  // ── Navigation ────────────────────────────────────────────────────────────
  derive('navHover',        () => 'rgba(255, 255, 255, 0.12)');
  derive('navActive',       () => 'rgba(255, 255, 255, 0.2)');
  // Most themes use navText for active border; accent-themed navs override in Advanced
  derive('navActiveBorder', () => c.navText);
  derive('navBorder',       () => _mix(c.nav, isDark ? '#000000' : '#000000', isDark ? 0.3 : 0.15));
  derive('navIcon',         () => c.navText);
  derive('navActiveText',   () => c.navText);
  derive('navAppName',      () => c.navText);
  derive('navAppBorder',    () => 'rgba(255, 255, 255, 0.2)');
  derive('navWaffleDot',    () => c.navText);

  // ── Links ─────────────────────────────────────────────────────────────────
  derive('linkHover', () => isDark ? _lighten(c.link, 12) : _darken(c.link, 20));

  // ── Borders ───────────────────────────────────────────────────────────────
  derive('borderSeparator', () => c.border);

  // ── Buttons ───────────────────────────────────────────────────────────────
  derive('buttonBrandBg',      () => c.accent);
  derive('buttonBrandBorder',  () => c.accent);
  derive('buttonBrandHover',   () => _darken(c.accent, 10));
  derive('buttonNeutralBorder', () => c.borderInput);
  derive('buttonNeutralHover',  () => isDark ? _lighten(c.surface, 5) : _darken(c.surface, 3));
  derive('buttonNeutralText',   () => c.textPrimary);

  // ── Tables ────────────────────────────────────────────────────────────────
  derive('tableHeaderText', () => c.textSecondary);
  derive('tableAltRow',     () => isDark ? _lighten(c.surface, 2) : _darken(c.surface, 1));
  derive('tableHoverRow',   () => _alpha(c.accent, 0.10));
  derive('tableBorderRow',  () => c.border);
  derive('tableColBorder',  () => isDark ? c.border : _lighten(c.border, 5));

  // ── Modals ────────────────────────────────────────────────────────────────
  derive('modalHeaderBg',  () => isDark ? _darken(c.surface, 5) : c.surface);
  derive('modalFooterBg',  () => isDark ? _darken(c.surface, 5) : c.background);
  derive('modalBackdrop',  () => isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.4)');
  derive('modalShadow',    () => isDark
    ? '0 20px 60px rgba(0, 0, 0, 0.6)'
    : '0 20px 60px rgba(0, 0, 0, 0.12)');

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  derive('dropdownItemHoverBg',   () => _alpha(c.accent, 0.10));
  derive('dropdownItemHoverText', () => c.textPrimary);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  derive('tabNavBorder',    () => c.border);
  derive('tabActiveColor',  () => c.accent);
  derive('tabActiveBorder', () => c.accent);
  derive('tabInactiveColor', () => c.textSecondary);
  derive('tabContentBg',    () => c.surface);

  // ── Focus ─────────────────────────────────────────────────────────────────
  // focusRing is a core key but if not set, derive it
  derive('focusRing', () => `0 0 0 3px ${_alpha(c.accent, 0.3)}`);

  // ── Scrollbar ─────────────────────────────────────────────────────────────
  derive('scrollTrack',     () => isDark ? _darken(c.background, 10) : _darken(c.background, 2));
  derive('scrollThumbHover', () => c.textPlaceholder);

  // ── Badges & Pills ────────────────────────────────────────────────────────
  derive('badgeBg',     () => isDark ? _alpha(c.accent, 0.15) : c.accent);
  derive('badgeText',   () => isDark ? c.accent : _contrast(c.accent));
  derive('badgeBorder', () => isDark ? `1px solid ${_alpha(c.accent, 0.3)}` : 'none');
  derive('pillBg',      () => _alpha(c.accent, 0.10));
  derive('pillBorder',  () => c.borderInput);
  derive('pillText',    () => c.textPrimary);

  // ── Panels ────────────────────────────────────────────────────────────────
  derive('panelBg',     () => c.surface);
  derive('panelBorder', () => c.border);

  // ── Search (primarily for dark themes with white header) ──────────────────
  derive('searchBg',          () => isDark ? _darken(c.surface, 10) : c.surface);
  derive('searchText',        () => isDark ? c.textPrimary : c.textPrimary);
  derive('searchBorder',      () => isDark ? c.border : c.borderInput);
  derive('searchPlaceholder', () => isDark ? c.textSecondary : c.textPlaceholder);
  derive('searchFocusBorder', () => c.accent);
  derive('searchFocusShadow', () => `0 0 0 2px ${_alpha(c.accent, 0.25)}`);

  // ── Global header ─────────────────────────────────────────────────────────
  derive('globalHeaderWhite', () => true);

  return c;
}

/**
 * Extract the 23 core values from a full theme colors object.
 * Useful for populating the editor from an existing theme.
 */
function extractCoreValues(fullColors) {
  const core = {};
  for (const key of CORE_KEYS) {
    if (fullColors[key] !== undefined) {
      core[key] = fullColors[key];
    }
  }
  return core;
}

/**
 * Resolve a custom theme: base theme + core overrides + derivation + advanced overrides.
 *
 * @param {Object} baseColors - Full colors from the base OOTB theme
 * @param {Object} coreOverrides - User's changes to core values (up to 23 keys)
 * @param {Object} advancedOverrides - User's changes to derived values
 * @returns {Object} Full resolved colors object
 */
function resolveCustomTheme(baseColors, coreOverrides, advancedOverrides) {
  // 1. Start with base theme's core values
  const core = extractCoreValues(baseColors);

  // 2. Apply user's core overrides
  Object.assign(core, coreOverrides || {});

  // 3. Run derivation engine (fills in ~58 derived values)
  const derived = deriveFullTheme(core);

  // 4. Apply user's advanced overrides (wins over derivation)
  Object.assign(derived, advancedOverrides || {});

  return derived;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined') {
  module.exports = { deriveFullTheme, extractCoreValues, resolveCustomTheme, CORE_KEYS };
}

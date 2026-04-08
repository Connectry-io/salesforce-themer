/**
 * Salesforce Themer — Color Utilities
 * Pure functions for color manipulation used by the derivation engine.
 * No dependencies. Works in service worker, content script, and options page.
 */

'use strict';

/**
 * Parse any CSS color to { r, g, b, a } (0-255 for rgb, 0-1 for a).
 * Supports: #rgb, #rrggbb, #rrggbbaa, rgb(), rgba().
 * Returns null on failure.
 */
function parseColor(color) {
  if (!color || typeof color !== 'string') return null;
  color = color.trim();

  // Hex: #rgb, #rrggbb, #rrggbbaa
  if (color[0] === '#') {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    return null;
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    };
  }

  return null;
}

/**
 * Convert { r, g, b } to #rrggbb hex string.
 */
function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert RGB (0-255) to HSL (h: 0-360, s: 0-100, l: 0-100).
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
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

/**
 * Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB (0-255).
 */
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Lighten a hex color by a percentage (0-100).
 * @param {string} hex - e.g. "#2c3038"
 * @param {number} amount - e.g. 10 for 10%
 * @returns {string} hex
 */
function lighten(hex, amount) {
  const c = parseColor(hex);
  if (!c) return hex;
  const hsl = rgbToHsl(c.r, c.g, c.b);
  hsl.l = Math.min(100, hsl.l + amount);
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Darken a hex color by a percentage (0-100).
 */
function darken(hex, amount) {
  const c = parseColor(hex);
  if (!c) return hex;
  const hsl = rgbToHsl(c.r, c.g, c.b);
  hsl.l = Math.max(0, hsl.l - amount);
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Return a hex color as rgba() with the given opacity (0-1).
 * @param {string} hex
 * @param {number} opacity - 0 to 1
 * @returns {string} e.g. "rgba(74, 111, 165, 0.15)"
 */
function alpha(hex, opacity) {
  const c = parseColor(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
}

/**
 * Return white or dark text for best readability on the given background.
 * Uses WCAG relative luminance formula.
 * @param {string} hex - background color
 * @returns {string} "#ffffff" or "#1a1a1a"
 */
function contrast(hex) {
  const c = parseColor(hex);
  if (!c) return '#ffffff';
  // Relative luminance
  const [rs, gs, bs] = [c.r, c.g, c.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  return luminance > 0.35 ? '#1a1a1a' : '#ffffff';
}

/**
 * Mix two hex colors. weight 0 = all color1, 1 = all color2.
 * @param {string} hex1
 * @param {string} hex2
 * @param {number} weight - 0 to 1
 * @returns {string} hex
 */
function mix(hex1, hex2, weight) {
  const c1 = parseColor(hex1);
  const c2 = parseColor(hex2);
  if (!c1 || !c2) return hex1;
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    c1.r + (c2.r - c1.r) * w,
    c1.g + (c2.g - c1.g) * w,
    c1.b + (c2.b - c1.b) * w
  );
}

/**
 * Convert hex to "R, G, B" string for use in rgba() template literals.
 * @param {string} hex
 * @returns {string} e.g. "74, 111, 165"
 */
function hexToRgb(hex) {
  const c = parseColor(hex);
  if (!c) return '74, 111, 165';
  return `${c.r}, ${c.g}, ${c.b}`;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined') {
  module.exports = { parseColor, lighten, darken, alpha, contrast, mix, hexToRgb, rgbToHex, rgbToHsl, hslToRgb };
}

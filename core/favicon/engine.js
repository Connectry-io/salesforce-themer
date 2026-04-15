/**
 * Connectry Favicon Engine — canonical favicon SVG builder.
 *
 * Single source of truth for every surface that renders a theme favicon:
 *   - content.js       → the real Chrome tab favicon on SF pages
 *   - options.js       → Hero preview, theme cards, Builder preview iframe,
 *                        Guide tab interactive demo, Studio popup preview
 *
 * Before monocode: each surface owned its own icon list and its own SVG
 * builder. Two lists could drift (icon added to Studio, never reached the
 * real tab) and two builders could disagree on shape math. Now everyone
 * calls ConnectryFavicon.buildSVG(config, size).
 *
 * Usage:
 *   const svg = ConnectryFavicon.buildSVG({ shape, color, icon }, size);
 *   // returns '<svg …>…</svg>' as string
 *
 *   const icons = ConnectryFavicon.ICONS;
 *   // [{ id, label, svg }, …] for rendering pickers
 */
(() => {
  'use strict';

  const ns = (self.ConnectryFavicon = self.ConnectryFavicon || {});
  if (ns._loaded) return;
  ns._loaded = true;

  // Icon library. Each `svg` is the glyph path(s) only — background shape is
  // applied by buildSVG based on the shape config. Colored paths use
  // `fill="white"` / `stroke="white"` as placeholders; when shape === 'none',
  // those get rewritten to the user's chosen color.
  const ICONS = [
    { id: 'connectry', label: 'Connectry', svg: '<circle cx="8" cy="16" r="4" fill="white"/><line x1="12" y1="16" x2="20" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="16" r="4" fill="white" opacity="0.7"/>' },
    { id: 'snowflake', label: 'Snowflake', svg: '<path d="M16 4v24M4 16h24M8 8l16 16M24 8L8 24" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="white"/>' },
    { id: 'flame', label: 'Flame', svg: '<path d="M16 4c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z" fill="white" opacity="0.9"/><path d="M16 12c0 3-3 4-3 7a3 3 0 006 0c0-3-3-4-3-7z" fill="white" opacity="0.5"/>' },
    { id: 'moon', label: 'Moon', svg: '<path d="M20 6a10 10 0 11-8 20 12 12 0 008-20z" fill="white" opacity="0.9"/>' },
    { id: 'bolt', label: 'Bolt', svg: '<path d="M18 4L8 18h7l-3 10 10-14h-7l3-10z" fill="white" opacity="0.9"/>' },
    { id: 'leaf', label: 'Leaf', svg: '<path d="M8 24C8 12 16 4 28 4c0 12-8 20-20 20z" fill="white" opacity="0.85"/><path d="M8 24c4-4 10-8 16-12" stroke="white" stroke-width="1.5" opacity="0.5"/>' },
    { id: 'star', label: 'Star', svg: '<path d="M16 4l3.5 8 8.5 1-6.5 6 2 8.5L16 23l-7.5 4.5 2-8.5L4 13l8.5-1z" fill="white" opacity="0.9"/>' },
    { id: 'diamond', label: 'Diamond', svg: '<path d="M16 3l11 13-11 13L5 16z" fill="white" opacity="0.85"/>' },
    { id: 'shield', label: 'Shield', svg: '<path d="M16 3L5 8v7c0 7 5 12 11 14 6-2 11-7 11-14V8L16 3z" fill="white" opacity="0.85"/>' },
    { id: 'heart', label: 'Heart', svg: '<path d="M16 28s-10-6-10-14a5.5 5.5 0 0111 0 5.5 5.5 0 0111 0c0 8-12 14-12 14z" fill="white" opacity="0.9" transform="translate(0,-2)"/>' },
    { id: 'circle', label: 'Circle', svg: '<circle cx="16" cy="16" r="8" fill="white" opacity="0.85"/>' },
    { id: 'waves', label: 'Waves', svg: '<path d="M4 12c4-3 8 3 12 0s8 3 12 0M4 18c4-3 8 3 12 0s8 3 12 0" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.85"/>' },
  ];

  const DEFAULT_CONFIG = { shape: 'circle', color: '#4A6FA5', icon: 'connectry' };

  // Monogram system: every preset uses the Connectry glyph tinted with its
  // accent color. Pro users override via an explicit `favicon` config on
  // their custom theme (including image uploads, future).
  const THEME_ICON_MAP = {};

  /**
   * Resolve the default favicon config for a theme when it hasn't set one
   * explicitly. Defaults to the Connectry glyph on a circle tinted with the
   * theme's accent — consistent Connectry branding across presets, with the
   * theme accent as the only differentiator. Explicit per-theme `favicon`
   * configs (including a THEME_ICON_MAP lookup) still override this default.
   */
  function defaultForTheme(themeId, accent) {
    return {
      shape: 'circle',
      color: accent || DEFAULT_CONFIG.color,
      icon: 'connectry',
    };
  }

  function _findIcon(iconId) {
    return ICONS.find(i => i.id === iconId) || ICONS[0];
  }

  function _buildBackground(shape, color) {
    if (shape === 'circle') return `<circle cx="16" cy="16" r="15" fill="${color}"/>`;
    if (shape === 'rounded') return `<rect x="1" y="1" width="30" height="30" rx="6" fill="${color}"/>`;
    if (shape === 'square') return `<rect x="1" y="1" width="30" height="30" rx="1" fill="${color}"/>`;
    return ''; // 'none' = transparent background
  }

  /**
   * Build a theme favicon SVG string.
   * @param {{shape?: string, color?: string, icon?: string}} config
   * @param {number} [size=32] Rendered width/height in px. viewBox is always 32.
   * @returns {string} '<svg …>…</svg>'
   */
  function buildSVG(config, size) {
    const shape = (config && config.shape) || DEFAULT_CONFIG.shape;
    const color = (config && config.color) || DEFAULT_CONFIG.color;
    const iconId = (config && config.icon) || DEFAULT_CONFIG.icon;
    const dim = size || 32;
    const icon = _findIcon(iconId);
    const bg = _buildBackground(shape, color);
    // When there's no background, recolor the glyph's white placeholders
    // with the chosen color so it remains visible on any tab.
    const glyph = shape === 'none' ? icon.svg.replace(/white/g, color) : icon.svg;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${dim}" height="${dim}">${bg}${glyph}</svg>`;
  }

  Object.assign(ns, {
    ICONS,
    DEFAULT_CONFIG,
    THEME_ICON_MAP,
    defaultForTheme,
    buildSVG,
  });
})();

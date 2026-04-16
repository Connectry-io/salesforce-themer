/**
 * Connectry Favicon Engine — content-script runtime mirror.
 *
 * SSOT for favicon logic is themes/engine.js (FAVICON_ICONS, renderFavicon,
 * defaultFaviconForTheme). This file is a SUBSET COPY loaded in content_scripts
 * only, because content.js needs runtime favicon rendering on SF tabs (for
 * custom themes at apply time) and themes/engine.js is too large to load on
 * every SF page (Migration A2 removed it from the content-script path).
 *
 * Options + popup load themes/engine.js directly; its compat shim populates
 * the same `self.ConnectryFavicon` global — so call sites work identically
 * in every surface.
 *
 * Drift: scripts/check-theme-drift.js asserts that the ICONS array here
 * matches the FAVICON_ICONS array in themes/engine.js. If you add an icon or
 * change a glyph, update BOTH files. (If this becomes tedious, a future
 * sync script can regenerate this file from themes/engine.js.)
 *
 * Usage (unchanged from the pre-A2 API):
 *   const svg = ConnectryFavicon.buildSVG({ shape, color, icon }, size);
 *   const icons = ConnectryFavicon.ICONS;
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
  // Favicon glyphs render at 16px in real browser tabs — they need to read
  // as bold, solid marks. No opacity on the paths; transparency is owned by
  // the shape=none background, not the glyph.
  const ICONS = [
    { id: 'connectry', label: 'Connectry', svg: '<circle cx="8" cy="16" r="4" fill="white"/><line x1="12" y1="16" x2="20" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="16" r="4" fill="white"/>' },
    { id: 'cloud', label: 'Cloud', svg: '<circle cx="10" cy="19" r="5" fill="white"/><circle cx="16" cy="14" r="6" fill="white"/><circle cx="22" cy="19" r="5" fill="white"/><rect x="10" y="19" width="12" height="5" fill="white"/>' },
    { id: 'snowflake', label: 'Snowflake', svg: '<path d="M16 4v24M4 16h24M8 8l16 16M24 8L8 24" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="white"/>' },
    { id: 'flame', label: 'Flame', svg: '<path d="M16 4c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z" fill="white"/>' },
    { id: 'moon', label: 'Moon', svg: '<path d="M20 6a10 10 0 11-8 20 12 12 0 008-20z" fill="white"/>' },
    { id: 'bolt', label: 'Bolt', svg: '<path d="M18 4L8 18h7l-3 10 10-14h-7l3-10z" fill="white"/>' },
    { id: 'leaf', label: 'Leaf', svg: '<path d="M8 24C8 12 16 4 28 4c0 12-8 20-20 20z" fill="white"/>' },
    { id: 'star', label: 'Star', svg: '<path d="M16 4l3.5 8 8.5 1-6.5 6 2 8.5L16 23l-7.5 4.5 2-8.5L4 13l8.5-1z" fill="white"/>' },
    { id: 'diamond', label: 'Diamond', svg: '<path d="M16 3l11 13-11 13L5 16z" fill="white"/>' },
    { id: 'shield', label: 'Shield', svg: '<path d="M16 3L5 8v7c0 7 5 12 11 14 6-2 11-7 11-14V8L16 3z" fill="white"/>' },
    { id: 'heart', label: 'Heart', svg: '<path d="M16 28s-10-6-10-14a5.5 5.5 0 0111 0 5.5 5.5 0 0111 0c0 8-12 14-12 14z" fill="white" transform="translate(0,-2)"/>' },
    { id: 'waves', label: 'Waves', svg: '<path d="M4 12c4-3 8 3 12 0s8 3 12 0M4 18c4-3 8 3 12 0s8 3 12 0" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>' },
  ];

  const DEFAULT_CONFIG = { shape: 'circle', color: '#4A6FA5', icon: 'connectry', iconColor: '#ffffff' };

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
    // When there's no background, an unspecified iconColor falls back to the
    // bg color so the glyph stays visible on a transparent tab — preserves
    // the pre-iconColor behavior users were relying on.
    const iconColor = (config && config.iconColor)
      || (shape === 'none' ? color : DEFAULT_CONFIG.iconColor);
    const dim = size || 32;
    const icon = _findIcon(iconId);
    const bg = _buildBackground(shape, color);
    const glyph = icon.svg.replace(/white/g, iconColor);
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

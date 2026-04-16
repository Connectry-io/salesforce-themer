/**
 * themes/engine.mjs — ESM adapter around the CommonJS theme engine.
 *
 * The canonical engine lives in themes/engine.js and uses a script-context
 * IIFE + module.exports to support three load contexts today:
 *   - Browser <script src>  (options.html, popup.html)       — self.ConnectryThemer
 *   - Node (CI)             (scripts/render-presets.mjs)     — module.exports
 *   - Service Worker        (background.js, pre-A2 only)     — importScripts/inline
 *
 * V2 adds a fourth: Supabase Edge Function (Deno, ESM). This file is the
 * bridge. When the Deno edge function for `/render-theme` gets built, it
 * imports from THIS file:
 *
 *   import { renderTheme } from '../../themes/engine.mjs';
 *
 * and gets identical behaviour to the CommonJS path without touching the
 * original engine.js. One source of truth, one canonical output.
 *
 * Part of A2 + hybrid-engine groundwork. See ARCHITECTURE.md § V2.5.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine = require('./engine.js');

export const {
  generateThemeCSS,
  renderFavicon,
  renderTheme,
  defaultFaviconForTheme,
  hexToRgb,
  FAVICON_ICONS,
  FAVICON_DEFAULT_CONFIG,
} = engine;

export default engine;

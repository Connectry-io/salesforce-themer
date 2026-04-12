/**
 * Engine Connector — Salesforce Themer Diagnostic
 *
 * Bridges the diagnostic system to the theme engine. Loads the active theme's
 * color config from themes.json so the diagnostic can:
 *   1. Know what values the theme SHOULD produce for each token
 *   2. Compare expected vs actual computed styles on each component
 *   3. Provide the fix generator with the correct color values
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  let _themesCache = null;
  let _activeThemeColors = null;
  let _activeThemeId = null;

  // ─── Theme data loading ────────────────────────────────────────────────────

  /**
   * Load themes.json from the extension's web_accessible_resources.
   * Caches the result for the session.
   */
  async function loadThemesData() {
    if (_themesCache) return _themesCache;
    try {
      const url = chrome.runtime.getURL('themes/themes.json');
      const resp = await fetch(url);
      _themesCache = await resp.json();
      return _themesCache;
    } catch (err) {
      console.warn('[SFT EngConn] Failed to load themes.json:', err.message);
      return null;
    }
  }

  /**
   * Resolve the full color config for a theme, handling both OOTB and custom themes.
   *
   * @param {string} themeId - The active theme's ID
   * @returns {Promise<Object|null>} The theme's full color config, or null
   */
  ns.resolveThemeColors = async function resolveThemeColors(themeId) {
    if (!themeId || themeId === 'none') return null;

    // Return cached if same theme
    if (_activeThemeId === themeId && _activeThemeColors) return _activeThemeColors;

    const data = await loadThemesData();
    if (!data) return null;

    // Check OOTB themes first
    const ootb = data.themes.find(t => t.id === themeId);
    if (ootb) {
      _activeThemeColors = ootb.colors;
      _activeThemeId = themeId;
      return _activeThemeColors;
    }

    // Check custom themes in storage
    try {
      const syncData = await chrome.storage.sync.get({ customThemes: [] });
      const custom = syncData.customThemes.find(t => t.id === themeId);
      if (custom) {
        const base = data.themes.find(t => t.id === custom.basedOn);
        if (base) {
          // Merge base + overrides
          _activeThemeColors = {
            ...base.colors,
            ...(custom.coreOverrides || {}),
            ...(custom.advancedOverrides || {}),
          };
          _activeThemeId = themeId;
          return _activeThemeColors;
        }
      }
    } catch (_) {}

    return null;
  };

  /**
   * Get the cached active theme colors (no async, for fast access after initial load).
   */
  ns.getActiveThemeColors = function getActiveThemeColors() {
    return _activeThemeColors;
  };

  /**
   * Resolve the display name of a theme (e.g. "Connectry Light") from its id.
   * Falls back to the id if the theme isn't found.
   */
  ns.resolveThemeName = async function resolveThemeName(themeId) {
    if (!themeId || themeId === 'none') return null;
    const data = await loadThemesData();
    if (!data) return themeId;
    const ootb = data.themes.find(t => t.id === themeId);
    if (ootb) return ootb.name || themeId;
    try {
      const syncData = await chrome.storage.sync.get({ customThemes: [] });
      const custom = syncData.customThemes.find(t => t.id === themeId);
      if (custom) return custom.name || themeId;
    } catch (_) {}
    return themeId;
  };

  /**
   * Clear the cache (call when theme changes).
   */
  ns.clearThemeCache = function clearThemeCache() {
    _activeThemeColors = null;
    _activeThemeId = null;
  };

  // ─── Expected vs Actual comparison ─────────────────────────────────────────

  /**
   * Compare what the theme SHOULD set vs what's actually computed on :root.
   * Returns mismatches where the computed value doesn't match the expected value.
   *
   * @param {Object} themeColors - The theme's color config
   * @returns {Object} { matches, mismatches, notSet }
   */
  ns.compareExpectedVsActual = function compareExpectedVsActual(themeColors) {
    if (!themeColors || !ns.TOKEN_COLOR_MAP) {
      return { matches: [], mismatches: [], notSet: [] };
    }

    const cs = getComputedStyle(document.documentElement);
    const matches = [];
    const mismatches = [];
    const notSet = [];

    for (const [token, colorKey] of Object.entries(ns.TOKEN_COLOR_MAP)) {
      const expected = _resolveColorKey(colorKey, themeColors);
      if (!expected) continue;

      const actual = cs.getPropertyValue(token).trim();
      if (!actual) {
        notSet.push({ token, expected, colorKey });
        continue;
      }

      // Normalize both values for comparison (handle hex vs rgb)
      if (_colorsMatch(expected, actual)) {
        matches.push({ token, expected, actual, colorKey });
      } else {
        mismatches.push({ token, expected, actual, colorKey });
      }
    }

    return { matches, mismatches, notSet };
  };

  /**
   * Resolve a color key to its value, handling special placeholders.
   */
  function _resolveColorKey(key, themeColors) {
    if (!key) return null;
    if (key === '{inputBg}') {
      return themeColors.colorScheme === 'dark' ? themeColors.background : themeColors.surface;
    }
    return themeColors[key] || null;
  }

  /**
   * Compare two color values, normalizing hex/rgb differences.
   * Returns true if they represent the same color.
   */
  function _colorsMatch(a, b) {
    if (!a || !b) return false;
    // Direct match
    if (a.trim() === b.trim()) return true;

    // Normalize to RGB for comparison
    const rgbA = _toRgb(a);
    const rgbB = _toRgb(b);
    if (rgbA && rgbB) {
      return rgbA.r === rgbB.r && rgbA.g === rgbB.g && rgbA.b === rgbB.b;
    }

    // For non-color values (box-shadow, etc.) just string compare
    return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse a color string to { r, g, b }.
   */
  function _toRgb(color) {
    if (!color) return null;
    color = color.trim();

    // Hex
    if (color[0] === '#') {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
        };
      }
      if (hex.length >= 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    }

    // RGB/RGBA
    const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };

    return null;
  }

  // ─── Full diagnostic with engine awareness ─────────────────────────────────

  /**
   * Run a full engine-aware diagnostic scan.
   * Combines token scanning, component scanning, fix generation, and
   * expected-vs-actual comparison into a single comprehensive report.
   *
   * @param {string} themeId - Active theme ID
   * @returns {Promise<Object>} Full diagnostic report
   */
  ns.runFullDiagnostic = async function runFullDiagnostic(themeId) {
    // Load theme colors
    const themeColors = await ns.resolveThemeColors(themeId);

    // Run token scan
    const tokenResults = ns.scanTokens ? ns.scanTokens(themeId) : null;

    // Run component scan
    const componentResults = ns.scanComponents ? ns.scanComponents(themeColors) : null;

    // Generate fixes
    const fixReport = ns.generateFullFixReport
      ? ns.generateFullFixReport(tokenResults, componentResults, themeColors)
      : null;

    // Compare expected vs actual
    const comparison = themeColors ? ns.compareExpectedVsActual(themeColors) : null;

    return {
      themeId,
      themeColors,
      tokenResults,
      componentResults,
      fixReport,
      comparison,
      timestamp: new Date().toISOString(),
    };
  };
})();

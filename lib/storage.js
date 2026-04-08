/**
 * Salesforce Themer — Storage Abstraction
 * Thin wrapper over chrome.storage.
 * V1: themes come from bundled THEME_REGISTRY.
 * V2+: custom themes from local storage.
 * V3+: swap getAllThemes() to fetch from server API — nothing else changes.
 */

'use strict';

const ThemeStorage = {

  // ─── Preferences ──────────────────────────────────────────────────────────

  async getThemePreference() {
    return chrome.storage.sync.get({
      theme: 'connectry',
      autoMode: false,
      lastLightTheme: 'connectry',
      lastDarkTheme: 'connectry-dark',
      orgThemes: {},
    });
  },

  async setThemePreference(updates) {
    return chrome.storage.sync.set(updates);
  },

  // ─── CSS cache ────────────────────────────────────────────────────────────

  async getThemeCSS(themeId) {
    const result = await chrome.storage.local.get(`themeCSS_${themeId}`);
    return result[`themeCSS_${themeId}`] || null;
  },

  async cacheThemeCSS(themeId, css) {
    return chrome.storage.local.set({ [`themeCSS_${themeId}`]: css });
  },

  // ─── Theme registry ───────────────────────────────────────────────────────

  getAllThemes() {
    // V1: returns from bundled THEME_REGISTRY (defined in background.js scope)
    // V3+: replace this with a fetch() to a backend API
    return typeof THEME_REGISTRY !== 'undefined' ? THEME_REGISTRY.themes : [];
  },

  getThemeById(id) {
    return this.getAllThemes().find(t => t.id === id) || null;
  },

  getLightThemes() {
    return this.getAllThemes().filter(t => t.category === 'light');
  },

  getDarkThemes() {
    return this.getAllThemes().filter(t => t.category === 'dark');
  },

  // ─── Custom themes (V2 stub) ───────────────────────────────────────────────

  async getCustomThemes() {
    const result = await chrome.storage.local.get('customThemes');
    return result.customThemes || [];
  },

  async saveCustomTheme(theme) {
    const existing = await this.getCustomThemes();
    const idx = existing.findIndex(t => t.id === theme.id);
    if (idx >= 0) {
      existing[idx] = theme;
    } else {
      existing.push(theme);
    }
    return chrome.storage.local.set({ customThemes: existing });
  },

  async deleteCustomTheme(id) {
    const existing = await this.getCustomThemes();
    const filtered = existing.filter(t => t.id !== id);
    return chrome.storage.local.set({ customThemes: filtered });
  },
};

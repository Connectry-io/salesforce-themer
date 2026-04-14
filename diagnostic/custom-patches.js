/**
 * Custom Patches — Salesforce Themer Diagnostic
 *
 * Storage and injection system for per-component CSS overrides.
 * When the diagnostic finds custom LWCs with hardcoded colors,
 * this module stores the generated patches and injects them alongside
 * the theme CSS. Users can enable/disable patches per component.
 *
 * Storage format (chrome.storage.local):
 *   customPatches: {
 *     [tagName]: {
 *       enabled: boolean,
 *       css: string,           // full CSS rule
 *       rules: [...],          // structured rule objects
 *       createdAt: ISO string,
 *       updatedAt: ISO string,
 *       source: 'auto' | 'manual',
 *     }
 *   }
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  const STORAGE_KEY = 'customPatches';
  const PATCH_STYLE_ID = 'sf-themer-custom-patches';

  // ─── Storage operations ────────────────────────────────────────────────────

  /**
   * Load all custom patches from storage.
   * @returns {Promise<Object>} Map of tagName → patch config
   */
  ns.loadPatches = async function loadPatches() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return data[STORAGE_KEY] || {};
    } catch (_) {
      return {};
    }
  };

  /**
   * Save a patch for a component.
   * @param {string} tag - Component tag name (e.g., 'c-my-component')
   * @param {Object} patch - { css, rules, source }
   * @param {boolean} enabled - Whether the patch is active
   */
  ns.savePatch = async function savePatch(tag, patch, enabled = true) {
    try {
      const all = await ns.loadPatches();
      all[tag] = {
        enabled,
        css: patch.css,
        rules: patch.rules || [],
        createdAt: all[tag]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: patch.source || 'auto',
      };
      await chrome.storage.local.set({ [STORAGE_KEY]: all });
    } catch (err) {
      console.warn('[SFT Patches] Save failed:', err.message);
    }
  };

  /**
   * Toggle a patch on/off.
   * @param {string} tag - Component tag name
   * @param {boolean} enabled - New enabled state
   */
  ns.togglePatch = async function togglePatch(tag, enabled) {
    try {
      const all = await ns.loadPatches();
      if (all[tag]) {
        all[tag].enabled = enabled;
        all[tag].updatedAt = new Date().toISOString();
        await chrome.storage.local.set({ [STORAGE_KEY]: all });
      }
    } catch (err) {
      console.warn('[SFT Patches] Toggle failed:', err.message);
    }
  };

  /**
   * Remove a patch entirely.
   * @param {string} tag - Component tag name
   */
  ns.removePatch = async function removePatch(tag) {
    try {
      const all = await ns.loadPatches();
      delete all[tag];
      await chrome.storage.local.set({ [STORAGE_KEY]: all });
    } catch (err) {
      console.warn('[SFT Patches] Remove failed:', err.message);
    }
  };

  /**
   * Clear all patches.
   */
  ns.clearAllPatches = async function clearAllPatches() {
    try {
      await chrome.storage.local.remove(STORAGE_KEY);
    } catch (_) {}
  };

  // ─── CSS injection ─────────────────────────────────────────────────────────

  /**
   * Inject all enabled patches as a single <style> tag.
   * Called by content.js after theme CSS is applied.
   */
  ns.injectPatches = async function injectPatches() {
    const patches = await ns.loadPatches();
    const enabledPatches = Object.values(patches).filter(p => p.enabled);

    // Remove existing patch style
    const existing = document.getElementById(PATCH_STYLE_ID);
    if (existing) existing.remove();

    if (!enabledPatches.length) return;

    const css = enabledPatches.map(p => p.css).join('\n\n');
    const style = document.createElement('style');
    style.id = PATCH_STYLE_ID;
    style.dataset.sftSource = 'custom:local';
    style.textContent = `/* @sft-source: custom:local */\n/* Custom LWC Patches — Salesforce Themer */\n\n${css}`;
    const target = document.head || document.documentElement;
    target.appendChild(style);

    console.log(`[SFT Patches] Injected ${enabledPatches.length} custom patches`);
  };

  /**
   * Remove the patch style tag.
   */
  ns.removePatches = function removePatches() {
    const existing = document.getElementById(PATCH_STYLE_ID);
    if (existing) existing.remove();
  };

  /**
   * Get a summary of current patch state.
   * @returns {Promise<Object>} { total, enabled, disabled, tags }
   */
  ns.getPatchSummary = async function getPatchSummary() {
    const patches = await ns.loadPatches();
    const entries = Object.entries(patches);
    return {
      total: entries.length,
      enabled: entries.filter(([, p]) => p.enabled).length,
      disabled: entries.filter(([, p]) => !p.enabled).length,
      tags: entries.map(([tag, p]) => ({ tag, enabled: p.enabled, source: p.source })),
    };
  };

  // Export the style ID for the MutationObserver in content.js
  ns.PATCH_STYLE_ID = PATCH_STYLE_ID;
})();

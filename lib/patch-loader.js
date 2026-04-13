/**
 * Patch loader — runs at document_start in every Salesforce frame.
 *
 * Fetches the active "patches/global" CSS bundle from the Connectry
 * Intelligence Layer and injects it as a <style> tag. Falls back to the
 * bundled CSS at intelligence/bundled/global.css when the backend is
 * unreachable, so themed pages keep working offline.
 *
 * Hard rule: NO runtime JavaScript fetch. Only CSS / JSON crosses the wire.
 */
(() => {
  'use strict';

  if (window.__sfThemerPatchLoaderRan) return;
  window.__sfThemerPatchLoaderRan = true;

  const STYLE_ID = 'sf-themer-intel-patch';
  const KEY = 'patches/global';

  function inject(css, source) {
    if (!css) return;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.dataset.intelSource = source;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = css;
  }

  async function run() {
    const intel = self.ConnectryIntel;
    if (!intel) return;
    const bundledUrl = chrome.runtime.getURL('intelligence/bundled/global.css');
    const cfg = await intel.fetchConfig(KEY, { bundledFallbackUrl: bundledUrl });
    if (cfg?.content) inject(cfg.content, cfg.source);
  }

  run().catch((e) => console.warn('[sf-themer] patch-loader failed', e));
})();

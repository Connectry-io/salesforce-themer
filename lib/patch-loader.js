/**
 * Patch loader — runs at document_start in every Salesforce frame.
 *
 * Fetches the index of active "patches/*" rows from the Connectry
 * Intelligence Layer, then loads and concatenates each patch CSS into a
 * single <style> tag. Falls back to the bundled CSS at
 * intelligence/bundled/global.css when the backend is unreachable, so
 * themed pages keep working offline.
 *
 * Hard rule: NO runtime JavaScript fetch. Only CSS / JSON crosses the wire.
 */
(() => {
  'use strict';

  if (window.__sfThemerPatchLoaderRan) return;
  window.__sfThemerPatchLoaderRan = true;

  const STYLE_ID = 'sf-themer-intel-patch';
  const PROJECT_REF = 'pemofbbniuzogxzzioyp';
  const INDEX_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/config/themer/_index?prefix=patches/`;
  const INDEX_CACHE_KEY = 'intelPatchIndex:themer';

  function inject(css, source) {
    if (!css) return;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.dataset.intelSource = source;
    el.textContent = css;
  }

  async function fetchIndex() {
    try {
      const res = await fetch(INDEX_URL, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const body = await res.json();
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ [INDEX_CACHE_KEY]: body });
      }
      return body;
    } catch {
      if (chrome?.storage?.local) {
        const obj = await chrome.storage.local.get(INDEX_CACHE_KEY);
        return obj?.[INDEX_CACHE_KEY] || null;
      }
      return null;
    }
  }

  async function run() {
    const intel = self.ConnectryIntel;
    if (!intel) return;

    const bundledUrl = chrome.runtime.getURL('intelligence/bundled/global.css');

    const index = await fetchIndex();
    if (!index?.entries?.length) {
      // No remote patches yet — load bundled floor.
      const cfg = await intel.fetchConfig('patches/global', { bundledFallbackUrl: bundledUrl });
      if (cfg?.content) inject(cfg.content, cfg.source);
      return;
    }

    const parts = await Promise.all(
      index.entries.map(async (e) => {
        const cfg = await intel.fetchConfig(e.key, { bundledFallbackUrl: null });
        return cfg?.content
          ? `/* ── ${e.key} (v${e.version}, ${cfg.source}) ───────────── */\n${cfg.content}`
          : '';
      }),
    );
    const combined = parts.filter(Boolean).join('\n\n');
    if (combined) inject(combined, 'remote-index');
    else {
      const cfg = await intel.fetchConfig('patches/global', { bundledFallbackUrl: bundledUrl });
      if (cfg?.content) inject(cfg.content, cfg.source);
    }
  }

  run().catch((e) => console.warn('[sf-themer] patch-loader failed', e));
})();

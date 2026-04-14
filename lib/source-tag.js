/**
 * Source attribution for every Themer-injected <style> tag.
 *
 * Every style the extension creates gets:
 *   - data-sft-source="<tag>" attribute
 *   - /* sft-source: <tag> *\/ leading CSS comment (visible in DevTools)
 *
 * Source tags (one of):
 *   engine:theme        — content.js main theme rules
 *   engine:transitions  — content.js view-transition styles
 *   engine:effects      — content.js effects CSS
 *   intel:patches       — patch-loader.js (Supabase-hosted published+draft)
 *   intel:live-accepted — diagnostic-panel.js in-session preview injection
 *   custom:local        — custom-patches.js user-authored LWC patches
 *
 * The intel:patches style concatenates multiple patches. Each patch block
 * is wrapped in /* ── sft-patch key=... v=... ── *\/ boundary comments so
 * __sftExplain can attribute rules inside it to a specific config key.
 */
(() => {
  'use strict';
  if (window.__sftSourceTagInstalled) return;
  window.__sftSourceTagInstalled = true;

  /**
   * Apply source-tag attribute + leading comment to a <style> element.
   * Idempotent — safe to call multiple times on the same element.
   */
  function applySftSource(styleEl, tag, css) {
    if (!styleEl || !tag) return css || '';
    styleEl.dataset.sftSource = tag;
    const header = `/* sft-source: ${tag} */\n`;
    const body = css || '';
    // Avoid double-prefixing if caller already wrapped it.
    if (body.startsWith(header)) return body;
    return header + body;
  }

  /**
   * Wrap a single patch's CSS with boundary comments so it's attributable
   * inside a concatenated intel:patches <style>.
   */
  function wrapPatchBoundary(patchCss, key, version) {
    const v = version != null ? ` v=${version}` : '';
    return `/* ── sft-patch key=${key}${v} ── */\n${patchCss}\n/* ── sft-end key=${key} ── */\n`;
  }

  /**
   * Inspect what rule won for a given CSS property on a given element.
   *
   *   __sftExplain($0, 'background-color')
   *
   * Returns { value, source, selector, styleId, patchKey? } or null if no
   * rule matched. Walks only Themer-tagged stylesheets; SF's own rules
   * are reported as source="salesforce".
   */
  function explainPixel(el, prop) {
    if (!el || !prop) return null;
    const computed = getComputedStyle(el)[prop];
    const sheets = Array.from(document.styleSheets);
    let winner = null;

    for (const sheet of sheets) {
      const owner = sheet.ownerNode;
      const sftSource = owner?.dataset?.sftSource || null;
      const styleId = owner?.id || null;
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;

      for (const rule of rules) {
        if (!rule.selectorText) continue;
        let matches;
        try { matches = el.matches(rule.selectorText); } catch { continue; }
        if (!matches) continue;
        const value = rule.style?.getPropertyValue(prop);
        if (!value) continue;
        winner = {
          value,
          computed,
          source: sftSource || (styleId ? `extension:${styleId}` : 'salesforce'),
          selector: rule.selectorText,
          styleId,
          patchKey: findContainingPatchKey(sheet, rule),
        };
      }
    }
    return winner;
  }

  /**
   * For intel:patches — look up which /* ── sft-patch key=... ── *\/
   * boundary the given rule sits inside by scanning the raw textContent.
   */
  function findContainingPatchKey(sheet, rule) {
    const owner = sheet.ownerNode;
    if (owner?.dataset?.sftSource !== 'intel:patches') return null;
    const text = owner.textContent || '';
    const selector = rule.selectorText;
    // Find last sft-patch boundary before the selector's first occurrence.
    const idx = text.indexOf(selector);
    if (idx < 0) return null;
    const before = text.slice(0, idx);
    const lastBoundary = before.lastIndexOf('sft-patch key=');
    if (lastBoundary < 0) return null;
    const m = before.slice(lastBoundary).match(/sft-patch key=([^\s]+)/);
    return m ? m[1] : null;
  }

  /**
   * Summarize every Themer-tagged style on the page. Handy for quick
   * sanity: "what's currently injected?"
   */
  function listSources() {
    return Array.from(document.querySelectorAll('style[data-sft-source]')).map((el) => ({
      source: el.dataset.sftSource,
      id: el.id || null,
      bytes: (el.textContent || '').length,
      patches: extractPatchKeys(el.textContent || ''),
    }));
  }
  function extractPatchKeys(text) {
    const keys = [];
    const re = /sft-patch key=([^\s]+)/g;
    let m;
    while ((m = re.exec(text))) keys.push(m[1]);
    return keys;
  }

  window.__sftSourceTag = { applySftSource, wrapPatchBoundary };
  window.__sftExplain = explainPixel;
  window.__sftSources = listSources;
})();

/**
 * Scan enrichment — Connectry Intelligence Layer (Advanced mode).
 *
 * Collects the rich signal payload that Claude needs to write good patches
 * without guessing:
 *   1. Full computed styles per gap element
 *   2. Parent chain to <body>
 *   3. Sibling classes
 *   4. Stylesheet URL list (managed-package detection)
 *   5. Engine CSS excerpt for affected selectors
 *   6. Active theme config (caller passes — we just attach)
 *   7. Edition + locale (best-effort sniff)
 *   8. Previous patches for this gap signature (caller wires)
 *   9. Screenshot of visible viewport (background-script bounce)
 *
 * Sanitization is intentionally aggressive: text nodes are replaced with
 * length stubs, input values are dropped, email/tel/name fields skipped
 * entirely. We cap each field at 4 KB and the whole payload at ~200 KB.
 *
 * Exposed on window.__sfThemerEnrichment for the diagnostic panel to use.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerEnrichment = window.__sfThemerEnrichment || {});

  // ── helpers ─────────────────────────────────────────────────────────────

  const MAX_FIELD = 4 * 1024;
  const MAX_PAYLOAD = 200 * 1024;

  function clip(s, n = MAX_FIELD) {
    if (typeof s !== 'string') return s;
    return s.length > n ? s.slice(0, n) + `…[+${s.length - n}]` : s;
  }

  // SECURITY (T3): free-text attrs are STRIPPED ENTIRELY, not redacted.
  // Reaching Claude with attacker-controlled prose enables prompt injection.
  // See SECURITY.md ("Sanitization rules").
  const STRIPPED_ATTRS = new Set([
    'aria-label', 'aria-description', 'aria-roledescription',
    'title', 'placeholder', 'alt', 'data-tooltip', 'tooltip',
    'value', 'data-value', 'data-name', 'data-email', 'data-label',
    'data-description', 'data-content',
  ]);

  function sanitizeNode(el) {
    if (!el || el.nodeType !== 1) return null;
    const out = {
      tag: el.tagName.toLowerCase(),
      classes: [...(el.classList || [])].slice(0, 32),
      attrs: {},
    };
    for (const a of el.attributes || []) {
      const name = a.name.toLowerCase();
      if (name === 'class') continue;
      if (STRIPPED_ATTRS.has(name)) continue; // T3: drop entirely
      if (name.startsWith('data-') || name.startsWith('aria-') || name === 'role' || name === 'id') {
        // Allow attribute KEY through, but if VALUE looks like a sentence
        // (whitespace-separated words) drop the value too — keep only the key.
        const v = String(a.value || '');
        const looksLikeSentence = v.length > 24 && /\s/.test(v) && /[a-zA-Z]/.test(v);
        out.attrs[name] = looksLikeSentence ? `[stripped len=${v.length}]` : clip(v, 200);
      }
    }
    return out;
  }

  function parentChain(el) {
    const chain = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.tagName !== 'BODY' && depth < 20) {
      chain.push(sanitizeNode(cur));
      cur = cur.parentElement;
      depth++;
    }
    if (cur) chain.push({ tag: 'body', classes: [...cur.classList].slice(0, 16), attrs: {} });
    return chain;
  }

  function siblingClasses(el) {
    if (!el?.parentElement) return [];
    return [...el.parentElement.children]
      .filter((s) => s !== el)
      .slice(0, 12)
      .map((s) => ({
        tag: s.tagName.toLowerCase(),
        classes: [...s.classList].slice(0, 16),
      }));
  }

  function computedStyles(el) {
    if (!el) return {};
    const cs = getComputedStyle(el);
    const out = {};
    // Walk every property — cs has length and indexed access.
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      const val = cs.getPropertyValue(prop);
      // Skip default-y noise to keep payload lean
      if (!val || val === 'initial' || val === 'normal' || val === 'auto' || val === 'none') continue;
      out[prop] = clip(String(val), 256);
    }
    return out;
  }

  function stylesheetURLs() {
    const urls = [];
    for (const sheet of document.styleSheets) {
      try {
        if (sheet.href) urls.push(sheet.href);
      } catch { /* cross-origin, ignore */ }
    }
    return urls.slice(0, 200);
  }

  function engineCSSExcerpt(selectorTerms = []) {
    const styleEl = document.getElementById('sf-themer-intel-patch')
      || document.querySelector('style[data-sf-themer]')
      || document.getElementById('sf-themer-style');
    if (!styleEl) return '';
    const text = styleEl.textContent || '';
    if (!selectorTerms.length) return clip(text, 8192);
    // Grep rules whose selector mentions any of the terms.
    const lines = text.split(/\}\s*/);
    const matches = lines.filter((rule) =>
      selectorTerms.some((t) => rule.includes(t)),
    );
    return clip(matches.slice(0, 40).join('}\n') + '}', 8192);
  }

  function editionAndLocale() {
    const out = {};
    try {
      const u = window.UserContext;
      if (u) {
        out.userType = u.userType || null;
        out.locale = u.locale || u.userLocale || null;
        out.timezone = u.timeZone?.timezoneId || null;
        out.orgInstance = u.orgFeatures?.instance || null;
      }
    } catch { /* not aura, ignore */ }
    out.lang = document.documentElement.lang || null;
    out.viewport = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio };
    out.urlPath = location.pathname;
    out.urlHost = location.host;
    return out;
  }

  // ── screenshot via background script ────────────────────────────────────

  function captureScreenshot() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'intel.captureScreenshot' }, (resp) => {
          if (chrome.runtime.lastError) return resolve(null);
          if (resp?.ok && resp.dataUrl) resolve(resp.dataUrl);
          else resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  // ── gap signature (stable hash for "previously failed" lookup) ──────────

  async function gapSignature(gapToken, parentChainArr) {
    const seed = gapToken + ':' + (parentChainArr || []).map((n) => n.tag + '.' + (n.classes || []).slice(0, 3).join('.')).join('>');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  // ── element discovery for a token gap ───────────────────────────────────

  /**
   * Find DOM elements that visibly use the missing token. We cheat: we look
   * for elements whose computed value for any color/border/background prop
   * matches `var(--token)` in the cascading context. Fallback: pick first
   * SLDS-prefixed element on the page so Claude has *something* to anchor.
   */
  // Skip elements the user effectively never sees: hidden, zero-box, or
  // inside a hidden subtree. Prevents Aura's loader spinners + assistive-
  // text from dominating token-gap examples (ESC-3, 2026-04-15).
  const HIDDEN_CLASS_RE = /(?:^|\s)(slds-hide|slds-assistive-text|hidden|loadingHide)(?:$|\s)/;
  function isEffectivelyHidden(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.tagName === 'BODY' || el.tagName === 'HTML') return false;
    let cur = el;
    while (cur && cur.nodeType === 1 && cur.tagName !== 'BODY') {
      const cn = typeof cur.className === 'string' ? cur.className : '';
      if (HIDDEN_CLASS_RE.test(cn)) return true;
      cur = cur.parentElement;
    }
    cur = el;
    while (cur && cur.nodeType === 1 && cur.tagName !== 'BODY') {
      const cs = getComputedStyle(cur);
      if (cs.display === 'none') return true;
      if (cs.visibility === 'hidden') return true;
      cur = cur.parentElement;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return true;
    return false;
  }

  function findElementsForToken(token, max = 3) {
    const candidates = [];
    const all = document.querySelectorAll('[class*="slds-"], [class*="lwc-"]');
    for (const el of all) {
      if (candidates.length >= max) break;
      if (isEffectivelyHidden(el)) continue;
      candidates.push(el);
    }
    return candidates.slice(0, max);
  }

  // ── public entrypoint ───────────────────────────────────────────────────

  /**
   * Build the rich findings payload for /ai-suggest in Advanced mode.
   * @param {Object} opts
   * @param {string[]} opts.gaps        — token names from the scanner
   * @param {Object}   opts.themeColors — active theme config
   * @param {boolean}  opts.includeScreenshot — default true
   * @returns {Promise<{payload, screenshotDataUrl}>}
   */
  async function buildAdvancedFindings({ gaps = [], themeColors = {}, includeScreenshot = true } = {}) {
    const gapDetails = [];
    const seenSignatures = new Set();
    const allSelectorTerms = new Set();

    for (let i = 0; i < Math.min(gaps.length, 12); i++) {
      const token = gaps[i];
      const els = findElementsForToken(token, 2);
      const examples = [];
      for (const el of els) {
        const chain = parentChain(el);
        const sig = await gapSignature(token, chain);
        if (seenSignatures.has(sig)) continue;
        seenSignatures.add(sig);
        const node = sanitizeNode(el);
        node?.classes?.forEach((c) => allSelectorTerms.add('.' + c));
        examples.push({
          signature: sig,
          element: node,
          parent_chain: chain,
          siblings: siblingClasses(el),
          computed_styles: computedStyles(el),
        });
      }
      gapDetails.push({
        id: `gap-${i + 1}`,
        token,
        examples,
      });
    }

    const payload = {
      mode: 'advanced',
      gaps: gapDetails,
      stylesheet_urls: stylesheetURLs(),
      engine_css_excerpt: engineCSSExcerpt([...allSelectorTerms].slice(0, 30)),
      edition_locale: editionAndLocale(),
      theme_config: themeColors,
    };

    let screenshotDataUrl = null;
    if (includeScreenshot) {
      screenshotDataUrl = await captureScreenshot();
    }

    // Size guard.
    const json = JSON.stringify(payload);
    if (json.length > MAX_PAYLOAD) {
      // Drop computed styles first, then siblings, then engine_css_excerpt.
      payload.gaps.forEach((g) => g.examples.forEach((e) => { e.computed_styles = '[trimmed for size]'; }));
      if (JSON.stringify(payload).length > MAX_PAYLOAD) {
        payload.gaps.forEach((g) => g.examples.forEach((e) => { delete e.siblings; }));
      }
      if (JSON.stringify(payload).length > MAX_PAYLOAD) {
        payload.engine_css_excerpt = '[trimmed for size]';
      }
    }

    return { payload, screenshotDataUrl };
  }

  Object.assign(ns, {
    buildAdvancedFindings,
    captureScreenshot,
    sanitizeNode,
    parentChain,
    computedStyles,
    stylesheetURLs,
    engineCSSExcerpt,
    editionAndLocale,
    gapSignature,
  });
})();

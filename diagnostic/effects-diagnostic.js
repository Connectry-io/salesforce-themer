/**
 * Effects Diagnostic — one-click dump of everything relevant to debugging
 * why a Themer effect is/isn't visible on the current SF page.
 *
 * Exposed as `window.__sfThemerDiag.dumpEffectsState()`. Returns a
 * formatted string and (best-effort) copies it to the clipboard.
 *
 * Used to populate brain/knowledge/projects/salesforce-themer/SF-DOM-MAP.md
 * with real observations instead of speculation.
 */
(() => {
  'use strict';

  const ns = window.__sfThemerDiag = window.__sfThemerDiag || {};

  // Extract useful computed-style fields from an element or pseudo-element.
  function _snap(el, pseudo) {
    if (!el) return null;
    const s = getComputedStyle(el, pseudo || null);
    return {
      tag: el.tagName,
      id: el.id || '',
      class: (el.className?.baseVal || el.className || '').toString().slice(0, 120),
      content: pseudo ? s.content : undefined,
      position: s.position,
      zIndex: s.zIndex,
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity,
      overflow: s.overflow,
      overflowX: s.overflowX,
      overflowY: s.overflowY,
      bg: s.backgroundColor,
      bgImage: (s.backgroundImage || 'none').slice(0, 160),
      mixBlendMode: s.mixBlendMode,
      filter: (s.filter || 'none').slice(0, 120),
      animation: (s.animationName || 'none'),
      pointerEvents: s.pointerEvents,
    };
  }

  function _stackAt(x, y, limit) {
    return document.elementsFromPoint(x, y).slice(0, limit || 8).map(el => {
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        class: (el.className?.baseVal || el.className || '').toString().slice(0, 80),
        position: s.position,
        zIndex: s.zIndex,
        overflow: s.overflow,
        bg: s.backgroundColor,
      };
    });
  }

  function _classifyArchetype() {
    const u = location.href;
    if (/\/lightning\/r\//.test(u)) return 'record-detail';
    if (/\/lightning\/o\/[^/]+\/list/.test(u)) return 'list-view';
    if (/\/lightning\/setup\//.test(u)) return 'setup';
    if (/\/lightning\/page\/home/.test(u)) return 'home';
    if (/\/lightning\/app\//.test(u)) return 'app-launcher';
    return 'other';
  }

  function _collectStyleTags() {
    const tags = document.querySelectorAll('style[id^="sf-themer-"]');
    return Array.from(tags).map(t => ({
      id: t.id,
      bytes: (t.textContent || '').length,
      first200: (t.textContent || '').slice(0, 200),
    }));
  }

  async function _readConfig() {
    if (!chrome?.storage?.sync) return { error: 'no chrome.storage' };
    try {
      const r = await chrome.storage.sync.get({
        theme: null,
        effectsVolume: null,
        customThemes: [],
        autoMode: false,
        themeScope: null,
        orgThemes: {},
        faviconEnabled: null,
      });
      // Drop big blobs we don't need for the dump
      r.customThemesCount = (r.customThemes || []).length;
      r.customThemeIds = (r.customThemes || []).map(t => t.id);
      delete r.customThemes;
      return r;
    } catch (err) { return { error: String(err) }; }
  }

  // Pure data collection — no side effects. Used by Scan to fold effects
  // state into the unified report.
  async function getEffectsState() {
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    const manifestVersion = chrome?.runtime?.getManifest?.()?.version || '?';
    const archetype = _classifyArchetype();
    const config = await _readConfig();

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        extensionVersion: manifestVersion,
        url: location.href,
        archetype,
        viewport: { w: innerWidth, h: innerHeight },
      },
      bodyClasses: document.body.className,
      htmlClasses: document.documentElement.className,
      syncConfig: config,
      html: _snap(document.documentElement),
      body: _snap(document.body),
      'body::before': _snap(document.body, '::before'),
      'body::after': _snap(document.body, '::after'),
      themerStyleTags: _collectStyleTags(),
      stackAtViewportCenter: _stackAt(cx, cy, 8),
      stackAtTopLeft: _stackAt(100, 100, 6),
      stackAtBottomRight: _stackAt(innerWidth - 100, innerHeight - 100, 6),
      knownSelectors: {
        slds_card: document.querySelectorAll('.slds-card').length,
        force_record_card: document.querySelectorAll('.forceRecordCard').length,
        force_related_list: document.querySelectorAll('.forceRelatedListSingleContainer').length,
        slds_brand: document.querySelectorAll('.slds-button_brand, .slds-button--brand').length,
        context_bar_active: document.querySelectorAll('.slds-context-bar__item.slds-is-active').length,
        page_header_title: document.querySelectorAll('.slds-page-header__title').length,
        oneContent: document.querySelectorAll('.oneContent, .desktop, .forceRecordLayout').length,
      },
    };
  }

  async function dumpEffectsState() {
    const report = await getEffectsState();

    const formatted = '=== SF THEMER EFFECTS DIAGNOSTIC ===\n'
      + JSON.stringify(report, null, 2)
      + '\n=== END DIAGNOSTIC ===';

    let copied = false;
    try {
      await navigator.clipboard.writeText(formatted);
      copied = true;
    } catch (_) {
      // Fallback: textarea selection
      try {
        const ta = document.createElement('textarea');
        ta.value = formatted;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        ta.remove();
      } catch (_) {}
    }

    // Toast confirmation (floating, dismisses in 3s).
    try {
      const toast = document.createElement('div');
      toast.textContent = copied
        ? '✓ Effects diagnostic copied to clipboard'
        : '⚠ Couldn\'t copy — see console log';
      toast.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(20,20,24,0.95)', 'color:#fff', 'padding:10px 18px',
        'border-radius:8px', 'font:600 13px system-ui', 'z-index:2147483647',
        'box-shadow:0 6px 20px rgba(0,0,0,0.3)', 'pointer-events:none',
      ].join(';');
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (_) {}

    console.log('[SF Themer] Effects diagnostic:\n' + formatted);
    return { copied, report };
  }

  ns.dumpEffectsState = dumpEffectsState;
  ns.getEffectsState = getEffectsState;
})();

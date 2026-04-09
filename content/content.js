(() => {
  'use strict';

  // Only theme Salesforce-origin frames (all_frames=true catches all iframes)
  const hostname = window.location.hostname;
  if (!hostname.includes('salesforce.com') && !hostname.includes('force.com')) return;

  // Skip login, verification, and other pre-auth pages — don't theme them
  const skipPatterns = [
    '/login',
    '/_ui/identity/',
    '/setup/secur/',
    '/secur/login',
    '/one/one.app?login',
  ];
  const path = window.location.pathname + window.location.search;
  if (skipPatterns.some(p => path.includes(p))) return;

  const STYLE_ID = 'sf-themer-styles';
  const TRANSITION_CLASS = 'sf-themer-transitioning';
  const TRANSITION_DURATION = 300;

  // Detect page type for scope filtering
  const isSetupPage = path.includes('/lightning/setup/');

  let currentTheme = null;
  let observer = null;
  let mediaQuery = null;

  // ─── Transition helpers ──────────────────────────────────────────────────

  function injectTransitionStyles() {
    if (document.getElementById('sf-themer-transitions')) return;
    const style = document.createElement('style');
    style.id = 'sf-themer-transitions';
    style.textContent = `
      .sf-themer-transitioning,
      .sf-themer-transitioning *,
      .sf-themer-transitioning *::before,
      .sf-themer-transitioning *::after {
        transition:
          background-color ${TRANSITION_DURATION}ms ease,
          color ${TRANSITION_DURATION}ms ease,
          border-color ${TRANSITION_DURATION}ms ease,
          box-shadow ${TRANSITION_DURATION}ms ease !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .sf-themer-transitioning,
        .sf-themer-transitioning *,
        .sf-themer-transitioning *::before,
        .sf-themer-transitioning *::after {
          transition: none !important;
        }
      }
    `;
    const target = document.head || document.documentElement;
    target.appendChild(style);
  }

  function beginTransition() {
    const target = document.body || document.documentElement;
    target.classList.add(TRANSITION_CLASS);
  }

  function endTransition() {
    setTimeout(() => {
      const target = document.body || document.documentElement;
      target.classList.remove(TRANSITION_CLASS);
    }, TRANSITION_DURATION + 50);
  }

  // ─── CSS injection ───────────────────────────────────────────────────────

  function removeThemeStyles() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
  }

  function injectCSSText(css) {
    removeThemeStyles();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    const target = document.head || document.documentElement;
    target.appendChild(style);
  }

  async function fetchThemeCSS(themeName) {
    const url = chrome.runtime.getURL(`content/themes/${themeName}.css`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch theme: ${themeName} (${response.status})`);
    return response.text();
  }

  // ─── Apply theme (with zero-flash fast path via local storage) ───────────

  // Synchronous fast-path: reads from chrome.storage.local which was pre-cached
  // by background.js. Called at document_start before any paint.
  function applyThemeFast(themeName, css) {
    if (!css || !themeName || themeName === 'none') return;
    injectCSSText(css);
    currentTheme = themeName;
  }

  async function applyTheme(themeName, animate = true) {
    if (themeName === 'none') {
      if (animate) beginTransition();
      removeThemeStyles();
      currentTheme = 'none';
      if (animate) endTransition();
      return;
    }

    try {
      // Try local cache first (fast), fall back to fetch (first install edge case)
      const cached = await chrome.storage.local.get(`themeCSS_${themeName}`);
      const css = cached[`themeCSS_${themeName}`] || await fetchThemeCSS(themeName);

      if (animate) beginTransition();
      injectCSSText(css);
      currentTheme = themeName;
      if (animate) endTransition();
    } catch (err) {
      console.warn('[Salesforce Themer] Could not apply theme:', err.message);
    }
  }

  // ─── Per-org theming ─────────────────────────────────────────────────────

  function getOrgHostname() {
    return window.location.hostname;
  }

  async function resolveTheme(syncData) {
    const hostname = getOrgHostname();
    const orgThemes = syncData.orgThemes || {};

    if (orgThemes[hostname]) {
      return orgThemes[hostname];
    }

    if (syncData.autoMode) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDark ? (syncData.lastDarkTheme || 'connectry-dark') : (syncData.lastLightTheme || 'connectry');
    }

    return syncData.theme || 'connectry';
  }

  // ─── System dark mode sync ───────────────────────────────────────────────

  function setupMediaQueryListener() {
    if (mediaQuery) return; // Only set up once
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', async () => {
      const result = await chrome.storage.sync.get({
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
      });

      if (!result.autoMode) return;

      // Check if this org has a per-org override — if so, don't auto-switch
      const hostname = getOrgHostname();
      if (result.orgThemes[hostname]) return;

      const isDark = mediaQuery.matches;
      const next = isDark ? result.lastDarkTheme : result.lastLightTheme;
      await applyTheme(next, true);
    });
  }

  // ─── MutationObserver: re-inject if SF SPA navigation clears the head ────

  function ensureThemePresent() {
    if (!currentTheme || currentTheme === 'none') return;
    if (!document.getElementById(STYLE_ID)) {
      applyTheme(currentTheme, false);
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      let needsReinjection = false;
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node.id === STYLE_ID || node.id === 'sf-themer-transitions') {
            needsReinjection = true;
            break;
          }
        }
        if (needsReinjection) break;
      }
      if (needsReinjection) {
        injectTransitionStyles();
        ensureThemePresent();
      }
    });

    const target = document.head || document.documentElement;
    observer.observe(target, { childList: true, subtree: false });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: false, attributes: false });
    }
  }

  // ─── Message listener (from popup + background) ──────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'setTheme') {
      applyTheme(message.theme, true).then(() => {
        sendResponse({ success: true, theme: message.theme });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (message.action === 'getTheme') {
      sendResponse({ theme: currentTheme });
      return false;
    }
  });

  // ─── Initialisation ──────────────────────────────────────────────────────

  async function init() {
    injectTransitionStyles();
    startObserver();
    setupMediaQueryListener();

    try {
      const syncResult = await chrome.storage.sync.get({
        theme: 'connectry',
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
        themeScope: 'both',
      });

      if (!shouldApplyToPage(syncResult.themeScope)) return;

      const themeName = await resolveTheme(syncResult);

      // Try local cache for zero-flash experience when DOM is already ready
      const cached = await chrome.storage.local.get(`themeCSS_${themeName}`);
      const cachedCSS = cached[`themeCSS_${themeName}`];

      if (cachedCSS) {
        applyThemeFast(themeName, cachedCSS);
      } else {
        await applyTheme(themeName, false);
      }
    } catch (err) {
      console.warn('[Salesforce Themer] Init error:', err.message);
      try {
        await applyTheme('connectry', false);
      } catch (_) {}
    }
  }

  // ─── Zero-flash pre-paint injection ─────────────────────────────────────
  // At document_start, attempt to synchronously pull from local storage.
  // chrome.storage.local.get is async but resolves very quickly at document_start
  // before any paint occurs, eliminating the white flash.

  function shouldApplyToPage(scope) {
    if (!scope || scope === 'both') return true;
    if (scope === 'lightning' && isSetupPage) return false;
    if (scope === 'setup' && !isSetupPage) return false;
    return true;
  }

  function preInit() {
    chrome.storage.sync.get(
      { theme: 'connectry', autoMode: false, lastLightTheme: 'connectry', lastDarkTheme: 'connectry-dark', orgThemes: {}, themeScope: 'both' },
      (syncData) => {
        if (!shouldApplyToPage(syncData.themeScope)) return;
        if (chrome.runtime.lastError) return;

        const hostname = getOrgHostname();
        const orgThemes = syncData.orgThemes || {};

        let themeName;
        if (orgThemes[hostname]) {
          themeName = orgThemes[hostname];
        } else if (syncData.autoMode) {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          themeName = isDark ? (syncData.lastDarkTheme || 'connectry-dark') : (syncData.lastLightTheme || 'connectry');
        } else {
          themeName = syncData.theme || 'connectry';
        }

        if (!themeName || themeName === 'none') return;

        chrome.storage.local.get(`themeCSS_${themeName}`, (localData) => {
          if (chrome.runtime.lastError) return;
          const css = localData[`themeCSS_${themeName}`];
          if (css) {
            applyThemeFast(themeName, css);
          }
        });
      }
    );
  }

  // Run pre-init immediately (document_start) for zero-flash
  preInit();

  // Full init when DOM is ready (sets up observer, media query, etc.)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

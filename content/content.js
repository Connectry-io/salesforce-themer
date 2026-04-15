(() => {
  'use strict';

  // Only theme actual Salesforce org pages — NOT the broader Salesforce
  // ecosystem (AppExchange, Trailhead, Help, Developer docs, etc.).
  // The manifest's broad *.salesforce.com match is required because org
  // hostnames vary, but we filter here to only org-like patterns.
  const hostname = window.location.hostname;

  // Non-org Salesforce subdomains that should NEVER be themed.
  const NON_ORG_HOSTS = [
    'appexchange.salesforce.com',
    'developer.salesforce.com',
    'help.salesforce.com',
    'trailhead.salesforce.com',
    'trailblazer.salesforce.com',
    'admin.salesforce.com',
    'partners.salesforce.com',
    'www.salesforce.com',
    'login.salesforce.com',
    'test.salesforce.com',
    'status.salesforce.com',
    'trust.salesforce.com',
    'ideas.salesforce.com',
    'success.salesforce.com',
    'certification.salesforce.com',
    'medium.salesforce.com',
  ];
  if (NON_ORG_HOSTS.includes(hostname)) return;

  // Positive check: must look like an org instance, Setup host, or VF host.
  const isOrgHost = (
    hostname.endsWith('.my.salesforce.com') ||         // org: *.my.salesforce.com
    hostname.endsWith('.lightning.force.com') ||        // org: *.lightning.force.com
    hostname.endsWith('.my.salesforce-setup.com') ||    // setup: *.my.salesforce-setup.com
    hostname.endsWith('.salesforce-setup.com') ||       // setup fallback
    hostname.endsWith('.visualforce.com') ||            // VF pages
    hostname.endsWith('.cloudforce.com') ||             // legacy org host
    hostname.endsWith('.force.com')                     // catch-all force.com subdomains
  );
  if (!isOrgHost) return;

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
  const EFFECTS_STYLE_ID = 'sf-themer-effects';
  const TRANSITION_CLASS = 'sf-themer-transitioning';
  const TRANSITION_DURATION = 150;

  // Effects state
  let particleSystem = null;
  let cursorTrailSystem = null;
  let currentEffectsConfig = null;

  // Diagnostic panel (lazy-init)
  let diagnosticPanel = null;

  // Detect page type for scope filtering. Setup pages can live on any of
  // these patterns: /lightning/setup/ (modern Lightning Setup),
  // /setup/ (classic Setup, also used by VF iframes),
  // *.visualforce.com (legacy VF Setup), *.salesforce-setup.com (newer host).
  const isSetupPage = (
    path.includes('/lightning/setup/') ||
    path.startsWith('/setup/') ||
    path.includes('/_ui/setup/') ||
    hostname.includes('visualforce.com') ||
    hostname.includes('salesforce-setup.com')
  );

  // Diagnostic logging — leave on during development. Lets us see in DevTools
  // exactly which frames the content script is running in and whether the
  // scope check is excluding them. Search the SF tab console for [SFT].
  const isTopFrame = (window === window.top);
  console.log(
    `[SFT] content script loaded`,
    {
      hostname,
      path: path.slice(0, 80),
      isSetupPage,
      isTopFrame,
      url: window.location.href.slice(0, 120),
    }
  );

  let currentTheme = null;
  let observer = null;
  let mediaQuery = null;
  let contextDead = false;

  /**
   * Returns true if the error is the harmless "Extension context invalidated"
   * that fires when the extension is reloaded while a content script is still
   * running on an open tab. The old script's chrome.* handles are now stale.
   * Once we detect this, we set contextDead and tear down the observer so we
   * stop hammering a dead context. The user just needs to refresh the SF tab.
   */
  function isExtensionContextDead(err) {
    const msg = err && (err.message || String(err));
    return !!(msg && msg.includes('Extension context invalidated'));
  }

  function handleDeadContext() {
    if (contextDead) return;
    contextDead = true;
    if (observer) {
      try { observer.disconnect(); } catch (_) {}
      observer = null;
    }
  }

  // ─── Transition helpers ──────────────────────────────────────────────────

  function injectTransitionStyles() {
    if (document.getElementById('sf-themer-transitions')) return;
    const style = document.createElement('style');
    style.id = 'sf-themer-transitions';
    style.dataset.sftSource = 'engine:transitions';
    style.textContent = `/* sft-source: engine:transitions */

      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 150ms;
        animation-timing-function: ease;
      }
      @media (prefers-reduced-motion: reduce) {
        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation-duration: 0.01ms;
        }
      }
      .sf-themer-transitioning,
      .sf-themer-transitioning *,
      .sf-themer-transitioning *::before,
      .sf-themer-transitioning *::after {
        transition:
          background-color ${TRANSITION_DURATION}ms ease,
          color ${TRANSITION_DURATION}ms ease,
          border-color ${TRANSITION_DURATION}ms ease !important;
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
    style.dataset.sftSource = 'engine:theme';
    style.textContent = `/* sft-source: engine:theme */\n${css}`;
    const target = document.head || document.documentElement;
    target.appendChild(style);
  }

  // Atomic page-wide cross-fade when available; falls back to per-element
  // transition class (see beginTransition/endTransition).
  function swapThemeCSS(css) {
    if (typeof document.startViewTransition === 'function') {
      try {
        document.startViewTransition(() => injectCSSText(css));
        return true;
      } catch (_) { /* fall through */ }
    }
    return false;
  }

  // Preset themes ship in the binary at content/themes/<id>.css.
  // Custom themes (id starts with "theme_") live in Supabase app_configs at
  // key='themes/user/<slug>' and are fetched with ETag caching; see
  // ARCHITECTURE.md § V2.5. Cache survives Chrome restarts so zero-flash
  // return visits cost nothing on the wire (304 after first load).
  const SUPABASE_PROJECT_REF = 'pemofbbniuzogxzzioyp';
  const SUPABASE_CONFIG_BASE =
    `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/config/themer`;

  async function fetchThemeCSS(themeName) {
    if (typeof themeName === 'string' && themeName.startsWith('theme_')) {
      return fetchCustomThemeCSS(themeName);
    }
    const url = chrome.runtime.getURL(`content/themes/${themeName}.css`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch theme: ${themeName} (${response.status})`);
    return response.text();
  }

  async function fetchCustomThemeCSS(slug) {
    const cacheKey = `themeCache:${slug}`;
    let cached = null;
    try {
      const obj = await chrome.storage.local.get(cacheKey);
      cached = obj?.[cacheKey] || null;
    } catch (_) {}

    const url = `${SUPABASE_CONFIG_BASE}/themes/user/${encodeURIComponent(slug)}`;
    try {
      const headers = {};
      if (cached?.etag) headers['if-none-match'] = cached.etag;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
      if (res.status === 304 && cached) return cached.css;
      if (res.ok) {
        const css = await res.text();
        const etag = res.headers.get('etag') || '';
        try {
          await chrome.storage.local.set({
            [cacheKey]: { css, etag, fetchedAt: Date.now() },
          });
        } catch (_) {}
        return css;
      }
      // 404 / 5xx: fall through to cache or fail.
    } catch (_) {
      // Network error — fall through to cache.
    }

    if (cached?.css) return cached.css;
    throw new Error(`Failed to fetch custom theme ${slug} and no cache`);
  }

  // ─── Favicon injection ────────────────────────────────────────────────────

  const FAVICON_LINK_ID = 'sf-themer-favicon';
  let _originalFavicons = null;
  let _currentFaviconEnabled = false;
  let _currentFaviconConfig = null;

  function _saveOriginalFavicons() {
    if (_originalFavicons !== null) return;
    _originalFavicons = [];
    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
      _originalFavicons.push({ rel: link.rel, href: link.href, type: link.type, sizes: link.sizes?.value });
    });
  }

  // Favicon SVG generation is delegated to the canonical engine at
  // core/favicon/engine.js (loaded ahead of this script via manifest
  // content_scripts). Single source of truth across every surface.

  // Resolve the active theme's favicon config. Custom themes carry .favicon
  // inline; presets carry it in themes/themes.json. When a theme has no
  // explicit favicon config, derive one from the theme's accent so the SF
  // tab matches what the theme card in Studio/popup shows (circle + accent
  // + connectry glyph). Null = use the bundled connectry.svg fallback.
  let _presetRegistryCache = null;
  function _defaultFavicon(themeId, accent) {
    if (self.ConnectryFavicon && self.ConnectryFavicon.defaultForTheme) {
      return self.ConnectryFavicon.defaultForTheme(themeId, accent);
    }
    return { shape: 'circle', color: accent || '#4A6FA5', icon: 'connectry' };
  }
  async function _resolveThemeFavicon(themeName) {
    if (!themeName || themeName === 'none') return null;
    if (themeName.startsWith('theme_') || themeName.startsWith('custom-')) {
      try {
        const { customThemes = [] } = await chrome.storage.sync.get('customThemes');
        const ct = customThemes.find(t => t.id === themeName);
        if (!ct) return null;
        if (ct.favicon) return ct.favicon;
        const base = _presetRegistryCache?.themes?.find(x => x.id === ct.basedOn);
        const accent = ct.advancedOverrides?.accent || ct.coreOverrides?.accent || base?.colors?.accent;
        return _defaultFavicon(ct.basedOn, accent);
      } catch (_) { return null; }
    }
    try {
      if (!_presetRegistryCache) {
        const res = await fetch(chrome.runtime.getURL('themes/themes.json'));
        _presetRegistryCache = await res.json();
      }
      const t = (_presetRegistryCache.themes || []).find(x => x.id === themeName);
      if (!t) return null;
      return t.favicon || _defaultFavicon(t.id, t.colors?.accent);
    } catch (_) { return null; }
  }

  function applyFavicon(enabled, config) {
    _currentFaviconEnabled = enabled;
    _currentFaviconConfig = config || null;
    if (!enabled) {
      removeFavicon();
      return;
    }
    _saveOriginalFavicons();
    // Remove all existing favicons so ours takes priority
    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
      if (link.id !== FAVICON_LINK_ID) link.remove();
    });
    let link = document.getElementById(FAVICON_LINK_ID);
    if (!link) {
      link = document.createElement('link');
      link.id = FAVICON_LINK_ID;
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      (document.head || document.documentElement).appendChild(link);
    }
    // Use custom config if provided, otherwise static Connectry SVG
    if (config && config.icon) {
      const svg = self.ConnectryFavicon.buildSVG(config, 32);
      // Use base64 encoding for reliable cross-browser favicon rendering
      link.href = 'data:image/svg+xml;base64,' + btoa(svg);
    } else {
      link.href = chrome.runtime.getURL('favicons/connectry.svg');
    }
    // Force Chrome to re-evaluate the favicon by toggling sizes
    link.setAttribute('sizes', 'any');
    // Also set as shortcut icon for older browser compat
    link.rel = 'icon';
  }

  function removeFavicon() {
    const ours = document.getElementById(FAVICON_LINK_ID);
    if (ours) ours.remove();
    // Restore original favicons
    if (_originalFavicons && _originalFavicons.length) {
      for (const f of _originalFavicons) {
        const link = document.createElement('link');
        link.rel = f.rel;
        link.href = f.href;
        if (f.type) link.type = f.type;
        if (f.sizes) link.sizes = f.sizes;
        (document.head || document.documentElement).appendChild(link);
      }
    }
    _originalFavicons = null;
  }

  // ─── Effects layer ────────────────────────────────────────────────────────

  function removeEffectsStyles() {
    const existing = document.getElementById(EFFECTS_STYLE_ID);
    if (existing) existing.remove();
  }

  function injectEffectsCSS(css) {
    removeEffectsStyles();
    if (!css) return;
    const style = document.createElement('style');
    style.id = EFFECTS_STYLE_ID;
    style.dataset.sftSource = 'engine:effects';
    style.textContent = `/* sft-source: engine:effects */\n${css}`;
    const target = document.head || document.documentElement;
    target.appendChild(style);
  }

  function destroyCanvasEffects() {
    if (particleSystem) { particleSystem.destroy(); particleSystem = null; }
    if (cursorTrailSystem) { cursorTrailSystem.destroy(); cursorTrailSystem = null; }
  }

  /**
   * Apply effects based on config + current theme colors.
   * @param {Object} config - Effects config from resolveEffectsConfig()
   * @param {Object} themeColors - Current theme's color values
   */
  function applyEffects(config, themeColors) {
    currentEffectsConfig = config;

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      destroyCanvasEffects();
      removeEffectsStyles();
      if (typeof applyEffectsClasses === 'function') applyEffectsClasses(null);
      return;
    }

    // Generate and inject effects CSS
    if (typeof generateEffectsCSS === 'function') {
      const css = generateEffectsCSS(config, themeColors);
      injectEffectsCSS(css);
    }

    // Apply body classes
    if (typeof applyEffectsClasses === 'function') {
      applyEffectsClasses(config);
    }

    // Manage canvas-based effects
    destroyCanvasEffects();

    if (config && config.particles && config.particles !== false) {
      const pType = typeof config.particles === 'string' ? config.particles : 'dots';
      const runtime = typeof buildParticleRuntimeConfig === 'function'
        ? buildParticleRuntimeConfig(config, themeColors)
        : { color: themeColors?.accent || '#ffffff', density: 50, speed: 1, opacity: 0.5 };
      particleSystem = new SFThemerParticles(pType, runtime);
      particleSystem.init();
    }

    if (config && config.cursorTrail) {
      const runtime = typeof buildCursorTrailRuntimeConfig === 'function'
        ? buildCursorTrailRuntimeConfig(config, themeColors)
        : { color: themeColors?.accent || '#ffffff', length: 20, size: 4, opacity: 0.5 };
      cursorTrailSystem = new SFThemerCursorTrail(runtime);
      cursorTrailSystem.init();
    }
  }

  /**
   * Load and apply effects for the current theme.
   * Resolution rules (implemented in resolveActiveEffects):
   *   - Custom theme active → use customTheme.effects snapshot
   *   - OOTB theme active  → use theme's SHIPPED effects, scaled by Volume knob
   */
  async function loadAndApplyEffects(themeName) {
    if (contextDead) return;
    try {
      const [syncData, themeData] = await Promise.all([
        chrome.storage.sync.get({ effectsVolume: 'default', customThemes: [] }),
        fetch(chrome.runtime.getURL('themes/themes.json')).then(r => r.json()),
      ]);

      // Find the theme (OOTB or custom)
      let theme = themeData.themes.find(t => t.id === themeName);
      let customTheme = null;

      if (!theme && Array.isArray(syncData.customThemes)) {
        customTheme = syncData.customThemes.find(t => t.id === themeName);
        if (customTheme) {
          // Use the custom theme's resolved colors (base + overrides)
          const base = themeData.themes.find(t => t.id === customTheme.basedOn);
          theme = {
            id: customTheme.id,
            colors: { ...(base?.colors || {}), ...(customTheme.coreOverrides || {}), ...(customTheme.advancedOverrides || {}) },
          };
        }
      }

      if (!theme) return;

      const config = typeof resolveActiveEffects === 'function'
        ? resolveActiveEffects(themeName, syncData.effectsVolume, customTheme)
        : null;

      if (config) {
        applyEffects(config, theme.colors);
      }
    } catch (err) {
      if (isExtensionContextDead(err)) {
        handleDeadContext();
        return;
      }
      console.warn('[Salesforce Themer] Effects load error:', err.message);
    }
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
    if (contextDead) return;
    if (themeName === 'none') {
      const stripTheme = () => {
        removeThemeStyles();
        removeEffectsStyles();
        destroyCanvasEffects();
        currentEffectsConfig = null;
        if (window.__sfThemerDiag?.removePatches) {
          try { window.__sfThemerDiag.removePatches(); } catch (_) {}
        }
      };
      if (animate && typeof document.startViewTransition === 'function') {
        try { document.startViewTransition(stripTheme); }
        catch (_) { beginTransition(); stripTheme(); endTransition(); }
      } else {
        if (animate) beginTransition();
        stripTheme();
        if (animate) endTransition();
      }
      currentTheme = 'none';
      return;
    }

    try {
      // Try local cache first (fast), fall back to fetch (first install edge case)
      const cached = await chrome.storage.local.get(`themeCSS_${themeName}`);
      const css = cached[`themeCSS_${themeName}`] || await fetchThemeCSS(themeName);

      if (animate && swapThemeCSS(css)) {
        currentTheme = themeName;
      } else {
        if (animate) beginTransition();
        injectCSSText(css);
        currentTheme = themeName;
        if (animate) endTransition();
      }
    } catch (err) {
      if (isExtensionContextDead(err)) {
        handleDeadContext();
        return;
      }
      console.warn('[Salesforce Themer] Could not apply theme:', err.message);
    }
  }

  // ─── Per-org theming ─────────────────────────────────────────────────────

  function getOrgHostname() {
    return window.location.hostname;
  }

  async function resolveTheme(syncData) {
    // If the user explicitly turned theming off, respect that above all else.
    // 'none' means "no theme" — don't let orgThemes or autoMode override it.
    if (syncData.theme === 'none') {
      return 'none';
    }

    const hostname = getOrgHostname();
    const orgThemes = syncData.orgThemes || {};

    // Per-org override (only if user hasn't globally disabled)
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
      if (contextDead) return;
      try {
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
      } catch (err) {
        if (isExtensionContextDead(err)) {
          handleDeadContext();
          return;
        }
        console.warn('[Salesforce Themer] Auto-mode listener error:', err.message);
      }
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
      let needsEffectsReinjection = false;
      let needsFaviconReinjection = false;
      let needsPatchReinjection = false;
      let competingFaviconAdded = false;
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node.id === STYLE_ID || node.id === 'sf-themer-transitions') {
            needsReinjection = true;
          }
          if (node.id === EFFECTS_STYLE_ID) {
            needsEffectsReinjection = true;
          }
          if (node.id === FAVICON_LINK_ID) {
            needsFaviconReinjection = true;
          }
          if (node.id === 'sf-themer-custom-patches') {
            needsPatchReinjection = true;
          }
        }
        for (const node of mutation.addedNodes) {
          // Salesforce's SPA re-adds its own <link rel="icon"> after navigation.
          // If ours is already in place, strip the competitor so the browser
          // doesn't pick the newer sibling as the tab icon.
          if (node.nodeType === 1 && node.tagName === 'LINK'
              && (node.rel || '').includes('icon') && node.id !== FAVICON_LINK_ID
              && _currentFaviconEnabled) {
            node.remove();
            competingFaviconAdded = true;
          }
        }
      }
      if (competingFaviconAdded) {
        // Force the browser to re-read our favicon.
        const ours = document.getElementById(FAVICON_LINK_ID);
        if (ours) {
          const href = ours.href;
          ours.href = '';
          ours.href = href;
        }
      }
      if (needsReinjection) {
        injectTransitionStyles();
        ensureThemePresent();
      }
      if (needsEffectsReinjection && currentTheme && currentTheme !== 'none') {
        loadAndApplyEffects(currentTheme);
      }
      if (needsFaviconReinjection && _currentFaviconEnabled) {
        applyFavicon(true, _currentFaviconConfig);
      }
      if (needsPatchReinjection && currentTheme && currentTheme !== 'none') {
        if (window.__sfThemerDiag?.injectPatches) {
          try { window.__sfThemerDiag.injectPatches(); } catch (_) {}
        }
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
      applyTheme(message.theme, true).then(async () => {
        // Re-apply effects for new theme (colors may differ)
        loadAndApplyEffects(message.theme);
        // Swap the favicon to the new theme's config. Pull the enabled flag
        // from sync storage in case this message arrives before the initial
        // apply on this tab has stamped _currentFaviconEnabled.
        try {
          const { faviconEnabled = true } = await chrome.storage.sync.get({ faviconEnabled: true });
          const cfg = await _resolveThemeFavicon(message.theme);
          applyFavicon(faviconEnabled, cfg);
        } catch (_) {}
        // Keep diagnostic panel in sync with active theme
        if (diagnosticPanel) diagnosticPanel.updateTheme(message.theme);
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

    if (message.action === 'setFavicon') {
      applyFavicon(!!message.enabled, message.config || null);
      sendResponse({ success: true });
      return false;
    }

    if (message.action === 'setEffects') {
      // Direct effects config update (from popup/options)
      if (currentTheme && currentTheme !== 'none') {
        loadAndApplyEffects(currentTheme);
      }
      sendResponse({ success: true });
      return false;
    }

    if (message.action === 'getEffects') {
      sendResponse({ config: currentEffectsConfig });
      return false;
    }

    if (message.action === 'toggleDiagnostic') {
      console.log('[SFT] toggleDiagnostic received', { isTop: window === window.top, hasDiag: !!window.__sfThemerDiag?.DiagnosticPanel });
      // Only run in top frame
      if (window !== window.top) { sendResponse({ ignored: true }); return false; }
      if (!window.__sfThemerDiag?.DiagnosticPanel) {
        console.error('[SFT] DiagnosticPanel class not found on window.__sfThemerDiag');
        sendResponse({ error: 'Diagnostic module not loaded' });
        return false;
      }
      if (!diagnosticPanel) {
        diagnosticPanel = new window.__sfThemerDiag.DiagnosticPanel({
          currentTheme,
          styleId: STYLE_ID,
        });
        console.log('[SFT] DiagnosticPanel created');
      } else {
        diagnosticPanel.updateTheme(currentTheme);
      }
      diagnosticPanel.toggle();
      sendResponse({ success: true });
      return true; // async — toggle() is async
    }

    if (message.action === 'diagnose') {
      // Read computed CSS custom properties and report which tokens are active
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const tokens = message.tokens || [];
      const results = {};
      for (const token of tokens) {
        const val = cs.getPropertyValue(token).trim();
        results[token] = val || null;
      }
      // Also report basic page info
      const styleTag = document.getElementById(STYLE_ID);
      sendResponse({
        url: location.hostname,
        theme: currentTheme,
        styleInjected: !!styleTag,
        styleLengthBytes: styleTag ? styleTag.textContent.length : 0,
        tokens: results,
      });
      return false;
    }
  });

  // ─── SPA navigation listener (for diagnostic panel) ──────────────────────

  function setupNavigationListener() {
    if (window !== window.top) return;
    let lastUrl = location.href;
    const notify = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (diagnosticPanel) diagnosticPanel.onNavigate();
      }
    };
    window.addEventListener('popstate', notify);
    window.addEventListener('hashchange', notify);
    // SF uses pushState for SPA nav — intercept it
    const origPushState = history.pushState;
    history.pushState = function (...args) {
      origPushState.apply(this, args);
      notify();
    };
    const origReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      origReplaceState.apply(this, args);
      notify();
    };
    // Polling fallback — SF sometimes navigates without pushState
    // Only runs when diagnostic panel is open, checks every 2s
    setInterval(() => {
      if (diagnosticPanel && diagnosticPanel.isOpen) notify();
    }, 2000);
  }

  // ─── Initialisation ──────────────────────────────────────────────────────

  async function init() {
    injectTransitionStyles();
    startObserver();
    setupMediaQueryListener();
    setupNavigationListener();

    try {
      const syncResult = await chrome.storage.sync.get({
        theme: 'connectry',
        autoMode: false,
        lastLightTheme: 'connectry',
        lastDarkTheme: 'connectry-dark',
        orgThemes: {},
        themeScope: 'lightning',
        faviconEnabled: true,
        faviconConfig: null,
      });

      if (!shouldApplyToPage(syncResult.themeScope)) {
        console.log(`[SFT] BAILED — scope='${syncResult.themeScope}' excludes this frame (isSetupPage=${isSetupPage}). Switch scope to 'both' or 'setup' in the popup to theme Setup pages.`);
        return;
      }
      console.log(`[SFT] applying theme — scope='${syncResult.themeScope}' isSetupPage=${isSetupPage}`);

      const themeName = await resolveTheme(syncResult);

      // Try local cache for zero-flash experience when DOM is already ready
      const cached = await chrome.storage.local.get(`themeCSS_${themeName}`);
      const cachedCSS = cached[`themeCSS_${themeName}`];

      if (cachedCSS) {
        applyThemeFast(themeName, cachedCSS);
      } else {
        await applyTheme(themeName, false);
      }

      // Load effects layer after theme is applied
      loadAndApplyEffects(themeName);

      // Inject custom LWC patches (if any)
      if (window.__sfThemerDiag?.injectPatches) {
        try { window.__sfThemerDiag.injectPatches(); } catch (_) {}
      }

      // Favicon — resolve from the active theme's own config (custom themes
      // carry .favicon inline, presets carry it in themes.json). Fall back to
      // the bundled Connectry mark if the theme has no favicon config.
      const faviconCfg = await _resolveThemeFavicon(themeName);
      applyFavicon(syncResult.faviconEnabled, faviconCfg);

      // Auto-reopen diagnostic panel if it was open before page refresh
      if (isTopFrame && window.__sfThemerDiag?.DiagnosticPanel) {
        try {
          const diagState = await chrome.storage.local.get('diagnosticPanelOpen');
          if (diagState.diagnosticPanelOpen) {
            diagnosticPanel = new window.__sfThemerDiag.DiagnosticPanel({
              currentTheme,
              styleId: STYLE_ID,
            });
            diagnosticPanel.open();
            console.log('[SFT] Diagnostic panel auto-reopened');
          }
        } catch (_) {}
      }
    } catch (err) {
      if (isExtensionContextDead(err)) {
        handleDeadContext();
        return;
      }
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
      { theme: 'connectry', autoMode: false, lastLightTheme: 'connectry', lastDarkTheme: 'connectry-dark', orgThemes: {}, themeScope: 'lightning' },
      (syncData) => {
        if (chrome.runtime.lastError) return;
        if (!shouldApplyToPage(syncData.themeScope)) {
          console.log(`[SFT preInit] BAILED — scope='${syncData.themeScope}' excludes this frame (isSetupPage=${isSetupPage}).`);
          return;
        }

        // If user explicitly disabled theming, bail immediately
        if (syncData.theme === 'none') return;

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

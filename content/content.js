(() => {
  'use strict';

  const STYLE_ID = 'sf-themer-styles';
  const TRANSITION_CLASS = 'sf-themer-transitioning';
  const TRANSITION_DURATION = 300;

  let currentTheme = null;
  let observer = null;

  // Inject transition styles once — lightweight, always present
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
    `;
    const target = document.head || document.documentElement;
    target.appendChild(style);
  }

  // Fetch CSS from extension package
  async function fetchThemeCSS(themeName) {
    const url = chrome.runtime.getURL(`content/themes/${themeName}.css`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch theme: ${themeName} (${response.status})`);
    }
    return response.text();
  }

  // Remove existing theme style tag
  function removeThemeStyles() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
  }

  // Apply theme CSS by injecting a <style> tag
  async function applyTheme(themeName, animate = true) {
    if (themeName === 'none') {
      if (animate) beginTransition();
      removeThemeStyles();
      currentTheme = 'none';
      if (animate) endTransition();
      return;
    }

    try {
      const css = await fetchThemeCSS(themeName);

      if (animate) beginTransition();

      removeThemeStyles();

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css;

      const target = document.head || document.documentElement;
      target.appendChild(style);

      currentTheme = themeName;

      if (animate) endTransition();
    } catch (err) {
      console.warn('[Salesforce Themer] Could not apply theme:', err.message);
    }
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

  // Re-inject theme if our style tag was removed (SF SPA navigation sometimes clears head)
  function ensureThemePresent() {
    if (!currentTheme || currentTheme === 'none') return;
    if (!document.getElementById(STYLE_ID)) {
      applyTheme(currentTheme, false);
    }
  }

  // Watch for DOM mutations: SF navigation can clear or re-render the document head
  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      let needsReinjection = false;

      for (const mutation of mutations) {
        // Check if our style tag was removed
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

    // Also observe body for SPA navigation signals
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: false, attributes: false });
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'setTheme') {
      applyTheme(message.theme, true).then(() => {
        sendResponse({ success: true, theme: message.theme });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // Keep channel open for async response
    }

    if (message.action === 'getTheme') {
      sendResponse({ theme: currentTheme });
      return false;
    }
  });

  // Initialise: load saved theme and inject
  async function init() {
    injectTransitionStyles();
    startObserver();

    try {
      const result = await chrome.storage.sync.get({ theme: 'connectry' });
      const savedTheme = result.theme || 'connectry';
      await applyTheme(savedTheme, false);
    } catch (err) {
      console.warn('[Salesforce Themer] Init error:', err.message);
      // Fallback: try connectry theme silently
      try {
        await applyTheme('connectry', false);
      } catch (_) {
        // Silent fail — don't break the page
      }
    }
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

(() => {
  'use strict';

  const THEMES = ['connectry', 'midnight', 'slate', 'tron', 'obsidian', 'arctic', 'none'];

  // Update UI to reflect active theme
  function setActiveUI(activeTheme) {
    document.querySelectorAll('[data-theme]').forEach((el) => {
      const isActive = el.dataset.theme === activeTheme;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('aria-checked', String(isActive));
    });
  }

  // Send theme to content script on the active Salesforce tab
  async function applyThemeToTab(theme) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme });
    } catch (_) {
      // Content script may not be injected on this tab — silent fail
    }
  }

  // Handle theme selection
  async function selectTheme(theme) {
    if (!THEMES.includes(theme)) return;

    // Save to storage
    await chrome.storage.sync.set({ theme });

    // Update UI immediately
    setActiveUI(theme);

    // Push to content script
    await applyThemeToTab(theme);
  }

  // Wire up all theme buttons
  function bindButtons() {
    document.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectTheme(btn.dataset.theme);
      });

      // Keyboard support
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTheme(btn.dataset.theme);
        }
      });
    });
  }

  // Init: read saved theme and reflect it
  async function init() {
    const result = await chrome.storage.sync.get({ theme: 'connectry' });
    setActiveUI(result.theme);
    bindButtons();
  }

  init();
})();

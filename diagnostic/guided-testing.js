/**
 * Guided Testing — Salesforce Themer Diagnostic
 *
 * Walks the user through testing the active theme across all major
 * Salesforce page types. Detects the current page via URL patterns,
 * runs scans, tracks per-theme progress, and suggests next steps.
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  // ─── Page type definitions ──────────────────────────────────────────────

  const PAGE_TYPES = [
    {
      id: 'home',
      label: 'Home Page',
      icon: 'home',
      urlPatterns: [/\/lightning\/page\/home/, /\/lightning\/o\/Home/],
      hint: 'Click the Home tab in the navigation bar.',
      scans: ['tokens', 'components'],
      keyComponents: ['card', 'pageHeader', 'nav'],
    },
    {
      id: 'record',
      label: 'Record Detail',
      icon: 'record',
      urlPatterns: [/\/lightning\/r\/[A-Za-z0-9_]+\/[a-zA-Z0-9]+\/view/],
      hint: 'Open any record (Account, Contact, Opportunity, etc.).',
      scans: ['tokens', 'components'],
      keyComponents: ['card', 'button', 'input', 'tab', 'recordLayout', 'path'],
    },
    {
      id: 'listView',
      label: 'List View',
      icon: 'list',
      urlPatterns: [/\/lightning\/o\/[A-Za-z0-9_]+\/list/, /\/lightning\/o\/[A-Za-z0-9_]+\/home/],
      hint: 'Navigate to any object\'s list view (e.g., Accounts > All Accounts).',
      scans: ['tokens', 'components'],
      keyComponents: ['table', 'pageHeader', 'button', 'input'],
    },
    {
      id: 'relatedList',
      label: 'Related Lists',
      icon: 'related',
      urlPatterns: [/\/lightning\/r\/.*\/related/, /\/lightning\/r\/[A-Za-z0-9_]+\/[a-zA-Z0-9]+\/view/],
      hint: 'Open a record — Related Lists are on the Related tab.',
      scans: ['tokens', 'components'],
      keyComponents: ['card', 'table', 'button'],
      // Detected via DOM: record pages always have related lists
      domDetect: () => document.querySelectorAll('.forceRelatedListContainer, .slds-related-list').length > 0,
    },
    {
      id: 'setup',
      label: 'Setup',
      icon: 'setup',
      urlPatterns: [/\/lightning\/setup\//, /salesforce-setup\.com/, /\/setup\//],
      hint: 'Click the gear icon → "Setup". Opens in a new tab — open the diagnostic there too.',
      scans: ['tokens', 'components'],
      keyComponents: ['card', 'table', 'input', 'nav'],
    },
    {
      id: 'appLauncher',
      label: 'App Launcher',
      icon: 'launcher',
      urlPatterns: [/\/lightning\/o\/AppLauncher/, /\/lightning\/page\/app-launcher/],
      hint: 'Click the 9-dot waffle icon in the top-left corner.',
      scans: ['tokens'],
      keyComponents: ['card', 'input'],
      // App Launcher often opens as a modal overlay — detect via DOM
      domDetect: () => document.querySelector('.appLauncherMenu, .slds-app-launcher') !== null,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: 'report',
      urlPatterns: [/\/lightning\/o\/Report/, /\/lightning\/r\/Report/],
      hint: 'Navigate to the Reports tab.',
      scans: ['tokens', 'components'],
      keyComponents: ['table', 'card', 'button'],
    },
    {
      id: 'dashboards',
      label: 'Dashboards',
      icon: 'dashboard',
      urlPatterns: [/\/lightning\/o\/Dashboard/, /\/lightning\/r\/Dashboard/],
      hint: 'Navigate to the Dashboards tab.',
      scans: ['tokens', 'components'],
      keyComponents: ['card'],
    },
    {
      id: 'modal',
      label: 'Modal / Dialog',
      icon: 'modal',
      urlPatterns: [],
      hint: 'Open any modal (e.g., click "New" on a list view, or edit a record inline).',
      scans: ['tokens', 'components'],
      keyComponents: ['modal', 'button', 'input'],
      // Auto-detect when a modal is visible in the DOM
      domDetect: () => document.querySelector('.slds-modal__container, .modal-container, .forceModalContainer') !== null,
    },
    {
      id: 'dropdown',
      label: 'Dropdowns & Popovers',
      icon: 'dropdown',
      urlPatterns: [],
      hint: 'Click any dropdown menu or hover over a help tooltip.',
      scans: ['tokens', 'components'],
      keyComponents: ['dropdown', 'popover'],
      // Auto-detect when a dropdown/popover is visible
      domDetect: () => document.querySelector('.slds-dropdown.slds-dropdown_length-5, .slds-popover:not([hidden]), .slds-dropdown[aria-expanded="true"]') !== null,
    },
  ];

  const STORAGE_KEY_PREFIX = 'diagTestProgress_';

  // ─── Page detection ─────────────────────────────────────────────────────

  /**
   * Detect the current page type based on URL.
   * Returns the matching page type object, or null.
   */
  ns.detectPageType = function detectPageType() {
    const url = location.pathname + location.search + location.hash;
    const host = location.hostname;

    // First check DOM-detected types (modals, dropdowns, app launcher overlay)
    // These take priority since they're transient overlays on top of other pages
    for (const pt of PAGE_TYPES) {
      if (pt.domDetect && pt.domDetect()) {
        return pt;
      }
    }

    // Then check URL patterns
    for (const pt of PAGE_TYPES) {
      if (!pt.urlPatterns.length) continue;
      for (const pattern of pt.urlPatterns) {
        if (pattern.test(url) || pattern.test(host)) {
          return pt;
        }
      }
    }
    return null;
  };

  // ─── Progress management ────────────────────────────────────────────────

  /**
   * Get testing progress for a theme.
   * Returns { [pageTypeId]: { completed, timestamp, tokenCoverage, componentHealth } }
   */
  ns.getTestingProgress = async function getTestingProgress(themeId) {
    try {
      const key = STORAGE_KEY_PREFIX + (themeId || 'unknown');
      const data = await chrome.storage.local.get(key);
      return data[key] || {};
    } catch (_) {
      return {};
    }
  };

  /**
   * Save a test result for a page type.
   */
  ns.saveTestResult = async function saveTestResult(themeId, pageTypeId, result) {
    try {
      const key = STORAGE_KEY_PREFIX + (themeId || 'unknown');
      const data = await chrome.storage.local.get(key);
      const progress = data[key] || {};

      progress[pageTypeId] = {
        completed: true,
        timestamp: new Date().toISOString(),
        tokenCoverage: result.tokenCoverage || null,
        componentHealth: result.componentHealth || null,
        url: location.href,
      };

      await chrome.storage.local.set({ [key]: progress });
    } catch (_) {}
  };

  /**
   * Clear testing progress for a theme.
   */
  ns.clearTestingProgress = async function clearTestingProgress(themeId) {
    try {
      const key = STORAGE_KEY_PREFIX + (themeId || 'unknown');
      await chrome.storage.local.remove(key);
    } catch (_) {}
  };

  /**
   * Get a completion summary.
   */
  ns.getCompletionSummary = function getCompletionSummary(progress) {
    const total = PAGE_TYPES.length;
    let completed = 0;
    const items = [];

    for (const pt of PAGE_TYPES) {
      const result = progress[pt.id];
      items.push({
        ...pt,
        completed: !!(result && result.completed),
        result: result || null,
      });
      if (result && result.completed) completed++;
    }

    return { completed, total, items };
  };

  /**
   * Suggest the next untested page type. Prioritizes auto-detectable
   * pages (with URL patterns) over manual ones.
   */
  ns.suggestNext = function suggestNext(progress) {
    // First, try auto-detectable pages
    for (const pt of PAGE_TYPES) {
      if (pt.manual) continue;
      if (!progress[pt.id]?.completed) return pt;
    }
    // Then manual ones
    for (const pt of PAGE_TYPES) {
      if (!pt.manual) continue;
      if (!progress[pt.id]?.completed) return pt;
    }
    return null; // All done
  };

  // ─── Exports ────────────────────────────────────────────────────────────

  ns.PAGE_TYPES = PAGE_TYPES;
})();

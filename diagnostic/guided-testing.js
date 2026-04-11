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

  // ORDER MATTERS — more specific patterns must come before generic ones.
  // Reports/Dashboards must precede Record Detail since /lightning/r/Report/
  // and /lightning/r/Dashboard/ would match the generic record pattern.
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
      id: 'setup',
      label: 'Setup',
      icon: 'setup',
      urlPatterns: [/\/lightning\/setup\//, /salesforce-setup\.com/, /\/setup\//, /SetupOneHome/],
      hint: 'Click the gear icon → "Setup". Opens in a new tab — open the diagnostic there too.',
      scans: ['tokens', 'components'],
      keyComponents: ['card', 'table', 'input', 'nav'],
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
      id: 'appLauncher',
      label: 'App Launcher',
      icon: 'launcher',
      urlPatterns: [/\/lightning\/o\/AppLauncher/, /\/lightning\/page\/app-launcher/, /app-launcher/],
      hint: 'Click the 9-dot waffle icon in the top-left corner.',
      scans: ['tokens'],
      keyComponents: ['card', 'input'],
      domDetect: () => {
        const launcher = document.querySelector('.appLauncherMenu, .slds-app-launcher, [class*="appLauncher"]');
        if (!launcher) return false;
        return launcher.offsetHeight > 100;
      },
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
      urlPatterns: [/\/lightning\/r\/.*\/related/],
      hint: 'On a record, click the "Related" tab to see related lists.',
      scans: ['tokens', 'components'],
      keyComponents: ['card', 'table', 'button'],
      domDetect: () => {
        if (!/\/lightning\/r\//.test(location.pathname)) return false;
        return document.querySelectorAll('.forceRelatedListContainer, [class*="relatedList"], .slds-card.forceRelatedListCardDesktop').length > 0;
      },
    },
    {
      // Record Detail MUST come after Reports/Dashboards since /lightning/r/ is a broad match
      id: 'record',
      label: 'Record Detail',
      icon: 'record',
      urlPatterns: [/\/lightning\/r\/[A-Za-z0-9_]+\/[a-zA-Z0-9]+\/view/],
      hint: 'Open any record (Account, Contact, Opportunity, etc.).',
      scans: ['tokens', 'components'],
      keyComponents: ['card', 'button', 'input', 'tab', 'recordLayout', 'path'],
    },
    {
      id: 'modal',
      label: 'Modal / Dialog',
      icon: 'modal',
      urlPatterns: [/\/new\?/, /\/e\?/], // SF new/edit record URLs
      hint: 'Open any modal (e.g., click "New" on a list view, or edit a record inline).',
      scans: ['tokens', 'components'],
      keyComponents: ['modal', 'button', 'input'],
      // Auto-detect when a modal is actually visible (check computed visibility)
      domDetect: () => {
        const modal = document.querySelector('.slds-modal__container, .modal-container, .forceModalContainer');
        if (!modal) return false;
        const style = getComputedStyle(modal);
        return style.display !== 'none' && style.visibility !== 'hidden' && modal.offsetHeight > 0;
      },
    },
    {
      id: 'dropdown',
      label: 'Dropdowns & Popovers',
      icon: 'dropdown',
      urlPatterns: [],
      hint: 'Click any dropdown menu or hover over a help tooltip.',
      scans: ['tokens', 'components'],
      keyComponents: ['dropdown', 'popover'],
      manual: true, // Keep as manual — dropdowns are too transient for auto-detect
    },
  ];

  const STORAGE_KEY_PREFIX = 'diagTestProgress_';

  /** Build storage key: per theme + per org */
  function storageKey(themeId) {
    const org = location.hostname.replace('.lightning.force.com', '').replace('.my.salesforce.com', '').replace('.my.salesforce-setup.com', '');
    return STORAGE_KEY_PREFIX + (themeId || 'unknown') + '_' + org;
  }

  // ─── Page detection ─────────────────────────────────────────────────────

  /**
   * Detect the current page type based on URL.
   * Returns the matching page type object, or null.
   */
  ns.detectPageType = function detectPageType() {
    const url = location.pathname + location.search + location.hash;
    const host = location.hostname;

    // URL patterns first — they're the most reliable signal
    for (const pt of PAGE_TYPES) {
      if (!pt.urlPatterns || !pt.urlPatterns.length) continue;
      for (const pattern of pt.urlPatterns) {
        if (pattern.test(url) || pattern.test(host)) {
          return pt;
        }
      }
    }

    // Then DOM-detected types (modals, app launcher overlay)
    // Only checked if no URL pattern matched
    for (const pt of PAGE_TYPES) {
      if (pt.domDetect && pt.domDetect()) {
        return pt;
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
      const key = storageKey(themeId);
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
      const key = storageKey(themeId);
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
      const key = storageKey(themeId);
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

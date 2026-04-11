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
  // ── Page groups ──────────────────────────────────────────────────────────
  // Pages are organized into groups for the checklist UI.
  // ORDER MATTERS within groups — more specific URL patterns first.

  const PAGE_TYPES = [
    // ── Lightning Experience ──────────────────────────────────────────────
    {
      id: 'home',
      label: 'Home Page',
      group: 'lightning',
      urlPatterns: [/\/lightning\/page\/home/, /\/lightning\/o\/Home/],
      hint: 'Click the Home tab in the navigation bar.',
      keyComponents: ['card', 'pageHeader', 'nav'],
    },
    {
      id: 'listView',
      label: 'List View',
      group: 'lightning',
      urlPatterns: [/\/lightning\/o\/[A-Za-z0-9_]+\/list/, /\/lightning\/o\/[A-Za-z0-9_]+\/home/],
      hint: 'Navigate to any object\'s list view (e.g., Accounts > All Accounts).',
      keyComponents: ['table', 'pageHeader', 'button', 'input'],
    },
    {
      id: 'reports',
      label: 'Reports',
      group: 'lightning',
      urlPatterns: [/\/lightning\/o\/Report/, /\/lightning\/r\/Report/],
      hint: 'Navigate to the Reports tab.',
      keyComponents: ['table', 'card', 'button'],
    },
    {
      id: 'dashboards',
      label: 'Dashboards',
      group: 'lightning',
      urlPatterns: [/\/lightning\/o\/Dashboard/, /\/lightning\/r\/Dashboard/],
      hint: 'Navigate to the Dashboards tab.',
      keyComponents: ['card'],
    },
    {
      // Record Detail MUST come after Reports/Dashboards since /lightning/r/ is broad
      id: 'record',
      label: 'Record Detail',
      group: 'lightning',
      urlPatterns: [/\/lightning\/r\/[A-Za-z0-9_]+\/[a-zA-Z0-9]+\/view/],
      hint: 'Open any record (Account, Contact, Opportunity, etc.).',
      keyComponents: ['card', 'button', 'input', 'tab', 'recordLayout', 'path'],
    },
    {
      id: 'relatedList',
      label: 'Related Lists',
      group: 'lightning',
      urlPatterns: [/\/lightning\/r\/.*\/related/],
      hint: 'On a record, click the "Related" tab.',
      keyComponents: ['card', 'table', 'button'],
      // Also detect via DOM when Related tab is active on a record page
      domDetect: () => {
        // Check if the Related tab is selected (aria-selected="true" on a tab with "Related" text)
        const relTab = document.querySelector('.slds-tabs_default__item.slds-is-active');
        return relTab && /related/i.test(relTab.textContent);
      },
    },
    {
      id: 'appLauncher',
      label: 'App Launcher',
      group: 'lightning',
      urlPatterns: [/\/lightning\/o\/AppLauncher/, /\/lightning\/page\/app-launcher/],
      hint: 'Click the 9-dot waffle icon in the top-left corner.',
      keyComponents: ['card', 'input'],
      // Detect overlay by checking for the launcher modal in DOM
      domDetect: () => {
        const el = document.querySelector('one-app-launcher-modal');
        return el && el.offsetHeight > 0;
      },
    },
    {
      id: 'modal',
      label: 'Modal / Dialog',
      group: 'lightning',
      urlPatterns: [/\/new\?/, /\/e\?/],
      hint: 'Open any modal (e.g., click "New" on a list view).',
      keyComponents: ['modal', 'button', 'input'],
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
      group: 'lightning',
      urlPatterns: [],
      hint: 'Click any dropdown menu or hover over a help tooltip.',
      keyComponents: ['dropdown', 'popover'],
      manual: true, // Genuinely transient — can't auto-detect reliably
    },

    // ── Setup Pages ──────────────────────────────────────────────────────
    {
      id: 'setupHome',
      label: 'Setup Home',
      group: 'setup',
      urlPatterns: [/SetupOneHome/, /\/lightning\/setup\/SetupOneHome/],
      hint: 'Gear icon → Setup → you land on Setup Home.',
      keyComponents: ['card', 'nav'],
    },
    {
      id: 'setupUsers',
      label: 'Users',
      group: 'setup',
      urlPatterns: [/\/lightning\/setup\/ManageUsers/, /\/setup\/ManageUsers/],
      hint: 'Setup → Users → Users list.',
      keyComponents: ['table', 'button', 'input'],
    },
    {
      id: 'setupProfiles',
      label: 'Profiles',
      group: 'setup',
      urlPatterns: [/\/lightning\/setup\/EnhancedProfiles/, /\/lightning\/setup\/Profiles/, /\/setup\/profiles/i],
      hint: 'Setup → Profiles.',
      keyComponents: ['table', 'button'],
    },
    {
      id: 'setupPermSets',
      label: 'Permission Sets',
      group: 'setup',
      urlPatterns: [/\/lightning\/setup\/PermSets/, /\/setup\/PermSets/],
      hint: 'Setup → Permission Sets. Often a classic VF page.',
      keyComponents: ['table', 'button'],
    },
    {
      id: 'setupObjManager',
      label: 'Object Manager',
      group: 'setup',
      urlPatterns: [/\/lightning\/setup\/ObjectManager/, /\/setup\/ObjectManager/],
      hint: 'Setup → Object Manager.',
      keyComponents: ['table', 'input', 'card'],
    },
    {
      id: 'setupFlows',
      label: 'Flows',
      group: 'setup',
      urlPatterns: [/\/lightning\/setup\/Flows/, /\/setup\/Flows/],
      hint: 'Setup → Flows.',
      keyComponents: ['table', 'button'],
    },
    {
      id: 'setupGeneric',
      label: 'Other Setup Page',
      group: 'setup',
      // Catch-all for any setup page not matched above
      urlPatterns: [/\/lightning\/setup\//, /salesforce-setup\.com/, /\/setup\//],
      hint: 'Navigate to any other Setup page.',
      keyComponents: ['card', 'table', 'input', 'nav'],
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

    // Overlay detection FIRST — App Launcher and Modals are overlays on
    // top of other pages. Their DOM is present but the URL still shows
    // the underlying page. Must check before URL patterns.
    const overlayTypes = PAGE_TYPES.filter(pt => pt.domDetect && (pt.id === 'appLauncher' || pt.id === 'modal'));
    for (const pt of overlayTypes) {
      if (pt.domDetect()) return pt;
    }

    // URL patterns — most reliable for non-overlay page types
    for (const pt of PAGE_TYPES) {
      if (!pt.urlPatterns || !pt.urlPatterns.length) continue;
      for (const pattern of pt.urlPatterns) {
        if (pattern.test(url) || pattern.test(host)) {
          return pt;
        }
      }
    }

    // Remaining DOM detection (related lists on record pages)
    for (const pt of PAGE_TYPES) {
      if (pt.domDetect && pt.id !== 'appLauncher' && pt.id !== 'modal') {
        if (pt.domDetect()) return pt;
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

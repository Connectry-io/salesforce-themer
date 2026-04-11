/**
 * Component Scanner — Salesforce Themer Diagnostic
 *
 * Walks the live DOM to inventory Salesforce components, custom LWCs,
 * and managed-package elements. For each component found, checks whether
 * the active theme's CSS is reaching it or if it uses hardcoded colors
 * that bypass the token system.
 *
 * Three detection modes:
 *  1. Standard SLDS components (cards, buttons, tables, etc.)
 *  2. Custom LWCs (customer-built, identified by tag name pattern)
 *  3. Managed package components (namespaced tag names like nCino-*)
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  // ─── Component registry ─────────────────────────────────────────────────
  // Maps SF component types to the selectors and CSS properties we check.
  // cssProps are the properties we read via getComputedStyle to determine
  // if the theme is reaching the component.

  const COMPONENT_REGISTRY = {
    card: {
      label: 'Cards',
      selectors: ['.slds-card', '.forceRecordCard'],
      cssProps: ['background-color', 'border-color', 'color'],
    },
    button: {
      label: 'Buttons',
      selectors: ['.slds-button_brand', '.slds-button--brand', '.slds-button_neutral', '.slds-button--neutral'],
      cssProps: ['background-color', 'border-color', 'color'],
    },
    input: {
      label: 'Form Inputs',
      selectors: ['.slds-input', '.slds-textarea', '.slds-select', '.slds-combobox__form-element'],
      cssProps: ['background-color', 'border-color', 'color'],
    },
    table: {
      label: 'Tables',
      selectors: ['.slds-table'],
      cssProps: ['background-color', 'border-color'],
    },
    modal: {
      label: 'Modals',
      selectors: ['.slds-modal__container'],
      cssProps: ['background-color', 'border-color', 'color'],
    },
    tab: {
      label: 'Tabs',
      selectors: ['.slds-tabs_default__item', '.slds-tabs--default__item'],
      cssProps: ['color', 'border-bottom-color'],
    },
    dropdown: {
      label: 'Dropdowns',
      selectors: ['.slds-dropdown'],
      cssProps: ['background-color', 'border-color'],
    },
    pageHeader: {
      label: 'Page Headers',
      selectors: ['.slds-page-header', '[class*="pageHeader"]'],
      cssProps: ['background-color', 'border-bottom-color'],
    },
    nav: {
      label: 'Navigation',
      selectors: ['.slds-context-bar', '.oneGlobalNav', 'one-app-nav-bar'],
      cssProps: ['background-color', 'border-bottom-color'],
    },
    popover: {
      label: 'Popovers',
      selectors: ['.slds-popover'],
      cssProps: ['background-color', 'border-color', 'color'],
    },
    pill: {
      label: 'Pills',
      selectors: ['.slds-pill'],
      cssProps: ['background-color', 'border-color', 'color'],
    },
    badge: {
      label: 'Badges',
      selectors: ['.slds-badge'],
      cssProps: ['background-color', 'color'],
    },
    panel: {
      label: 'Panels',
      selectors: ['.slds-panel', '.slds-split-view_container'],
      cssProps: ['background-color', 'border-color'],
    },
    path: {
      label: 'Path',
      selectors: ['.slds-path__item'],
      cssProps: ['background-color'],
    },
    recordLayout: {
      label: 'Record Layout',
      selectors: ['.forceRecordLayout', '.forceHighlightsPanel', '.slds-page-header_record-home'],
      cssProps: ['background-color', 'color'],
    },
  };

  // Maximum elements to scan per component type (performance guard)
  const MAX_PER_TYPE = 150;

  // ─── Known SF default colors ────────────────────────────────────────────
  // These are Salesforce's standard/default computed values. If a component
  // still shows these after theming, it means our theme didn't reach it.

  const SF_DEFAULTS = new Set([
    'rgb(255, 255, 255)',       // #ffffff — default white bg
    'rgb(243, 243, 243)',       // #f3f3f3 — default page bg
    'rgb(244, 246, 249)',       // #f4f6f9 — default setup bg
    'rgb(22, 50, 92)',          // #16325c — default text
    'rgb(0, 112, 210)',         // #0070d2 — default brand blue
    'rgb(221, 219, 218)',       // #dddbda — default border
    'rgb(201, 199, 197)',       // #c9c7c5 — default input border
    'rgb(84, 105, 141)',        // #54698d — default label color
    'rgb(24, 24, 24)',          // #181818 — default text primary
    'rgb(68, 68, 68)',          // #444444 — default text secondary
  ]);

  // ─── Hardcoded color detection ──────────────────────────────────────────
  // Detects elements that use hardcoded colors instead of CSS custom props,
  // which means the theme can't style them.

  /**
   * Check if an element's inline styles or stylesheet rules use hardcoded
   * color values instead of var(--token) references.
   */
  function detectHardcodedColors(el) {
    const issues = [];

    // Check inline styles
    const inlineStyle = el.getAttribute('style');
    if (inlineStyle) {
      const colorProps = ['color', 'background-color', 'background', 'border-color', 'border'];
      for (const prop of colorProps) {
        const re = new RegExp(`${prop}\\s*:\\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\\([^)]+\\))`, 'i');
        const match = inlineStyle.match(re);
        if (match) {
          issues.push({
            property: prop,
            value: match[1],
            source: 'inline',
            element: describeElement(el),
          });
        }
      }
    }

    return issues;
  }

  // ─── Custom LWC detection ──────────────────────────────────────────────

  /** Detect custom (non-standard) LWC components on the page. */
  function scanCustomLWCs() {
    const customComponents = [];
    const seen = new Set();

    // LWCs use tag names with a namespace-component pattern containing a hyphen
    // Standard Salesforce ones start with 'lightning-' or 'force' or 'one-'
    // Custom ones use customer namespaces like 'c-', 'myns-', etc.
    const SF_PREFIXES = [
      'lightning-', 'force', 'one-', 'slds-',
      'aura-', 'ui-', 'runtime_', 'laf-',
      'records-', 'flexipage', 'forceSearch',
      'lst-', 'search-', 'highlights-',
      'setup-', 'comm-', 'flow',
      'navex-', 'navex_', 'navigation-',
      'record_', 'record-',
      'emailui-', 'email-',
      'sales_', 'sales-',
      'dnd-', 'builder_',
      'interactions-',
      'formula-', 'analytics-',
      'community_', 'community-',
      'cms-', 'content-',
      'app_', 'appnav-',
      'console-', 'workspace-',
      'chatter-', 'feed-', 'publisher-',
      'global-', 'globalheader-',
      'profile-', 'user-',
      'notification-',
      'picklist-', 'lookup-',
      'listview', 'list-',
      'output-', 'input-',
      'detail-', 'related-',
      'report-', 'dashboard-',
      'wave-', 'tableau-',
      'data-', 'datatable-',
      'calendar-', 'event-',
      'task-', 'activity-',
      'approval-', 'workflow-',
      'quip-',
      'base-',
      'sfa-', 'sfc-',
      'lbpm-', 'lbs-',
      'mob-', 'mobile-',
      'platform-',
      'quick-', 'action-',
      'schema-',
      'soql-', 'sobject-',
      'util-', 'utils-',
      'webruntimedesign-',
      'slot-',
      'search_dialog-', 'search_input-',
      'setup_discovery-', 'setup_home-', 'setup_service-',
      'sf-themer-',  // Our own — skip
    ];

    // Known managed packages
    const MANAGED_PREFIXES = [
      { prefix: 'ncino', label: 'nCino' },
      { prefix: 'nforcecredit', label: 'nCino' },
      { prefix: 'vlocity', label: 'Vlocity/Omnistudio' },
      { prefix: 'omnistudio', label: 'Omnistudio' },
      { prefix: 'copado', label: 'Copado' },
      { prefix: 'conga', label: 'Conga' },
      { prefix: 'drawloop', label: 'Conga (Drawloop)' },
      { prefix: 'docusign', label: 'DocuSign' },
      { prefix: 'dsfs', label: 'DocuSign' },
      { prefix: 'sb_', label: 'Salesforce CPQ' },
      { prefix: 'sbqq', label: 'Salesforce CPQ' },
      { prefix: 'sfa_', label: 'Salesforce Advanced' },
      { prefix: 'maps', label: 'Salesforce Maps' },
      { prefix: 'taskray', label: 'TaskRay' },
      { prefix: 'formassembly', label: 'FormAssembly' },
    ];

    const allCustomEls = document.querySelectorAll('*');
    let count = 0;

    for (const el of allCustomEls) {
      if (count >= 500) break; // Hard cap

      const tag = el.tagName.toLowerCase();
      if (!tag.includes('-')) continue; // Not a custom element

      // Skip standard SF components
      if (SF_PREFIXES.some(p => tag.startsWith(p))) continue;

      // Deduplicate by tag name
      if (seen.has(tag)) continue;
      seen.add(tag);
      count++;

      // Classify: managed package or customer custom
      let source = 'custom';
      let packageName = null;
      for (const mp of MANAGED_PREFIXES) {
        if (tag.startsWith(mp.prefix)) {
          source = 'managed';
          packageName = mp.label;
          break;
        }
      }

      // Count instances
      const instances = document.querySelectorAll(tag);
      const instanceCount = Math.min(instances.length, MAX_PER_TYPE);

      // Sample styling from first visible instance
      let styling = null;
      for (const inst of instances) {
        if (inst.offsetParent === null && inst.tagName !== 'BODY') continue; // hidden
        const cs = getComputedStyle(inst);
        const bg = cs.backgroundColor;
        const fg = cs.color;
        const border = cs.borderColor;

        styling = {
          backgroundColor: bg,
          color: fg,
          borderColor: border,
          usesDefaults: SF_DEFAULTS.has(bg) || SF_DEFAULTS.has(fg),
          hardcodedIssues: detectHardcodedColors(inst),
        };
        break;
      }

      customComponents.push({
        tag,
        source,
        packageName,
        count: instanceCount,
        styling,
      });
    }

    // Sort: managed packages first, then custom, then by count
    customComponents.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'managed' ? -1 : 1;
      return b.count - a.count;
    });

    return customComponents;
  }

  // ─── Standard component scan ───────────────────────────────────────────

  /**
   * Scan standard SLDS components on the page.
   * For each type, counts instances and checks if theme colors are applied.
   */
  ns.scanComponents = function scanComponents(themeColors) {
    const results = {};

    for (const [type, config] of Object.entries(COMPONENT_REGISTRY)) {
      const selector = config.selectors.join(',');
      const elements = document.querySelectorAll(selector);

      if (elements.length === 0) {
        results[type] = {
          label: config.label,
          found: 0,
          styled: 0,
          partial: 0,
          unstyled: 0,
          hardcodedIssues: [],
        };
        continue;
      }

      let styled = 0;
      let partial = 0;
      let unstyled = 0;
      const allHardcoded = [];
      const limit = Math.min(elements.length, MAX_PER_TYPE);

      for (let i = 0; i < limit; i++) {
        const el = elements[i];
        // Skip hidden/off-screen elements
        if (el.offsetParent === null && el.tagName !== 'BODY') continue;

        const cs = getComputedStyle(el);
        let themedProps = 0;
        let defaultProps = 0;

        for (const prop of config.cssProps) {
          const val = cs.getPropertyValue(prop).trim();
          if (SF_DEFAULTS.has(val)) {
            defaultProps++;
          } else {
            themedProps++;
          }
        }

        if (defaultProps === 0) styled++;
        else if (themedProps > 0) partial++;
        else unstyled++;

        // Check for hardcoded colors
        const hc = detectHardcodedColors(el);
        if (hc.length) allHardcoded.push(...hc);
      }

      results[type] = {
        label: config.label,
        found: elements.length,
        styled,
        partial,
        unstyled,
        hardcodedIssues: allHardcoded.slice(0, 10), // Cap at 10
      };
    }

    // Custom / managed package components
    const customLWCs = scanCustomLWCs();

    return {
      standard: results,
      custom: customLWCs.filter(c => c.source === 'custom'),
      managed: customLWCs.filter(c => c.source === 'managed'),
      summary: buildSummary(results, customLWCs),
    };
  };

  // ─── Summary builder ──────────────────────────────────────────────────

  function buildSummary(standardResults, customLWCs) {
    let totalFound = 0;
    let totalStyled = 0;
    let totalPartial = 0;
    let totalUnstyled = 0;
    let totalHardcoded = 0;

    for (const r of Object.values(standardResults)) {
      totalFound += r.found;
      totalStyled += r.styled;
      totalPartial += r.partial;
      totalUnstyled += r.unstyled;
      totalHardcoded += r.hardcodedIssues.length;
    }

    const managedPackages = new Set(
      customLWCs.filter(c => c.source === 'managed').map(c => c.packageName)
    );

    return {
      standardTypes: Object.keys(standardResults).filter(k => standardResults[k].found > 0).length,
      totalStandardFound: totalFound,
      totalStyled,
      totalPartial,
      totalUnstyled,
      totalHardcoded,
      customLWCCount: customLWCs.filter(c => c.source === 'custom').length,
      managedPackages: Array.from(managedPackages),
      managedComponentCount: customLWCs.filter(c => c.source === 'managed').length,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Build a short human-readable description of an element. */
  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return `${tag}${id}${cls}`.slice(0, 80);
  }
})();

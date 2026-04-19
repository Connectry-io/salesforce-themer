/**
 * Component Scanner — Salesforce Themer Diagnostic
 *
 * Auto-discovers every Salesforce standard component, custom LWC, and
 * managed-package element on the page. No curated registry — identity is
 * derived from namespace prefixes on tag names and classes.
 *
 * Designed as the data feed for the self-learning loop (see VISION.md §5):
 *   live scan → diffs → backend → AI fix → next scan confirms → loop
 *
 * Output shape is designed to be diff-stable:
 *   - components keyed by stable signature (tag + primary class)
 *   - deterministic field order, sorted results
 *   - per-component: identity, namespace class, instances, computed styles,
 *     DOM structure, hardcoded-color issues
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  // ─── Namespace classification ───────────────────────────────────────────
  // Every SF and managed-package element belongs to one of these namespaces.
  // The first matching prefix wins. Prefixes match against tag name OR classes.

  const STANDARD_NAMESPACES = [
    // Most specific first
    { id: 'slds',       label: 'SLDS',             prefixes: ['slds-'] },
    { id: 'force',      label: 'Force (Aura)',     prefixes: ['force'] }, // forceRecordLayout, forceEntityIcon
    { id: 'lightning',  label: 'Lightning (LWC)',  prefixes: ['lightning-', 'lwc-'] },
    { id: 'records',    label: 'Records (LWC)',    prefixes: ['records-'] },
    { id: 'flexipage',  label: 'Flexipage',        prefixes: ['flexipage'] },
    { id: 'one',        label: 'One (shell)',      prefixes: ['one-', 'oneGlobal', 'oneConsole'] },
    { id: 'aura',       label: 'Aura',             prefixes: ['aura-', 'ui-'] },
    { id: 'runtime',    label: 'Runtime',          prefixes: ['runtime_', 'runtime-', 'laf-'] },
    { id: 'setup',      label: 'Setup',            prefixes: ['setup-', 'setup_', 'setup_discovery-', 'setup_home-', 'setup_service-'] },
    { id: 'comm',       label: 'Communities',      prefixes: ['comm-', 'comm_', 'community_', 'community-', 'cms-'] },
    { id: 'navex',      label: 'Nav-Ex',           prefixes: ['navex-', 'navex_'] },
    { id: 'sf-chrome',  label: 'SF Chrome',        prefixes: [
      'navigation-', 'record_', 'record-', 'emailui-', 'email-',
      'sales_', 'sales-', 'dnd-', 'builder_', 'interactions-',
      'formula-', 'analytics-', 'content-', 'app_', 'appnav-',
      'console-', 'workspace-', 'chatter-', 'feed-', 'publisher-',
      'global-', 'globalheader-', 'profile-', 'user-', 'notification-',
      'picklist-', 'lookup-', 'listview', 'list-', 'lst-', 'output-', 'input-',
      'detail-', 'related-', 'report-', 'dashboard-', 'wave-', 'tableau-',
      'data-', 'datatable-', 'calendar-', 'event-', 'task-', 'activity-',
      'approval-', 'workflow-', 'quip-', 'base-', 'sfa-', 'sfc-',
      'lbpm-', 'lbs-', 'mob-', 'mobile-', 'platform-', 'quick-', 'action-',
      'schema-', 'soql-', 'sobject-', 'util-', 'utils-', 'webruntimedesign-',
      'slot-', 'search-', 'search_dialog-', 'search_input-',
      'forceSearch', 'highlights-', 'flow'
    ] },
    { id: 'sf-themer',  label: '(ours)',           prefixes: ['sf-themer-'] }, // excluded from reports
  ];

  // Known managed packages — tag/class prefix → human label.
  // NOTE: first-party SF managed apps (DevOps Center, Pardot, etc.) are
  // classified here so they don't fall through to the "custom LWC" bucket.
  // Custom = only the user's own c-* tags.
  const MANAGED_PACKAGES = [
    { prefix: 'ncino',          label: 'nCino' },
    { prefix: 'nforcecredit',   label: 'nCino' },
    { prefix: 'vlocity',        label: 'Vlocity/Omnistudio' },
    { prefix: 'omnistudio',     label: 'Omnistudio' },
    { prefix: 'copado',         label: 'Copado' },
    { prefix: 'conga',          label: 'Conga' },
    { prefix: 'drawloop',       label: 'Conga (Drawloop)' },
    { prefix: 'docusign',       label: 'DocuSign' },
    { prefix: 'dsfs',           label: 'DocuSign' },
    { prefix: 'sb_',            label: 'Salesforce CPQ' },
    { prefix: 'sbqq',           label: 'Salesforce CPQ' },
    { prefix: 'sfa_',           label: 'Salesforce Advanced' },
    { prefix: 'maps',           label: 'Salesforce Maps' },
    { prefix: 'taskray',        label: 'TaskRay' },
    { prefix: 'formassembly',   label: 'FormAssembly' },
    { prefix: 'mholt',          label: 'Matt Holt (AppExchange)' },
    // First-party SF managed apps (LWC tags that look custom)
    { prefix: 'devops_center',  label: 'DevOps Center' },
    { prefix: 'devops-center',  label: 'DevOps Center' },
    { prefix: 'pi__',           label: 'Pardot' },
    { prefix: 'einstein',       label: 'Einstein' },
    { prefix: 'data_cloud',     label: 'Data Cloud' },
    { prefix: 'installedPackage', label: 'Installed Package' },
  ];

  // ─── Utility / sub-part / invisible exclusions ─────────────────────────
  // Classes that have no paint of their own (spacing, sizing, alignment,
  // truncation, etc.) — flagging them as "unstyled" is always a false
  // positive because they were never meant to be themed.
  const UTILITY_PREFIXES = [
    'slds-m-', 'slds-p-',                // margin / padding
    'slds-var-m-', 'slds-var-p-',
    'slds-size_', 'slds-size-',          // grid sizing
    'slds-col_', 'slds-col-',            // column layout modifiers
    'slds-align_', 'slds-align-',
    'slds-grid_', 'slds-grid-',          // grid modifiers (NOT slds-grid itself)
    'slds-text-align_', 'slds-text-align-',
    'slds-text-body_', 'slds-text-body-',
    'slds-text-heading_', 'slds-text-heading-',
    'slds-line-height_', 'slds-line-height-',
    'slds-border_', 'slds-border-',
    'slds-float_', 'slds-float-',
    'slds-clear_', 'slds-clear-',
  ];

  const UTILITY_EXACT = new Set([
    'slds-truncate', 'slds-truncate_container_75',
    'slds-assistive-text',              // screen-reader only, never visible
    'slds-hide', 'slds-hidden', 'slds-show', 'slds-show_inline', 'slds-show_inline-block',
    'slds-is-relative', 'slds-is-absolute', 'slds-is-fixed', 'slds-is-active',
    'slds-no-flex', 'slds-shrink-none', 'slds-grow',
    'slds-has-flexi-truncate', 'slds-has-divider', 'slds-has-divider_bottom',
    'slds-theme_default', 'slds-theme_alt-inverse',
    'slds-r1', 'slds-r2', 'slds-r3', 'slds-r4', 'slds-r5',
    'slds-r6', 'slds-r7', 'slds-r8', 'slds-r9',
    // Grid cells with no paint
    'slds-col',
  ]);

  function isUtilityClass(cls) {
    if (UTILITY_EXACT.has(cls)) return true;
    for (const p of UTILITY_PREFIXES) {
      if (cls.startsWith(p)) return true;
    }
    return false;
  }

  // BEM sub-parts (`block__element`) are pieces of a composite component,
  // not standalone components. Their parent block owns the visual theming.
  // Flagging them individually double-counts. Recognising by `__` convention.
  function isSubPart(cls) {
    return cls.includes('__');
  }

  // Classes that identify semantically distinct standard components. Used
  // to pick a stable "identity class" per element even when many slds-
  // classes are present. Anything outside this set is treated as a modifier.
  // This list is narrow by intent — extending it is how we tell the catalog
  // about a new "kind of thing".
  const KNOWN_COMPONENT_CLASSES = new Set([
    // SLDS 1
    'slds-card', 'slds-table', 'slds-modal', 'slds-dropdown', 'slds-popover',
    'slds-pill', 'slds-badge', 'slds-panel', 'slds-path', 'slds-path__item',
    'slds-page-header', 'slds-context-bar', 'slds-avatar', 'slds-button',
    'slds-button_brand', 'slds-button_neutral', 'slds-button_icon',
    'slds-tabs_default', 'slds-tabs_default__item', 'slds-tabs_scoped',
    'slds-input', 'slds-textarea', 'slds-select', 'slds-combobox',
    'slds-combobox__form-element', 'slds-form-element',
    'slds-checkbox', 'slds-radio', 'slds-toggle', 'slds-progress',
    'slds-notification', 'slds-tooltip', 'slds-spinner', 'slds-tile',
    'slds-media', 'slds-icon', 'slds-breadcrumb', 'slds-tree',
    'slds-picklist', 'slds-lookup', 'slds-listbox',
    // Force / records
    'forceRecordLayout', 'forceHighlightsPanel', 'forceHighlightsStencilDesktop',
    'forceEntityIcon', 'forceRecordCard', 'forceActionsContainer',
    'forceRelatedListCardHeader', 'forceChatterMessage',
    'records-highlights', 'records-highlights-details-item',
    // Page-level
    'slds-page-header_record-home',
    // Nav
    'oneGlobalNav', 'oneAppNavContainer', 'navexConsoleTabBar',
  ]);

  // Standard SF default computed values — a component still showing these
  // after theming indicates the theme didn't reach it.
  const SF_DEFAULTS = new Set([
    'rgb(255, 255, 255)',
    'rgb(243, 243, 243)',
    'rgb(244, 246, 249)',
    'rgb(22, 50, 92)',
    'rgb(0, 112, 210)',
    'rgb(221, 219, 218)',
    'rgb(201, 199, 197)',
    'rgb(84, 105, 141)',
    'rgb(24, 24, 24)',
    'rgb(68, 68, 68)',
  ]);

  // Caps to keep scans cheap. Scanner must be safe to run often (see VISION).
  const MAX_ELEMENTS_WALKED = 8000;
  const MAX_INSTANCES_PER_COMPONENT = 150;

  // ─── Namespace classification ───────────────────────────────────────────

  function classifyToken(token) {
    for (const mp of MANAGED_PACKAGES) {
      if (token.startsWith(mp.prefix)) {
        return { source: 'managed', namespace: mp.prefix, label: mp.label };
      }
    }
    for (const ns of STANDARD_NAMESPACES) {
      for (const p of ns.prefixes) {
        if (token.startsWith(p)) {
          return { source: 'standard', namespace: ns.id, label: ns.label };
        }
      }
    }
    return null;
  }

  // Returns the "identity" for an element: the stable class or tag we use
  // to group it in the catalog. null means unclassified (not reported).
  function identifyElement(el) {
    const tag = el.tagName.toLowerCase();

    // Custom-element tag names (contain hyphen) are themselves identity keys
    if (tag.includes('-')) {
      const cls = classifyToken(tag);
      if (cls) return { identityKey: tag, tag, identityClass: null, ...cls };
      // Unknown namespaced tag → treat as custom LWC
      return { identityKey: tag, tag, identityClass: null, source: 'custom', namespace: 'c-*', label: 'Custom' };
    }

    // Plain tag (div/span/etc) — identity comes from classes
    const classes = typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];
    if (!classes.length) return null;

    // Prefer KNOWN_COMPONENT_CLASSES; otherwise first namespaced, non-utility,
    // non-subpart class. Utility/subpart classes produce false positives
    // because they have no paint of their own — the parent owns the theme.
    let identityClass = classes.find(c =>
      KNOWN_COMPONENT_CLASSES.has(c) && !isUtilityClass(c)
    );
    if (!identityClass) {
      identityClass = classes.find(c =>
        classifyToken(c) && !isUtilityClass(c) && !isSubPart(c)
      );
    }
    if (!identityClass) return null;

    const cls = classifyToken(identityClass);
    if (!cls) return null;
    return { identityKey: identityClass, tag, identityClass, ...cls };
  }

  // Inheritance-aware theming detection. Elements with transparent bg that
  // sit inside a themed parent are visually themed via inheritance — flagging
  // them as unstyled was a major false-positive source (nav items, header
  // buttons, context-bar children all have transparent bg + themed parent).
  function hasThemedAncestorBg(el) {
    let p = el.parentElement;
    let hops = 0;
    while (p && p !== document.body && hops < 8) {
      try {
        const bg = getComputedStyle(p).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          // First solid-bg ancestor wins. If it's themed (not a SF default),
          // this element inherits a themed visual context.
          return !SF_DEFAULTS.has(bg);
        }
      } catch (_) {}
      p = p.parentElement;
      hops++;
    }
    return false;
  }

  // ─── Style + structure capture ──────────────────────────────────────────

  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return `${tag}${id}${cls}`.slice(0, 80);
  }

  function captureComputedStyles(el) {
    const cs = getComputedStyle(el);
    const out = {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderColor: cs.borderColor,
      borderTopColor: cs.borderTopColor,
      borderBottomColor: cs.borderBottomColor,
    };
    if (cs.boxShadow !== 'none') out.boxShadow = cs.boxShadow;
    return out;
  }

  function captureDOMStructure(el, maxDepth = 3) {
    function walk(node, depth) {
      if (depth > maxDepth || node.nodeType !== 1) return null;
      const tag = node.tagName.toLowerCase();
      const classes = typeof node.className === 'string'
        ? node.className.trim().split(/\s+/).filter(c =>
            c.startsWith('slds-') || c.startsWith('force') ||
            c.startsWith('lwc-') || c.startsWith('lightning-') ||
            c.startsWith('records-')
          ).slice(0, 5)
        : [];
      const attrs = {};
      if (node.getAttribute('role')) attrs.role = node.getAttribute('role');
      if (node.getAttribute('data-aura-rendered-by')) attrs.aura = true;
      const children = [];
      for (const child of node.children) {
        if (children.length >= 8) {
          children.push({ tag: '...', truncated: node.children.length - 8 });
          break;
        }
        const c = walk(child, depth + 1);
        if (c) children.push(c);
      }
      return {
        tag,
        classes: classes.length ? classes : undefined,
        attrs: Object.keys(attrs).length ? attrs : undefined,
        children: children.length ? children : undefined,
      };
    }
    return walk(el, 0);
  }

  // B24 — DOM sample capture for partial/unstyled components. Trims the
  // outerHTML so the report stays copy-paste friendly and so we don't spam
  // data: URIs or giant SVG paths into the clipboard. Parent chain (2
  // levels up) is captured so the selector context is visible without the
  // user having to Inspect and copy manually.
  function captureOuterHTMLSample(el, maxLen = 1800) {
    try {
      let html = el.outerHTML || '';
      // Strip inline data: URIs (SVG payloads bloat the sample)
      html = html.replace(/(data:[^"')]+)/g, 'data:...');
      // Collapse runs of whitespace
      html = html.replace(/\s+/g, ' ').trim();
      if (html.length > maxLen) html = html.slice(0, maxLen) + '…[truncated]';

      const parents = [];
      let p = el.parentElement;
      for (let i = 0; i < 2 && p && p.tagName !== 'BODY'; i++) {
        const tag = p.tagName.toLowerCase();
        const cls = typeof p.className === 'string'
          ? p.className.trim().split(/\s+/).slice(0, 3).join('.')
          : '';
        parents.push(cls ? `${tag}.${cls}` : tag);
        p = p.parentElement;
      }
      return { outerHTML: html, parentChain: parents.reverse() };
    } catch (_err) {
      return null;
    }
  }

  function detectHardcodedColors(el) {
    const issues = [];
    const inlineStyle = el.getAttribute('style');
    if (!inlineStyle) return issues;
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
    return issues;
  }

  // ─── Discovery walk ─────────────────────────────────────────────────────

  // Walks the DOM, buckets every classifiable element by its identity key.
  // Deduplicates by identity. Returns an ordered catalog entry per identity.
  function discover() {
    const byIdentity = new Map(); // identityKey → entry
    const all = document.body ? document.body.getElementsByTagName('*') : [];
    const walkLimit = Math.min(all.length, MAX_ELEMENTS_WALKED);

    for (let i = 0; i < walkLimit; i++) {
      const el = all[i];
      const identity = identifyElement(el);
      if (!identity) continue;
      if (identity.namespace === 'sf-themer') continue; // our own overlay

      let entry = byIdentity.get(identity.identityKey);
      if (!entry) {
        entry = {
          identity: identity.identityKey,
          tag: identity.tag,
          identityClass: identity.identityClass,
          source: identity.source,          // 'standard' | 'managed' | 'custom'
          namespace: identity.namespace,    // e.g. 'slds', 'force', 'ncino'
          namespaceLabel: identity.label,   // e.g. 'SLDS', 'nCino'
          instances: 0,
          visibleInstances: 0,
          firstVisibleSample: null,
        };
        byIdentity.set(identity.identityKey, entry);
      }
      entry.instances++;
      if (entry.instances > MAX_INSTANCES_PER_COMPONENT) continue;

      const visible = el.offsetParent !== null || el.tagName === 'BODY';
      if (visible) {
        entry.visibleInstances++;
        if (!entry.firstVisibleSample) entry.firstVisibleSample = el;
      }
    }

    // Build output entries from samples
    const entries = [];
    for (const entry of byIdentity.values()) {
      const sample = entry.firstVisibleSample || null;
      const styles = sample ? captureComputedStyles(sample) : null;
      const structure = sample ? captureDOMStructure(sample) : null;
      const hardcoded = sample ? detectHardcodedColors(sample) : [];

      // Styled classification: any computed color value not in SF_DEFAULTS
      // counts as "themed". All defaults = "unstyled". Mixed = "partial".
      // Inheritance rule: if the element's own bg is transparent but its
      // nearest solid-bg ancestor is themed, the element visually inherits
      // the theme — upgrade "unstyled" to "styled" and "partial" stays
      // "partial" (text/border defaults still want addressing).
      let styled = 'unknown';
      if (styles) {
        const vals = [styles.backgroundColor, styles.color, styles.borderColor].filter(v => v && v !== 'rgba(0, 0, 0, 0)');
        if (vals.length) {
          const themed = vals.filter(v => !SF_DEFAULTS.has(v)).length;
          const defaults = vals.length - themed;
          if (defaults === 0) styled = 'styled';
          else if (themed === 0) {
            // All default colors — but check if the element is actually
            // painted via a themed ancestor background.
            const inherits = sample && styles.backgroundColor === 'rgba(0, 0, 0, 0)'
              ? hasThemedAncestorBg(sample)
              : false;
            styled = inherits ? 'styled' : 'unstyled';
          }
          else styled = 'partial';
        }
      }

      // B24 — capture outerHTML sample only for partial/unstyled so I can
      // see the real selector chain without the user having to Inspect and
      // paste DOM manually. Cheap because we only grab one sample per
      // identity and only for the ~20-30 failing components.
      const domSample = sample && (styled === 'partial' || styled === 'unstyled')
        ? captureOuterHTMLSample(sample)
        : null;

      entries.push({
        identity: entry.identity,
        tag: entry.tag,
        identityClass: entry.identityClass,
        source: entry.source,
        namespace: entry.namespace,
        namespaceLabel: entry.namespaceLabel,
        instances: entry.instances,
        visibleInstances: entry.visibleInstances,
        styled,
        computedStyles: styles,
        domStructure: structure,
        domSample,
        hardcodedIssues: hardcoded,
      });
    }

    // Deterministic order for diff stability: source, namespace, identity
    entries.sort((a, b) => {
      const sourceRank = { standard: 0, managed: 1, custom: 2 };
      if (a.source !== b.source) return sourceRank[a.source] - sourceRank[b.source];
      if (a.namespace !== b.namespace) return a.namespace.localeCompare(b.namespace);
      return a.identity.localeCompare(b.identity);
    });

    return entries;
  }

  // ─── Public API — back-compat with diagnostic-panel.js ─────────────────

  // Matches the shape used by diagnostic-panel.js today, but computed from
  // the auto-discovery entries. Legacy component "types" are derived by
  // grouping on identity class.
  ns.scanComponents = function scanComponents(_themeColors) {
    const entries = discover();
    const visibleEntries = entries.filter(e => e.visibleInstances > 0);

    // Legacy "standard" bucket — grouped by identity for the existing panel UI.
    const standard = {};
    for (const e of visibleEntries) {
      if (e.source !== 'standard') continue;
      const key = e.identity;
      if (!standard[key]) {
        standard[key] = {
          label: e.identity,
          namespace: e.namespaceLabel,
          found: 0, styled: 0, partial: 0, unstyled: 0,
          hardcodedIssues: [],
          domSample: null,
          domSampleStatus: null,
        };
      }
      standard[key].found += e.visibleInstances;
      if (e.styled === 'styled') standard[key].styled += e.visibleInstances;
      else if (e.styled === 'partial') standard[key].partial += e.visibleInstances;
      else if (e.styled === 'unstyled') standard[key].unstyled += e.visibleInstances;
      if (e.hardcodedIssues.length) {
        standard[key].hardcodedIssues.push(...e.hardcodedIssues.slice(0, 10));
      }
      // First partial/unstyled sample wins (discover() sort is stable)
      if (e.domSample && !standard[key].domSample) {
        standard[key].domSample = e.domSample;
        standard[key].domSampleStatus = e.styled;
        standard[key].computedStyles = e.computedStyles;
      }
    }

    const custom = visibleEntries
      .filter(e => e.source === 'custom')
      .map(e => ({
        tag: e.tag,
        source: 'custom',
        packageName: null,
        count: e.visibleInstances,
        styling: e.computedStyles ? {
          backgroundColor: e.computedStyles.backgroundColor,
          color: e.computedStyles.color,
          borderColor: e.computedStyles.borderColor,
          usesDefaults: SF_DEFAULTS.has(e.computedStyles.backgroundColor) ||
                        SF_DEFAULTS.has(e.computedStyles.color),
          hardcodedIssues: e.hardcodedIssues,
        } : null,
      }));

    const managed = visibleEntries
      .filter(e => e.source === 'managed')
      .map(e => ({
        tag: e.tag,
        source: 'managed',
        packageName: e.namespaceLabel,
        count: e.visibleInstances,
        styling: e.computedStyles ? {
          backgroundColor: e.computedStyles.backgroundColor,
          color: e.computedStyles.color,
          borderColor: e.computedStyles.borderColor,
          usesDefaults: SF_DEFAULTS.has(e.computedStyles.backgroundColor) ||
                        SF_DEFAULTS.has(e.computedStyles.color),
          hardcodedIssues: e.hardcodedIssues,
        } : null,
      }));

    return {
      standard,
      custom,
      managed,
      summary: buildSummary(standard, [...custom, ...managed]),
      // New: full auto-discovered catalog (diff-ready). Consumers that know
      // the new shape use this directly.
      catalog: visibleEntries,
    };
  };

  function buildSummary(standardResults, customAndManaged) {
    let totalFound = 0, totalStyled = 0, totalPartial = 0, totalUnstyled = 0, totalHardcoded = 0;
    for (const r of Object.values(standardResults)) {
      totalFound += r.found;
      totalStyled += r.styled;
      totalPartial += r.partial;
      totalUnstyled += r.unstyled;
      totalHardcoded += r.hardcodedIssues.length;
    }
    const managedPackages = new Set(
      customAndManaged.filter(c => c.source === 'managed').map(c => c.packageName)
    );
    return {
      standardTypes: Object.keys(standardResults).length,
      totalStandardFound: totalFound,
      totalStyled,
      totalPartial,
      totalUnstyled,
      totalHardcoded,
      customLWCCount: customAndManaged.filter(c => c.source === 'custom').length,
      managedPackages: Array.from(managedPackages),
      managedComponentCount: customAndManaged.filter(c => c.source === 'managed').length,
    };
  }

  // Full snapshot — DOM structure + styles keyed by identity. Diff-ready:
  // same URL across scans produces comparable output.
  ns.captureDOMSnapshot = function captureDOMSnapshot() {
    const entries = discover();
    const components = {};
    for (const e of entries) {
      if (e.visibleInstances === 0) continue;
      components[e.identity] = {
        label: e.identity,
        source: e.source,
        namespace: e.namespace,
        namespaceLabel: e.namespaceLabel,
        identityClass: e.identityClass,
        matchedSelector: e.identityClass ? `.${e.identityClass}` : e.tag,
        instanceCount: e.instances,
        visibleCount: e.visibleInstances,
        domStructure: e.domStructure,
        computedStyles: e.computedStyles,
        hardcodedIssues: e.hardcodedIssues,
      };
    }
    return {
      url: location.href,
      timestamp: new Date().toISOString(),
      components,
    };
  };
})();

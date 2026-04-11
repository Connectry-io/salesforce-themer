/**
 * Token Scanner — Salesforce Themer Diagnostic
 *
 * Scans the current page for CSS custom property coverage:
 *  - Which tokens does the theme SET (from injected style tag)?
 *  - Which tokens does Salesforce USE on this page (from stylesheets)?
 *  - What are the GAPS (SF uses them but theme doesn't override)?
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  // ─── Canonical token lists (mirrored from background.js engine) ──────────

  const SLDS1_TOKENS = [
    '--lwc-colorBackground',
    '--lwc-colorBackgroundAlt',
    '--lwc-colorBackgroundRow',
    '--lwc-colorBackgroundRowHover',
    '--lwc-colorBackgroundHighlight',
    '--lwc-colorBackgroundSelection',
    '--lwc-colorBackgroundButtonBrand',
    '--lwc-colorBackgroundButtonBrandHover',
    '--lwc-colorBackgroundButtonBrandActive',
    '--lwc-colorBackgroundButtonDefault',
    '--lwc-colorBackgroundButtonDefaultHover',
    '--lwc-headerColorBackground',
    '--lwc-pageColorBackground',
    '--lwc-colorTextDefault',
    '--lwc-colorTextWeak',
    '--lwc-colorTextLabel',
    '--lwc-colorTextPlaceholder',
    '--lwc-colorTextButtonBrand',
    '--lwc-colorTextLink',
    '--lwc-colorTextLinkHover',
    '--lwc-colorBorder',
    '--lwc-colorBorderSeparator',
    '--lwc-colorBorderInput',
    '--lwc-colorBorderInputActive',
    '--lwc-brandPrimary',
    '--lwc-brandPrimaryActive',
    '--lwc-brandPrimaryTransparent',
    '--lwc-brandAccessible',
    '--lwc-brandAccessibleActive',
    '--lwc-colorBackgroundSpin',
    '--lwc-shadowOutlineFocus',
  ];

  const SLDS2_GLOBAL_TOKENS = [
    '--slds-g-color-surface-1',
    '--slds-g-color-surface-2',
    '--slds-g-color-surface-3',
    '--slds-g-color-surface-4',
    '--slds-g-color-on-surface-1',
    '--slds-g-color-on-surface-2',
    '--slds-g-color-on-surface-3',
    '--slds-g-color-border-1',
    '--slds-g-color-border-2',
    '--slds-g-color-brand-1',
    '--slds-g-color-brand-2',
    '--slds-g-color-brand-3',
    '--slds-g-color-neutral-1',
    '--slds-g-color-neutral-2',
    '--slds-g-color-neutral-3',
  ];

  const SLDS2_COMPONENT_TOKENS = [
    '--slds-c-card-color-background',
    '--slds-c-card-color-border',
    '--slds-c-input-color-background',
    '--slds-c-input-color-border',
    '--slds-c-input-color-border-focus',
    '--slds-c-button-brand-color-background',
    '--slds-c-button-brand-color-border',
    '--slds-c-button-brand-color-background-hover',
    '--slds-c-button-neutral-color-background',
    '--slds-c-button-neutral-color-border',
  ];

  const ALL_TOKENS = [...SLDS1_TOKENS, ...SLDS2_GLOBAL_TOKENS, ...SLDS2_COMPONENT_TOKENS];

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Parse declared custom properties from a CSS text string. */
  function extractDeclaredTokens(cssText) {
    const declared = new Set();
    // Match --lwc-*, --slds-g-*, --slds-c-* declarations
    const re = /--(lwc-|slds-g-|slds-c-)[a-zA-Z0-9-]+/g;
    let m;
    while ((m = re.exec(cssText)) !== null) {
      declared.add(m[0]);
    }
    return declared;
  }

  // Tokens we intentionally don't theme — structural/layout tokens that
  // should NOT appear as gaps. Overriding these would break SF layouts.
  const IGNORE_PREFIXES = [
    '--slds-g-spacing',
    '--slds-g-sizing',
    '--slds-g-shadow',
    '--slds-g-ratio',
    '--slds-g-radius',
    '--slds-g-duration',
    '--slds-g-transparent',
    '--slds-g-color-palette-',    // Raw palette values (blue-10 etc.)
    '--slds-g-color-neutral-base-',
    '--slds-g-color-brand-base-',
    '--slds-g-color-error-base-',
    '--slds-g-color-warning-base-',
    '--slds-g-color-success-base-',
    '--slds-g-color-neutral-10-opacity',
    '--slds-g-color-neutral-100-opacity',
    '--slds-g-font-scale',
    '--slds-g-font-lineheight',
    '--slds-g-font-weight-bold',
    '--slds-g-font-weight-1',
    '--slds-g-font-weight-2',
    '--slds-g-font-weight-3',
    '--slds-g-font-weight-5',
    '--slds-g-font-weight-6',
    '--slds-g-font-size-base',
    '--slds-g-font-family-monospace',
    '--slds-g-link-color',
    '--slds-g-spacing-var',
    '--lwc-spacing',
    '--lwc-varSpacing',
    '--lwc-size',
    '--lwc-square',
    '--lwc-height',
    '--lwc-width',
    '--lwc-borderWidth',
    '--lwc-borderStroke',
    '--lwc-borderRadius',
    '--lwc-lineClamp',
    '--lwc-lineHeight',
    '--lwc-fontSize',                // font sizing tokens — not color
    '--lwc-fontWeight',
    '--lwc-fontFamily',
    '--lwc-fontSizeText',
    '--lwc-varFontSize',
    '--lwc-font',                    // generic font prefix
    '--lwc-zIndex',
    '--lwc-duration',
    '--lwc-shadow',
    '--lwc-opacity',
    '--lwc-maxWidth',
    '--lwc-template',
    '--lwc-banner',
    '--lwc-textTransform',
    '--lwc-palette',
    '--lwc-codeSnippet',
    '--lwc-comment',
    '--lwc-feed',
    '--lwc-action',
    '--lwc-mention',
    '--lwc-crud',
    '--lwc-tooltip',
    '--lwc-negTooltip',
    '--lwc-list',
    '--lwc-page',
    '--lwc-split',
    '--lwc-setup',
    '--lwc-autoComplete',
    '--lwc-brandBand',
    '--lwc-card',                    // cardFontWeight, cardSpacing — not color
  ];

  /** Check if a token name should be excluded from gap analysis. */
  function isIgnoredToken(token) {
    for (const prefix of IGNORE_PREFIXES) {
      if (token.startsWith(prefix)) return true;
    }
    // Also skip tokens that are clearly non-color (sizing, spacing numbers)
    if (/\d+$/.test(token) && !token.includes('color') && !token.includes('brand') && !token.includes('surface') && !token.includes('border') && !token.includes('accent')) {
      return true;
    }
    return false;
  }

  /** Scan page stylesheets for var(--token) references SF is consuming. */
  function getPageUsedTokens() {
    const used = new Set();
    const re = /var\(\s*(--(lwc-|slds-g-|slds-c-)[a-zA-Z0-9-]+)/g;

    for (const sheet of document.styleSheets) {
      try {
        // Skip our own injected styles
        if (sheet.ownerNode?.id === 'sf-themer-styles' ||
            sheet.ownerNode?.id === 'sf-themer-effects' ||
            sheet.ownerNode?.id === 'sf-themer-transitions') continue;

        for (const rule of sheet.cssRules) {
          const text = rule.cssText;
          let m;
          while ((m = re.exec(text)) !== null) {
            const token = m[1];
            // Only include color/theme-relevant tokens, skip structural ones
            if (!isIgnoredToken(token)) {
              used.add(token);
            }
          }
        }
      } catch (_) {
        // CORS — can't read cross-origin sheets, skip silently
      }
    }
    return used;
  }

  /** Read computed values for all known tokens from :root. */
  function getComputedTokenValues() {
    const cs = getComputedStyle(document.documentElement);
    const values = {};
    for (const token of ALL_TOKENS) {
      const val = cs.getPropertyValue(token).trim();
      values[token] = val || null;
    }
    return values;
  }

  // ─── Main scan ──────────────────────────────────────────────────────────

  /**
   * Run a full token coverage scan.
   * @param {string} currentTheme - Name of the active theme
   * @returns {Object} Scan results
   */
  ns.scanTokens = function scanTokens(currentTheme) {
    const styleTag = document.getElementById('sf-themer-styles');
    const themeCSS = styleTag ? styleTag.textContent : '';

    // What the theme declares
    const themeProvides = extractDeclaredTokens(themeCSS);

    // What SF pages reference via var()
    const pageUses = getPageUsedTokens();

    // Computed values on :root
    const computed = getComputedTokenValues();

    // Gap analysis: tokens SF uses but our theme doesn't set
    const gaps = [];
    for (const token of pageUses) {
      if (!themeProvides.has(token)) {
        gaps.push(token);
      }
    }

    // Per-category breakdown
    const categorize = (tokens) => {
      const results = [];
      for (const token of tokens) {
        results.push({
          token,
          value: computed[token],
          provided: themeProvides.has(token),
          usedByPage: pageUses.has(token),
        });
      }
      return results;
    };

    const providedCount = ALL_TOKENS.filter(t => themeProvides.has(t)).length;

    return {
      theme: currentTheme,
      url: location.hostname + location.pathname,
      timestamp: new Date().toISOString(),
      styleInjected: !!styleTag,
      styleSizeKB: themeCSS ? (themeCSS.length / 1024).toFixed(1) : '0',
      coverage: ALL_TOKENS.length ? (providedCount / ALL_TOKENS.length) : 0,
      summary: {
        total: ALL_TOKENS.length,
        provided: providedCount,
        gaps: gaps.length,
        pageUsesCount: pageUses.size,
      },
      categories: {
        slds1: { label: 'SLDS 1 (Legacy LWC)', tokens: categorize(SLDS1_TOKENS) },
        slds2Global: { label: 'SLDS 2 Global', tokens: categorize(SLDS2_GLOBAL_TOKENS) },
        slds2Component: { label: 'SLDS 2 Component Hooks', tokens: categorize(SLDS2_COMPONENT_TOKENS) },
      },
      gaps,
    };
  };

  // Export token lists for other modules
  ns.ALL_TOKENS = ALL_TOKENS;
  ns.SLDS1_TOKENS = SLDS1_TOKENS;
  ns.SLDS2_GLOBAL_TOKENS = SLDS2_GLOBAL_TOKENS;
  ns.SLDS2_COMPONENT_TOKENS = SLDS2_COMPONENT_TOKENS;
})();

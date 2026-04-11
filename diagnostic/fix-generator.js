/**
 * Fix Generator — Salesforce Themer Diagnostic
 *
 * When the token scanner finds gaps (tokens SF uses but the engine doesn't set),
 * this module generates the CSS fix: the exact :root declaration that would close
 * the gap, mapped to the active theme's color config.
 *
 * Also generates per-component CSS patches for custom LWCs with hardcoded colors.
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  // ─── Token-to-theme-color mapping ──────────────────────────────────────────
  // Maps CSS custom property names to the theme color key they should resolve to.
  // This is the bridge between "what SF expects" and "what our engine provides."

  const TOKEN_COLOR_MAP = {
    // ── Legacy LWC tokens → theme color keys ──────────────────────────────────
    '--lwc-colorBackground':                    'background',
    '--lwc-colorBackgroundAlt':                 'surface',
    '--lwc-colorBackgroundRow':                 'surface',
    '--lwc-colorBackgroundRowHover':            'surfaceHover',
    '--lwc-colorBackgroundHighlight':           'surfaceHighlight',
    '--lwc-colorBackgroundSelection':           'surfaceSelection',
    '--lwc-colorBackgroundLight':               'surface',
    '--lwc-colorBackgroundShade':               'surfaceAlt',
    '--lwc-colorBackgroundShadeDark':           'surfaceAlt',
    '--lwc-colorBackgroundButtonBrand':         'buttonBrandBg',
    '--lwc-colorBackgroundButtonBrandHover':    'buttonBrandHover',
    '--lwc-colorBackgroundButtonBrandActive':   'accentActive',
    '--lwc-colorBackgroundButtonBrandDisabled': 'textMuted',
    '--lwc-colorBackgroundButtonDefault':       'buttonNeutralBg',
    '--lwc-colorBackgroundButtonDefaultHover':  'buttonNeutralHover',
    '--lwc-colorBackgroundButtonDefaultActive': 'surfaceHover',
    '--lwc-colorBackgroundButtonDefaultDisabled': 'surface',
    '--lwc-colorBackgroundInput':               '{inputBg}',
    '--lwc-colorBackgroundInputActive':         '{inputBg}',
    '--lwc-colorBackgroundInputDisabled':       'surfaceAlt',
    '--lwc-colorBackgroundInputError':          'surface',
    '--lwc-colorBackgroundInputSearch':         '{inputBg}',
    '--lwc-colorBackgroundInputCheckbox':       'surface',
    '--lwc-colorBackgroundInputCheckboxSelected': 'accent',
    '--lwc-colorBackgroundModal':               'modalBg',
    '--lwc-colorBackgroundBackdropTint':        'modalBackdrop',
    '--lwc-colorBackgroundPill':                'pillBg',
    '--lwc-colorBackgroundSpin':                'accent',
    '--lwc-headerColorBackground':              'nav',
    '--lwc-pageColorBackground':                'background',
    '--lwc-colorTextDefault':                   'textPrimary',
    '--lwc-colorTextWeak':                      'textSecondary',
    '--lwc-colorTextLabel':                     'textSecondary',
    '--lwc-colorTextPlaceholder':               'textPlaceholder',
    '--lwc-colorTextButtonBrand':               'buttonBrandText',
    '--lwc-colorTextButtonBrandHover':          'buttonBrandText',
    '--lwc-colorTextButtonBrandDisabled':       'textMuted',
    '--lwc-colorTextButtonDefault':             'textPrimary',
    '--lwc-colorTextButtonDefaultHover':        'textPrimary',
    '--lwc-colorTextButtonDefaultHint':         'textSecondary',
    '--lwc-colorTextButtonDefaultDisabled':     'textMuted',
    '--lwc-colorTextLink':                      'link',
    '--lwc-colorTextLinkHover':                 'linkHover',
    '--lwc-colorTextIconDefault':               'textSecondary',
    '--lwc-colorTextIconDefaultHover':          'textPrimary',
    '--lwc-colorTextIconDefaultActive':         'accent',
    '--lwc-colorTextIconDefaultDisabled':       'textMuted',
    '--lwc-colorTextActionLabel':               'textSecondary',
    '--lwc-colorTextActionLabelActive':         'textPrimary',
    '--lwc-colorTextInputIcon':                 'textSecondary',
    '--lwc-colorBorder':                        'border',
    '--lwc-colorBorderSeparator':               'borderSeparator',
    '--lwc-colorBorderInput':                   'borderInput',
    '--lwc-colorBorderInputActive':             'accent',
    '--lwc-colorBorderPrimary':                 'border',
    '--lwc-colorBorderBrand':                   'accent',
    '--lwc-colorBorderButtonBrand':             'buttonBrandBorder',
    '--lwc-colorBorderButtonBrandDisabled':     'textMuted',
    '--lwc-colorBorderButtonDefault':           'buttonNeutralBorder',
    '--lwc-brandPrimary':                       'accent',
    '--lwc-brandPrimaryActive':                 'accentHover',
    '--lwc-brandPrimaryTransparent':            'accentLight',
    '--lwc-brandAccessible':                    'accent',
    '--lwc-brandAccessibleActive':              'accentHover',
    '--lwc-colorBrand':                         'accent',
    '--lwc-colorBrandDark':                     'accentActive',
    '--lwc-colorBrandDarker':                   'accentActive',
    '--lwc-colorTextBrand':                     'accent',
    '--lwc-colorTextBrandPrimary':              'accent',
    '--lwc-shadowOutlineFocus':                 'focusRing',
    '--lwc-buttonColorBackgroundPrimary':       'buttonBrandBg',
    '--lwc-buttonColorBorderPrimary':           'buttonBrandBorder',

    // ── SLDS 2 Global tokens ──────────────────────────────────────────────────
    '--slds-g-color-surface-1':                 'background',
    '--slds-g-color-surface-2':                 'surface',
    '--slds-g-color-surface-3':                 'surfaceHover',
    '--slds-g-color-surface-4':                 'border',
    '--slds-g-color-surface-container-1':       'surface',
    '--slds-g-color-surface-container-2':       'surfaceHover',
    '--slds-g-color-surface-container-3':       'surfaceAlt',
    '--slds-g-color-on-surface-1':              'textPrimary',
    '--slds-g-color-on-surface-2':              'textSecondary',
    '--slds-g-color-on-surface-3':              'textMuted',
    '--slds-g-color-border-1':                  'border',
    '--slds-g-color-border-2':                  'borderInput',
    '--slds-g-color-brand-1':                   'accent',
    '--slds-g-color-brand-2':                   'accentHover',
    '--slds-g-color-brand-3':                   'accentActive',
    '--slds-g-color-neutral-1':                 'background',
    '--slds-g-color-neutral-2':                 'surfaceHover',
    '--slds-g-color-neutral-3':                 'border',
    '--slds-g-color-accent-1':                  'accent',
    '--slds-g-color-accent-2':                  'accentHover',
    '--slds-g-color-accent-3':                  'accentLight',

    // ── SLDS 2 Component hooks ────────────────────────────────────────────────
    '--slds-c-card-color-background':               'surface',
    '--slds-c-card-color-border':                   'border',
    '--slds-c-input-color-background':              '{inputBg}',
    '--slds-c-input-color-border':                  'borderInput',
    '--slds-c-input-color-border-focus':            'accent',
    '--slds-c-input-text-color':                    'textPrimary',
    '--slds-c-button-brand-color-background':       'buttonBrandBg',
    '--slds-c-button-brand-color-border':           'buttonBrandBorder',
    '--slds-c-button-brand-color-background-hover': 'buttonBrandHover',
    '--slds-c-button-neutral-color-background':     'buttonNeutralBg',
    '--slds-c-button-neutral-color-border':         'buttonNeutralBorder',
    '--slds-c-button-neutral-color-background-hover': 'buttonNeutralHover',
    '--slds-c-button-neutral-color-border-hover':   'buttonNeutralBorder',
    '--slds-c-button-neutral-color-background-active': 'surfaceHover',
    '--slds-c-button-neutral-color-border-active':  'borderInput',
    '--slds-c-button-text-color-hover':             'textPrimary',
    '--slds-c-button-text-color-active':            'textPrimary',
    '--slds-c-tabs-item-text-color':                'textSecondary',
    '--slds-c-tabs-item-text-color-active':         'accent',
    '--slds-c-tabs-item-color-border-hover':        'accent',
    '--slds-c-tabs-item-color-border-active':       'accent',
  };

  // ─── Resolve token value from theme colors ─────────────────────────────────

  /**
   * Resolve a theme color key, handling special placeholders like {inputBg}.
   */
  function resolveColorKey(key, themeColors) {
    if (!key || !themeColors) return null;

    // Special placeholder: {inputBg} = dark ? background : surface
    if (key === '{inputBg}') {
      return themeColors.colorScheme === 'dark' ? themeColors.background : themeColors.surface;
    }

    return themeColors[key] || null;
  }

  // ─── CSS Fix Generation ────────────────────────────────────────────────────

  /**
   * Generate CSS fixes for token gaps.
   *
   * @param {string[]} gaps - Array of CSS custom property names the scanner found as gaps
   * @param {Object} themeColors - The active theme's full color config
   * @returns {Object} { fixes: [...], unknownGaps: [...], css: string }
   */
  ns.generateTokenFixes = function generateTokenFixes(gaps, themeColors) {
    if (!gaps || !gaps.length || !themeColors) {
      return { fixes: [], unknownGaps: [], css: '' };
    }

    const fixes = [];
    const unknownGaps = [];

    for (const token of gaps) {
      const colorKey = TOKEN_COLOR_MAP[token];
      if (colorKey) {
        const value = resolveColorKey(colorKey, themeColors);
        if (value) {
          fixes.push({
            token,
            colorKey: colorKey.startsWith('{') ? colorKey : colorKey,
            value,
            css: `  ${token}: ${value} !important;`,
          });
        } else {
          unknownGaps.push(token);
        }
      } else {
        unknownGaps.push(token);
      }
    }

    // Build complete CSS block
    let css = '';
    if (fixes.length) {
      css = ':root {\n';
      css += fixes.map(f => f.css).join('\n');
      css += '\n}';
    }

    return { fixes, unknownGaps, css };
  };

  // ─── Custom LWC Patch Generation ──────────────────────────────────────────

  /**
   * Generate a CSS patch for a custom LWC component with hardcoded colors.
   *
   * @param {Object} component - Component scan result (tag, styling, hardcodedIssues)
   * @param {Object} themeColors - Active theme's color config
   * @returns {Object} { tag, rules: [...], css: string }
   */
  ns.generateComponentPatch = function generateComponentPatch(component, themeColors) {
    if (!component || !themeColors) return null;

    const tag = component.tag;
    const isDark = themeColors.colorScheme === 'dark';
    const rules = [];

    // ── Always generate a comprehensive set of overrides for custom LWCs ──
    // Custom components often inherit SF defaults (white bg, dark text) that
    // clash with dark themes. Even if the component's computed bg is transparent,
    // its children may not be — so we theme the host AND its descendants.

    // Host element: background + text + border
    rules.push({
      property: 'background-color',
      value: `var(--lwc-colorBackgroundAlt, ${themeColors.surface})`,
      reason: 'Theme surface color on custom component host',
    });

    rules.push({
      property: 'color',
      value: `var(--lwc-colorTextDefault, ${themeColors.textPrimary})`,
      reason: 'Theme text color on custom component host',
    });

    // Border: only if the component actually has visible borders
    if (component.styling) {
      const bc = component.styling.borderColor;
      const hasBorder = bc && bc !== 'rgb(0, 0, 0)' && bc !== 'rgba(0, 0, 0, 0)' && bc !== 'transparent';
      if (hasBorder) {
        rules.push({
          property: 'border-color',
          value: `var(--lwc-colorBorder, ${themeColors.border})`,
          reason: `Replaces ${bc}`,
        });
      }
    }

    // ── Descendant overrides ────────────────────────────────────────────────
    // Custom LWCs contain inner elements (divs, spans, tables, inputs) that
    // hardcode SF default colors. The descendant rules ensure these inherit
    // the theme's palette instead of rendering as bright white patches.
    const descendantRules = [];

    // Inner containers and divs
    descendantRules.push({
      selector: `${tag} div, ${tag} section, ${tag} article`,
      properties: [
        { property: 'color', value: 'inherit' },
      ],
    });

    // Inner headings and labels
    descendantRules.push({
      selector: `${tag} h1, ${tag} h2, ${tag} h3, ${tag} h4, ${tag} label, ${tag} span`,
      properties: [
        { property: 'color', value: 'inherit' },
      ],
    });

    // Links inside the component
    descendantRules.push({
      selector: `${tag} a`,
      properties: [
        { property: 'color', value: `var(--lwc-colorTextLink, ${themeColors.link})` },
      ],
    });

    // Tables inside the component
    descendantRules.push({
      selector: `${tag} table, ${tag} .slds-table`,
      properties: [
        { property: 'background-color', value: `var(--lwc-colorBackgroundAlt, ${themeColors.surface})` },
        { property: 'border-color', value: `var(--lwc-colorBorder, ${themeColors.border})` },
      ],
    });

    descendantRules.push({
      selector: `${tag} th`,
      properties: [
        { property: 'background-color', value: `var(--lwc-colorBackground, ${themeColors.background})` },
        { property: 'color', value: `var(--lwc-colorTextDefault, ${themeColors.textPrimary})` },
      ],
    });

    descendantRules.push({
      selector: `${tag} td`,
      properties: [
        { property: 'border-color', value: `var(--lwc-colorBorder, ${themeColors.border})` },
        { property: 'color', value: 'inherit' },
      ],
    });

    // Inputs inside the component
    descendantRules.push({
      selector: `${tag} input, ${tag} textarea, ${tag} select`,
      properties: [
        { property: 'background-color', value: `var(--lwc-colorBackgroundInput, ${isDark ? themeColors.background : themeColors.surface})` },
        { property: 'border-color', value: `var(--lwc-colorBorderInput, ${themeColors.borderInput})` },
        { property: 'color', value: `var(--lwc-colorTextDefault, ${themeColors.textPrimary})` },
      ],
    });

    // Buttons inside the component
    descendantRules.push({
      selector: `${tag} button, ${tag} .slds-button`,
      properties: [
        { property: 'color', value: 'inherit' },
      ],
    });

    // Also include explicit hardcoded issues from inline styles (these add
    // more specific rules where the scanner found actual hardcoded values)
    if (component.styling?.hardcodedIssues) {
      for (const issue of component.styling.hardcodedIssues) {
        const mapped = mapHardcodedProperty(issue.property, themeColors);
        if (mapped && !rules.find(r => r.property === mapped.property)) {
          rules.push(mapped);
        }
      }
    }

    // ── Build CSS ──────────────────────────────────────────────────────────
    let css = `/* Patch: <${tag}> */\n`;
    css += `${tag} {\n${rules.map(r => `  ${r.property}: ${r.value} !important;`).join('\n')}\n}\n`;

    for (const dr of descendantRules) {
      const props = dr.properties.map(p => `  ${p.property}: ${p.value} !important;`).join('\n');
      css += `\n${dr.selector} {\n${props}\n}`;
    }

    return { tag, rules, descendantRules, css };
  };

  /**
   * Map a hardcoded CSS property to a theme-aware replacement.
   */
  function mapHardcodedProperty(prop, themeColors) {
    switch (prop) {
      case 'background-color':
      case 'background':
        return {
          property: 'background-color',
          value: `var(--lwc-colorBackgroundAlt, ${themeColors.surface})`,
          reason: 'Hardcoded background replaced with theme token',
        };
      case 'color':
        return {
          property: 'color',
          value: `var(--lwc-colorTextDefault, ${themeColors.textPrimary})`,
          reason: 'Hardcoded text color replaced with theme token',
        };
      case 'border-color':
      case 'border':
        return {
          property: 'border-color',
          value: `var(--lwc-colorBorder, ${themeColors.border})`,
          reason: 'Hardcoded border replaced with theme token',
        };
      default:
        return null;
    }
  }

  // ─── Bulk patch generation for all custom LWCs ─────────────────────────────

  /**
   * Generate patches for all custom LWCs detected on the page.
   *
   * @param {Object[]} customComponents - Array from component scanner (source === 'custom')
   * @param {Object} themeColors - Active theme's color config
   * @returns {Object[]} Array of patch objects
   */
  ns.generateAllPatches = function generateAllPatches(customComponents, themeColors) {
    if (!customComponents || !themeColors) return [];

    return customComponents
      .map(comp => ns.generateComponentPatch(comp, themeColors))
      .filter(Boolean);
  };

  // ─── Full fix report (token gaps + component patches) ─────────────────────

  /**
   * Generate a complete fix report combining token gap fixes and component patches.
   *
   * @param {Object} scanResults - Token scan results (from ns.scanTokens)
   * @param {Object} componentResults - Component scan results (from ns.scanComponents)
   * @param {Object} themeColors - Active theme's color config
   * @returns {Object} { tokenFixes, componentPatches, fullCSS }
   */
  ns.generateFullFixReport = function generateFullFixReport(scanResults, componentResults, themeColors) {
    const tokenFixes = ns.generateTokenFixes(scanResults?.gaps || [], themeColors);
    const componentPatches = ns.generateAllPatches(componentResults?.custom || [], themeColors);

    let fullCSS = '';
    if (tokenFixes.css) {
      fullCSS += '/* ─── Token Gap Fixes ──────────────────────────────────────── */\n\n';
      fullCSS += tokenFixes.css + '\n\n';
    }
    if (componentPatches.length) {
      fullCSS += '/* ─── Custom LWC Patches ──────────────────────────────────── */\n\n';
      fullCSS += componentPatches.map(p => p.css).join('\n\n') + '\n';
    }

    return {
      tokenFixes,
      componentPatches,
      fullCSS,
      summary: {
        tokenGapsFixed: tokenFixes.fixes.length,
        tokenGapsUnknown: tokenFixes.unknownGaps.length,
        componentsPatched: componentPatches.length,
      },
    };
  };

  // Export the token map for other modules
  ns.TOKEN_COLOR_MAP = TOKEN_COLOR_MAP;
})();

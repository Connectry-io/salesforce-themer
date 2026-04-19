/**
 * Salesforce Themer — Theme Engine
 * Generates complete CSS from a theme color config.
 * Single source of truth for all selectors and CSS structure.
 */

'use strict';

// Font stack lookup — must match the FONT_STACKS in options.js
const _FONT_STACKS = {
  'system-ui':      'system-ui, sans-serif',
  'neo-grotesque':  "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif",
  'humanist':       "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
  'geometric':      "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
  'classic-serif':  "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
  'ibm-plex':       "'IBM Plex Sans', Inter, 'Segoe UI', system-ui, sans-serif",
};

function _generateTypographyCSS(typo) {
  if (!typo) return '';
  const bodyStack = _FONT_STACKS[typo.fontFamily] || _FONT_STACKS['system-ui'];
  const headingStack = typo.fontFamilyHeading ? (_FONT_STACKS[typo.fontFamilyHeading] || bodyStack) : null;
  const scale = typo.sizeScale || 1.0;
  const isDefault = typo.fontFamily === 'system-ui' && scale === 1.0
    && typo.weightBody === 400 && typo.weightHeading === 700
    && typo.lineHeight === 1.375 && !typo.letterSpacing
    && !typo.fontFamilyHeading;
  if (isDefault) return '';

  // SLDS 1 font sizes (rem values from Salesforce's token set)
  const sizes = {
    XSmall: 0.625, Small: 0.875, Medium: 1, Large: 1.125, XLarge: 1.25, XxLarge: 2,
  };

  let css = '\n/* ─── Typography overrides ──────────────────────────────────────────── */\n\n:root {\n';
  css += `  --lwc-fontFamily: ${bodyStack} !important;\n`;
  if (headingStack) css += `  --lwc-fontFamilyHeading: ${headingStack} !important;\n`;
  css += `  --slds-g-font-family: ${bodyStack} !important;\n`;

  // Weight tokens — only emit when explicitly set (don't emit 'undefined')
  if (typo.weightBody != null && typo.weightBody !== 400) {
    css += `  --lwc-fontWeightRegular: ${typo.weightBody} !important;\n`;
    css += `  --slds-g-font-weight-4: ${typo.weightBody} !important;\n`;
  }
  if (typo.weightHeading != null && typo.weightHeading !== 700) {
    css += `  --lwc-fontWeightBold: ${typo.weightHeading} !important;\n`;
    css += `  --slds-g-font-weight-7: ${typo.weightHeading} !important;\n`;
  }

  // Line height — only emit when explicitly set
  if (typo.lineHeight != null && typo.lineHeight !== 1.375) {
    css += `  --lwc-lineHeightText: ${typo.lineHeight} !important;\n`;
    css += `  --lwc-lineHeightHeading: ${Math.max(1.1, typo.lineHeight - 0.125)} !important;\n`;
  }

  // Size scaling — multiply each SLDS 1 fontSize token
  if (scale !== 1.0) {
    for (const [suffix, rem] of Object.entries(sizes)) {
      const scaled = (rem * scale).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      css += `  --lwc-fontSize${suffix}: ${scaled}rem !important;\n`;
    }
    css += `  --slds-g-font-size-base: ${(1 * scale).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}rem !important;\n`;
  }

  css += '}\n';

  // Font-family fallback on body (some elements don't inherit from tokens)
  css += `\nbody, .desktop, .oneContent, .slds-scope {\n  font-family: ${bodyStack} !important;\n`;
  if (typo.letterSpacing) css += `  letter-spacing: ${typo.letterSpacing}em !important;\n`;
  css += '}\n';

  // Heading font-family override if different from body
  if (headingStack) {
    css += `\n.slds-text-heading_large, .slds-text-heading_medium, .slds-text-heading_small,\n.slds-page-header__title, h1, h2, h3 {\n  font-family: ${headingStack} !important;\n}\n`;
  }

  // SLDS utility class size overrides (safety net — these use hardcoded values, not tokens)
  if (scale !== 1.0) {
    css += `\n.slds-text-heading_large { font-size: ${(1.5 * scale).toFixed(3)}rem !important; }\n`;
    css += `.slds-text-heading_medium { font-size: ${(1.25 * scale).toFixed(3)}rem !important; }\n`;
    css += `.slds-text-heading_small { font-size: ${(0.875 * scale).toFixed(3)}rem !important; }\n`;
    css += `.slds-text-body_regular { font-size: ${(0.875 * scale).toFixed(3)}rem !important; }\n`;
    css += `.slds-text-body_small { font-size: ${(0.75 * scale).toFixed(3)}rem !important; }\n`;
  }

  return css;
}

function generateThemeCSS(theme) {
  const c = theme.colors;
  const isDark = c.colorScheme === 'dark';
  const fx = c.specialEffects || null;
  const typo = theme.typography || null;

  const accentRgb = hexToRgb(c.accent) || '74, 111, 165';

  const brandBright = c.brandBright || c.accent;
  const iconColor = c.iconColor || c.textSecondary;
  const onSurface1 = c.onSurface1 || c.textPrimary;
  const onSurface2 = c.onSurface2 || c.textSecondary;
  const onSurface3 = c.onSurface3 || c.textMuted;
  const borderStrong = c.borderStrong || c.borderInput;
  const buttonBrandDisabledBg = c.buttonBrandDisabledBg || c.textMuted;
  const buttonBrandDisabledText = c.buttonBrandDisabledText || c.textMuted;
  const buttonNeutralBorderDefault = c.buttonNeutralBorderDefault || c.buttonBrandBorder;
  const buttonNeutralText = c.buttonNeutralText || c.textPrimary;
  const inputSearchBg = c.inputSearchBg || (isDark ? c.background : c.surface);

  return `
/* Auto-generated by Salesforce Themer engine — theme: ${theme.id} */

/* ─── CSS Custom Properties ─────────────────────────────────────────────── */

:root {
  color-scheme: ${c.colorScheme};

  /* Legacy LWC tokens */
  --lwc-colorBackground: ${c.background} !important;
  --lwc-colorBackgroundAlt: ${c.surface} !important;
  --lwc-colorBackgroundRow: ${c.surface} !important;
  --lwc-colorBackgroundRowHover: ${c.surfaceHover} !important;
  --lwc-colorBackgroundHighlight: ${c.surfaceHighlight} !important;
  --lwc-colorBackgroundSelection: ${c.surfaceSelection} !important;
  --lwc-colorBackgroundButtonBrand: ${c.buttonBrandBg} !important;
  --lwc-colorBackgroundButtonBrandHover: ${c.buttonBrandHover} !important;
  --lwc-colorBackgroundButtonBrandActive: ${c.accentActive} !important;
  --lwc-colorBackgroundButtonDefault: ${c.buttonNeutralBg} !important;
  --lwc-colorBackgroundButtonDefaultHover: ${c.buttonNeutralHover} !important;
  --lwc-headerColorBackground: ${c.nav} !important;
  --lwc-pageColorBackground: ${c.background} !important;
  --lwc-colorTextDefault: ${c.textPrimary} !important;
  --lwc-colorTextWeak: ${c.textSecondary} !important;
  --lwc-colorTextLabel: ${c.textSecondary} !important;
  --lwc-colorTextPlaceholder: ${c.textPlaceholder} !important;
  --lwc-colorTextButtonBrand: ${c.buttonBrandText} !important;
  --lwc-colorTextLink: ${c.link} !important;
  --lwc-colorTextLinkHover: ${c.linkHover} !important;
  --lwc-colorBorder: ${c.border} !important;
  --lwc-colorBorderSeparator: ${c.borderSeparator} !important;
  --lwc-colorBorderInput: ${c.borderInput} !important;
  --lwc-colorBorderInputActive: ${brandBright} !important;
  --lwc-brandPrimary: ${c.accent} !important;
  --lwc-brandPrimaryActive: ${c.accentHover} !important;
  --lwc-brandPrimaryTransparent: ${c.accentLight} !important;
  --lwc-brandAccessible: ${c.accent} !important;
  --lwc-brandAccessibleActive: ${c.accentHover} !important;
  --lwc-colorBackgroundSpin: ${c.accent} !important;
  --lwc-shadowOutlineFocus: ${c.focusRing} !important;

  /* SLDS 2 global tokens */
  --slds-g-color-surface-1: ${c.surface} !important;
  --slds-g-color-surface-2: ${c.background} !important;
  --slds-g-color-surface-3: ${c.surfaceHover} !important;
  --slds-g-color-surface-4: ${c.border} !important;
  --slds-g-color-on-surface-1: ${onSurface1} !important;
  --slds-g-color-on-surface-2: ${onSurface2} !important;
  --slds-g-color-on-surface-3: ${onSurface3} !important;
  --slds-g-color-border-1: ${c.borderInput} !important;
  --slds-g-color-border-2: ${borderStrong} !important;
  --slds-g-color-brand-1: ${c.accent} !important;
  --slds-g-color-brand-2: ${c.accentHover} !important;
  --slds-g-color-brand-3: ${c.accentActive} !important;
  --slds-g-color-neutral-1: ${c.background} !important;
  --slds-g-color-neutral-2: ${c.surfaceAlt || c.surfaceHover} !important;
  --slds-g-color-neutral-3: ${c.border} !important;

  /* SLDS 2 surface containers */
  --slds-g-color-surface-container-1: ${c.surface} !important;
  --slds-g-color-surface-container-2: ${c.surfaceHover} !important;
  --slds-g-color-surface-container-3: ${c.border} !important;

  /* SLDS 2 accent */
  --slds-g-color-accent-1: ${c.accent} !important;
  --slds-g-color-accent-2: ${c.accentHover} !important;
  --slds-g-color-accent-3: ${c.accentLight} !important;

  /* Legacy LWC — brand */
  --lwc-colorBrand: ${brandBright} !important;
  --lwc-colorBrandDark: ${c.accent} !important;
  --lwc-colorBrandDarker: ${c.accentActive} !important;
  --lwc-colorTextBrand: ${brandBright} !important;
  --lwc-colorTextBrandPrimary: ${c.accent} !important;

  /* Legacy LWC — backgrounds (surfaces, inputs, modals) */
  --lwc-colorBackgroundLight: ${c.surface} !important;
  --lwc-colorBackgroundShade: ${c.surfaceAlt || c.surfaceHover} !important;
  --lwc-colorBackgroundShadeDark: ${c.surfaceAlt || c.surfaceHover} !important;
  --lwc-colorBackgroundInput: ${isDark ? c.background : c.surface} !important;
  --lwc-colorBackgroundInputActive: ${isDark ? c.background : c.surface} !important;
  --lwc-colorBackgroundInputDisabled: ${c.surfaceAlt || c.surfaceHover} !important;
  --lwc-colorBackgroundInputError: ${c.surface} !important;
  --lwc-colorBackgroundInputSearch: ${inputSearchBg} !important;
  --lwc-colorBackgroundInputCheckbox: ${c.surface} !important;
  --lwc-colorBackgroundInputCheckboxSelected: ${brandBright} !important;
  --lwc-colorBackgroundModal: ${c.modalBg} !important;
  --lwc-colorBackgroundBackdropTint: ${c.modalBackdrop} !important;
  --lwc-colorBackgroundPill: ${c.pillBg} !important;

  /* Legacy LWC — button states */
  --lwc-colorBackgroundButtonBrandDisabled: ${buttonBrandDisabledBg} !important;
  --lwc-colorBackgroundButtonDefaultActive: ${c.surfaceHover} !important;
  --lwc-colorBackgroundButtonDefaultDisabled: ${c.surface} !important;
  --lwc-buttonColorBackgroundPrimary: ${c.buttonBrandBg} !important;
  --lwc-buttonColorBorderPrimary: ${buttonNeutralBorderDefault} !important;

  /* Legacy LWC — text (buttons, icons, actions) */
  --lwc-colorTextButtonBrandHover: ${c.buttonBrandText} !important;
  --lwc-colorTextButtonBrandDisabled: ${buttonBrandDisabledText} !important;
  --lwc-colorTextButtonDefault: ${buttonNeutralText} !important;
  --lwc-colorTextButtonDefaultHover: ${buttonNeutralText} !important;
  --lwc-colorTextButtonDefaultHint: ${c.textSecondary} !important;
  --lwc-colorTextButtonDefaultDisabled: ${c.textMuted} !important;
  --lwc-colorTextIconDefault: ${iconColor} !important;
  --lwc-colorTextIconDefaultHover: ${c.textPrimary} !important;
  --lwc-colorTextIconDefaultActive: ${c.accent} !important;
  --lwc-colorTextIconDefaultDisabled: ${c.textMuted} !important;
  --lwc-colorTextActionLabel: ${c.textSecondary} !important;
  --lwc-colorTextActionLabelActive: ${c.textPrimary} !important;
  --lwc-colorTextInputIcon: ${c.textSecondary} !important;

  /* Legacy LWC — borders */
  --lwc-colorBorderPrimary: ${c.border} !important;
  --lwc-colorBorderBrand: ${c.accent} !important;
  --lwc-colorBorderButtonBrand: ${c.buttonBrandBorder} !important;
  --lwc-colorBorderButtonBrandDisabled: ${c.buttonBrandDisabledBorder || 'transparent'} !important;
  --lwc-colorBorderButtonDefault: ${c.buttonNeutralBorder} !important;

  /* Component hooks — cards & inputs */
  --slds-c-card-color-background: ${c.surface} !important;
  --slds-c-card-color-border: ${c.border} !important;
  --slds-c-input-color-background: ${isDark ? c.background : c.surface} !important;
  --slds-c-input-color-border: ${c.borderInput} !important;
  --slds-c-input-color-border-focus: ${c.accent} !important;
  --slds-c-input-text-color: ${c.textPrimary} !important;

  /* Component hooks — buttons */
  --slds-c-button-brand-color-background: ${c.buttonBrandBg} !important;
  --slds-c-button-brand-color-border: ${c.buttonBrandBorder} !important;
  --slds-c-button-brand-color-background-hover: ${c.buttonBrandHover} !important;
  --slds-c-button-neutral-color-background: ${c.buttonNeutralBg} !important;
  --slds-c-button-neutral-color-border: ${c.buttonNeutralBorder} !important;
  --slds-c-button-neutral-color-background-hover: ${c.buttonNeutralHover} !important;
  --slds-c-button-neutral-color-border-hover: ${c.buttonNeutralBorder} !important;
  --slds-c-button-neutral-color-background-active: ${c.surfaceHover} !important;
  --slds-c-button-neutral-color-border-active: ${c.borderInput} !important;
  --slds-c-button-text-color-hover: ${c.textPrimary} !important;
  --slds-c-button-text-color-active: ${c.textPrimary} !important;

  /* Legacy LWC — gap tokens discovered 2026-04-12 */
  --lwc-colorBackgroundAlt2: ${c.surfaceAlt || c.background} !important;
  --lwc-colorBackgroundRowActive: ${c.surfaceSelection} !important;
  --lwc-colorBackgroundRowSelected: ${c.surfaceSelection} !important;
  --lwc-colorBackgroundNotification: ${c.surfaceHighlight} !important;
  --lwc-colorBackgroundToggleHover: ${c.surfaceHover} !important;
  --lwc-colorTextPrimary: ${c.textPrimary} !important;
  --lwc-colorTextLinkDisabled: ${c.textMuted} !important;
  --lwc-colorTextLinkActive: ${c.accentActive} !important;
  /* Kebab-case aliases SF uses alongside camelCase */
  --lwc-color-background: ${c.background} !important;
  --lwc-color-background-alt: ${c.surface} !important;
  --lwc-colorBackgroundDark: ${c.nav} !important;

  /* Component hooks — tabs */
  --slds-c-tabs-item-text-color: ${c.tabInactiveColor} !important;
  --slds-c-tabs-item-text-color-active: ${c.tabActiveColor} !important;
  --slds-c-tabs-item-color-border-hover: ${c.tabActiveBorder} !important;
  --slds-c-tabs-item-color-border-active: ${c.tabActiveBorder} !important;
  --slds-c-tabs-list-color-border: ${c.tabNavBorder || c.border} !important;
  --lwc-colorTextTabLabel: ${c.tabInactiveColor} !important;
  --lwc-colorTextTabLabelSelected: ${c.tabActiveColor} !important;
  --lwc-colorBorderTabSelected: ${c.tabActiveBorder} !important;
  --lwc-colorBorderTabActive: ${c.tabActiveBorder} !important;

  /* Component hooks — Welcome Mat (Setup Home hero) */
  --lwc-welcomeMatColorBackgroundProgressBar: ${c.surfaceAlt} !important;
  --lwc-welcomeMatTextColorInfo: ${c.textPrimary} !important;
  --lwc-welcomeMatBackgroundColorInfo: ${c.surface} !important;
  --lwc-welcomeMatBackgroundImageInfo: none !important;
  --lwc-welcomeMatColorActionShadow: 0 2px 4px rgba(0, 0, 0, ${isDark ? 0.4 : 0.08}) !important;
  --lwc-welcomeMatColorIconComplete: ${c.accent} !important;

  /* Component hooks — Brand Primary family (Setup cards + branded chrome) */
  --lwc-colorBackgroundBrandPrimary: ${c.accent} !important;
  --lwc-colorBackgroundBrandPrimaryActive: ${c.accentActive} !important;
  --lwc-colorBackgroundBrandPrimaryFocus: ${c.accentHover} !important;
  --lwc-colorBorderBrandPrimary: ${c.accent} !important;
  --lwc-colorBorderBrandPrimaryActive: ${c.accentActive} !important;
  --lwc-colorBorderBrandPrimaryFocus: ${c.accentHover} !important;
  --lwc-colorBackgroundContextBar: ${c.nav} !important;
  --lwc-brandBackgroundDark: ${c.nav} !important;
  --lwc-brandBackgroundDarkTransparent: ${c.accentLight || 'transparent'} !important;
  --lwc-brandBackgroundPrimaryTransparent: ${c.accentLight || 'transparent'} !important;

  /* Component hooks — Cards (inner text + footer) */
  --slds-c-card-text-color: ${c.textPrimary} !important;
  --slds-c-card-footer-color-border: ${c.borderSeparator || c.border} !important;

  /* Component hooks — Modal + Backdrop */
  --slds-c-modal-color-background: ${c.modalBg || c.surface} !important;
  --slds-c-modal-color-border: ${c.border} !important;
  --slds-c-modal-header-color-background: ${c.modalHeaderBg || c.surface} !important;
  --slds-c-modal-header-text-color: ${c.textPrimary} !important;
  --slds-c-modal-content-color-background: ${c.modalBg || c.surface} !important;
  --slds-c-modal-content-text-color: ${c.textPrimary} !important;
  --slds-c-modal-text-color: ${c.textPrimary} !important;
  --slds-c-modal-footer-color-background: ${c.modalFooterBg || c.surfaceAlt} !important;
  --slds-c-modal-footer-text-color: ${c.textPrimary} !important;
  --slds-c-backdrop-color-background: ${c.modalBackdrop || 'rgba(0, 0, 0, 0.5)'} !important;

  /* Component hooks — Dropdown / Combobox items */
  --slds-c-dropdown-color: ${c.dropdownBg || c.surface} !important;
  --slds-c-dropdown-item-color-background: ${c.dropdownBg || c.surface} !important;
  --slds-c-dropdown-item-color: ${c.textPrimary} !important;
  --slds-c-dropdown-item-color-background-hover: ${c.dropdownItemHoverBg || c.surfaceHover} !important;
  --slds-c-dropdown-item-color-hover: ${c.dropdownItemHoverText || c.textPrimary} !important;
  --slds-c-dropdown-item-color-background-focus: ${c.dropdownItemHoverBg || c.surfaceHover} !important;
  --slds-c-dropdown-item-color-focus: ${c.dropdownItemHoverText || c.textPrimary} !important;
  --slds-c-dropdown-item-color-background-active: ${c.accentLight || c.surfaceSelection} !important;
  --slds-c-dropdown-item-color-active: ${c.textPrimary} !important;
  --slds-c-dropdown-item-color-background-disabled: ${c.surfaceAlt} !important;
  --slds-c-dropdown-item-color-disabled: ${c.textMuted} !important;

  /* Component hooks — Listbox (picker options) */
  --slds-c-listbox-option-color: ${c.textPrimary} !important;
  --slds-c-listbox-option-color-background: ${c.surface} !important;
  --slds-c-listbox-option-color-hover: ${c.textPrimary} !important;
  --slds-c-listbox-option-color-background-hover: ${c.surfaceHover} !important;
  --slds-c-listbox-option-color-focus: ${c.textPrimary} !important;
  --slds-c-listbox-option-color-background-focus: ${c.surfaceHover} !important;
  --slds-c-listbox-option-color-disabled: ${c.textMuted} !important;
  --slds-c-listbox-option-color-background-disabled: ${c.surfaceAlt} !important;
  --slds-c-listbox-option-meta-color: ${c.textSecondary} !important;
  --slds-c-listbox-option-meta-color-hover: ${c.textPrimary} !important;
  --slds-c-listbox-option-meta-color-focus: ${c.textPrimary} !important;
  --slds-c-listbox-option-meta-color-disabled: ${c.textMuted} !important;

  /* Component hooks — Pills (chips/tags) */
  --slds-c-pill-color-border: ${c.pillBorder || c.border} !important;
  --slds-c-pill-color-background: ${c.pillBg || c.surfaceAlt} !important;
  --slds-c-pill-color-background-hover: ${c.surfaceHover} !important;
  --slds-c-pill-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;
  --slds-c-pill-container-color-background: ${c.surface} !important;

  /* Component hooks — Input focus + Textarea */
  --slds-c-input-color-background-focus: ${isDark ? c.background : c.surface} !important;
  --slds-c-input-text-color-focus: ${c.textPrimary} !important;
  --slds-c-input-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;
  --slds-c-textarea-color-background: ${isDark ? c.background : c.surface} !important;
  --slds-c-textarea-text-color: ${c.textPrimary} !important;
  --slds-c-textarea-color-border: ${c.borderInput} !important;
  --slds-c-textarea-color-background-focus: ${isDark ? c.background : c.surface} !important;

  /* Component hooks — Radio + Checkbox */
  --slds-c-radio-color-background: ${isDark ? c.background : c.surface} !important;
  --slds-c-radio-color-border: ${c.borderInput} !important;
  --slds-c-radio-color-background-checked: ${c.accent} !important;
  --slds-c-radio-color-border-checked: ${c.accent} !important;
  --slds-c-radio-mark-color-foreground: ${c.buttonBrandText || '#ffffff'} !important;
  --slds-c-radio-color-border-focus: ${c.accent} !important;
  --slds-c-radio-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;
  --slds-c-checkbox-color-background: ${isDark ? c.background : c.surface} !important;
  --slds-c-checkbox-color-border: ${c.borderInput} !important;
  --slds-c-checkbox-color-background-checked: ${c.accent} !important;
  --slds-c-checkbox-color-border-checked: ${c.accent} !important;
  --slds-c-checkbox-mark-color-foreground: ${c.buttonBrandText || '#ffffff'} !important;
  --slds-c-checkbox-color-border-focus: ${c.accent} !important;
  --slds-c-checkbox-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;

  /* Component hooks — Tooltip + Toast */
  --slds-c-tooltip-color-background: ${c.nav} !important;
  --slds-c-tooltip-text-color: ${c.navText} !important;
  --slds-c-toast-color-background: ${c.surface} !important;
  --slds-c-toast-text-color: ${c.textPrimary} !important;
  --lwc-notificationColorBackgroundInverse: ${c.nav} !important;

  /* Component hooks — Avatar */
  --slds-c-avatar-text-color: ${c.textPrimary} !important;
  --slds-c-avatar-initials-text-color: ${c.buttonBrandText || '#ffffff'} !important;

  /* Legacy LWC — Path chevrons (Opportunity stages etc.) */
  --lwc-colorBackgroundPathIncomplete: ${c.surfaceAlt} !important;
  --lwc-colorBackgroundPathIncompleteHover: ${c.surfaceHover} !important;
  --lwc-colorBackgroundPathComplete: ${c.accentLight || c.accent} !important;
  --lwc-colorBackgroundPathCompleteHover: ${c.accentLight || c.accent} !important;
  --lwc-colorBackgroundPathCurrent: ${c.accent} !important;
  --lwc-colorBorderPathCurrent: ${c.accent} !important;
  --lwc-colorTextPathCurrent: ${c.buttonBrandText || '#ffffff'} !important;

  /* Component hooks — Accordion */
  --slds-c-accordion-heading-color: ${c.textPrimary} !important;
  --slds-c-accordion-heading-text-color: ${c.textPrimary} !important;
  --slds-c-accordion-heading-text-color-hover: ${c.accent} !important;

  /* Component hooks — Select (picker) */
  --slds-c-select-color-border: ${c.borderInput} !important;
  --slds-c-select-color-background: ${isDark ? c.background : c.surface} !important;
  --slds-c-select-text-color: ${c.textPrimary} !important;
  --slds-c-select-color-border-focus: ${c.accent} !important;
  --slds-c-select-color-background-focus: ${isDark ? c.background : c.surface} !important;
  --slds-c-select-text-color-focus: ${c.textPrimary} !important;
  --slds-c-select-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;

  /* Component hooks — Slider */
  --slds-c-slider-thumb-color-foreground: ${c.accent} !important;
  --slds-c-slider-thumb-color-foreground-hover: ${c.accentHover} !important;
  --slds-c-slider-thumb-color-foreground-active: ${c.accentActive} !important;
  --slds-c-slider-thumb-color-foreground-focus: ${c.accent} !important;
  --slds-c-slider-thumb-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;
  --slds-c-slider-track-color-background: ${c.surfaceAlt} !important;
  --lwc-sliderTrackColorBackground: ${c.surfaceAlt} !important;
  --lwc-sliderColorBackgroundDisabled: ${c.surfaceAlt} !important;

  /* Component hooks — Toggle switch (slds-checkbox-toggle) */
  --slds-c-checkbox-toggle-color-border: ${c.borderInput} !important;
  --lwc-colorBackgroundToggle: ${c.surfaceAlt} !important;
  --slds-c-checkbox-toggle-color-background: ${c.surfaceAlt} !important;
  --slds-c-checkbox-toggle-color-background-hover: ${c.surfaceHover} !important;
  --slds-c-checkbox-toggle-color-border-hover: ${c.borderInput} !important;
  --slds-c-checkbox-toggle-switch-color-background: ${isDark ? c.textSecondary : '#ffffff'} !important;
  --slds-c-checkbox-toggle-color-background-focus: ${c.surfaceHover} !important;
  --slds-c-checkbox-toggle-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;
  --slds-c-checkbox-toggle-color-border-checked: ${c.accent} !important;
  --slds-c-checkbox-toggle-color-background-checked: ${c.accent} !important;
  --slds-c-checkbox-toggle-color-background-checked-hover: ${c.accentHover} !important;
  --slds-c-checkbox-toggle-switch-color-background-checked: ${c.buttonBrandText || '#ffffff'} !important;
  --slds-c-checkbox-toggle-mark-color-foreground: ${c.buttonBrandText || '#ffffff'} !important;
  --lwc-colorBorderToggleChecked: ${c.accent} !important;
  --slds-c-checkbox-toggle-color-background-checked-focus: ${c.accent} !important;
  --lwc-colorBackgroundToggleDisabled: ${c.surfaceAlt} !important;
  --lwc-colorBackgroundInputCheckboxDisabled: ${c.surfaceAlt} !important;

  /* Component hooks — Alert */
  --slds-c-alert-text-color: ${c.textPrimary} !important;
  --slds-c-alert-color-background: ${c.surface} !important;
  --slds-c-alert-color-border: ${c.border} !important;
  --slds-c-alert-text-color-active: ${c.textPrimary} !important;

  /* Component hooks — Progress (bar + ring) */
  --lwc-progressBarColorBackground: ${c.surfaceAlt} !important;
  --lwc-progressBarColorBackgroundFill: ${c.accent} !important;
  --lwc-progressBarColorBackgroundFillSuccess: ${c.success} !important;
  --lwc-progressColorBackgroundShade: ${c.surfaceAlt} !important;
  --lwc-progressColorBorderShade: ${c.border} !important;
  --lwc-progressColorBackground: ${c.surface} !important;
  --lwc-progressColorBorderActive: ${c.accent} !important;
  --lwc-progressColorBorderHover: ${c.accentHover} !important;
  --lwc-progressColorBorder: ${c.border} !important;
  --lwc-colorBackgroundProgressRingContent: ${c.surface} !important;
  --lwc-colorBackgroundSpinnerDot: ${c.textMuted} !important;

  /* Component hooks — Popover walkthrough */
  --lwc-popoverWalkthroughColorBackground: ${c.surface} !important;
  --lwc-popoverWalkthroughHeaderColorBackground: ${c.surfaceAlt} !important;
  --lwc-popoverColorText: ${c.textPrimary} !important;
  --lwc-popoverWalkthroughColorBackgroundAlt: ${c.surfaceAlt} !important;
  --lwc-popoverWalkthroughAltNubbinColorBackground: ${c.surfaceAlt} !important;

  /* Component hooks — Docked panel + Einstein header + Illustrations */
  --lwc-colorBackgroundDockedPanel: ${c.surface} !important;
  --lwc-colorBackgroundDockedPanelHeader: ${c.surfaceAlt} !important;
  --lwc-einsteinHeaderBackgroundColor: ${c.accentLight || c.surface} !important;
  --lwc-einsteinHeaderBackground: ${c.accentLight || c.surface} !important;
  --lwc-einsteinHeaderTextShadow: none !important;
  --lwc-illustrationColorPrimary: ${c.accent} !important;
  --lwc-illustrationColorSecondary: ${c.textSecondary} !important;

  /* Legacy LWC — Table headers (post-B7 coverage) */
  --lwc-tableColorBackgroundHeader: ${c.tableHeaderBg || c.surfaceAlt} !important;
  --lwc-tableColorTextHeader: ${c.tableHeaderText || c.textSecondary} !important;
  --lwc-tableColorBackgroundHeaderHover: ${c.surfaceHover} !important;
  --lwc-tableColorBackgroundHeaderResizableHandle: ${c.border} !important;

  /* Component hooks — Avatar hover + inverse */
  --slds-c-avatar-text-color-hover: ${c.textPrimary} !important;
  --slds-c-avatar-initials-text-color-hover: ${c.buttonBrandText || '#ffffff'} !important;
  --slds-c-avatar-inverse-text-color: ${c.buttonBrandText || '#ffffff'} !important;
  --slds-c-avatar-initials-inverse-text-color: ${c.buttonBrandText || '#ffffff'} !important;
  --slds-c-avatar-initials-inverse-text-color-hover: ${c.buttonBrandText || '#ffffff'} !important;

  /* Component hooks — Pill error states */
  --slds-c-pill-error-color-border: ${c.error} !important;
  --slds-c-pill-error-color-border-active: ${c.error} !important;
  --slds-c-pill-error-text-color: ${c.error} !important;
  --slds-c-pill-text-color-error: ${c.error} !important;
  --slds-c-pill-label-shadow-focus: ${c.focusRing || '0 0 0 2px ' + c.accent} !important;

  /* Legacy LWC — orphan hardcoded-light tokens used across Lightning + Setup */
  --lwc-colorBackgroundBackdrop: ${c.modalBackdrop || 'rgba(0, 0, 0, 0.5)'} !important;
  --lwc-colorBackgroundIconWaffle: ${c.navText} !important;
  --lwc-colorBackgroundPost: ${c.surface} !important;
  --lwc-colorBackgroundInfo: ${c.surfaceAlt} !important;
  --lwc-colorBackgroundIndicatorDot: ${c.accent} !important;
  --lwc-colorBackgroundImageOverlay: rgba(0, 0, 0, ${isDark ? 0.7 : 0.45}) !important;
  --lwc-colorBorderWarning: ${c.warning} !important;
  --lwc-colorBorderInputDisabled: ${c.borderInput} !important;
  --lwc-colorTextInputDisabled: ${c.textMuted} !important;
  --lwc-inputStaticColor: ${c.textPrimary} !important;
  --lwc-colorBorderReminder: ${c.border} !important;
  --lwc-colorBackgroundReminderHover: ${c.surfaceHover} !important;
  --lwc-colorBackgroundGuidance: ${c.surface} !important;
  --slds-c-color-brand-dark: ${c.accentActive} !important;
  --slds-g-color-border-brand-2: ${c.border} !important;

  /* Notification utility-bar tokens (Setup uses these) */
  --lwc-utilityBarColorBackgroundNotificationBadge: ${c.error} !important;
  --lwc-utilityBarColorBackgroundNotificationFocus: ${c.accent} !important;

  /* Global nav item accent-active/focus (Setup chrome) */
  --lwc-globalnavigationItemHeightAccentActive: ${c.accent} !important;
  --lwc-globalnavigationItemHeightAccentFocus: ${c.accentHover} !important;

  /* Kebab-case alias for brandAccessible (used in some SF SLDS 2 tokens) */
  --lwc-brand-accessible: ${c.accent} !important;

  /* Context bar + Context tab bar active/hover — these tokens paint
   * the active-subtab fill (the "Home" pill) which defaults to white.
   * This is the root cause of the Home-tab-always-cyan saga on Tron:
   * SF paints with ContextBarItemActive, we had no override, and my
   * selector-level transparent-bg was losing specificity. Neutralize
   * at the token source. */
  --lwc-colorBackgroundContextBarItem: transparent !important;
  --lwc-colorBackgroundContextBarItemActive: transparent !important;
  --lwc-colorBackgroundContextBarItemHover: ${c.navHover || 'rgba(255,255,255,0.08)'} !important;
  --lwc-colorBackgroundContextBarInverseItemActive: ${c.accentLight || 'rgba(255,255,255,0.15)'} !important;
  --lwc-colorBackgroundContextBarInverseItemHover: ${c.navHover || 'rgba(255,255,255,0.1)'} !important;
  --lwc-colorBackgroundContextTabBarItem: transparent !important;
  --lwc-colorBackgroundContextTabBarItemActive: transparent !important;
  --lwc-colorBorderContextBarThemeDefault: ${c.accent} !important;
  --lwc-colorBorderContextBarThemeDefaultActive: ${c.accent} !important;
  --lwc-colorBorderContextBarThemeDefaultAlt: ${c.border} !important;
  --lwc-colorBorderContextBarThemeDefaultHover: ${c.accentHover} !important;

  /* Path chevron — hover + stage-specific states (B7 added the basics) */
  --lwc-colorBorderPathCurrentHover: ${c.accentHover} !important;
  --lwc-colorTextPathCurrentHover: ${c.buttonBrandText || '#ffffff'} !important;
  --lwc-colorBackgroundPathActive: ${c.accent} !important;
  --lwc-colorBackgroundPathActiveHover: ${c.accentHover} !important;
  --lwc-colorBackgroundPathLost: ${c.error} !important;
  --lwc-colorBackgroundPathWon: ${c.success} !important;
}

/* ─── SF utility-class background overrides (not token-driven) ──────────────
 * Some SF classes hardcode background-color in their CSS rules (no custom
 * property to override). .slds-theme_default is the biggest offender —
 * it is used on the Setup Home hero + various surfaces and hardcodes white.
 * We recolor these directly per DESIGN-RULES.md (recolor, not restructure).
 */
.slds-theme_default,
.slds-theme_default-solid {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
}

.slds-color__background_gray-1,
.slds-color__background_gray-2,
.slds-color__background_gray-3,
.slds-color__background_gray-4,
.slds-color__background_gray-5 {
  background-color: ${c.surfaceAlt} !important;
}

.slds-text-color_default {
  color: ${c.textPrimary} !important;
}

.slds-text-color_weak {
  color: ${c.textSecondary} !important;
}

/* Setup Home + Brand Band wrappers — SF paints these with a light band
 * regardless of theme. Make them transparent to let body bg show through.
 * Confirmed via DOM inspection 2026-04-19: forceBrandBand wraps the whole
 * Setup Home page; without this override the welcome hero + section
 * headers render theme text colors on an SF-light background = invisible. */
.slds-brand-band,
.slds-brand-band_cover,
.slds-brand-band_none,
.slds-brand-band_medium,
.slds-brand-band_small,
.forceBrandBand {
  background-color: ${c.background} !important;
  background-image: none !important;
}

.setup-card,
.home-screen,
.enhancedSetupHome,
.recent-items-card {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
}

/* Setup Home hero logo/welcome title — inherit theme text color */
.welcome-title,
.welcome-subtitle,
.topic-text {
  color: inherit !important;
}

/* Active subtab — classic underline-only pattern: transparent bg +
 * accent underline + accent text. Forces transparent across every
 * ancestor and descendant to neutralize whatever SF paints underneath
 * (various themes use brand-accent fills; those clash with our accent
 * colors and text becomes low-contrast). */
.slds-tabs_default__item.slds-is-active,
.slds-sub-tabs__item.slds-active,
.oneConsoleTabItem.slds-active,
.oneConsoleTabItem.active {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: inset 0 -3px 0 ${c.accent} !important;
  border-color: transparent !important;
}

.slds-tabs_default__item.slds-is-active > .slds-tabs_default__link,
.slds-sub-tabs__item.slds-active > .tabHeader,
.slds-sub-tabs__item.slds-active > a,
.oneConsoleTabItem.slds-active > .tabHeader,
.oneConsoleTabItem.active > .tabHeader {
  background: transparent !important;
  background-color: transparent !important;
}

/* All text inside active tabs — accent color for legibility on any bg. */
.slds-tabs_default__item.slds-is-active .slds-tabs_default__link,
.slds-tabs_default__item.slds-is-active .title,
.slds-sub-tabs__item.slds-active .tabHeader,
.slds-sub-tabs__item.slds-active .title,
.slds-sub-tabs__item.slds-active .showTitleWhenPinned,
.oneConsoleTabItem.slds-active .tabHeader,
.oneConsoleTabItem.slds-active .title,
.oneConsoleTabItem.slds-active .showTitleWhenPinned,
.oneConsoleTabItem.active .tabHeader,
.oneConsoleTabItem.active .title,
.oneConsoleTabItem.active .showTitleWhenPinned {
  color: ${c.accent} !important;
  text-shadow: none !important;
}

/* SVG icons inside active tabs — accent fill */
.oneConsoleTabItem.slds-active svg,
.oneConsoleTabItem.active svg,
.slds-sub-tabs__item.slds-active svg {
  fill: ${c.accent} !important;
}

/* Setup tree + left-nav hover — SF hardcodes a light hover bg that
 * makes text invisible on dark themes. Every node type that the Setup
 * sidebar uses: slds-tree__item (generic tree), setup-tree-node (LWC
 * wrapper), .setupLeaf (leaf rows), .setupLink (link rows). */
.slds-tree__item:hover,
.slds-tree__item:focus,
.slds-tree__item-label:hover,
setup-tree-node:hover,
.setup-tree-node:hover,
.setupLeaf:hover,
.setupLink:hover,
li.slds-tree__item:hover > a,
.slds-tree__item[aria-selected="true"] {
  background-color: ${c.surfaceHover} !important;
  color: ${c.textPrimary} !important;
}

.slds-tree__item:hover *,
.slds-tree__item-label:hover *,
setup-tree-node:hover *,
.setupLeaf:hover *,
.setupLink:hover * {
  color: ${c.textPrimary} !important;
}

/* Kill text-shadow on small interactive UI (buttons, dropdown items,
 * listbox rows, tree items, tab headers). The theme's link-glow effect
 * blurs small text unreadably — keep the glow for headings/hero text
 * only, not dense UI copy. */
.slds-button,
.slds-button *,
.slds-button_brand,
.slds-button_neutral,
.slds-button_icon,
.slds-dropdown__item,
.slds-dropdown__item *,
.slds-listbox__item,
.slds-listbox__item *,
.slds-tree__item,
.slds-tree__item *,
.slds-tabs_default__link,
.slds-sub-tabs__item a,
.tabHeader,
.setupLink,
.uiOutputText,
.lookup__menu,
.lookup__menu *,
.forceSearchDropdown,
.forceSearchDropdown * {
  text-shadow: none !important;
}

/* Global search dropdown (Setup search bar + force:search) — SF's
 * picker uses .forceSearchDropdown / .lookup__menu / .forceActionsContainer.
 * Ensure bg + text + row-hover match the theme so results are legible. */
body .forceSearchDropdown,
body .forceSearchSection,
body .forceSearchSectionHeader,
body .forceSearchAutoCompleteDataContainer,
body .forceSearchAutoCompleteDesktop,
body .forceSearchAutoCompleteRow,
body .forceActionsContainer,
body .lookup__menu,
body .search-setup-dropdown,
body .forceSearchResults,
body .searchDropdownRoot {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

/* Text inside the dropdown — aggressively force textPrimary on every
 * text-bearing element. SF buries the item title in various nested
 * spans/divs with specific classes. Using body prefix + broad list to
 * beat Aura CSS specificity. */
body .forceSearchDropdown,
body .forceSearchDropdown span,
body .forceSearchDropdown div,
body .forceSearchDropdown li,
body .forceSearchDropdown a,
body .forceSearchDropdown b,
body .forceSearchDropdown h1,
body .forceSearchDropdown h2,
body .forceSearchDropdown h3,
body .forceSearchDropdown .primaryField,
body .forceSearchDropdown .slds-truncate,
body .forceSearchDropdown .entityName,
body .forceSearchDropdown .result-name,
body .forceSearchDropdown .search-item-name,
body .forceSearchDropdown .search-entity-item-name,
body .forceSearchAutoCompleteRow,
body .forceSearchAutoCompleteRow span,
body .forceSearchAutoCompleteRow div,
body .forceSearchAutoCompleteRow a,
body .forceSearchAutoCompleteRow .primaryField,
body .forceSearchAutoCompleteRow .slds-truncate,
body .lookup__menu,
body .lookup__menu span,
body .lookup__menu div,
body .lookup__menu a,
body .lookup__menu li,
body .lookup__item-label {
  color: ${c.textPrimary} !important;
}

/* Secondary / meta text (record type, modified date, etc.) */
body .forceSearchDropdown .secondaryField,
body .forceSearchDropdown .slds-text-body_small,
body .forceSearchDropdown .meta,
body .forceSearchDropdown .entity,
body .forceSearchAutoCompleteRow .secondaryField,
body .forceSearchAutoCompleteRow .slds-text-body_small,
body .lookup__menu .slds-text-body_small,
body .lookup__menu .secondaryField,
body .lookup__item-meta {
  color: ${c.textSecondary} !important;
}

/* Section header ("Recent Items", "Top Results", etc.) */
body .forceSearchDropdown .forceSearchSectionHeader,
body .forceSearchDropdown .section-header,
body .forceSearchDropdown .slds-listbox__option-header,
body .forceSearchDropdown h3.slds-text-title,
body .forceSearchAutoCompleteDesktop .searchTitle {
  color: ${c.textSecondary} !important;
  background-color: ${c.surfaceAlt} !important;
  font-weight: 600 !important;
}

/* Hover / focus / selected */
body .forceSearchDropdown li:hover,
body .forceSearchDropdown a:hover,
body .forceSearchDropdown .forceSearchAutoCompleteRow:hover,
body .forceSearchDropdown .forceSearchAutoCompleteRow.selected,
body .forceSearchAutoCompleteRow:hover,
body .forceSearchAutoCompleteRow.selected,
body .lookup__menu li:hover,
body .lookup__menu a:hover {
  background-color: ${c.surfaceHover} !important;
}

body .forceSearchDropdown li:hover *,
body .forceSearchDropdown a:hover *,
body .forceSearchAutoCompleteRow:hover *,
body .forceSearchAutoCompleteRow.selected *,
body .lookup__menu li:hover *,
body .lookup__menu a:hover * {
  color: ${c.textPrimary} !important;
}

/* Global header chrome — context bar sections + global actions.
 * Scan showed .slds-context-bar__primary/secondary/tertiary unstyled;
 * these are the left/middle/right sections of the top bar. Global
 * actions (gear, bell, waffle, profile, help) live in __tertiary. */
.slds-context-bar,
.slds-context-bar__primary,
.slds-context-bar__secondary,
.slds-context-bar__tertiary {
  background-color: ${c.nav} !important;
  color: ${c.navText} !important;
  border-color: ${c.navBorder} !important;
}

.slds-global-actions,
.slds-global-actions__item,
.slds-global-actions__item-action {
  background-color: transparent !important;
  color: ${c.navIcon} !important;
}

.slds-global-actions__item:hover,
.slds-global-actions__item-action:hover,
.slds-global-actions__item-action:focus {
  background-color: ${c.navHover || 'rgba(255,255,255,0.08)'} !important;
  color: ${c.navText} !important;
}

.slds-global-actions__item svg,
.slds-global-actions__item-action svg,
.slds-global-actions__item .slds-icon,
.slds-global-actions__item-action .slds-icon {
  fill: ${c.navIcon} !important;
  color: ${c.navIcon} !important;
}

.slds-global-actions__item:hover svg,
.slds-global-actions__item-action:hover svg {
  fill: ${c.navText} !important;
  color: ${c.navText} !important;
}

/* Icon background defaults — prevent stray accent bubbles on icons
 * that inherit --slds-c-icon-color-background. Search magnifying
 * glass + various icon slots use this token; must stay transparent
 * unless a specific component explicitly styles it. */
:root {
  --slds-c-icon-color-background: transparent !important;
  --sds-c-icon-color-background: transparent !important;
}

.slds-icon_container,
.slds-icon-text-default,
.slds-input__icon,
.slds-input-has-icon .slds-icon {
  background-color: transparent !important;
}

/* Global search input icon — Setup top bar magnifying glass */
.forceSearchInputContainer .slds-icon,
.globalSearchContainer .slds-icon,
.slds-form-element__icon .slds-icon,
.slds-input__icon svg {
  fill: ${c.textSecondary} !important;
  background-color: transparent !important;
}

/* Search-term text highlight — SF hardcodes bright yellow (#fff03f).
 * Replace with punchy theme-accent tint (30% alpha) — visible on any
 * bg without washing out the text underneath. */
:root {
  --lwc-colorBackgroundHighlightSearch: rgba(${accentRgb}, 0.3) !important;
}

mark,
.highlight,
.highlightSearchTerm,
.slds-text-highlight,
.slds-nav__list-item .highlight,
.search-highlight,
.forceHighlightText {
  background-color: rgba(${accentRgb}, 0.3) !important;
  color: ${c.textPrimary} !important;
  box-shadow: none !important;
  border-radius: 2px !important;
  padding: 0 2px !important;
}

/* Legacy Aura Setup pages (Users, Profiles, Permission Sets, Roles,
 * Queues, Public Groups, etc.) — SF's older admin UI hardcodes white
 * container bgs + near-black text on .uiDataGrid + related classes.
 * Recolor to theme surface. These pages look ~10 years older than
 * Setup Home and need this baseline or they render as white islands. */
.enhancedSetupHome,
.setupcontent,
.onesetupSetupComponent,
.onesetupModule,
.module,
.module-content,
.setupBody,
.setupManager,
.bBody,
.bRelatedList,
.listViewContent,
.listViewHeader,
.listViewBody {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
}

.uiDataGrid,
.uiDataGrid--default,
.uiVirtualDataGrid,
.dataTable,
table.list,
table.bList,
.bList {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

.uiDataGrid thead,
.uiDataGrid thead tr,
.uiDataGrid thead th,
.uiDataGrid th,
table.list thead,
table.list thead th,
table.bList thead,
table.bList thead th {
  background-color: ${c.tableHeaderBg || c.surfaceAlt} !important;
  color: ${c.tableHeaderText || c.textSecondary} !important;
  border-color: ${c.border} !important;
}

.uiDataGrid tbody tr,
.uiDataGrid tbody td,
table.list tbody tr,
table.list tbody td,
table.bList tbody tr,
table.bList tbody td {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.borderSeparator || c.border} !important;
}

.uiDataGrid tbody tr:hover,
.uiDataGrid tbody tr:hover td,
table.list tbody tr:hover,
table.list tbody tr:hover td,
table.bList tbody tr:hover,
table.bList tbody tr:hover td {
  background-color: ${c.surfaceHover} !important;
}

.uiDataGrid tbody tr:nth-child(even) td,
table.list tbody tr:nth-child(even) td,
table.bList tbody tr:nth-child(even) td {
  background-color: ${c.tableAltRow || c.surface} !important;
}

.uiDataGrid a,
table.list a,
table.bList a {
  color: ${c.link || c.accent} !important;
}

/* Legacy Setup page headings + description + help text */
.pageDescription,
.bPageDescription,
.pbSubsection,
.pbHeader,
.mainTitle,
.detailList,
.setupBody .pageHeader h1,
.setupBody .pageHeader h2,
.setupcontent .pageHeader,
h1.pageType,
h2.pageDescription,
.bodyCell,
.labelCol,
.dataCol {
  color: ${c.textPrimary} !important;
  background-color: transparent !important;
}

/* Alphabet filter / letter picker (W X Y Z Other All on list views) */
.letterBar,
.letterBar a,
.letterBar span,
.pipe,
.alphaPicker,
.alphaPicker a,
.alphaPicker .current {
  color: ${c.textSecondary} !important;
  background-color: transparent !important;
}

.letterBar a:hover,
.alphaPicker a:hover,
.alphaPicker a.current,
.letterBar a.current {
  background-color: ${c.accentLight || c.surfaceHover} !important;
  color: ${c.accent} !important;
}

/* "Help for this Page" link + similar Setup chrome links */
.pageDescription a,
.helpLink,
.bHelp a {
  color: ${c.link || c.accent} !important;
}

/* Legacy Setup form inputs + dropdowns (native select needs color-scheme
 * hint so the browser paints dark chrome on the list popup). */
.setupBody input[type="text"],
.setupBody input[type="search"],
.setupBody input[type="email"],
.setupBody input[type="number"],
.setupBody select,
.setupBody textarea,
.setupcontent input[type="text"],
.setupcontent input[type="search"],
.setupcontent select,
.setupcontent textarea,
.bBody select,
.bBody input[type="text"],
.listViewContent select,
body.desktop input[type="text"]:not(.slds-input),
body.desktop select:not(.slds-select) {
  background-color: ${isDark ? c.background : c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.borderInput} !important;
  color-scheme: ${isDark ? 'dark' : 'light'} !important;
}

/* Native select arrow + checkbox accent tint — modern browser feature */
.setupBody,
.setupcontent,
.bBody,
.listViewContent,
body.desktop {
  accent-color: ${c.accent};
}

input[type="checkbox"],
input[type="radio"] {
  accent-color: ${c.accent} !important;
  color-scheme: ${isDark ? 'dark' : 'light'} !important;
}

/* Legacy form labels + inline text (View: label, "Edit | Create New View") */
.setupBody label,
.setupcontent label,
.bBody label,
.labelCol,
.formFieldLabel,
.pbTitle,
.pbSubheader {
  color: ${c.textPrimary} !important;
}

.setupBody a,
.setupcontent a,
.bBody a,
.listViewContent a,
.letterBar + .listViewContent a {
  color: ${c.link || c.accent} !important;
}

/* Legacy Setup buttons (the Aura "btn" class variant, not SLDS).
 * Brand the primary action with accent border + accent text; hover
 * fills with accentLight for visible affordance.
 *
 * CRITICAL: appearance: none strips the browser's native button chrome
 * (ButtonFace bg color) — without it, <input type="button"> renders
 * with a user-agent-stylesheet white/grey bg that beats our
 * background-color: transparent even with !important. Fixed 2026-04-19
 * after Users-page legacy buttons stayed white through B14-B16. */
.btn,
input.btn,
button.btn,
input[type="button"].btn,
input[type="submit"].btn,
.setupBody .btn,
.bBody .btn,
.bPageBlock .btn,
.pbBottomButtons .btn {
  -webkit-appearance: none !important;
  appearance: none !important;
  background-color: transparent !important;
  background-image: none !important;
  color: ${c.accent} !important;
  border: 1px solid ${c.accent} !important;
  border-radius: 4px !important;
  padding: 5px 12px !important;
  cursor: pointer !important;
  text-shadow: none !important;
  box-shadow: none !important;
  font-weight: 500 !important;
}

.btn:hover,
input.btn:hover,
button.btn:hover,
input[type="button"].btn:hover {
  background-color: ${c.accentLight || c.surfaceHover} !important;
  color: ${c.accent} !important;
  border-color: ${c.accent} !important;
}

.btn:active,
input.btn:active,
button.btn:active {
  background-color: ${c.accentLight || c.surfaceHover} !important;
  transform: translateY(1px);
}

.btnDisabled,
.btn:disabled,
input.btn:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}

/* Legacy list-view filter "View:" dropdown (.bFilterView pattern).
 * DOM confirmed 2026-04-19: .bFilterView > .bFilter > label + .fBody
 * > select + .fFooter > Edit/Create-New-View links. */
.bFilterView,
.bFilter,
.fBody,
.fFooter {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
}

.bFilterView label,
.bFilter label,
.bFilterView .assistiveText {
  color: ${c.textPrimary} !important;
  font-weight: 600 !important;
}

.bFilterView select,
.bFilter select,
.fBody select {
  -webkit-appearance: menulist !important;
  appearance: menulist !important;
  background-color: ${isDark ? c.background : c.surface} !important;
  color: ${c.textPrimary} !important;
  border: 1px solid ${c.borderInput} !important;
  border-radius: 4px !important;
  padding: 4px 6px !important;
  color-scheme: ${isDark ? 'dark' : 'light'} !important;
}

.bFilterView select:focus,
.bFilter select:focus,
.fBody select:focus {
  border-color: ${c.accent} !important;
  outline: none !important;
  box-shadow: 0 0 0 2px ${c.accentLight || 'rgba(0,0,0,0.1)'} !important;
}

.fFooter a,
.bFilter a,
.bFilterView a {
  color: ${c.link || c.accent} !important;
}

/* Aggressive active-tab hammer — role/aria-based selectors catch any
 * variant of active state that SF uses (Setup subtabs, workspace tabs,
 * app-nav pins). Should finally end the Home-tab readability saga. */
[role="tab"][aria-selected="true"],
li[role="presentation"].slds-active,
li[role="presentation"].active,
.oneConsoleTabItem[aria-selected="true"],
.tabHeader[aria-selected="true"] {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: inset 0 -3px 0 ${c.accent} !important;
  border-color: transparent !important;
}

[role="tab"][aria-selected="true"],
[role="tab"][aria-selected="true"] *,
.tabHeader[aria-selected="true"],
.tabHeader[aria-selected="true"] * {
  color: ${c.accent} !important;
  text-shadow: none !important;
}

/* Pseudo-element kill for active tabs — DevTools Computed panel on
 * 2026-04-19 pinned the cyan fill to app.css line 609:
 *   .slds-context-bar__item.slds-is-active::before,
 *   .slds-context-bar__item.slds-is-active::after,
 *   one-app-nav-bar-item-root.slds-is-active::before,
 *   one-app-nav-bar-item-root.slds-is-active::after,
 *   .slds-context-bar__item.slds-is-active a::before,
 *   .slds-context-bar__item.slds-is-active a::after
 *     { background-color: var(--lwc-colorBrand) !important; }
 *
 * My earlier kills targeted .oneConsoleTabItem.slds-active (different
 * class — note: slds-active vs slds-is-active). SF's rule won on
 * cascade order (their app.css loads after our document_start injection)
 * despite tied specificity.
 *
 * Fix: prefix with body to boost specificity above SF's rule, and
 * include EVERY variant SF uses (context-bar, app-nav-bar, sub-tabs,
 * console-tab, role-tab). */
body .slds-context-bar__item.slds-is-active::before,
body .slds-context-bar__item.slds-is-active::after,
body .slds-context-bar__item.slds-is-active a::before,
body .slds-context-bar__item.slds-is-active a::after,
body one-app-nav-bar-item-root.slds-is-active::before,
body one-app-nav-bar-item-root.slds-is-active::after,
body .oneConsoleTabItem.slds-active::before,
body .oneConsoleTabItem.slds-active::after,
body .oneConsoleTabItem.active::before,
body .oneConsoleTabItem.active::after,
body .slds-sub-tabs__item.slds-active::before,
body .slds-sub-tabs__item.slds-active::after,
body [role="tab"][aria-selected="true"]::before,
body [role="tab"][aria-selected="true"]::after,
body .tabHeader[aria-selected="true"]::before,
body .tabHeader[aria-selected="true"]::after {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

/* Active-tab underline via ::after — replaces the pseudo-element
 * fill with a thin accent underline that won't obscure text. */
body .slds-context-bar__item.slds-is-active::after,
body one-app-nav-bar-item-root.slds-is-active::after,
body .oneConsoleTabItem.slds-active::after,
body [role="tab"][aria-selected="true"]::after {
  content: '' !important;
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: 3px !important;
  background-color: ${c.accent} !important;
  pointer-events: none !important;
}

/* Aloha Page wrapper — SF's classic Visualforce-style container that
 * hosts Profiles, Permission Sets detail, Object Manager legacy
 * screens. Has its own white bg that sits outside .bPageBlock.
 * force-aloha-page is an LWC wrapper; .aloha-page is the inner
 * container. Both default to white; force to transparent so our
 * body bg shows through. */
force-aloha-page,
.force-aloha-page,
.aloha-page,
.alohaOnboardingPage,
.aloha-page-container,
.aloha-iframe-container,
.setupApp,
.setup-app,
.sfdcBody,
.bodyDiv,
.topBox,
.setupTabContent {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
}

force-aloha-page > *,
.aloha-page > *,
.setupApp > *,
.sfdcBody > * {
  background-color: transparent !important;
}

/* Aloha content area backgrounds — Profiles, PermSets etc. wrap their
 * content in these. The pbWrapper + related paints the light frame
 * around the .bPageBlock. */
.pbWrapper,
.pbBody_full,
.bLeft,
.bRight,
.bTitle,
.bPageTitle,
.bPageBlock.brandTertiaryBrd,
.bPageBlock.brandSecondaryBrd,
.bPageBlock.brandPrimaryBrd,
.brandSecondaryBrd,
.brandTertiaryBrd,
.brandPrimaryBrd,
.brandPrimaryBgd,
.brandSecondaryBgd,
.brandTertiaryBgd,
.brandQuaternaryBgd {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

/* iframe containers — tell browser to paint native chrome in theme mode */
iframe,
iframe.setupIframe,
iframe.apexIframe,
iframe.vfFrameId {
  color-scheme: ${isDark ? 'dark' : 'light'} !important;
  background-color: transparent !important;
}

/* ═══════════════════════════════════════════════════════════════════════
 * EXTJS 3.2.2 + Classic Aura-Aloha page coverage
 *
 * Profiles, Permission Set detail, Object Manager legacy screens etc.
 * render inside an Aura-Aloha iframe using the ~2010-era ExtJS 3.2.2
 * grid (x-grid3-* classes) on top of SF's classic Setup CSS
 * (sCSS/.../setup.css + profile.css + AuraAlohaSetupContentFrame.css).
 * These stylesheets load AFTER our content_scripts inject, so we need
 * body prefixes + very specific selectors to beat cascade order.
 *
 * DOM confirmed 2026-04-19 on /lightning/setup/EnhancedProfiles/home.
 * ════════════════════════════════════════════════════════════════════ */

/* Body + outer wrapper classes — body may have combos of:
 * hasMotif setupTab listPage ext-webkit ext-chrome ext-mac sfdcBody
 * brandQuaternaryBgr + themer effects classes. */
body.sfdcBody,
body.hasMotif,
body.setupTab,
body.listPage,
body.brandQuaternaryBgr,
body.ext-webkit,
body[class*="ext-"] {
  background-color: ${c.background} !important;
  color: ${c.textPrimary} !important;
}

/* Page title + breadcrumb area (.bPageTitle > .ptBody > .content + .links) */
body .bPageTitle,
body .bPageTitle .ptBody,
body .bPageTitle .content,
body .bPageTitle .links,
body .ptBreadcrumb {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

body .bPageTitle h1,
body .bPageTitle h2,
body .bPageTitle .pageType,
body .bPageTitle .noSecondHeader {
  color: ${c.textPrimary} !important;
}

body .bPageTitle .helpLink,
body .bPageTitle a {
  color: ${c.link || c.accent} !important;
}

/* List viewport wrappers (.individualPalette, .listViewportWrapper,
 * .listViewport, .setupBlock) */
body .individualPalette,
body .listViewportWrapper,
body .listViewport,
body .listViewport.setupBlock,
body .feedContainer,
body .feedBody,
body .listBody {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
}

/* Top nav bar + sub nav bar (.topNav.primaryPalette, .subNav with
 * .linkBar.brandSecondaryBrd). Contains: view dropdown, filter links,
 * new button, refresh button, rolodex A-Z. */
body .topNav,
body .topNav.primaryPalette,
body .subNav,
body .linkBar,
body .linkBar.brandSecondaryBrd,
body .listButtons,
body .listButtons ul,
body .listButtons li {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

body .topNav .controls,
body .topNav .title,
body .topNav .filterLinks,
body .topNav .filterLinks a,
body .topNav .divisionLabel,
body .topNav .topNavTab {
  color: ${c.textPrimary} !important;
  background-color: transparent !important;
}

body .topNav select,
body .topNav .title select,
body select.title {
  background-color: ${isDark ? c.background : c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.borderInput} !important;
  color-scheme: ${isDark ? 'dark' : 'light'} !important;
}

body .filterLinks a,
body .subNav a {
  color: ${c.link || c.accent} !important;
}

/* Rolodex (A-Z Other All letter filter across the top of list views) */
body .rolodex,
body .rolodex a,
body .rolodex .listItem,
body .rolodex .listItemPad {
  background-color: transparent !important;
  color: ${c.textSecondary} !important;
}

body .rolodex a:hover,
body .rolodex a:focus {
  background-color: ${c.surfaceHover} !important;
  color: ${c.accent} !important;
}

body .rolodex .listItemSelected {
  background-color: ${c.accentLight || c.surfaceHover} !important;
  color: ${c.accent} !important;
  border-color: ${c.accent} !important;
}

/* ExtJS 3.2.2 grid — the actual table is rendered by ExtJS, not HTML.
 * Uses .x-grid3 container with .x-grid3-header + .x-grid3-body of
 * .x-grid3-row > .x-grid3-col cells. Notoriously heavy specificity. */
body .x-grid3,
body .x-grid3-viewport,
body .x-grid3-body,
body .x-grid3-scroller,
body .x-panel,
body .x-panel-body,
body .x-panel-bwrap,
body .x-grid-panel {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

body .x-grid3-header,
body .x-grid3-header-inner,
body .x-grid3-header-offset,
body .x-grid3-hd-row,
body .x-grid3-hd,
body .x-grid3-hd-inner,
body .x-grid3-hd table,
body .x-grid3-hd thead,
body .x-grid3-hd th {
  background-color: ${c.tableHeaderBg || c.surfaceAlt} !important;
  color: ${c.tableHeaderText || c.textSecondary} !important;
  border-color: ${c.border} !important;
}

body .x-grid3-hd-inner a,
body .x-grid3-hd a {
  color: ${c.tableHeaderText || c.textSecondary} !important;
  font-weight: 600 !important;
}

body .x-grid3-row,
body .x-grid3-row td,
body .x-grid3-row-table,
body .x-grid3-cell,
body .x-grid3-cell-inner,
body .x-grid3-col,
body [class*="x-grid3-td-"],
body [class*="x-grid3-col-"] {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.borderSeparator || c.border} !important;
}

body .x-grid3-row-alt,
body .x-grid3-row-alt td {
  background-color: ${c.tableAltRow || c.surfaceAlt} !important;
}

body .x-grid3-row-over,
body .x-grid3-row-over td,
body .x-grid3-row:hover,
body .x-grid3-row:hover td {
  background-color: ${c.surfaceHover} !important;
}

body .x-grid3-row-selected,
body .x-grid3-row-selected td {
  background-color: ${c.surfaceSelection || c.accentLight} !important;
}

body .x-grid3-row a,
body .x-grid3-cell a,
body .x-grid3-col a,
body .actionLink {
  color: ${c.link || c.accent} !important;
}

/* ExtJS column resize handles + focus outline */
body .x-grid3-focus {
  outline-color: ${c.accent} !important;
}

body .x-dd-drag-proxy,
body .x-dd-drag-ghost {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
}

/* Bottom pagination bar (.bottomNav > .paginator) */
body .bottomNav,
body .paginator,
body .paginator .left,
body .paginator .right,
body .paginator .prevNextLinks,
body .paginator .prevNext,
body .paginator .selectorTarget,
body .paginator .selectCount {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
}

body .paginator a,
body .paginator .prevNext a {
  color: ${c.link || c.accent} !important;
}

body .paginator .pageInput {
  background-color: ${isDark ? c.background : c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.borderInput} !important;
}

/* Selector dropdowns shown by pagination (rows-per-page, selection) */
body .paginator .selector,
body .paginator .selector .opt,
body .paginator .selector .rpp,
body .paginator .selector .selection {
  background-color: ${c.dropdownBg || c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

body .paginator .selector .opt:hover,
body .paginator .selector .optHover {
  background-color: ${c.dropdownItemHoverBg || c.surfaceHover} !important;
  color: ${c.dropdownItemHoverText || c.textPrimary} !important;
}

/* Date picker (classic Aloha) */
body #datePicker,
body .datePicker,
body .datePicker .calBody,
body .datePicker .calDays {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

body .datePicker .dateBar,
body .datePicker .dateBar select {
  background-color: ${c.surfaceAlt} !important;
  color: ${c.textPrimary} !important;
  color-scheme: ${isDark ? 'dark' : 'light'} !important;
}

body .datePicker .calRow td {
  color: ${c.textPrimary} !important;
}

body .datePicker .calToday {
  color: ${c.accent} !important;
}

/* Modal dialog overlay (classic) */
body #massEdit,
body .overlayDialog,
body .cssDialog,
body .inlineEditDialog {
  background-color: ${c.modalBg || c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

/* Loading indicator (inline within list body) */
body .waitingSearchDiv,
body .waitingSearchDivOpacity {
  background-color: ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)'} !important;
}

body .waitingDescription {
  color: ${c.textPrimary} !important;
}

/* Setup left-nav section headers (ADMINISTRATION, PLATFORM TOOLS, etc.) —
 * scan flagged .slds-text-title_caps as 3 unstyled instances. These are
 * the uppercase category labels in the Setup tree sidebar. Default color
 * comes through as near-black on dark themes. Force textSecondary with
 * proper letter-spacing for "category header" feel. */
.slds-text-title_caps,
.slds-section-title,
.slds-section__title,
.slds-setup-nav__section-title,
.setup-tree-section-label,
.setup-nav-section-title,
setup-tree-node .slds-text-title_caps {
  color: ${c.textSecondary} !important;
  font-weight: 600 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
}

/* Generic slds-text-title (non-caps) also needs override for Dracula-
 * style dark themes where default is too muted */
.slds-text-title,
.slds-text-title_bold {
  color: ${c.textSecondary} !important;
}

/* ─── Legacy .bPageBlock pattern (Users, Profiles, Perm Sets, Roles,
 * Queues, Public Groups list screens) — the OLD old Setup UI. DOM
 * confirmed 2026-04-19: uses .bPageBlock.brandSecondaryBrd.secondaryPalette
 * wrapper, table.list with <tr class="headerRow"> directly in <tbody>
 * (NO <thead>), rows as tr.dataRow.even/.odd, cells as .dataCell, and
 * image-based checkmarks in .booleanColumn. */
.listRelatedObject,
.setupBlock,
.bPageBlock,
.bPageBlock.brandSecondaryBrd,
.bPageBlock.secondaryPalette,
.bPageBlock .pbHeader,
.bPageBlock .pbBody,
.bPageBlock .pbInnerFooter,
.bPageBlock .pbFooter,
.bPageBlock .pbFooter.secondaryPalette,
.bPageBlock .bg,
.pbHeader,
.pbInnerFooter,
.pbFooter,
.pbBottomButtons,
.pbSubsection,
.secondaryPalette {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
}

/* Header row (inside <tbody>, not <thead> — SF's legacy list pattern) */
table.list tr.headerRow,
table.list tr.headerRow th,
table.list tr.headerRow td,
.pbBody tr.headerRow,
.pbBody tr.headerRow th,
.listRelatedObject tr.headerRow,
.listRelatedObject tr.headerRow th,
tr.headerRow,
tr.headerRow th,
tr.headerRow td {
  background-color: ${c.tableHeaderBg || c.surfaceAlt} !important;
  color: ${c.tableHeaderText || c.textSecondary} !important;
  border-color: ${c.border} !important;
}

tr.headerRow th a,
tr.headerRow a,
.zen-deemphasize,
.zen-deemphasize a,
th.zen-deemphasize,
th.zen-deemphasize a {
  color: ${c.tableHeaderText || c.textSecondary} !important;
}

/* Data rows — alternating .even/.odd/.first/.last + .dataCell */
tr.dataRow,
tr.dataRow th.dataCell,
tr.dataRow td.dataCell,
tr.dataRow .dataCell,
tr.dataRow td,
tr.dataRow th {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.borderSeparator || c.border} !important;
}

tr.dataRow.odd,
tr.dataRow.odd td,
tr.dataRow.odd th,
tr.dataRow.odd .dataCell {
  background-color: ${c.tableAltRow || c.surfaceAlt} !important;
}

tr.dataRow:hover,
tr.dataRow:hover td,
tr.dataRow:hover th,
tr.dataRow:hover .dataCell {
  background-color: ${c.surfaceHover} !important;
}

tr.dataRow a,
.dataCell a,
.actionColumn a,
.actionLink {
  color: ${c.link || c.accent} !important;
}

td.actionColumn,
th.actionColumn {
  background-color: inherit !important;
}

/* Image-based "Active" checkmark column — the gif is a dark blue
 * checkmark on transparent; invert to pure white on dark themes so
 * it's visible against our dark rows. Light themes keep the original. */
td.booleanColumn img.checkImg,
td.booleanColumn img[src*="checkbox_"],
img.checkImg {
  filter: ${isDark ? 'brightness(0) invert(1) opacity(0.85)' : 'none'} !important;
}

/* ─── Base ───────────────────────────────────────────────────────────────── */

html,
body,
.desktop {
  background-color: ${c.background} !important;
  color: ${c.textPrimary} !important;${fx && fx.gridOverlay ? `
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 39px,
      rgba(${hexToRgb(c.accent)}, 0.02) 39px,
      rgba(${hexToRgb(c.accent)}, 0.02) 40px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 39px,
      rgba(${hexToRgb(c.accent)}, 0.02) 39px,
      rgba(${hexToRgb(c.accent)}, 0.02) 40px
    ) !important;
  background-attachment: fixed !important;` : ''}
}

/* ─── Global Header ──────────────────────────────────────────────────────
 * Light themes with globalHeaderWhite force a white header so the SF logo
 * and slate icons stay legible.
 * Dark themes paint the header to match the nav band underneath — avoids
 * the jarring white strip above an otherwise dark app.
 * Light themes with globalHeaderWhite=false inherit SF's default white.
 */
${c.globalHeaderWhite && !isDark ? `
.slds-global-header,
.slds-global-header_container,
.forceSearchDesktopHeader {
  background-color: #ffffff !important;
  color: #2d2d2d !important;
}` : ''}

${isDark ? `
.slds-global-header,
.slds-global-header_container,
.forceSearchDesktopHeader {
  background-color: ${c.nav} !important;
  color: ${c.navText} !important;
}` : ''}

${isDark ? `
/* Global header controls (DARK themes only) — hamburger, env switcher, edition
 * badges, system message bar. On dark themes the global header is painted
 * c.nav; icons and text need c.navIcon / c.navText to stay visible.
 * On LIGHT themes the global header is white (SF default) and SF's own slate
 * icon colors work fine — no override needed, and overriding with c.navIcon
 * (often white on pink/dark nav themes) would render icons invisible on the
 * white header. */
header#oneHeader button,
header#oneHeader .slds-button,
.slds-global-header_container button,
.slds-global-header_container .slds-button {
  color: ${c.navIcon} !important;
}

header#oneHeader button svg,
header#oneHeader .slds-button svg,
header#oneHeader .slds-icon,
header#oneHeader .slds-button__icon,
.slds-global-header_container svg,
.slds-global-header_container .slds-icon,
.slds-global-header_container .slds-button__icon {
  fill: ${c.navIcon} !important;
  color: ${c.navIcon} !important;
}

header#oneHeader .slds-badge,
header#oneHeader .slds-badge_inverse,
header#oneHeader .slds-badge--inverse,
header#oneHeader .slds-badge_lightest,
.slds-global-header_container .slds-badge,
.slds-global-header_container .slds-badge_inverse,
.slds-global-header_container .slds-badge--inverse,
.slds-global-header_container .slds-badge_lightest,
header#oneHeader .slds-pill,
.slds-global-header_container .slds-pill {
  background-color: ${c.accentLight} !important;
  color: ${c.accent} !important;
  border: 1px solid ${c.navBorder} !important;
}

header#oneHeader .oneSystemMessage,
header#oneHeader .oneSystemMessage.slds-color__background_gray-1,
.slds-global-header_container .oneSystemMessage {
  background-color: ${c.surfaceHighlight || c.accentLight} !important;
  color: ${c.navText} !important;
  border-bottom: 1px solid ${c.navBorder} !important;
}` : ''}

${isDark || !c.globalHeaderWhite ? `
/* Search box in header — themed for dark or non-white-header themes */
.slds-global-header .slds-input,
.slds-global-header input[type="search"],
.forceSearchDesktopHeader input,
.slds-global-header .slds-form-element__control input {
  background-color: ${c.searchBg || c.surface} !important;
  color: ${c.searchText || c.textPrimary} !important;
  border-color: ${c.searchBorder || c.border} !important;
  border-radius: 6px !important;${fx && fx.glowOnHover ? `
  box-shadow: 0 0 6px ${c.accentLight} !important;` : ''}
}

.slds-global-header .slds-input::placeholder,
.slds-global-header input::placeholder {
  color: ${c.searchPlaceholder || c.textPlaceholder} !important;
}

.slds-global-header .slds-input:focus,
.slds-global-header input:focus {
  border-color: ${c.searchFocusBorder || c.accent} !important;
  box-shadow: ${c.searchFocusShadow || c.focusRing} !important;
}` : ''}

/* ─── Navigation ─────────────────────────────────────────────────────────── */

.oneGlobalNav,
one-app-nav-bar,
.navexConsoleTabBar,
[class*="globalNavigation"],
.slds-context-bar {
  background-color: ${c.nav} !important;
  border-bottom: 1px solid ${c.navBorder} !important;${fx && fx.navBoxShadow ? `
  box-shadow: ${fx.navBoxShadow} !important;` : ''}
}

.slds-context-bar__item,
.navexConsoleTabItem,
.oneConsoleTabItem {
  color: ${c.navText} !important;
}

.slds-context-bar__item:hover,
.navexConsoleTabItem:hover {
  background-color: ${c.navHover} !important;${c.navActiveText !== c.navText ? `
  color: ${c.navActiveText} !important;` : ''}
}

/* Active nav tab — paint ONLY the outer list item.
 * SF stacks three possible layers on an active tab (.slds-context-bar__item,
 * one-app-nav-bar-item-root wrapper, inner <a>). Painting more than one layer
 * produces a "chip inside a bubble" double-highlight. Keep the background on
 * the outer <li> and null every inner layer, including SF's own SLDS tokens,
 * so the highlight reads as ONE pill. */
.slds-context-bar__item.slds-is-active,
.slds-context-bar__item.slds-is-active.slds-is-unsaved,
.navexConsoleTabItem.active {
  background-color: ${c.navActive} !important;
  border-bottom-color: ${c.navActiveBorder} !important;${fx && fx.navActiveBoxShadow ? `
  box-shadow: ${fx.navActiveBoxShadow} !important;` : ''}
  color: ${c.navActiveText} !important;
}

/* Kill the underline pseudo-elements on active tab */
.slds-context-bar__item.slds-is-active::before,
.slds-context-bar__item.slds-is-active::after,
one-app-nav-bar-item-root.slds-is-active::before,
one-app-nav-bar-item-root.slds-is-active::after,
.slds-context-bar__item.slds-is-active a::before,
.slds-context-bar__item.slds-is-active a::after,
one-app-nav-bar-item-root.slds-is-active a::before,
one-app-nav-bar-item-root.slds-is-active a::after {
  background-color: ${c.navActiveBorder} !important;
  background: ${c.navActiveBorder} !important;
  border-color: ${c.navActiveBorder} !important;
}

/* Null ALL inner active-tab backgrounds — prevents double-chip visual.
 * Also override SLDS/LWC tokens SF uses internally for the active state,
 * so customer orgs on SLDS 2 (Cosmos) don't re-introduce the inner pill. */
.slds-context-bar__item.slds-is-active one-app-nav-bar-item-root,
one-app-nav-bar-item-root.slds-is-active,
one-app-nav-bar-item-root.navItem.slds-is-active,
.slds-context-bar__item.slds-is-active .slds-context-bar__label-action,
.slds-context-bar__item.slds-is-active a,
one-app-nav-bar-item-root.slds-is-active a,
one-app-nav-bar-item-root.slds-is-active a.dndItem,
one-app-nav-bar-item-root.slds-is-active .slds-context-bar__label-action,
.slds-context-bar a[aria-current="page"] {
  color: ${c.navActiveText} !important;
  background-color: transparent !important;
  --slds-c-context-bar-item-color-background-active: transparent !important;
  --lwc-brandNavigationColorBackgroundActive: transparent !important;
}

/* Nav text and icons */
.slds-context-bar__label-action,
.slds-context-bar__icon-action,
.slds-context-bar .slds-icon {
  color: ${c.navIcon} !important;
  fill: ${c.navIcon} !important;
}

/* App launcher button */
.slds-context-bar__app-name,
.appLauncherButton {
  color: ${c.navAppName} !important;
  border-right: 1px solid ${c.navAppBorder} !important;${fx ? `
  text-shadow: 0 0 8px ${c.accentLight} !important;` : ''}
}

/* App launcher waffle dots — target individual dots, not the container */
.slds-icon-waffle .slds-r1,
.slds-icon-waffle .slds-r2,
.slds-icon-waffle .slds-r3,
.slds-icon-waffle .slds-r4,
.slds-icon-waffle .slds-r5,
.slds-icon-waffle .slds-r6,
.slds-icon-waffle .slds-r7,
.slds-icon-waffle .slds-r8,
.slds-icon-waffle .slds-r9 {
  background-color: ${c.navWaffleDot} !important;
}

/* ─── Main Content ───────────────────────────────────────────────────────── */

.oneContent,
.oneWorkspace,
.flexipageBody,
.onesetupSetupLayout,
.setupcontent {
  background-color: ${fx && fx.gridOverlay ? 'transparent' : c.background} !important;
}

/* ─── Page Headers ───────────────────────────────────────────────────────── */

.slds-page-header,
.forceListViewManager .listViewManager,
[class*="pageHeader"] {
  background-color: ${c.surface} !important;
  border-bottom: 1px solid ${c.border} !important;
  box-shadow: ${isDark ? '0 1px 0 rgba(255, 255, 255, 0.04)' : '0 1px 3px rgba(0, 0, 0, 0.06)'} !important;${fx ? `
  box-shadow: 0 1px 20px rgba(${hexToRgb(c.accent)}, 0.06) !important;` : ''}
}

.slds-page-header__title,
.slds-page-header__name-title {
  color: ${c.textPrimary} !important;${fx ? `
  text-shadow: 0 0 12px rgba(${hexToRgb(c.accent)}, 0.3) !important;` : ''}
}

.slds-page-header__meta-text {
  color: ${c.textSecondary} !important;
}

/* ─── Cards ──────────────────────────────────────────────────────────────── */

/* Cards — border only on .slds-card itself, not inner body/footer */
.slds-card,
.forceRecordCard {
  background-color: ${c.surface} !important;
  border-color: ${c.border} !important;
  box-shadow: ${isDark ? '0 1px 4px rgba(0, 0, 0, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.06)'} !important;${isDark ? `
  color: ${c.textPrimary} !important;` : ''}${fx ? `
  box-shadow: 0 0 20px rgba(${hexToRgb(c.accent)}, 0.06), inset 0 0 40px rgba(0, 0, 0, 0.2) !important;` : ''}
}

.slds-card__body,
.slds-card__footer {
  background-color: ${c.surface} !important;${isDark ? `
  color: ${c.textPrimary} !important;` : ''}
}
${fx ? `
.slds-card:hover {
  border-color: ${fx.cardHoverBorder} !important;
  box-shadow: ${fx.cardHoverShadow} !important;
}` : ''}

.slds-card__header {
  background-color: ${c.surface} !important;
  border-bottom-color: ${isDark ? 'rgba(255,255,255,0.06)' : c.border} !important;
}

/* Card + page headings — force textPrimary so headings are always the
 * most readable text. Without this, SF defaults route headings through
 * --lwc-colorTextLabel which for dark themes (Dracula in particular:
 * #6272a4 comment-blue) is intentionally muted and lands too
 * low-contrast for a title. Applies to: card headers, page headings
 * (Seller Home, dashboard titles), section headings. */
.slds-card__header-title,
.slds-card__header-title a,
.slds-card__header-link,
.slds-card__header .slds-text-heading_small,
.slds-card__header .slds-text-heading_medium,
.slds-card__header .slds-text-heading_large,
.slds-text-heading_large,
.slds-text-heading_medium,
.slds-text-heading--large,
.slds-text-heading--medium {
  color: ${c.textPrimary} !important;
}

/* ─── Buttons ────────────────────────────────────────────────────────────── */

.slds-button_brand,
.slds-button--brand {
  background-color: ${c.buttonBrandBg} !important;
  border: 1px solid ${c.buttonBrandBorder} !important;
  color: ${c.buttonBrandText} !important;${fx ? `
  text-shadow: 0 0 8px rgba(${hexToRgb(c.accent)}, 0.5) !important;
  box-shadow: 0 0 10px rgba(${hexToRgb(c.accent)}, 0.15), inset 0 0 10px rgba(${hexToRgb(c.accent)}, 0.05) !important;` : ''}
}

.slds-button_brand:hover,
.slds-button--brand:hover {
  background-color: ${c.buttonBrandHover} !important;
  border-color: ${c.buttonBrandHover} !important;${fx ? `
  box-shadow: 0 0 20px rgba(${hexToRgb(c.accent)}, 0.3), inset 0 0 20px rgba(${hexToRgb(c.accent)}, 0.1) !important;` : ''}
}

.slds-button_neutral,
.slds-button--neutral {
  background-color: ${c.buttonNeutralBg} !important;
  border-color: ${c.buttonNeutralBorder} !important;
  color: ${c.buttonNeutralText} !important;
}

.slds-button_neutral:hover,
.slds-button--neutral:hover {
  background-color: ${c.buttonNeutralHover} !important;
}

/* ─── Form Elements ──────────────────────────────────────────────────────── */

.slds-input,
.slds-textarea,
.slds-select,
.slds-combobox__form-element,
.slds-has-input-focus .slds-input {
  background-color: ${isDark ? c.background : c.surface} !important;
  border-color: ${c.borderInput} !important;
  color: ${c.textPrimary} !important;
}

.slds-input:focus,
.slds-textarea:focus,
.slds-select:focus {
  border-color: ${c.accent} !important;
  box-shadow: ${isDark
    ? `0 0 0 3px rgba(${hexToRgb(c.accent)}, 0.2)${fx ? `, 0 0 12px rgba(${hexToRgb(c.accent)}, 0.15)` : ''}`
    : `0 0 0 3px rgba(${hexToRgb(c.accent)}, 0.2)`
  } !important;
  outline: none !important;
}

.slds-input::placeholder,
.slds-textarea::placeholder {
  color: ${c.textPlaceholder} !important;
}

.slds-form-element__label {
  color: ${c.textSecondary} !important;
  font-weight: 500 !important;
}

/* ─── Tables ─────────────────────────────────────────────────────────────── */

.slds-table {
  background-color: ${c.surface} !important;
  border: 1px solid ${c.border} !important;
}

.slds-table thead th,
.slds-table thead td {
  background-color: ${c.tableHeaderBg} !important;
  color: ${c.tableHeaderText} !important;
  border-bottom: ${isDark ? '2px' : '2px'} solid ${c.border} !important;
  font-weight: 600 !important;${fx ? `
  text-transform: uppercase !important;
  font-size: 11px !important;
  letter-spacing: 0.08em !important;
  text-shadow: 0 0 8px rgba(${hexToRgb(c.accent)}, 0.4) !important;` : ''}
}

.slds-table tbody tr {
  background-color: ${c.surface} !important;
  border-bottom: 1px solid ${c.tableBorderRow} !important;
  color: ${c.textPrimary} !important;
}

.slds-table tbody tr:nth-child(even) {
  background-color: ${c.tableAltRow} !important;
}

.slds-table tbody tr:hover {
  background-color: ${c.tableHoverRow} !important;${fx ? `
  box-shadow: inset 0 0 20px rgba(${hexToRgb(c.accent)}, 0.04) !important;` : ''}
}

.slds-table td,
.slds-table th {
  color: ${c.textPrimary} !important;
  border-right: 1px solid ${c.tableColBorder} !important;
}

/* ─── Modals ─────────────────────────────────────────────────────────────── */

.slds-modal__container {
  background-color: ${c.modalBg} !important;
  border: 1px solid ${c.border} !important;
  box-shadow: ${c.modalShadow} !important;
}

.slds-modal__header {
  background-color: ${c.modalHeaderBg} !important;
  border-bottom: 1px solid ${c.border} !important;
  color: ${c.textPrimary} !important;
}

.slds-modal__content {
  background-color: ${c.modalBg} !important;
  color: ${c.textPrimary} !important;
}

.slds-modal__footer {
  background-color: ${c.modalFooterBg} !important;
  border-top: 1px solid ${c.border} !important;
}

.slds-backdrop {
  background-color: ${c.modalBackdrop} !important;
}

/* App Launcher — the Aura-hosted modal wraps a pure-LWC content tree
 * in a standard .slds-modal__container painted white. That wide white
 * card around the app grid is what users read as a "weird backdrop
 * layer." For the app launcher specifically, null the outer modal
 * chrome (container + header) so the LWC content reads as a themed
 * fullscreen page rather than a card-inside-a-card. :has() scopes
 * this to the app-launcher modal only — standard modals (New Contact,
 * etc.) keep their card appearance. */
.slds-modal__container:has(one-app-launcher-modal),
.slds-modal:has(one-app-launcher-modal) .slds-modal__container {
  background-color: transparent !important;
  border-color: transparent !important;
}

.slds-modal__container:has(one-app-launcher-modal) .slds-modal__header,
.slds-modal:has(one-app-launcher-modal) .slds-modal__header {
  background-color: transparent !important;
  border-color: transparent !important;
}

/* LWC root inside the launcher modal — paint with theme background so
 * the app grid sits on a themed surface instead of SF default white. */
one-app-launcher-modal {
  background-color: ${c.background} !important;
}

one-app-launcher-modal .modal-container,
one-app-launcher-modal .slds-modal__container {
  background-color: ${c.modalBg} !important;
  max-height: 90vh !important;
  height: auto !important;
}

one-app-launcher-modal .modal-body,
one-app-launcher-modal .slds-modal__content {
  background-color: ${c.modalBg} !important;
  max-height: none !important;
}

one-app-launcher-modal .modal-header,
one-app-launcher-modal .slds-modal__header {
  background-color: ${c.modalHeaderBg} !important;
  position: relative !important;
}

/* App Launcher backdrop — use the theme's standard modal backdrop tint */
one-app-launcher-modal + .slds-backdrop,
one-app-launcher-modal ~ .slds-backdrop {
  background-color: ${c.modalBackdrop} !important;
}

/* App Launcher tiles — the individual app cards (Sales, Service, etc.).
 * Scan 2026-04-19 showed 21 tile-body instances partial + 21 tile-figure
 * + 21 lightning-avatar unstyled = tile body/figure defaulted to white.
 * Theme each tile as a card with surface bg, border, hover state. */
one-app-launcher-app-tile,
one-app-launcher-app-tile .slds-app-launcher__tile,
body .slds-app-launcher__tile {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
  border: 1px solid ${c.border} !important;
  border-radius: 4px !important;
}

one-app-launcher-app-tile .slds-app-launcher__tile-body,
body .slds-app-launcher__tile-body {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
}

one-app-launcher-app-tile .slds-app-launcher__tile-figure,
body .slds-app-launcher__tile-figure {
  background-color: ${c.surfaceAlt} !important;
}

one-app-launcher-app-tile .appTileTitle,
one-app-launcher-app-tile a,
one-app-launcher-app-tile b,
body .slds-app-launcher__tile-body a,
body .slds-app-launcher__tile-body b {
  color: ${c.accent} !important;
  font-weight: 600 !important;
}

one-app-launcher-app-tile .slds-text-body_small,
one-app-launcher-app-tile p,
body .slds-app-launcher__tile-body p,
body .slds-app-launcher__tile-body .slds-text-body_small {
  color: ${c.textSecondary} !important;
}

one-app-launcher-app-tile lightning-avatar,
one-app-launcher-app-tile .slds-avatar,
body .slds-app-launcher__tile .slds-avatar {
  background-color: transparent !important;
  border-color: transparent !important;
}

one-app-launcher-app-tile:hover,
body .slds-app-launcher__tile:hover {
  background-color: ${c.surfaceHover} !important;
  border-color: ${c.accent} !important;
  box-shadow: 0 2px 8px ${c.accentLight || 'rgba(0,0,0,0.2)'} !important;
}

/* App Launcher accordion section headers ("All Apps", "All Items") */
one-app-launcher-modal .slds-accordion__summary,
one-app-launcher-modal .slds-accordion__summary-heading,
one-app-launcher-modal lightning-accordion-section {
  background-color: transparent !important;
  color: ${c.textPrimary} !important;
  font-weight: 600 !important;
}

/* App Launcher search bar */
one-app-launcher-search-bar,
one-app-launcher-search-bar input,
one-app-launcher-search-bar .slds-input {
  background-color: ${isDark ? c.background : c.surface} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.borderInput} !important;
}

one-app-launcher-search-bar input::placeholder {
  color: ${c.textPlaceholder} !important;
}

/* App Launcher header + Visit AppExchange button */
one-app-launcher-header,
one-app-launcher-header h2,
one-app-launcher-modal h2 {
  color: ${c.textPrimary} !important;
}

one-app-launcher-modal a[href*="appexchange"],
one-app-launcher-modal .slds-button_neutral {
  color: ${c.accent} !important;
  border-color: ${c.accent} !important;
}

/* ─── Dropdowns & Popovers ───────────────────────────────────────────────── */

.slds-dropdown,
.slds-dropdown__list {
  background-color: ${c.dropdownBg} !important;
  border: 1px solid ${c.border} !important;
  box-shadow: ${isDark ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 4px 16px rgba(0, 0, 0, 0.10)'} !important;${fx ? `
  box-shadow: 0 0 30px rgba(${hexToRgb(c.accent)}, 0.12), 0 8px 24px rgba(0, 0, 0, 0.6) !important;` : ''}
}

.slds-dropdown__item > a,
.slds-dropdown__item > span {
  color: ${c.textPrimary} !important;
}

.slds-dropdown__item:hover > a,
.slds-dropdown__item:hover > span,
.slds-dropdown__item:focus > a {
  background-color: ${c.dropdownItemHoverBg} !important;
  color: ${c.dropdownItemHoverText} !important;
}

.slds-popover {
  background-color: ${c.dropdownBg} !important;
  border: 1px solid ${c.border} !important;
  box-shadow: ${isDark ? '0 8px 24px rgba(0, 0, 0, 0.45)' : '0 4px 16px rgba(0, 0, 0, 0.10)'} !important;
  color: ${c.textPrimary} !important;
}

/* ─── Tabs ───────────────────────────────────────────────────────────────── */

.slds-tabs_default__nav,
.slds-tabs--default__nav {
  border-bottom: 2px solid ${c.tabNavBorder} !important;
  background-color: transparent !important;
}

.slds-tabs_default__item,
.slds-tabs--default__item {
  color: ${c.tabInactiveColor} !important;
}

.slds-tabs_default__item.slds-is-active,
.slds-tabs--default__item.slds-active {
  color: ${c.tabActiveColor} !important;
  border-bottom-color: ${c.tabActiveBorder} !important;${fx ? `
  text-shadow: 0 0 10px rgba(${hexToRgb(c.accent)}, 0.5) !important;` : ''}
}

/* Override SF's ::after pseudo-element tab indicator */
.slds-tabs_default__item.slds-is-active::after,
.slds-tabs--default__item.slds-active::after {
  background-color: ${c.tabActiveBorder} !important;
}

.slds-tabs_default__content,
.slds-tabs--default__content {
  background-color: ${c.tabContentBg} !important;
}

/* ─── Pills & Badges ─────────────────────────────────────────────────────── */

.slds-pill {
  background-color: ${c.pillBg} !important;
  border: 1px solid ${c.pillBorder} !important;
  color: ${c.pillText} !important;
}

.slds-badge {
  background-color: ${c.badgeBg} !important;
  color: ${c.badgeText} !important;${c.badgeBorder !== 'none' ? `
  border: ${c.badgeBorder} !important;` : ''}${fx ? `
  text-shadow: 0 0 6px rgba(${hexToRgb(c.accent)}, 0.5) !important;` : ''}
}

/* ─── Scrollbars ─────────────────────────────────────────────────────────── */

::-webkit-scrollbar {
  width: ${fx ? '6px' : '8px'} !important;
  height: ${fx ? '6px' : '8px'} !important;
}

::-webkit-scrollbar-track {
  background: ${c.scrollTrack} !important;${fx ? `
  border-left: 1px solid rgba(${hexToRgb(c.accent)}, 0.06) !important;` : ''}
}

::-webkit-scrollbar-thumb {
  background: ${c.scrollThumb} !important;
  border-radius: ${fx ? '3px' : '4px'} !important;
}

::-webkit-scrollbar-thumb:hover {
  background: ${c.scrollThumbHover} !important;${fx && fx.glowOnHover ? `
  box-shadow: 0 0 6px rgba(${hexToRgb(c.accent)}, 0.3) !important;` : ''}
}

/* ─── Record Detail ──────────────────────────────────────────────────────── */

.forceOutputField,
.slds-form-element__static {
  color: ${c.textPrimary} !important;
}

/* ─── Sidebar / Panel ────────────────────────────────────────────────────── */

.slds-panel,
.slds-split-view_container {
  background-color: ${c.panelBg} !important;
  border-right: 1px solid ${c.panelBorder} !important;
}

/* ─── Links ──────────────────────────────────────────────────────────────── */

a,
.slds-truncate a,
.forceOutputLookup a {
  color: ${c.link} !important;${fx && fx.linkTextShadow ? `
  text-shadow: ${fx.linkTextShadow} !important;` : ''}
}

a:hover {
  color: ${c.linkHover} !important;${fx && fx.linkHoverTextShadow ? `
  text-shadow: ${fx.linkHoverTextShadow} !important;` : ''}
}

/* ─── Setup Pages ────────────────────────────────────────────────────────── */

.setupcontent,
.slds-setup-assistant,
.setup-page,
[class*="setupLayout"],
.onesetupSetupLayout,
.setupTabContent,
.slds-setup-summary,
.forceSetupDesktop,
.bodyDiv,
.setupHasMenu,
.contentRegion,
.contentWrapper,
.individualPalette,
.bPageBlock,
.pbBody,
.pbSubsection {
  background-color: ${c.background} !important;
  color: ${c.textPrimary} !important;
}

/* Legacy Visualforce-backed Setup pages: these load in iframes from
   *.visualforce.com and have a totally different DOM (no Lightning shell).
   Paint the html/body of those iframes directly so the user doesn't see a
   bright white block embedded inside their themed Setup page. */
html.setupBody,
body.setupBody,
body.setupTab,
body[class*="setup"],
.setupHelpContent,
.setupBodyDiv {
  background-color: ${c.background} !important;
  color: ${c.textPrimary} !important;
}

.setupBody a,
.setupBody .topNav,
.setupBody .secondaryPalette {
  color: ${c.textPrimary} !important;
}

.setupBody table,
.setupBody .list,
.setupBody .pbBody,
.setupBody .pbSubsection,
.setupBody .pbHeader {
  background-color: ${c.surface} !important;
  border-color: ${c.border} !important;
  color: ${c.textPrimary} !important;
}

/* ─── Reports ────────────────────────────────────────────────────────────── */

.report-container,
.reportOutput,
[class*="reportPage"],
.slds-report,
.forceReportOutput,
.reportHeader {
  background-color: ${c.background} !important;
  color: ${c.textPrimary} !important;
}

/* ─── Console / Service Console ──────────────────────────────────────────── */

.navexConsoleContent,
.workspaceManager,
.split-view,
.slds-split-view,
[class*="console"] {
  background-color: ${c.background} !important;
  color: ${c.textPrimary} !important;
}

/* ─── Record Page Header / Highlights ────────────────────────────────────── */

.highlights,
.forceHighlightsStencilDesktop,
.forceRecordLayout,
.forceHighlightsPanel,
.slds-page-header--record-home,
.slds-page-header_record-home,
.flexipageHeader,
.record-page-decorator,
.recordHomeTemplate,
.forceHighlightsLayout {
  background-color: ${c.background} !important;
  color: ${c.textPrimary} !important;
  border-color: ${c.border} !important;
  box-shadow: ${isDark ? '0 1px 3px rgba(0, 0, 0, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.06)'} !important;
}

/* Record page full body background */
.flexipagePage,
.flexipage-template,
.uiTabBar + .tabContent,
.forceRecordFlexiPage {
  background-color: ${c.background} !important;
}

/* ─── Path / Stage Path ─────────────────────────────────────────────────── */

/* Path structural containers — recolor, keep structure */
.slds-path,
.slds-path__scroller,
.slds-path__track,
.slds-path__wrap,
.slds-path__coach,
.slds-path__nav,
.slds-path__scroller-container,
.slds-path__scroller_inner,
.slds-path__scroll-controls,
.slds-grid.slds-path__track,
.pathAssistantContainer,
.forcePathAssistant,
lightning-sales-path,
records-lwc-highlights-panel,
.runtime_sales_pathassistantPathAssistantTabSet,
.runtime_sales_pathassistantPathAssistantHeader,
.uiScroller.slds-path__scroller,
[class*="pathAssistant"],
[class*="PathAssistant"],
[class*="salesPath"],
[class*="SalesPath"] {
  background-color: ${c.surface} !important;
  color: ${c.textPrimary} !important;
}

/* Path scroller inner wrapper */
.slds-path__scroller .scroller,
.slds-path__scroller .slds-path__scroller_inner {
  background-color: ${c.surface} !important;
}

/* The slds-card wrapping the path — recolor, keep structure */
body .pathOriginal .slds-card,
body .pathOriginal .slds-card__body,
body .pathOriginal .slds-card__body_inner,
body .runtime_sales_pathassistantPathAssistant .slds-card,
body .runtime_sales_pathassistantPathAssistant .slds-card__body,
body .runtime_sales_pathassistantPathAssistant .slds-card__body_inner,
body .runtime_sales_pathassistantPathAssistant > article,
body .forcePathAssistant .slds-card,
body .forcePathAssistant .slds-card__body,
body .forcePathAssistant .slds-card__body_inner {
  background-color: ${c.surface} !important;
  border-color: ${c.border} !important;
  box-shadow: ${isDark ? '0 1px 4px rgba(0, 0, 0, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.06)'} !important;
}

/* Path items — boosted specificity with body prefix */
body .slds-path__item,
body .slds-path__item .slds-path__link,
body .slds-path__item a.slds-path__link {
  background-color: ${c.surfaceAlt} !important;
}

body .slds-path__item.slds-is-complete,
body .slds-path__item.slds-is-complete .slds-path__link,
body .slds-path__item.slds-is-complete a.slds-path__link {
  background-color: ${c.accent} !important;
}

body .slds-path__item.slds-is-current,
body .slds-path__item.slds-is-current .slds-path__link,
body .slds-path__item.slds-is-current a.slds-path__link {
  background-color: ${c.accent} !important;
}

body .slds-path__item.slds-is-incomplete,
body .slds-path__item.slds-is-incomplete .slds-path__link,
body .slds-path__item.slds-is-incomplete a.slds-path__link {
  background-color: ${c.surfaceAlt} !important;
}

/* Path chevrons — SLDS uses skewed ::before/::after with background, NOT border triangles */
/* Each state must set background on BOTH the item AND its pseudo-elements */

/* Incomplete (default) — item + pseudo-elements */
body .slds-path__item::before,
body .slds-path__item::after {
  background: ${c.surfaceAlt} !important;
}

body .slds-path__item.slds-is-incomplete::before,
body .slds-path__item.slds-is-incomplete::after {
  background: ${c.surfaceAlt} !important;
}

/* Complete */
body .slds-path__item.slds-is-complete::before,
body .slds-path__item.slds-is-complete::after {
  background: ${c.accent} !important;
}

/* Current */
body .slds-path__item.slds-is-current::before,
body .slds-path__item.slds-is-current::after {
  background-color: ${c.accent} !important;
  background-image: none !important;
}

/* Active / selected — MUST come after incomplete to win specificity */
/* Handles both .slds-is-active alone AND .slds-is-incomplete.slds-is-active */
body .slds-path__item.slds-is-active,
body .slds-path__item.slds-is-active .slds-path__link,
body .slds-path__item.slds-is-active a.slds-path__link,
body .slds-path__item.slds-is-incomplete.slds-is-active,
body .slds-path__item.slds-is-incomplete.slds-is-active .slds-path__link,
body .slds-path__item.slds-is-incomplete.slds-is-active a.slds-path__link,
body .slds-path__item [aria-selected="true"] {
  background-color: ${c.accentHover} !important;
  color: ${c.buttonBrandText} !important;
}

body .slds-path__item.slds-is-active::before,
body .slds-path__item.slds-is-active::after,
body .slds-path__item.slds-is-incomplete.slds-is-active::before,
body .slds-path__item.slds-is-incomplete.slds-is-active::after {
  background: ${c.accentHover} !important;
}

/* Hover — incomplete items */
.slds-path__item:hover,
.slds-path__item:hover .slds-path__link {
  background-color: ${c.surfaceHover} !important;
}

.slds-path__item:hover::before,
.slds-path__item:hover::after {
  background: ${c.surfaceHover} !important;
}

/* Hover — complete/current items */
.slds-path__item.slds-is-complete:hover,
.slds-path__item.slds-is-complete:hover .slds-path__link,
.slds-path__item.slds-is-current:hover,
.slds-path__item.slds-is-current:hover .slds-path__link {
  background-color: ${c.accentHover} !important;
}

.slds-path__item.slds-is-complete:hover::before,
.slds-path__item.slds-is-complete:hover::after,
.slds-path__item.slds-is-current:hover::before,
.slds-path__item.slds-is-current:hover::after {
  background: ${c.accentHover} !important;
}

/* Won (Closed Won) */
body .slds-path__item.slds-is-won,
body .slds-path__item.slds-is-won .slds-path__link,
body .slds-path__item.slds-is-won a.slds-path__link {
  background-color: ${c.success} !important;
}

body .slds-path__item.slds-is-won::before,
body .slds-path__item.slds-is-won::after {
  background: ${c.success} !important;
}

body .slds-path__item.slds-is-won .slds-path__title {
  color: #ffffff !important;
}

/* Lost (Closed Lost) */
body .slds-path__item.slds-is-lost,
body .slds-path__item.slds-is-lost .slds-path__link,
body .slds-path__item.slds-is-lost a.slds-path__link {
  background-color: ${c.error} !important;
}

body .slds-path__item.slds-is-lost::before,
body .slds-path__item.slds-is-lost::after {
  background: ${c.error} !important;
}

body .slds-path__item.slds-is-lost .slds-path__title {
  color: #ffffff !important;
}

/* Path text colors */
.slds-path__title {
  color: ${c.textPrimary} !important;
}

.slds-path__item.slds-is-complete .slds-path__title,
.slds-path__item.slds-is-current .slds-path__title,
.slds-path__item.slds-is-active .slds-path__title {
  color: ${c.buttonBrandText} !important;
}

/* Path stage icon (checkmark on completed) */
.slds-path__stage {
  color: ${c.buttonBrandText} !important;
}

/* ─── Related List Cards (right sidebar) ─────────────────────────────────── */

/* Related list containers — background only, cards handle their own borders */
.forceRelatedListContainer,
.forceRelatedListSingleContainer {
  background-color: ${c.background} !important;
}

/* Related list inner headers — no extra borders */
.slds-page-header_joined,
.slds-page-header_bleed,
.slds-page-header.slds-page-header_joined {
  border-color: transparent !important;
  box-shadow: none !important;
}

/* ─── Profile Icon / Global Actions (top right) ─────────────────────────── */
/* Keep white header's action icons visible — don't override their colors */

.slds-global-actions__item > button,
.slds-global-actions__item > span,
.slds-global-actions__item > div > button {
  background-color: transparent !important;
}

${c.globalHeaderWhite && !isDark ? `
/* Light white header: slate icons for legibility on white */
.slds-global-header .slds-global-header__icon,
.slds-global-header .slds-button__icon,
.slds-global-header .forceIcon .slds-icon,
.slds-global-actions .slds-icon {
  fill: #54698d !important;
  color: #54698d !important;
}` : ''}

${isDark ? `
/* Dark header: icons match theme navIcon for visibility on dark surfaces */
.slds-global-header .slds-global-header__icon,
.slds-global-header .slds-button__icon,
.slds-global-header .forceIcon .slds-icon,
.slds-global-actions .slds-icon {
  fill: ${c.navIcon} !important;
  color: ${c.navIcon} !important;
}` : ''}

/* Profile avatar container — keep structure, just hide border visually */
.slds-avatar,
.forceSocialPhoto,
.photoContainer {
  border-color: transparent !important;
}
` + _generateTypographyCSS(typo);
}

/**
 * Convert hex color to "R, G, B" string for use in rgba().
 * Returns a fallback string if parsing fails.
 * @param {string} hex
 * @returns {string}
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '74, 111, 165';
  // Strip leading # and handle short hex
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '74, 111, 165';
}

// ────────────────────────────────────────────────────────────────────────────
// Favicon rendering — folded into the theme engine so a theme is one config
// that produces one pair of artifacts: { css, faviconSvg }. Single source of
// truth for icon library + SVG builder; consumed by renderTheme() below,
// by Studio (options.js) for live preview, and by the CI preset rebuild.
//
// Favicon glyphs render at 16px in browser tabs — they need to read as bold
// solid marks. No opacity on the paths; transparency is owned by the
// shape=none background, not the glyph.
// ────────────────────────────────────────────────────────────────────────────

const FAVICON_ICONS = [
  { id: 'connectry', label: 'Connectry', svg: '<circle cx="8" cy="16" r="4" fill="white"/><line x1="12" y1="16" x2="20" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="16" r="4" fill="white"/>' },
  { id: 'cloud',     label: 'Cloud',     svg: '<circle cx="10" cy="19" r="5" fill="white"/><circle cx="16" cy="14" r="6" fill="white"/><circle cx="22" cy="19" r="5" fill="white"/><rect x="10" y="19" width="12" height="5" fill="white"/>' },
  { id: 'snowflake', label: 'Snowflake', svg: '<path d="M16 4v24M4 16h24M8 8l16 16M24 8L8 24" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="white"/>' },
  { id: 'flame',     label: 'Flame',     svg: '<path d="M16 4c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z" fill="white"/>' },
  { id: 'moon',      label: 'Moon',      svg: '<path d="M20 6a10 10 0 11-8 20 12 12 0 008-20z" fill="white"/>' },
  { id: 'bolt',      label: 'Bolt',      svg: '<path d="M18 4L8 18h7l-3 10 10-14h-7l3-10z" fill="white"/>' },
  { id: 'leaf',      label: 'Leaf',      svg: '<path d="M8 24C8 12 16 4 28 4c0 12-8 20-20 20z" fill="white"/>' },
  { id: 'star',      label: 'Star',      svg: '<path d="M16 4l3.5 8 8.5 1-6.5 6 2 8.5L16 23l-7.5 4.5 2-8.5L4 13l8.5-1z" fill="white"/>' },
  { id: 'diamond',   label: 'Diamond',   svg: '<path d="M16 3l11 13-11 13L5 16z" fill="white"/>' },
  { id: 'shield',    label: 'Shield',    svg: '<path d="M16 3L5 8v7c0 7 5 12 11 14 6-2 11-7 11-14V8L16 3z" fill="white"/>' },
  { id: 'heart',     label: 'Heart',     svg: '<path d="M16 28s-10-6-10-14a5.5 5.5 0 0111 0 5.5 5.5 0 0111 0c0 8-12 14-12 14z" fill="white" transform="translate(0,-2)"/>' },
  { id: 'waves',     label: 'Waves',     svg: '<path d="M4 12c4-3 8 3 12 0s8 3 12 0M4 18c4-3 8 3 12 0s8 3 12 0" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>' },
];

const FAVICON_DEFAULT_CONFIG = { shape: 'circle', color: '#4A6FA5', icon: 'connectry', iconColor: '#ffffff' };

/**
 * Build a theme favicon SVG string.
 * Pure function — safe to call in any context (service worker, Node/CI, DOM).
 *
 * @param {{shape?: string, color?: string, icon?: string, iconColor?: string}} config
 * @param {number} [size=32] Rendered width/height in px. viewBox is always 32.
 * @returns {string} '<svg …>…</svg>'
 */
function renderFavicon(config, size) {
  const shape    = (config && config.shape)    || FAVICON_DEFAULT_CONFIG.shape;
  const color    = (config && config.color)    || FAVICON_DEFAULT_CONFIG.color;
  const iconId   = (config && config.icon)     || FAVICON_DEFAULT_CONFIG.icon;
  // When there's no background, an unspecified iconColor falls back to the
  // bg color so the glyph stays visible on a transparent tab — preserves
  // the pre-iconColor behaviour users were relying on.
  const iconColor = (config && config.iconColor)
    || (shape === 'none' ? color : FAVICON_DEFAULT_CONFIG.iconColor);
  const dim = size || 32;

  const icon = FAVICON_ICONS.find(i => i.id === iconId) || FAVICON_ICONS[0];
  let bg = '';
  if (shape === 'circle')  bg = `<circle cx="16" cy="16" r="15" fill="${color}"/>`;
  else if (shape === 'rounded') bg = `<rect x="1" y="1" width="30" height="30" rx="6" fill="${color}"/>`;
  else if (shape === 'square')  bg = `<rect x="1" y="1" width="30" height="30" rx="1" fill="${color}"/>`;
  // shape === 'none' leaves bg empty (transparent tab background).

  const glyph = icon.svg.replace(/white/g, iconColor);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${dim}" height="${dim}">${bg}${glyph}</svg>`;
}

/**
 * Resolve the default favicon config for a theme that hasn't set one.
 * Monogram system — every preset uses the Connectry glyph tinted with its
 * accent, consistent branding with the theme accent as the only differentiator.
 */
function defaultFaviconForTheme(themeId, accent) {
  return {
    shape: 'circle',
    color: accent || FAVICON_DEFAULT_CONFIG.color,
    icon: 'connectry',
  };
}


// ────────────────────────────────────────────────────────────────────────────
// renderTheme — the V2-portable primitive. Given a full theme object, returns
// both artifacts the runtime needs. CI calls this per preset; Studio calls
// this per save; a future Supabase Edge Function will call this server-side.
//
// Theme input shape:
//   { id, colors, typography?, favicon? }
// Returns:
//   { css, faviconSvg }
// ────────────────────────────────────────────────────────────────────────────

function renderTheme(theme) {
  if (!theme || !theme.colors) {
    throw new Error('renderTheme: theme must have a .colors object');
  }
  const css = generateThemeCSS(theme);
  const faviconConfig = theme.favicon || defaultFaviconForTheme(theme.id, theme.colors.accent);
  const faviconSvg = renderFavicon(faviconConfig, 32);
  return { css, faviconSvg };
}


// Browser-context globals.
//   self.ConnectryThemer  — canonical engine surface (renderTheme, renderFavicon, ...)
//   self.ConnectryFavicon — backward-compat shim for the old core/favicon/engine.js
//                           API. Keeps existing call sites in content.js, options.js,
//                           popup.js working unchanged during and after A2.
// When themes/engine.js is loaded in a surface (options, popup) or Node (CI), both
// globals populate. core/favicon/engine.js can be deleted — ConnectryFavicon still
// exists because we re-export its shape here.
if (typeof self !== 'undefined') {
  self.ConnectryThemer = self.ConnectryThemer || {};
  Object.assign(self.ConnectryThemer, {
    generateThemeCSS,
    renderFavicon,
    renderTheme,
    defaultFaviconForTheme,
    hexToRgb,
    FAVICON_ICONS,
    FAVICON_DEFAULT_CONFIG,
  });

  // Compat shim: old API surface exactly as core/favicon/engine.js exposed it.
  // Mark with _loaded so a re-load is idempotent.
  const compat = (self.ConnectryFavicon = self.ConnectryFavicon || {});
  if (!compat._loaded) {
    compat._loaded = true;
    compat.ICONS = FAVICON_ICONS;
    compat.DEFAULT_CONFIG = FAVICON_DEFAULT_CONFIG;
    compat.THEME_ICON_MAP = {};
    compat.defaultForTheme = defaultFaviconForTheme;
    compat.buildSVG = renderFavicon;
  }
}


// Export for Node (CI preset rebuild, tests) + background.js service worker.
if (typeof module !== 'undefined') {
  module.exports = {
    generateThemeCSS,
    renderFavicon,
    renderTheme,
    defaultFaviconForTheme,
    hexToRgb,
    FAVICON_ICONS,
    FAVICON_DEFAULT_CONFIG,
  };
}

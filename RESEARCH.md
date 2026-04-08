# Salesforce Themer — Technical Research

## Salesforce Shadow DOM (Critical Finding)

Salesforce Lightning uses **synthetic shadow DOM** — a polyfill, not native shadow DOM.

Key implications for our extension:
- Styles are injected into the document `<head>` as global `<style>` tags with obfuscated attribute selectors (e.g., `div[lwc-66unc5l95ad-host]`)
- **A shared stylesheet at the top level of the document CAN style all components** — styles leak through synthetic shadow
- CSS custom properties cascade into components via inheritance
- Do NOT rely on the obfuscated attributes — they are internal implementation and can change

## CSS Custom Properties to Override

### Legacy tokens (--lwc-* prefix)
- `--lwc-colorBackground` — page background
- `--lwc-colorBackgroundAlt` — card/component backgrounds
- `--lwc-colorTextDefault` — primary text
- `--lwc-colorTextWeak` — secondary text
- `--lwc-colorBorder` — borders
- `--lwc-colorBorderSeparator` — separators
- `--lwc-brandPrimary` — brand accent
- `--lwc-brandPrimaryActive` — active state
- `--lwc-brandPrimaryTransparent` — transparent brand
- `--lwc-colorBackgroundHighlight` — highlighted rows
- `--lwc-colorBackgroundButtonBrand` — brand button bg
- `--lwc-headerColorBackground` — header background
- `--lwc-pageColorBackground` — page background

### SLDS 2 global tokens (--slds-g-* prefix)
- `--slds-g-color-surface-*` — surface/background colors
- `--slds-g-color-on-surface-*` — text on surfaces
- `--slds-g-color-brand-*` — brand colors
- `--slds-g-color-border-*` — border colors
- `--slds-g-spacing-*` — spacing values
- `--slds-g-radius-*` — border radius
- `--slds-g-shadow-*` — shadows
- `--slds-g-font-*` — typography

### Component-level hooks (--slds-c-* prefix)
- `--slds-c-button-brand-color-background`
- `--slds-c-button-brand-color-border`
- `--slds-c-card-color-background`
- `--slds-c-input-color-background`
- `--slds-c-input-color-border`
- Note: Component hooks only work with SLDS 1 themes (not Cosmos/SLDS 2 yet)

## DOM Selectors to Target

### Structural elements (stable, safe to target)
- `body`, `html` — base
- `.desktop` — desktop container
- `.oneGlobalNav`, `one-app-nav-bar` — navigation
- `.oneContent` — main content area
- `.oneWorkspace` — workspace container
- `.flexipageBody` — Lightning page body
- `.navexConsoleContent` — console navigation
- `.oneWorkspaceTabWrapper` — workspace tabs
- `.forcePageBlockSectionRow` — record detail rows

### SLDS classes (widely used, relatively stable)
- `.slds-page-header` — page headers
- `.slds-card` — cards
- `.slds-card__header` — card headers
- `.slds-card__body` — card bodies
- `.slds-button` — buttons
- `.slds-input`, `.slds-textarea`, `.slds-select` — form elements
- `.slds-table` — data tables
- `.slds-table thead`, `.slds-table tbody tr` — table parts
- `.slds-modal` — modals
- `.slds-modal__container` — modal containers
- `.slds-dropdown` — dropdowns
- `.slds-popover` — popovers
- `.slds-pill` — pills/tags
- `.slds-badge` — badges
- `.slds-tabs_default` — tabs
- `.slds-spinner_container` — spinners

### Aura-specific
- `.uiTabBar` — tab bars
- `.tabContent` — tab content
- `.onesetupSetupLayout` — setup pages
- `.setupcontent` — setup content area

## Competition Analysis

| Extension | Users | Rating | Approach | Our Advantage |
|-----------|-------|--------|----------|---------------|
| Salesforce Dark Theme | 20,000+ | 4.2 | Single dark toggle | We offer 6 premium themes |
| Salesforce Dark Mode | unknown | 4.8 | Single dark theme | Multi-theme + better quality |
| Dark Mode for Salesforce | unknown | — | Basic contrast/brightness | Real theming, not filters |
| SFDark | unknown | — | Single dark theme | Variety + brand quality |
| Dark Reader | millions | 4.5 | Generic dark for all sites | SF-specific = much better results |

**Key gap: Nobody offers multiple premium themes. Dark mode only. No variety.**

## Approach: How Our Extension Should Work

1. Inject a `<style>` element into document `<head>` with CSS variable overrides at `:root`
2. CSS custom properties cascade through synthetic shadow DOM into components
3. Add targeted class-based overrides for elements that don't use CSS variables
4. Use MutationObserver to handle Salesforce SPA navigation (re-inject on route change)
5. Use MutationObserver to inject styles into any native shadow roots encountered
6. Store theme preference in `chrome.storage.sync` for cross-device persistence
7. Smooth 0.3s transition on theme switch via `* { transition: background-color 0.3s, color 0.3s, border-color 0.3s }`

## Chrome Extension Popup Best Practices
- Max size: ~380x500px for clean look
- Vanilla JS — no framework needed for this complexity
- Keep bundle under 50KB for instant feel
- 4MB total package limit
- Instant render — no loading states in popup

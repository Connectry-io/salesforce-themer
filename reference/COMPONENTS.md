# Salesforce Themer — Component Reference

This directory contains the canonical reference for every Salesforce Lightning component
we theme. It serves two purposes:

1. **Engine accuracy** — every CSS rule in the engine maps to a documented component structure
2. **Custom theme editor** (V2) — defines the surface area users can safely customize

## Reference Sources

| Source | File | What it covers |
|--------|------|----------------|
| SLDS 1 docs | `SLDS-COMPONENTS.md` | Official component HTML/CSS structure, legacy --lwc-* tokens |
| SLDS 2 docs | `SLDS2-COMPONENTS.md` | Cosmos structure, --slds-g-* and --slds-c-* tokens |
| Live DOM | `components/*.html` | Actual runtime DOM from Noland's org (includes force* wrappers) |

## Component Coverage Matrix

| Component | SLDS Ref | Live DOM | Engine CSS | Verified |
|-----------|----------|----------|------------|----------|
| Card (.slds-card) | | | Yes | |
| Path (.slds-path) | | | Yes | |
| Page Header | | | Yes | |
| Record Header / Highlights | | | Yes | |
| Navigation (context-bar) | | | Yes | |
| Data Table (.slds-table) | | | Yes | |
| Form Element | | | Yes | |
| Modal | | | Yes | |
| Buttons (brand, neutral) | | | Yes | |
| Tabs | | | Yes | |
| Dropdown / Menu | | | Yes | |
| Popover | | | Yes | |
| Pill | | | Yes | |
| Badge | | | Yes | |
| Panel / Split View | | | Yes | |
| Related List | | | Yes | |
| Scrollbar | | | Yes | |
| Setup Page | | | Yes | |
| Reports | | | Yes | |
| Console / Service Console | | | Yes | |
| Edit Modal | | | |
| Toast / Alert | | | |
| Progress Bar / Spinner | | | |
| Breadcrumbs | | | |
| Avatar | | | |
| Global Header | | | Yes | |

## Design Rules (apply to ALL components)

**CHANGE (colors only):**
- `background-color`
- `border-color`
- `color`
- `fill` (SVG icons)
- `box-shadow` (color component only — keep blur/spread/offset)
- `outline-color`

**NEVER CHANGE:**
- `border-width`, `border-style`, `border-radius`
- `padding`, `margin`
- `display`, `position`, `flex`, `grid`
- `clip-path`, `mask`
- `font-size`, `font-weight`, `line-height`, `letter-spacing`
- `width`, `height`, `min-*`, `max-*`
- `transform`, `transition` (structure)
- `z-index`, `overflow`

## Live DOM Snapshot Format

Each component snapshot in `components/` should be the outerHTML of the outermost
wrapper. File naming: `{component-name}.html`

When pasting a snapshot, include a comment at the top:
```html
<!-- Component: [name] -->
<!-- Page: [record page / list view / setup / etc] -->
<!-- Date: [YYYY-MM-DD] -->
<!-- SLDS version: [1 or 2 if known] -->
```

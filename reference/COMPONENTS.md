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
| Card (.slds-card) | Yes | Yes | Yes | Recolor only, border on .slds-card only |
| Path (.slds-path) | Yes | Yes | Yes | Skewed bg, won/lost states, active combo |
| Page Header | Yes | | Yes | |
| Record Header / Highlights | | | Yes | Recolored, not stripped |
| Navigation (context-bar) | Yes | Yes | Yes | Active tab pill override, aria-current |
| Global Header | Yes | Yes | Yes | White header, dark icons forced |
| Data Table (.slds-table) | Yes | | Yes | |
| Form Element | Yes | | Yes | No border-bottom lines |
| Modal | Yes | | Yes | |
| Buttons (brand, neutral) | Yes | | Yes | |
| Tabs | Yes | | Yes | ::after indicator override |
| Dropdown / Menu | Yes | | Yes | |
| Popover | Yes | | Yes | |
| Pill | Yes | | Yes | |
| Badge | Yes | | Yes | |
| Panel / Split View | Yes | | Yes | |
| Related List | | Yes | Yes | No double borders |
| Scrollbar | | | Yes | |
| Setup Page | | | Yes | all_frames + scope toggle |
| Reports | | | Yes | |
| Console / Service Console | | | Yes | |
| Edit Modal | | | Yes | No form field lines |
| Toast / Alert | | | | |
| Progress Bar / Spinner | | | | |
| Breadcrumbs | | | | |
| Avatar | | | Yes | Transparent bg |

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

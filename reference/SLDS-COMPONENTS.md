# SLDS Component Reference for Salesforce Themer

Source: [salesforce-ux/design-system](https://github.com/salesforce-ux/design-system) (v2.29.x)
Generated: 2026-04-08

This is the canonical reference for our theme engine's CSS rules. Each section
documents the real HTML structure, CSS classes, pseudo-elements, custom
properties (styling hooks), and state classes extracted directly from the SLDS
source repository.

---

## Table of Contents

1. [Card](#1-card)
2. [Path](#2-path)
3. [Data Table](#3-data-table)
4. [Modal](#4-modal)
5. [Button](#5-button)
6. [Tabs](#6-tabs)
7. [Page Header](#7-page-header)
8. [Global Navigation](#8-global-navigation)
9. [Form Element](#9-form-element)
10. [Popover](#10-popover)
11. [Pills](#11-pills)
12. [Badge](#12-badge)
13. [Panel](#13-panel)
14. [Dropdown / Menu](#14-dropdown--menu)

---

## 1. Card

**Selector:** `.slds-card`
**Restricts:** `article`, `div`, `section`

### HTML Structure

```html
<article class="slds-card">
  <div class="slds-card__header slds-grid">
    <header class="slds-media slds-media_center slds-has-flexi-truncate">
      <div class="slds-media__figure">
        <!-- icon -->
      </div>
      <div class="slds-media__body">
        <h2 class="slds-card__header-title">
          <a href="#" class="slds-card__header-link slds-truncate">
            <span>Title (N)</span>
          </a>
        </h2>
      </div>
      <div class="slds-no-flex">
        <button class="slds-button slds-button_neutral">New</button>
      </div>
    </header>
  </div>
  <div class="slds-card__body">
    <!-- table or tile content -->
  </div>
  <!-- OR with inner padding: -->
  <div class="slds-card__body slds-card__body_inner">
    <!-- padded content -->
  </div>
  <footer class="slds-card__footer">
    <a class="slds-card__footer-action" href="#">
      View All <span class="slds-assistive-text">Items</span>
    </a>
  </footer>
</article>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-card` | Root card container |
| `.slds-card_boundary` | Adds visible border when card is nested inside another card |
| `.slds-card__header` | Header wrapper |
| `.slds-card__header-title` | Title h2 wrapper |
| `.slds-card__header-link` | Actionable link in title |
| `.slds-card__body` | Body content area |
| `.slds-card__body_inner` | Body with horizontal padding matching header |
| `.slds-card__footer` | Footer with top border |
| `.slds-card__footer-action` | Footer link |
| `.slds-card__tile` | Used on tiles inside card body |
| `.slds-card-wrapper` | Wrapper that combines multiple cards into one visual card |

### Styling Properties (background, border, shadow, color)

```scss
.slds-card {
  background: var(--sds-c-card-color-background, $card-color-background);
  border-width: var(--sds-c-card-sizing-border, $border-width-thin);
  border-style: solid;
  border-color: var(--sds-c-card-color-border, $card-color-border);
  border-radius: var(--sds-c-card-radius-border, $border-radius-medium);
  box-shadow: var(--sds-c-card-shadow, $card-shadow);
  color: var(--sds-c-card-text-color);
}

.slds-card__footer {
  border-top-width: var(--sds-c-card-footer-sizing-border, $border-width-thin);
  border-top-style: solid;
  border-top-color: var(--sds-c-card-footer-color-border, ...);
}
```

### CSS Custom Properties (Styling Hooks)

```
--sds-c-card-color-background
--sds-c-card-color-border
--sds-c-card-sizing-border
--sds-c-card-radius-border
--sds-c-card-shadow
--sds-c-card-text-color
--sds-c-card-spacing-block-start / -end / -block / -inline / etc.
--sds-c-card-header-spacing-block-start / -end / -inline
--sds-c-card-heading-font-size
--sds-c-card-heading-font-weight
--sds-c-card-body-spacing-block-start / -end / -inline
--sds-c-card-footer-spacing-block / -inline
--sds-c-card-footer-text-align
--sds-c-card-footer-font-size
--sds-c-card-footer-sizing-border
--sds-c-card-footer-color-border
```

### Pseudo-elements

None.

### States

None (cards have no hover/active/focus states of their own).

### Theme-relevant selectors

```css
.slds-card                    /* background-color, border, box-shadow */
.slds-card__header            /* border-bottom (custom, not in SLDS default) */
.slds-card__body              /* background-color */
.slds-card__footer            /* background-color, border-top */
.slds-card-wrapper            /* background, border, box-shadow */
```

---

## 2. Path

**Selector:** `.slds-path`
**Restricts:** `div`

### HTML Structure

```html
<div class="slds-path">
  <div class="slds-grid slds-path__track">
    <div class="slds-grid slds-path__scroller-container">
      <!-- optional coaching toggle button -->
      <div class="slds-path__scroller">
        <div class="slds-path__scroller_inner">
          <ul class="slds-path__nav" role="listbox" aria-orientation="horizontal">
            <li class="slds-path__item slds-is-complete" role="presentation">
              <a class="slds-path__link" href="#" role="option" tabindex="-1" aria-selected="false">
                <span class="slds-path__stage">
                  <svg class="slds-icon slds-icon_x-small"><!-- check icon --></svg>
                  <span class="slds-assistive-text">Stage Complete</span>
                </span>
                <span class="slds-path__title">Contacted</span>
              </a>
            </li>
            <li class="slds-path__item slds-is-current slds-is-active" role="presentation">
              <a class="slds-path__link" href="#" role="option" tabindex="0" aria-selected="true">
                <span class="slds-path__stage">
                  <svg class="slds-icon slds-icon_x-small"><!-- check icon --></svg>
                  <span class="slds-assistive-text">Current Stage:</span>
                </span>
                <span class="slds-path__title">Open</span>
              </a>
            </li>
            <li class="slds-path__item slds-is-incomplete" role="presentation">
              <a class="slds-path__link" href="#" role="option" tabindex="-1" aria-selected="false">
                <span class="slds-path__stage">
                  <svg class="slds-icon slds-icon_x-small"><!-- check icon --></svg>
                </span>
                <span class="slds-path__title">Closed</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="slds-grid slds-path__action">
      <span class="slds-path__stage-name">Stage: Unqualified</span>
      <button class="slds-button slds-button_brand slds-path__mark-complete">
        <svg class="slds-button__icon slds-button__icon_left"><!-- check --></svg>
        Mark Status as Complete
      </button>
    </div>
  </div>
</div>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-path` | Root container |
| `.slds-path_has-coaching` | Has coaching section |
| `.slds-is-expanded` | Coaching section is visible |
| `.slds-path__track` | Flex container for track + action |
| `.slds-has-overflow` | Track has scrollable overflow |
| `.slds-path__scroller-container` | Flex container for toggle + scroller |
| `.slds-path__scroller` | Overflow-hidden scroller wrapper |
| `.slds-path__scroller_inner` | Inner flex wrapper for nav + scroll controls |
| `.slds-path__nav` | The horizontal `<ul>` of steps |
| `.slds-path__item` | Individual chevron step `<li>` |
| `.slds-path__link` | Clickable `<a>` inside each step |
| `.slds-path__stage` | Check icon container (rotates on state change) |
| `.slds-path__title` | Label text for each step |
| `.slds-path__action` | Container for stage name + action button |
| `.slds-path__stage-name` | Text showing current stage name |
| `.slds-path__mark-complete` | "Mark Complete" brand button |
| `.slds-path__trigger` | Coaching toggle button |
| `.slds-path__trigger_open` | Coaching toggle in open state (rotated 90deg) |
| `.slds-path__content` | Coaching tabpanel container |
| `.slds-path__coach` | Coaching flex layout |
| `.slds-path__keys` | Key Fields section |
| `.slds-path__guidance` | Guidance section |
| `.slds-path__coach-title` | Underlined title in coaching |
| `.slds-path__coach-edit` | Edit link in coaching |
| `.slds-path__guidance-content` | Guidance text container |
| `.slds-path__scroll-controls` | Left/right scroll buttons |

### Pseudo-elements (CRITICAL for theming)

The chevron/arrow shapes are built entirely with `::before` and `::after` on
`.slds-path__item`. These are skewed rectangles that create the arrow effect:

```scss
.slds-path__item {
  &:before,
  &:after {
    content: '';
    position: absolute;
    left: rem(-4px);
    right: rem(-5px);
    cursor: pointer;
  }
  &:before {
    top: 0;
    height: calc((#{$height-sales-path} / 2) + 0.0625rem);
    transform: skew(28deg);
  }
  &:after {
    bottom: 0;
    height: 50%;
    transform: skew(-30deg);
  }
}
```

The `::before` and `::after` pseudo-elements **inherit the background color**
of each state. When theming, you MUST set background on both the element AND
its pseudo-elements.

### State Classes (on `.slds-path__item`)

| State Class | Background | Text Color | Notes |
|---|---|---|---|
| `.slds-is-incomplete` | `$color-background-path-incomplete` | `$color-text-default` | Gray/light |
| `.slds-is-complete` | `$color-background-path-complete` | `$color-text-inverse` (white) | Blue/dark |
| `.slds-is-current` | `$color-background-path-current` | `$color-text-path-current` | Bordered, highlighted |
| `.slds-is-active` | `$color-background-path-active` | `$color-text-inverse` | Currently selected |
| `.slds-is-won` | `$color-background-path-won` | (inverse) | Green success |
| `.slds-is-lost` | `$color-background-path-lost` | (inverse) | Red/error |

Each state sets background on the item AND on `&:before, &:after`.
Hover states also exist for each (appending `-hover` to the token).

The `.slds-is-current` state uses gradient-based borders on `::before` / `::after`
(not `border`, but `background-image: linear-gradient(...)`) to draw the 2px
border on the chevron shape.

### Theme-relevant selectors

```css
/* Override backgrounds — must include pseudo-elements */
.slds-path__item.slds-is-incomplete,
.slds-path__item.slds-is-incomplete::before,
.slds-path__item.slds-is-incomplete::after         { background: ... }

.slds-path__item.slds-is-complete,
.slds-path__item.slds-is-complete::before,
.slds-path__item.slds-is-complete::after            { background: ... }

.slds-path__item.slds-is-current                    { background-color: ... }
.slds-path__item.slds-is-current::before,
.slds-path__item.slds-is-current::after              { background-color: ...; background-image: ...; }

.slds-path__item.slds-is-active,
.slds-path__item.slds-is-active::before,
.slds-path__item.slds-is-active::after              { background: ... }

/* Link text color */
.slds-path__item .slds-path__link                   { color: ... }

/* Coaching section */
.slds-path__guidance                                 { background-color: ... }
```

---

## 3. Data Table

**Selector:** `.slds-table`
**Restricts:** `table`

### HTML Structure

```html
<table class="slds-table slds-table_bordered slds-table_cell-buffer slds-table_fixed-layout" role="grid" aria-label="...">
  <thead>
    <tr class="slds-line-height_reset">
      <th class="slds-is-sortable" scope="col" aria-sort="none">
        <a class="slds-th__action slds-text-link_reset" href="#" role="button">
          <span class="slds-truncate" title="Column Name">Column Name</span>
          <svg class="slds-icon slds-icon-text-default slds-is-sortable__icon"><!-- arrowdown --></svg>
        </a>
      </th>
      <!-- more columns -->
    </tr>
  </thead>
  <tbody>
    <tr class="slds-hint-parent" aria-selected="false">
      <th scope="row" data-label="Name">
        <div class="slds-truncate" title="...">
          <a href="#" tabindex="-1">Record Name</a>
        </div>
      </th>
      <td data-label="Column" role="gridcell">
        <div class="slds-truncate" title="...">Cell Value</div>
      </td>
      <!-- more cells -->
    </tr>
  </tbody>
</table>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-table` | Base table styling |
| `.slds-table_bordered` | Adds row borders |
| `.slds-table_col-bordered` | Adds column borders |
| `.slds-table_striped` | Alternating row backgrounds |
| `.slds-table_fixed-layout` | Fixed column widths |
| `.slds-table_cell-buffer` | Adds cell padding |
| `.slds-table_edit` | Inline edit mode |
| `.slds-table_resizable-cols` | Resizable columns |
| `.slds-table_header-hidden` | Visually hides header row |
| `.slds-table_header-fixed` | Fixed/sticky header |
| `.slds-no-row-hover` | Disables row hover effect |
| `.slds-no-cell-focus` | Disables cell focus styling |
| `.slds-table_edit_container` | Wrapper for inline-edit table with `slds-is-relative` |
| `.slds-line-height_reset` | On `<tr>` in thead |
| `.slds-hint-parent` | On body `<tr>`, enables hover hints |
| `.slds-is-selected` | Selected row highlight |
| `.slds-is-sorted` | Column is sorted |
| `.slds-is-sorted_asc` | Sorted ascending |
| `.slds-is-sorted_desc` | Sorted descending |
| `.slds-is-sortable` | Column header is sortable |
| `.slds-has-focus` | Cell/th has focus |
| `.slds-cell-edit` | Cell in edit mode |
| `.slds-is-edited` | Cell has been edited |
| `.slds-cell-error` | Cell has an error |
| `.slds-has-error` | Cell/row-level error |
| `.slds-cell-wrap` | Allow text wrapping |
| `.slds-cell-shrink` | Narrow cell (checkbox/action columns) |
| `.slds-cell-fixed` | Fixed-width cell |
| `.slds-th__action` | Clickable header content wrapper |
| `.slds-th__action_form` | Header action for checkbox/radio |
| `.slds-is-resizable` | Column has resize handle |
| `.slds-resizable` | Resize control container |
| `.slds-resizable__input` | Hidden range input |
| `.slds-resizable__handle` | Grab handle |
| `.slds-resizable__divider` | Visual divider line |
| `.slds-has-button-menu` | Column has dropdown menu |

### Styling Properties

```scss
/* thead */
thead th        { background-color; color; border-bottom; font-weight }

/* tbody rows */
tbody tr        { background-color; border-bottom }
tbody tr:hover  { background-color (row hover) }

/* selected row */
.slds-is-selected { background-color (selection highlight) }

/* striped */
.slds-table_striped tbody tr:nth-child(even) { background-color }
```

### CSS Custom Properties

Tables do not expose `--sds-c-*` hooks in the current SLDS version. Override
via direct selectors.

### Pseudo-elements

None significant for theming.

### Theme-relevant selectors

```css
.slds-table                                    { background-color; border }
.slds-table thead th                           { background-color; color; border-bottom }
.slds-table tbody tr                           { background-color; border-bottom }
.slds-table tbody tr:hover                     { background-color }
.slds-table tbody tr:nth-child(even)           { background-color (if striped) }
.slds-table tbody tr.slds-is-selected          { background-color }
.slds-table td, .slds-table th                 { color }
```

---

## 4. Modal

**Selector:** `.slds-modal`
**Restricts:** `section[role="dialog"]`

### HTML Structure

```html
<section role="dialog" tabindex="-1" aria-modal="true"
  aria-describedby="modal-content-id-1"
  aria-labelledby="modal-heading-01"
  class="slds-modal slds-fade-in-open">
  <div class="slds-modal__container">
    <header class="slds-modal__header">
      <button class="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse">
        <svg class="slds-button__icon slds-button__icon_large"><!-- close --></svg>
        <span class="slds-assistive-text">Close</span>
      </button>
      <h2 id="modal-heading-01" class="slds-modal__title slds-hyphenate">
        Modal header
      </h2>
    </header>
    <div class="slds-modal__content slds-p-around_medium" id="modal-content-id-1">
      <p>Body content...</p>
    </div>
    <footer class="slds-modal__footer">
      <button class="slds-button slds-button_neutral">Cancel</button>
      <button class="slds-button slds-button_brand">Save</button>
    </footer>
  </div>
</section>
<div class="slds-backdrop slds-backdrop_open"></div>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-modal` | Root modal (centered, full-viewport overlay) |
| `.slds-modal_small` | Small width variant |
| `.slds-modal_medium` | Medium width variant |
| `.slds-modal_large` | Large width variant |
| `.slds-fade-in-open` | Makes modal visible with animation |
| `.slds-modal__container` | White box that contains header/content/footer |
| `.slds-modal__header` | Header area |
| `.slds-modal__header_empty` | Headless modal (no visible title) |
| `.slds-modal__title` | Title text |
| `.slds-modal__close` | Close button (absolute positioned) |
| `.slds-modal__content` | Scrollable body |
| `.slds-modal__content_has-hidden-footer` | Content with hidden footer padding |
| `.slds-modal__menu` | Optional menu section |
| `.slds-modal__footer` | Footer with action buttons |
| `.slds-modal__footer_directional` | Footer with space-between alignment |
| `.slds-backdrop` | Full-screen dim overlay behind modal |
| `.slds-backdrop_open` | Makes backdrop visible |

### Styling Properties

```scss
.slds-modal__container  { background-color; border-radius; box-shadow }
.slds-modal__header     { background-color; border-bottom; color }
.slds-modal__content    { background-color; color }
.slds-modal__footer     { background-color; border-top }
.slds-backdrop          { background-color (semi-transparent) }
```

### CSS Custom Properties

Modals do not expose `--sds-c-*` hooks in current SLDS. Override via direct
selectors.

### Pseudo-elements

None.

### Theme-relevant selectors

```css
.slds-modal__container          { background-color; border; box-shadow }
.slds-modal__header             { background-color; border-bottom; color }
.slds-modal__content            { background-color; color }
.slds-modal__footer             { background-color; border-top }
.slds-backdrop                  { background-color }
```

---

## 5. Button

**Selector:** `.slds-button`
**Restricts:** `button`, `a`, `span`

### HTML Structure

```html
<!-- Base (text link style) -->
<button class="slds-button">Button</button>

<!-- Neutral -->
<button class="slds-button slds-button_neutral">Neutral</button>

<!-- Brand -->
<button class="slds-button slds-button_brand">Brand</button>

<!-- Outline Brand -->
<button class="slds-button slds-button_outline-brand">Outline Brand</button>

<!-- Destructive -->
<button class="slds-button slds-button_destructive">Destructive</button>

<!-- Text Destructive -->
<button class="slds-button slds-button_text-destructive">Text Destructive</button>

<!-- Success -->
<button class="slds-button slds-button_success">Success</button>

<!-- Inverse (for dark backgrounds) -->
<button class="slds-button slds-button_inverse">Inverse</button>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-button` | Base button (text link appearance) |
| `.slds-button_neutral` | White bg, gray border |
| `.slds-button_brand` | Brand blue bg, white text |
| `.slds-button_outline-brand` | White bg, brand border |
| `.slds-button_inverse` | For dark backgrounds |
| `.slds-button_destructive` | Red bg, white text |
| `.slds-button_text-destructive` | Red text, no bg |
| `.slds-button_success` | Green bg, white text |
| `.slds-button_reset` | Resets to browser defaults |
| `.slds-button_full-width` | Full container width |
| `.slds-button_stretch` | Stretch layout |
| `.slds-button_first` | First in button group |
| `.slds-button_middle` | Middle in button group |
| `.slds-button_last` | Last in button group |

### Styling Properties and Custom Properties

```scss
/* Base */
.slds-button {
  background-color: var(--sds-c-button-color-background, transparent);
  border-color: var(--sds-c-button-color-border, transparent);
  border-width: var(--sds-c-button-sizing-border, $border-width-thin);
  border-radius: var(--sds-c-button-radius-border, $button-border-radius);
  box-shadow: var(--sds-c-button-shadow);
  line-height: var(--sds-c-button-line-height, ...);
  color: var(--sds-c-button-text-color, $brand-accessible);
  &:hover, &:focus { color: var(--sds-c-button-text-color-hover, ...); }
  &:focus { box-shadow: var(--sds-c-button-shadow-focus, $shadow-button-focus); }
  &:active { color: var(--sds-c-button-text-color-active, ...); }
}

/* Neutral */
.slds-button_neutral {
  background-color: var(--sds-c-button-neutral-color-background, ...);
  border-color: var(--sds-c-button-neutral-color-border, ...);
  &:hover { background-color: var(--sds-c-button-neutral-color-background-hover, ...); }
  &:active { background-color: var(--sds-c-button-neutral-color-background-active, ...); }
}

/* Brand */
.slds-button_brand {
  background-color: var(--sds-c-button-brand-color-background, $brand-accessible);
  border-color: var(--sds-c-button-brand-color-border, $brand-accessible);
  color: var(--sds-c-button-brand-text-color, white);
  &:hover { background-color: var(--sds-c-button-brand-color-background-hover, ...); }
  &:active { background-color: var(--sds-c-button-brand-color-background-active, ...); }
}

/* Outline Brand */
.slds-button_outline-brand {
  background-color: var(--sds-c-button-outline-brand-color-background, white);
  border-color: var(--sds-c-button-outline-brand-color-border, $brand-accessible);
}

/* Inverse */
.slds-button_inverse {
  background-color: var(--sds-c-button-inverse-color-background, ...);
  border-color: var(--sds-c-button-inverse-color-border, ...);
}
```

### Full CSS Custom Properties List

```
--sds-c-button-color-background
--sds-c-button-color-border
--sds-c-button-sizing-border
--sds-c-button-radius-border
--sds-c-button-shadow
--sds-c-button-shadow-focus
--sds-c-button-line-height
--sds-c-button-text-color
--sds-c-button-text-color-hover
--sds-c-button-text-color-active
--sds-c-button-spacing-block-start / -end
--sds-c-button-spacing-inline-start / -end
--sds-c-button-neutral-color-background / -hover / -active
--sds-c-button-neutral-color-border / -hover / -active
--sds-c-button-brand-color-background / -hover / -active
--sds-c-button-brand-color-border / -hover / -active
--sds-c-button-brand-text-color / -hover / -active
--sds-c-button-outline-brand-color-background / -hover / -active
--sds-c-button-outline-brand-color-border / -hover / -active
--sds-c-button-inverse-color-background / -hover / -active
--sds-c-button-inverse-color-border / -hover / -active
--sds-c-button-inverse-shadow-focus
--sds-c-button-inverse-color-border-focus
```

### Pseudo-elements

Kinetics buttons use `::after` for ripple effects, but this is optional/cosmetic.
No pseudo-elements needed for standard theming.

### States

| State | Selector | Notes |
|---|---|---|
| Hover | `:hover` | Background/border color changes |
| Focus | `:focus` | Box-shadow focus ring |
| Active | `:active` | Darker background |
| Disabled | `[disabled]`, `:disabled` | Muted colors, no pointer |

### Theme-relevant selectors

```css
.slds-button_brand                  { background-color; border-color; color }
.slds-button_brand:hover            { background-color; border-color }
.slds-button_neutral                { background-color; border-color; color }
.slds-button_neutral:hover          { background-color }
.slds-button_destructive            { background-color; border-color; color }
.slds-button_success                { background-color; border-color; color }
.slds-button_outline-brand          { background-color; border-color }
.slds-button_inverse                { background-color; border-color }
```

---

## 6. Tabs

**Selector:** `.slds-tabs_default` (or `.slds-tabs_scoped`)
**Restricts:** `div`

### HTML Structure

```html
<!-- Default Tabs -->
<div class="slds-tabs_default">
  <ul class="slds-tabs_default__nav" role="tablist">
    <li class="slds-tabs_default__item slds-is-active" role="presentation">
      <a class="slds-tabs_default__link" href="#" role="tab" tabindex="0"
         aria-selected="true" aria-controls="tab-1" id="tab-1__item">
        Item One
      </a>
    </li>
    <li class="slds-tabs_default__item" role="presentation">
      <a class="slds-tabs_default__link" href="#" role="tab" tabindex="-1"
         aria-selected="false" aria-controls="tab-2" id="tab-2__item">
        Item Two
      </a>
    </li>
  </ul>
  <div class="slds-tabs_default__content slds-show" role="tabpanel"
       aria-labelledby="tab-1__item" id="tab-1">
    Content for tab 1
  </div>
  <div class="slds-tabs_default__content slds-hide" role="tabpanel"
       aria-labelledby="tab-2__item" id="tab-2">
    Content for tab 2
  </div>
</div>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-tabs_default` | Default tab style container |
| `.slds-tabs_scoped` | Scoped tab style (contained look) |
| `.slds-tabs_default__nav` | Tab list `<ul>` |
| `.slds-tabs_default__item` | Individual tab `<li>` |
| `.slds-tabs_default__link` | Tab link `<a>` |
| `.slds-tabs_default__content` | Tab panel content |
| `.slds-tabs_default__overflow-button` | Overflow "More" tab |
| `.slds-tabs_medium` | Medium-sized tabs |
| `.slds-tabs_large` | Large-sized tabs |
| `.slds-tabs_card` | Tab styling for card context |
| `.slds-is-active` | Active/selected tab item |
| `.slds-show` | Visible panel |
| `.slds-hide` | Hidden panel |
| `.slds-tabs__left-icon` | Icon before tab label |
| `.slds-tabs__right-icon` | Icon after tab label |

### Tab with Icons

```html
<li class="slds-tabs_default__item slds-is-active">
  <a class="slds-tabs_default__link" ...>
    <span class="slds-tabs__left-icon">
      <!-- StandardIcon -->
    </span>
    Tab Label
    <span class="slds-tabs__right-icon">
      <!-- UtilityIcon e.g. error indicator -->
    </span>
  </a>
</li>
```

### Styling Properties

```scss
/* Nav bar */
.slds-tabs_default__nav { border-bottom }

/* Active tab */
.slds-tabs_default__item.slds-is-active {
  /* gets an underline via border-bottom on the item or link */
}

/* Tab link */
.slds-tabs_default__link { color }

/* Tab content */
.slds-tabs_default__content { background-color }
```

### CSS Custom Properties

Tabs do not expose `--sds-c-*` hooks. Override via direct selectors.

### Pseudo-elements

The active indicator underline is typically a `border-bottom` on
`.slds-tabs_default__item.slds-is-active`, not a pseudo-element.

### Theme-relevant selectors

```css
.slds-tabs_default__nav                         { border-bottom; background-color }
.slds-tabs_default__item                        { color }
.slds-tabs_default__item.slds-is-active         { color; border-bottom-color }
.slds-tabs_default__link                        { color }
.slds-tabs_default__content                     { background-color }
/* Scoped variants use slds-tabs_scoped__* instead */
```

---

## 7. Page Header

**Selector:** `.slds-page-header`
**Restricts:** `div`

### HTML Structure

```html
<div class="slds-page-header">
  <div class="slds-page-header__row">
    <div class="slds-page-header__col-title">
      <div class="slds-media">
        <div class="slds-media__figure">
          <span class="slds-icon_container slds-page-header__icon">
            <svg class="slds-icon"><!-- object icon --></svg>
          </span>
        </div>
        <div class="slds-media__body">
          <div class="slds-page-header__name">
            <div class="slds-page-header__name-title">
              <h1>
                <span>Object Name</span>
                <span class="slds-page-header__title slds-truncate">Record Title</span>
              </h1>
            </div>
            <div class="slds-page-header__name-switcher">
              <!-- optional view switcher dropdown -->
            </div>
          </div>
          <p class="slds-page-header__name-meta">10 items - Updated 13 minutes ago</p>
        </div>
      </div>
    </div>
    <div class="slds-page-header__col-actions">
      <div class="slds-page-header__controls">
        <div class="slds-page-header__control">
          <!-- action buttons -->
        </div>
      </div>
    </div>
  </div>
  <div class="slds-page-header__row">
    <div class="slds-page-header__col-details">
      <ul class="slds-page-header__detail-row">
        <li class="slds-page-header__detail-block">
          <div class="slds-text-title slds-truncate">Field Label</div>
          <div class="slds-truncate">Field Value</div>
        </li>
      </ul>
    </div>
  </div>
</div>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-page-header` | Root container |
| `.slds-page-header_vertical` | Vertical layout variant |
| `.slds-page-header_related-list` | Related list variant |
| `.slds-page-header_record-home` | Record home variant |
| `.slds-page-header__row` | Row container |
| `.slds-page-header__row_gutters` | Row with gutters |
| `.slds-page-header__col-title` | Title column |
| `.slds-page-header__col-actions` | Actions column |
| `.slds-page-header__col-controls` | Controls column |
| `.slds-page-header__col-details` | Details column |
| `.slds-page-header__col-meta` | Meta info column |
| `.slds-page-header__icon` | Object icon |
| `.slds-page-header__name` | Name container (title + switcher) |
| `.slds-page-header__name-title` | Title wrapper |
| `.slds-page-header__name-switcher` | View switcher dropdown |
| `.slds-page-header__name-meta` | Meta text under title |
| `.slds-page-header__title` | Main title text |
| `.slds-page-header__meta-text` | Additional meta text |
| `.slds-page-header__controls` | Controls wrapper |
| `.slds-page-header__control` | Individual control |
| `.slds-page-header__detail-row` | Detail fields row |
| `.slds-page-header__detail-list` | Detail fields list |
| `.slds-page-header__detail-block` | Individual detail field |
| `.slds-page-header__detail-item` | List-style detail field |

### Styling Properties

```scss
.slds-page-header { background-color; border-bottom; box-shadow }
```

### CSS Custom Properties

Page headers do not expose `--sds-c-*` hooks. Override via direct selectors.

### Pseudo-elements

None.

### Theme-relevant selectors

```css
.slds-page-header                { background-color; border-bottom; box-shadow }
.slds-page-header__title         { color }
.slds-page-header__name-title    { color }
.slds-page-header__meta-text     { color }
.slds-page-header__name-meta     { color }
```

---

## 8. Global Navigation

**Selector:** `.slds-context-bar`
**Restricts:** `div`

### HTML Structure

```html
<div class="slds-context-bar">
  <div class="slds-context-bar__primary">
    <div class="slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover">
      <div class="slds-context-bar__icon-action">
        <!-- Waffle icon (app launcher) -->
      </div>
      <span class="slds-context-bar__label-action slds-context-bar__app-name">
        <span class="slds-truncate" title="App Name">App Name</span>
      </span>
    </div>
  </div>
  <nav class="slds-context-bar__secondary" role="navigation">
    <ul class="slds-grid">
      <li class="slds-context-bar__item slds-is-active">
        <a href="#" class="slds-context-bar__label-action" title="Home">
          <span class="slds-assistive-text">Current Page:</span>
          <span class="slds-truncate" title="Home">Home</span>
        </a>
      </li>
      <li class="slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click">
        <a href="#" class="slds-context-bar__label-action" title="Menu Item">
          <span class="slds-truncate" title="Menu Item">Menu Item</span>
        </a>
        <div class="slds-context-bar__icon-action slds-p-left_none">
          <button class="slds-button slds-button_icon slds-context-bar__button">
            <svg><!-- chevrondown --></svg>
          </button>
        </div>
        <!-- optional dropdown menu -->
      </li>
    </ul>
  </nav>
</div>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-context-bar` | Root navigation bar |
| `.slds-context-bar__primary` | Left section (app launcher + app name) |
| `.slds-context-bar__secondary` | Right section (`<nav>` with tab items) |
| `.slds-context-bar__item` | Individual nav item `<li>` |
| `.slds-context-bar__label-action` | Clickable label area `<a>` |
| `.slds-context-bar__icon-action` | Icon button area (chevron, waffle) |
| `.slds-context-bar__app-name` | App name label |
| `.slds-context-bar__button` | Icon button inside icon-action |
| `.slds-context-bar__dropdown-trigger` | Item with dropdown capability |
| `.slds-is-active` | Currently active/selected nav item |
| `.slds-is-open` | Dropdown menu is open |
| `.slds-no-hover` | Disables hover effect (app launcher area) |

### Styling Properties

```scss
.slds-context-bar {
  background-color;  /* The main nav bar color */
  border-bottom;     /* Bottom border */
}
.slds-context-bar__item {
  color;  /* Text/icon color */
}
.slds-context-bar__item:hover {
  background-color;  /* Hover highlight */
}
.slds-context-bar__item.slds-is-active {
  background-color;  /* Active item */
  border-bottom;     /* Active indicator */
}
```

### CSS Custom Properties

Global navigation does not expose `--sds-c-*` hooks. Override via direct
selectors. In live Salesforce, the header color is controlled by
`--lwc-headerColorBackground`.

### Pseudo-elements

The active indicator on `.slds-context-bar__item.slds-is-active` may use a
`::after` pseudo-element for the bottom border indicator in some SF versions.

### Theme-relevant selectors

```css
.slds-context-bar                                    { background-color; border-bottom }
.slds-context-bar__item                              { color }
.slds-context-bar__item:hover                        { background-color }
.slds-context-bar__item.slds-is-active               { background-color; border-bottom }
.slds-context-bar__item.slds-is-active .slds-context-bar__label-action { color }
.slds-context-bar__label-action                      { color }
.slds-context-bar__icon-action                       { color }
.slds-context-bar__app-name                          { color; border-right }
.slds-context-bar .slds-icon                         { fill }
```

### Waffle Icon (App Launcher dots)

```css
.slds-icon-waffle .slds-r1 through .slds-r9         { background-color }
```

---

## 9. Form Element

**Selector:** `.slds-form-element`
**Restricts:** `div`, `fieldset`

### HTML Structure

```html
<div class="slds-form-element">
  <label class="slds-form-element__label" for="input-id">
    <abbr class="slds-required" title="required">*</abbr>
    Label Text
  </label>
  <div class="slds-form-element__control">
    <input type="text" id="input-id" class="slds-input" placeholder="..." />
  </div>
  <div class="slds-form-element__help" id="error-id">
    Error message text
  </div>
</div>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-form-element` | Root container |
| `.slds-form-element_edit` | Inline edit mode |
| `.slds-form-element_readonly` | View/readonly mode |
| `.slds-form-element_stacked` | Stacked label layout |
| `.slds-form-element_horizontal` | Horizontal label layout |
| `.slds-form-element_compound` | Compound field (multiple inputs) |
| `.slds-form-element_address` | Address compound field |
| `.slds-form-element_1-col` / `_2-col` | Column sizing |
| `.slds-form-element__label` | Label element |
| `.slds-form-element__legend` | Fieldset legend (styled as label) |
| `.slds-form-element__control` | Input wrapper |
| `.slds-form-element__help` | Error/help message |
| `.slds-form-element__static` | Static/readonly value display |
| `.slds-form-element__icon` | Tooltip icon container |
| `.slds-has-error` | Error state |
| `.slds-is-editing` | Currently being edited |
| `.slds-is-edited` | Has been edited (shows indicator) |
| `.slds-is-required` | Required field |
| `.slds-hint-parent` | Enables hover hint for edit button |
| `.slds-required` | Required asterisk `<abbr>` |
| `.slds-input` | Text input |
| `.slds-textarea` | Textarea |
| `.slds-select` | Select dropdown |
| `.slds-input-has-icon` | Input with icon(s) |
| `.slds-input-has-icon_left` | Icon on left |
| `.slds-input-has-icon_right` | Icon on right |
| `.slds-input-has-icon_left-right` | Icons on both sides |
| `.slds-input-has-icon_group-right` | Two icons grouped on right |

### Styling Properties

```scss
.slds-form-element__label  { color; font-weight }
.slds-input, .slds-textarea, .slds-select {
  background-color; border-color; color;
  &:focus { border-color; box-shadow; outline }
  &::placeholder { color }
}
.slds-form-element__static { color }
.slds-form-element__help   { color (error text) }
.slds-has-error .slds-input { border-color (error border) }
```

### CSS Custom Properties

```
--sds-c-input-color-background
--sds-c-input-color-border
--sds-c-input-color-border-focus (via --slds-c-input-color-border-focus)
--sds-c-input-radius-border
--sds-c-input-shadow
--sds-c-input-shadow-focus
--sds-c-input-text-color
--sds-c-input-text-color-placeholder
--sds-c-textarea-* (mirrors input hooks for textarea)
--sds-c-select-* (mirrors for select)
```

### Pseudo-elements

None significant for theming.

### Theme-relevant selectors

```css
.slds-form-element__label               { color; font-weight }
.slds-input                             { background-color; border-color; color }
.slds-input:focus                       { border-color; box-shadow }
.slds-input::placeholder                { color }
.slds-textarea                          { background-color; border-color; color }
.slds-select                            { background-color; border-color; color }
.slds-form-element__static              { color }
.slds-form-element__help                { color }
.slds-has-error .slds-input             { border-color }
```

---

## 10. Popover

**Selector:** `.slds-popover`
**Restricts:** `section[role="dialog"]`

### HTML Structure

```html
<section class="slds-popover slds-nubbin_left" role="dialog"
  aria-label="Dialog Title" aria-describedby="body-id">
  <button class="slds-button slds-button_icon slds-button_icon-small slds-float_right slds-popover__close">
    <svg><!-- close --></svg>
    <span class="slds-assistive-text">Close dialog</span>
  </button>
  <div class="slds-popover__body" id="body-id">
    <div class="slds-media">
      <div class="slds-media__figure">
        <!-- optional icon -->
      </div>
      <div class="slds-media__body">
        <header class="slds-popover__header">
          <h2 class="slds-text-heading_small">Header Title</h2>
        </header>
        <p>Body content...</p>
      </div>
    </div>
  </div>
  <footer class="slds-popover__footer">
    <!-- optional footer content -->
  </footer>
</section>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-popover` | Root popover container |
| `.slds-popover_full-width` | Full width variant |
| `.slds-popover_hide` | Hidden state |
| `.slds-popover_warning` | Warning variant (yellow) |
| `.slds-popover_error` | Error variant (red) |
| `.slds-popover_edit` | Inline edit popover |
| `.slds-popover_large` | Large size |
| `.slds-popover__body` | Body content wrapper |
| `.slds-popover__body_small` | Small body variant |
| `.slds-popover__header` | Header area |
| `.slds-popover__footer` | Footer area |
| `.slds-popover__footer_form` | Form-style footer |
| `.slds-popover__meta` | Meta/badge area |
| `.slds-popover__close` | Close button |
| `.slds-nubbin_*` | Arrow/nubbin position classes |

### Nubbin (Arrow) Position Classes

```
.slds-nubbin_top          .slds-nubbin_top-left       .slds-nubbin_top-right
.slds-nubbin_bottom       .slds-nubbin_bottom-left    .slds-nubbin_bottom-right
.slds-nubbin_left         .slds-nubbin_left-top       .slds-nubbin_left-bottom
.slds-nubbin_right        .slds-nubbin_right-top      .slds-nubbin_right-bottom
```

### Pseudo-elements

The nubbin (arrow triangle) is created with `::before` and `::after`
pseudo-elements on the `.slds-nubbin_*` classes. These are CSS triangles
using border tricks. When theming, you must also override the nubbin
background/border colors:

```css
.slds-popover::before { /* border/shadow for nubbin */ }
.slds-popover::after  { /* background fill for nubbin */ }
```

### Styling Properties

```scss
.slds-popover         { background-color; border; border-radius; box-shadow; color }
.slds-popover__header { background-color; border-bottom }
.slds-popover__footer { background-color; border-top }
/* Warning variant */
.slds-popover_warning { background-color (yellow); border-color }
/* Error variant */
.slds-popover_error   { background-color (red); color (white) }
```

### Theme-relevant selectors

```css
.slds-popover                           { background-color; border; box-shadow }
.slds-popover__header                   { background-color; border-bottom }
.slds-popover__footer                   { background-color; border-top }
/* Nubbin pseudo-elements for arrow color */
.slds-popover[class*="nubbin"]::before  { border-color }
.slds-popover[class*="nubbin"]::after   { background-color }
```

---

## 11. Pills

**Selector:** `.slds-pill`
**Restricts:** `span`

### HTML Structure

```html
<!-- Link Pill -->
<span class="slds-pill slds-pill_link">
  <span class="slds-pill__icon_container">
    <span class="slds-icon_container slds-icon-standard-account" title="Account">
      <svg class="slds-icon"><!-- icon --></svg>
    </span>
  </span>
  <a href="#" class="slds-pill__action" title="Full pill label">
    <span class="slds-pill__label">Pill Label</span>
  </a>
  <button class="slds-button slds-button_icon slds-pill__remove">
    <svg><!-- close --></svg>
    <span class="slds-assistive-text">Remove</span>
  </button>
</span>

<!-- Listbox Pill (combobox selections) -->
<span class="slds-pill" role="option" tabindex="0" aria-selected="true">
  <span class="slds-pill__label" title="Label">Pill Label</span>
  <span class="slds-icon_container slds-pill__remove" title="Remove">
    <svg class="slds-icon slds-icon_x-small slds-icon-text-default"><!-- close --></svg>
  </span>
</span>

<!-- Pill Container -->
<div class="slds-pill_container">
  <!-- pills go here -->
</div>

<!-- Listbox Pills -->
<ul class="slds-listbox slds-listbox_horizontal" role="listbox" aria-orientation="horizontal">
  <li class="slds-listbox-item" role="presentation">
    <!-- ListboxPill -->
  </li>
</ul>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-pill` | Base pill |
| `.slds-pill_link` | Pill with clickable action |
| `.slds-pill__action` | Clickable area `<a>` |
| `.slds-pill__label` | Text label |
| `.slds-pill__icon_container` | Icon wrapper |
| `.slds-pill__remove` | Remove/close button |
| `.slds-pill_container` | Container for multiple pills |
| `.slds-pill_container_bare` | Bare container (deprecated) |
| `.slds-has-error` | Error state |
| `.slds-listbox_horizontal` | Horizontal listbox pill layout |
| `.slds-listbox-item` | Individual listbox pill item |
| `.slds-listbox_selection-group` | Listbox group container |

### Styling Properties

```scss
.slds-pill { background-color; border; border-radius; color }
.slds-pill.slds-has-error { border-color (error) }
```

### Theme-relevant selectors

```css
.slds-pill                    { background-color; border; color }
.slds-pill__label             { color }
.slds-pill__remove            { color (icon fill) }
.slds-pill_container          { background-color; border }
```

---

## 12. Badge

**Selector:** `.slds-badge`
**Restricts:** `span`

### HTML Structure

```html
<!-- Default Badge -->
<span class="slds-badge">Badge Label</span>

<!-- Inverse Badge -->
<span class="slds-badge slds-badge_inverse">Inverse badge</span>

<!-- Lightest Badge -->
<span class="slds-badge slds-badge_lightest">Light badge</span>

<!-- Badge with Icon -->
<span class="slds-badge">
  <span class="slds-badge__icon slds-badge__icon_left">
    <svg class="slds-icon slds-icon_xx-small"><!-- icon --></svg>
  </span>
  423 Credits Available
</span>

<!-- Themed Badges -->
<span class="slds-badge slds-theme_success">Success badge</span>
<span class="slds-badge slds-theme_warning">Warning badge</span>
<span class="slds-badge slds-theme_error">Error badge</span>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-badge` | Base badge (light gray background) |
| `.slds-badge_inverse` | Dark/inverse variant |
| `.slds-badge_lightest` | Lightest variant |
| `.slds-badge__icon` | Icon container |
| `.slds-badge__icon_left` | Left-aligned icon |
| `.slds-badge__icon_right` | Right-aligned icon |
| `.slds-badge__icon_inverse` | Icon in inverse badge |
| `.slds-theme_success` | Green success badge |
| `.slds-theme_warning` | Yellow warning badge |
| `.slds-theme_error` | Red error badge |

### Styling Properties

```scss
.slds-badge          { background-color; color; border-radius; padding }
.slds-badge_inverse  { background-color (dark); color (light) }
.slds-badge_lightest { background-color (very light); color }
```

### CSS Custom Properties

Badges do not expose `--sds-c-*` hooks. Override via direct selectors.

### Theme-relevant selectors

```css
.slds-badge                    { background-color; color }
.slds-badge_inverse            { background-color; color }
.slds-badge_lightest           { background-color; color; border }
.slds-badge.slds-theme_success { background-color; color }
.slds-badge.slds-theme_warning { background-color; color }
.slds-badge.slds-theme_error   { background-color; color }
```

---

## 13. Panel

**Selector:** `.slds-panel`
**Restricts:** `div`

### HTML Structure

```html
<div class="slds-panel slds-size_medium slds-panel_docked slds-panel_docked-left slds-is-open">
  <div class="slds-panel__header">
    <h2 class="slds-panel__header-title slds-text-heading_small slds-truncate" title="Panel Header">
      Panel Header
    </h2>
    <div class="slds-panel__header-actions">
      <button class="slds-button slds-button_icon slds-panel__close">
        <svg><!-- close --></svg>
      </button>
    </div>
  </div>
  <div class="slds-panel__body">
    Panel body content
  </div>
</div>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-panel` | Root container |
| `.slds-panel_docked` | Docked to viewport edge |
| `.slds-panel_docked-left` | Docked to left |
| `.slds-panel_docked-right` | Docked to right |
| `.slds-panel_docked-bottom` | Docked to bottom |
| `.slds-panel_drawer` | Drawer-style panel |
| `.slds-panel_animated` | CSS-animated transitions |
| `.slds-is-open` | Panel is visible |
| `.slds-hidden` | Panel is hidden |
| `.slds-panel__header` | Header area |
| `.slds-panel__header_align-center` | Centered title |
| `.slds-panel__header_custom` | Custom header content |
| `.slds-panel__header-title` | Title text |
| `.slds-panel__header-actions` | Actions container (buttons) |
| `.slds-panel__body` | Body content |
| `.slds-panel__close` | Close button |
| `.slds-panel__back` | Back button (drill-in) |
| `.slds-size_small` | Small width |
| `.slds-size_medium` | Medium width |
| `.slds-size_large` | Large width |
| `.slds-size_x-large` | Extra large width |
| `.slds-size_full` | Full width |

### Styling Properties

```scss
.slds-panel        { background-color; box-shadow; border }
.slds-panel__header { background-color; border-bottom }
.slds-panel__body   { background-color }
```

### CSS Custom Properties

Panels do not expose `--sds-c-*` hooks. Override via direct selectors.

### Theme-relevant selectors

```css
.slds-panel                       { background-color; border; box-shadow }
.slds-panel__header               { background-color; border-bottom }
.slds-panel__header-title         { color }
.slds-panel__body                 { background-color; color }
```

---

## 14. Dropdown / Menu

**Selector:** `.slds-dropdown`
**Restricts:** `div` (inside `.slds-dropdown-trigger`)

### HTML Structure

```html
<div class="slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open">
  <button class="slds-button slds-button_icon slds-button_icon-border-filled"
    aria-haspopup="true" aria-expanded="true">
    <svg><!-- down chevron --></svg>
    <span class="slds-assistive-text">Show More</span>
  </button>
  <div class="slds-dropdown slds-dropdown_left">
    <ul class="slds-dropdown__list" role="menu" aria-label="Show More">
      <li class="slds-dropdown__item" role="presentation">
        <a href="#" role="menuitem" tabindex="0">
          <span class="slds-truncate" title="Menu Item One">Menu Item One</span>
        </a>
      </li>
      <li class="slds-dropdown__item" role="presentation">
        <a href="#" role="menuitem" tabindex="-1">
          <span class="slds-truncate" title="Menu Item Two">Menu Item Two</span>
        </a>
      </li>
      <li class="slds-has-divider_top-space" role="separator"></li>
      <li class="slds-dropdown__item" role="presentation">
        <a href="#" role="menuitem" tabindex="-1">
          <span class="slds-truncate" title="Menu Item Three">Menu Item Three</span>
        </a>
      </li>
    </ul>
  </div>
</div>
```

### Sub-Header variant

```html
<li class="slds-dropdown__header slds-truncate" title="Menu Sub Heading" role="separator">
  <span>Menu Sub Heading</span>
</li>
```

### Selectable Items

```html
<li class="slds-dropdown__item slds-is-selected" role="presentation">
  <a href="#" role="menuitemcheckbox" aria-checked="true">
    <span class="slds-truncate" title="Selected Item">
      <svg class="slds-icon slds-icon_selected slds-icon_x-small slds-icon-text-default slds-m-right_x-small">
        <!-- check -->
      </svg>
      Selected Item
    </span>
  </a>
</li>
```

### CSS Classes

| Class | Purpose |
|---|---|
| `.slds-dropdown-trigger` | Wrapper for trigger + dropdown |
| `.slds-dropdown-trigger_click` | Click-triggered dropdown |
| `.slds-is-open` | Dropdown is visible |
| `.slds-dropdown` | Dropdown menu container |
| `.slds-dropdown_left` | Left-aligned |
| `.slds-dropdown_right` | Right-aligned |
| `.slds-dropdown_bottom` | Bottom-aligned |
| `.slds-dropdown_small` | Small width |
| `.slds-dropdown_actions` | Action overflow menu |
| `.slds-dropdown__list` | Menu list `<ul>` |
| `.slds-dropdown__item` | Menu item `<li>` |
| `.slds-dropdown__header` | Sub-header/section divider |
| `.slds-is-selected` | Selected menu item |
| `.slds-has-divider_top-space` | Divider with spacing |
| `.slds-has-error` | Error state on item |
| `.slds-has-success` | Success state on item |
| `.slds-has-warning` | Warning state on item |
| `.slds-icon_selected` | Check icon for selected state |
| `.slds-dropdown_length-with-icon-10` | Max height for 10 items with icons |

### Styling Properties

```scss
.slds-dropdown         { background-color; border; border-radius; box-shadow }
.slds-dropdown__item a { color }
.slds-dropdown__item:hover a { background-color }
.slds-dropdown__header { color; border-top }
```

### CSS Custom Properties

Dropdowns do not expose `--sds-c-*` hooks. Override via direct selectors.

### Pseudo-elements

None significant for theming.

### Theme-relevant selectors

```css
.slds-dropdown                             { background-color; border; box-shadow }
.slds-dropdown__list                       { background-color }
.slds-dropdown__item > a                   { color }
.slds-dropdown__item:hover > a             { background-color; color }
.slds-dropdown__item:focus > a             { background-color }
.slds-dropdown__item.slds-is-selected > a  { color }
.slds-dropdown__header                     { color; border-top }
.slds-has-divider_top-space                { border-top }
```

---

## Appendix A: Global CSS Custom Properties (LWC Tokens)

These `:root` level custom properties control colors across all components in
Salesforce Lightning Experience. Set these for broad theming:

```css
:root {
  /* Backgrounds */
  --lwc-colorBackground: ...;
  --lwc-colorBackgroundAlt: ...;
  --lwc-colorBackgroundRow: ...;
  --lwc-colorBackgroundRowHover: ...;
  --lwc-colorBackgroundHighlight: ...;
  --lwc-colorBackgroundSelection: ...;
  --lwc-colorBackgroundButtonBrand: ...;
  --lwc-colorBackgroundButtonBrandHover: ...;
  --lwc-colorBackgroundButtonBrandActive: ...;
  --lwc-colorBackgroundButtonDefault: ...;
  --lwc-colorBackgroundButtonDefaultHover: ...;
  --lwc-headerColorBackground: ...;
  --lwc-pageColorBackground: ...;

  /* Text Colors */
  --lwc-colorTextDefault: ...;
  --lwc-colorTextWeak: ...;
  --lwc-colorTextLabel: ...;
  --lwc-colorTextPlaceholder: ...;
  --lwc-colorTextButtonBrand: ...;
  --lwc-colorTextLink: ...;
  --lwc-colorTextLinkHover: ...;

  /* Borders */
  --lwc-colorBorder: ...;
  --lwc-colorBorderSeparator: ...;
  --lwc-colorBorderInput: ...;
  --lwc-colorBorderInputActive: ...;

  /* Brand */
  --lwc-brandPrimary: ...;
  --lwc-brandPrimaryActive: ...;
  --lwc-brandPrimaryTransparent: ...;
  --lwc-brandAccessible: ...;
  --lwc-brandAccessibleActive: ...;

  /* Focus */
  --lwc-shadowOutlineFocus: ...;
}
```

## Appendix B: SLDS 2 Global Design Tokens

```css
:root {
  --slds-g-color-surface-1: ...;      /* page background */
  --slds-g-color-surface-2: ...;      /* card/component background */
  --slds-g-color-surface-3: ...;      /* elevated surface */
  --slds-g-color-surface-4: ...;      /* highest elevation */
  --slds-g-color-on-surface-1: ...;   /* primary text */
  --slds-g-color-on-surface-2: ...;   /* secondary text */
  --slds-g-color-on-surface-3: ...;   /* tertiary/muted text */
  --slds-g-color-border-1: ...;       /* default border */
  --slds-g-color-border-2: ...;       /* stronger border */
  --slds-g-color-brand-1: ...;        /* primary brand */
  --slds-g-color-brand-2: ...;        /* brand hover */
  --slds-g-color-brand-3: ...;        /* brand active */
  --slds-g-color-neutral-1: ...;      /* neutral light */
  --slds-g-color-neutral-2: ...;      /* neutral medium */
  --slds-g-color-neutral-3: ...;      /* neutral dark */
}
```

## Appendix C: Live Salesforce DOM Selectors

In live Salesforce Lightning Experience, additional non-SLDS selectors are
needed because SF uses custom components and shadow DOM:

```css
/* Main content areas */
.oneGlobalNav, one-app-nav-bar, .navexConsoleTabBar
.oneContent, .oneWorkspace, .flexipageBody
.forceListViewManager .listViewManager

/* Record pages */
.forceRecordCard, .forcePageBlockSectionRow
.forceOutputField, .forceOutputLookup

/* Setup pages */
.setupcontent, .onesetupSetupLayout, .forceSetupDesktop

/* Console / Service Console */
.navexConsoleContent, .navexConsoleTabItem
.workspaceManager, .split-view

/* Reports */
.report-container, .reportOutput, .forceReportOutput
```

These selectors are not part of SLDS but appear in the live DOM and may need
theming overrides.

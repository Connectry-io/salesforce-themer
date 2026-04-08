# SLDS 2 (Cosmos) Component & Token Reference

> Generated 2026-04-08 from SLDS CSS v2.29.1 (unpkg.com/@salesforce-ux/design-system)
> and Salesforce developer documentation (developer.salesforce.com)

## Key Differences: SLDS 1 vs SLDS 2

### Token Naming
| System | Prefix | Example | Status |
|--------|--------|---------|--------|
| SLDS 1 (LWC) | `--lwc-*` | `--lwc-colorBackground` | Legacy, still active in runtime |
| SLDS 2 Global | `--slds-g-*` | `--slds-g-color-neutral-base-95` | Active in CSS, set on `:root` |
| SLDS 2 Component | `--slds-c-*` | `--slds-c-card-color-background` | In SLDS CSS; **NOT yet supported in Cosmos theme** |

### Critical Note (from Salesforce docs)
> "Currently, SLDS 2 doesn't support component-level styling hooks (--slds-c-*).
> If your custom components use component-level styling hooks, we recommend that you
> use only SLDS 1 themes in your org for now."
>
> Component styling hooks exist in the SLDS CSS blueprint but are not wired up in the
> Cosmos runtime. For a Chrome extension, we can still override them via injected CSS
> because the var() fallback mechanism reads our values.

### CSS Class Convention Change
- SLDS 1: `slds-button--brand` (double hyphen modifier)
- SLDS 2: `slds-button_brand` (underscore modifier)
- Both coexist; the CSS includes both selectors for backward compatibility.

### HTML Structure
SLDS 2 (Cosmos) uses the same HTML blueprint structure as SLDS 1. The DOM hierarchy
and CSS class names are identical. The visual change comes from new default values
for the CSS custom properties and updated typography/spacing tokens.

---

## SAFE OVERRIDE PROPERTIES (for theming)

**CHANGE (colors only):**
- `background-color`, `background` (solid colors)
- `border-color`, `border-top-color`, `border-bottom-color`
- `color`
- `fill` (SVG icons)
- `box-shadow` (color component only -- keep blur/spread/offset)
- `outline-color`

**NEVER CHANGE:**
- `border-width`, `border-style`, `border-radius`
- `padding`, `margin`
- `display`, `position`, `flex`, `grid`
- `clip-path`, `mask`
- `font-size`, `font-weight`, `line-height`, `letter-spacing`
- `width`, `height`, `min-*`, `max-*`
- `transform`, `transition`
- `z-index`, `overflow`

---

## GLOBAL TOKENS (--slds-g-*)

### Color: Neutral Scale (light-to-dark)
```
--slds-g-color-neutral-base-100: #ffffff   (white)
--slds-g-color-neutral-base-95:  #f3f3f3   (lightest gray)
--slds-g-color-neutral-base-90:  #e5e5e5
--slds-g-color-neutral-base-80:  #c9c9c9
--slds-g-color-neutral-base-70:  #aeaeae
--slds-g-color-neutral-base-65:  #a0a0a0
--slds-g-color-neutral-base-60:  #939393
--slds-g-color-neutral-base-50:  #747474
--slds-g-color-neutral-base-40:  #5c5c5c
--slds-g-color-neutral-base-30:  #444444
--slds-g-color-neutral-base-20:  #2e2e2e
--slds-g-color-neutral-base-15:  #242424
--slds-g-color-neutral-base-10:  #181818   (near-black)
```

### Color: Brand Scale (Salesforce Blue)
```
--slds-g-color-brand-base-100: #ffffff
--slds-g-color-brand-base-95:  #eef4ff
--slds-g-color-brand-base-90:  #d8e6fe
--slds-g-color-brand-base-80:  #aacbff
--slds-g-color-brand-base-70:  #78b0fd
--slds-g-color-brand-base-65:  #57a3fd
--slds-g-color-brand-base-60:  #1b96ff   (primary brand blue)
--slds-g-color-brand-base-50:  #0176d3
--slds-g-color-brand-base-40:  #0b5cab
--slds-g-color-brand-base-30:  #014486
--slds-g-color-brand-base-20:  #032d60
--slds-g-color-brand-base-15:  #03234d
--slds-g-color-brand-base-10:  #001639
```

### Color: Error Scale (Red)
```
--slds-g-color-error-base-100: #ffffff
--slds-g-color-error-base-90:  #feded8
--slds-g-color-error-base-80:  #feb8ab
--slds-g-color-error-base-70:  #fe8f7d
--slds-g-color-error-base-60:  #fe5c4c
--slds-g-color-error-base-50:  #ea001e   (primary error red)
--slds-g-color-error-base-40:  #ba0517
--slds-g-color-error-base-30:  #8e030f
--slds-g-color-error-base-20:  #640103
--slds-g-color-error-base-10:  #300c01
```

### Color: Warning Scale (Orange)
```
--slds-g-color-warning-base-100: #ffffff
--slds-g-color-warning-base-90:  #fedfd0
--slds-g-color-warning-base-80:  #ffba90
--slds-g-color-warning-base-70:  #fe9339
--slds-g-color-warning-base-60:  #dd7a01
--slds-g-color-warning-base-50:  #a96404   (primary warning)
--slds-g-color-warning-base-40:  #825101
--slds-g-color-warning-base-30:  #5f3e02
--slds-g-color-warning-base-20:  #3e2b02
--slds-g-color-warning-base-10:  #201600
```

### Color: Success Scale (Green)
```
--slds-g-color-success-base-100: #ffffff
--slds-g-color-success-base-90:  #cdefc4
--slds-g-color-success-base-80:  #91db8b
--slds-g-color-success-base-70:  #45c65a
--slds-g-color-success-base-60:  #3ba755
--slds-g-color-success-base-50:  #2e844a   (primary success)
--slds-g-color-success-base-40:  #396547
--slds-g-color-success-base-30:  #194e31
--slds-g-color-success-base-20:  #1C3326
--slds-g-color-success-base-10:  #071b12
```

### Color: Border
```
--slds-g-color-border-base-1:   #c9c9c9   (default border)
--slds-g-color-border-base-2:   #aeaeae
--slds-g-color-border-base-3:   #939393
--slds-g-color-border-base-4:   #747474
--slds-g-color-border-brand-1:  #78b0fd
--slds-g-color-border-brand-2:  #1b96ff
```

### Color: Link
```
--slds-g-link-color:            #0b5cab
--slds-g-link-color-hover:      #014486
--slds-g-link-color-focus:      #014486
--slds-g-link-color-active:     #032d60
```

### Color: Opacity Variants
```
--slds-g-color-neutral-10-opacity-10:  rgba(24, 24, 24, 0.1)
--slds-g-color-neutral-10-opacity-25:  rgba(24, 24, 24, 0.25)
--slds-g-color-neutral-10-opacity-50:  rgba(24, 24, 24, 0.5)
--slds-g-color-neutral-10-opacity-75:  rgba(24, 24, 24, 0.75)
--slds-g-color-neutral-100-opacity-10: rgba(255, 255, 255, 0.1)
--slds-g-color-neutral-100-opacity-25: rgba(255, 255, 255, 0.25)
--slds-g-color-neutral-100-opacity-50: rgba(255, 255, 255, 0.5)
--slds-g-color-neutral-100-opacity-75: rgba(255, 255, 255, 0.75)
```

### Shadow: Focus
```
--slds-g-shadow-outset-focus-1:         0 0 0 2px #FFFFFF, 0 0 0 4px #0B5CAB
--slds-g-shadow-inset-focus-1:          0 0 0 2px #FFFFFF inset, 0 0 0 4px #0B5CAB inset
--slds-g-shadow-inset-inverse-focus-1:  0 0 0 2px #0B5CAB inset, 0 0 0 4px #FFFFFF inset
--slds-g-shadow-outline-focus-1:        0 0 0 2px #0B5CAB
```

### Palette Colors (used by component CSS internally)
Full palette available: blue, cloud-blue, green, hot-orange, indigo, orange, pink,
purple, red, teal, violet, yellow, neutral -- each with steps 10-95.
See full values in the `:root` block of salesforce-lightning-design-system.css.

### Global Tokens Actually Referenced in Component CSS
These 55 global tokens are the ones components actually consume via `var()`:
```
--slds-g-color-border-base-1       (default borders everywhere)
--slds-g-color-border-base-4       (stronger borders)
--slds-g-color-border-brand-2      (brand-colored borders)
--slds-g-color-brand-base-10..60   (brand backgrounds, text)
--slds-g-color-error-base-30..50   (error states)
--slds-g-color-neutral-base-*      (backgrounds, text, borders)
--slds-g-color-neutral-*-opacity-* (overlays, backdrops)
--slds-g-color-success-base-40..70 (success states)
--slds-g-color-warning-base-50..70 (warning states)
--slds-g-color-palette-blue-20..40 (specific blue shades)
--slds-g-color-palette-cloud-blue-60..90
--slds-g-color-palette-pink-90
--slds-g-color-palette-yellow-80..90
--slds-g-link-color, link-color-hover, link-color-focus
--slds-g-shadow-*-focus-1          (all 4 focus shadow variants)
```

---

## LEGACY TOKENS (--lwc-*)

These are injected by the Lightning runtime (not in the npm CSS). The engine sets:
```
--lwc-colorBackground              page background
--lwc-colorBackgroundAlt            surface/card background
--lwc-colorBackgroundRow            table row background
--lwc-colorBackgroundRowHover       table row hover
--lwc-colorBackgroundHighlight      selected/highlighted areas
--lwc-colorBackgroundSelection      selection background
--lwc-colorBackgroundButtonBrand    brand button bg
--lwc-colorBackgroundButtonBrandHover
--lwc-colorBackgroundButtonBrandActive
--lwc-colorBackgroundButtonDefault  neutral button bg
--lwc-colorBackgroundButtonDefaultHover
--lwc-headerColorBackground         global header bg
--lwc-pageColorBackground           page bg
--lwc-colorTextDefault              primary text
--lwc-colorTextWeak                 secondary text
--lwc-colorTextLabel                label text
--lwc-colorTextPlaceholder          placeholder text
--lwc-colorTextButtonBrand          brand button text
--lwc-colorTextLink                 link color
--lwc-colorTextLinkHover
--lwc-colorBorder                   default border
--lwc-colorBorderSeparator          separator lines
--lwc-colorBorderInput              input border
--lwc-colorBorderInputActive        input focus border
--lwc-brandPrimary                  primary brand color
--lwc-brandPrimaryActive
--lwc-brandPrimaryTransparent
--lwc-brandAccessible               accessible brand color
--lwc-brandAccessibleActive
--lwc-colorBackgroundSpin           spinner color
--lwc-shadowOutlineFocus            focus ring shadow
```

---

## COMPONENT HOOKS (--slds-c-*) WITH CSS PROPERTY MAPPINGS

### Card
```html
<article class="slds-card">
  <div class="slds-card__header">
    <header class="slds-media slds-media_center">
      <div class="slds-media__figure">
        <span class="slds-icon_container">...</span>
      </div>
      <div class="slds-media__body">
        <h2 class="slds-card__header-title">
          <a class="slds-card__header-link">Title</a>
        </h2>
      </div>
    </header>
  </div>
  <div class="slds-card__body slds-card__body_inner">
    ...content...
  </div>
  <footer class="slds-card__footer">
    <a class="slds-card__footer-action">View All</a>
  </footer>
</article>
```

**Variants:** `.slds-card_boundary`, `.slds-card_empty` / `.slds-card--empty`

**Safe color hooks:**
| Token | Maps to | Safe to override |
|-------|---------|:---:|
| `--slds-c-card-color-background` | `background` | YES |
| `--slds-c-card-color-border` | `border-color` | YES |
| `--slds-c-card-text-color` | `color` | YES |
| `--slds-c-card-shadow` | `box-shadow` | YES (color only) |
| `--slds-c-card-footer-color-border` | `border-top-color` | YES |

**Do NOT override:**
| Token | Maps to |
|-------|---------|
| `--slds-c-card-radius-border` | `border-radius` |
| `--slds-c-card-sizing-border` | `border-width` |
| `--slds-c-card-spacing-*` | `padding-*` |
| `--slds-c-card-body-spacing-*` | `padding-*`, `margin-*` |
| `--slds-c-card-header-spacing-*` | `padding-*` |
| `--slds-c-card-footer-spacing-*` | `padding-*`, `margin-top` |
| `--slds-c-card-heading-font-size` | `font-size` |
| `--slds-c-card-heading-font-weight` | `font-weight` |
| `--slds-c-card-footer-font-size` | `font-size` |

---

### Buttons
```html
<button class="slds-button slds-button_brand">Brand</button>
<button class="slds-button slds-button_neutral">Neutral</button>
<button class="slds-button slds-button_destructive">Delete</button>
<button class="slds-button slds-button_success">Success</button>
<button class="slds-button slds-button_outline-brand">Outline</button>
<button class="slds-button slds-button_inverse">Inverse</button>
<button class="slds-button slds-button_text-destructive">Text Destructive</button>
```

**Button Group:**
```html
<div class="slds-button-group" role="group">
  <button class="slds-button slds-button_neutral">...</button>
  <button class="slds-button slds-button_neutral">...</button>
</div>
```

**Button Icons:**
```html
<button class="slds-button slds-button_icon slds-button_icon-border">
  <svg class="slds-button__icon">...</svg>
</button>
```

Icon variants: `slds-button_icon-border-filled`, `slds-button_icon-border-inverse`,
`slds-button_icon-inverse`, `slds-button_icon-error`, `slds-button_icon-warning`

**Safe color hooks (brand variant):**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-button-brand-color-background` | `background-color` | YES |
| `--slds-c-button-brand-color-background-hover` | hover `background-color` | YES |
| `--slds-c-button-brand-color-background-active` | active `background-color` | YES |
| `--slds-c-button-brand-color-border` | `border-color` | YES |
| `--slds-c-button-brand-color-border-hover` | hover `border-color` | YES |
| `--slds-c-button-brand-text-color` | `color` | YES |
| `--slds-c-button-brand-text-color-hover` | hover `color` | YES |

**Safe color hooks (neutral variant):**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-button-neutral-color-background` | `background-color` | YES |
| `--slds-c-button-neutral-color-background-hover` | hover `background-color` | YES |
| `--slds-c-button-neutral-color-border` | `border-color` | YES |

**Safe color hooks (destructive variant):**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-button-destructive-color-background` | `background-color` | YES |
| `--slds-c-button-destructive-color-border` | `border-color` | YES |
| `--slds-c-button-destructive-text-color` | `color` | YES |

**Safe color hooks (base/shared):**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-button-color-background` | `background-color` | YES |
| `--slds-c-button-color-border` | `border-color` | YES |
| `--slds-c-button-text-color` | `color` | YES |
| `--slds-c-button-shadow` | `box-shadow` | YES (color only) |
| `--slds-c-button-shadow-focus` | focus `box-shadow` | YES (color only) |

**Do NOT override:**
| Token | Maps to |
|-------|---------|
| `--slds-c-button-radius-border` | `border-radius` |
| `--slds-c-button-sizing-border` | `border-width` |
| `--slds-c-button-spacing-*` | `padding-*` |
| `--slds-c-button-line-height` | `line-height` |

---

### Data Tables
```html
<table class="slds-table slds-table_bordered slds-table_cell-buffer slds-table_fixed-layout">
  <thead>
    <tr class="slds-line-height_reset">
      <th class="slds-text-title_caps" scope="col">
        <a class="slds-th__action slds-text-link_reset">
          <span class="slds-truncate">Column</span>
        </a>
      </th>
    </tr>
  </thead>
  <tbody>
    <tr class="slds-hint-parent">
      <td data-label="Column">
        <div class="slds-truncate">Cell</div>
      </td>
    </tr>
  </tbody>
</table>
```

**Variants:**
- `.slds-table_bordered` -- borders on all sides
- `.slds-table_col-bordered` -- column borders
- `.slds-table_striped` -- alternating row colors
- `.slds-table_fixed-layout` -- fixed column widths
- `.slds-table_cell-buffer` -- cell padding
- `.slds-table_resizable-cols` -- resizable columns
- `.slds-table_header-fixed` -- fixed header

**States:**
- `tr.slds-is-selected` -- selected row
- `td.slds-has-focus` -- focused cell
- `.slds-is-sorted` -- sorted column header
- `.slds-is-sorted_asc` / `.slds-is-sorted_desc`
- `.slds-is-resizable` -- resizable column

**No dedicated --slds-c-table-* hooks exist.** Tables rely on global tokens:
- Background: `--slds-g-color-neutral-base-100` (row), `--slds-g-color-neutral-base-95` (header/alt)
- Borders: `--slds-g-color-border-base-1`
- Text: inherits from parent

**Direct CSS override targets for tables:**
```css
.slds-table { background-color; color; border-color; }
.slds-table thead th { background-color; color; border-bottom-color; }
.slds-table tbody tr:hover { background-color; }
.slds-table_striped tbody tr:nth-child(even) { background-color; }
.slds-table tbody td { border-bottom-color; }
.slds-table .slds-is-selected { background-color; }
```

---

### Form Elements
```html
<div class="slds-form-element">
  <label class="slds-form-element__label" for="input-id">Label</label>
  <div class="slds-form-element__control">
    <input type="text" id="input-id" class="slds-input" />
  </div>
  <div class="slds-form-element__help">Help text</div>
</div>
```

**Variants:**
- `.slds-form-element_stacked` -- stacked layout
- `.slds-form-element_horizontal` -- horizontal layout
- `.slds-form-element_compound` -- compound fields
- `.slds-form-element_readonly` -- read-only display
- `.slds-form_compound` -- compound form

**States:**
- `.slds-has-error` -- error state on `.slds-form-element`
- `.slds-is-required` -- required field
- `.slds-is-edited` -- edited field

---

### Input
```html
<input type="text" class="slds-input" />
```

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-input-color-background` | `background-color` | YES |
| `--slds-c-input-color-background-focus` | focus `background-color` | YES |
| `--slds-c-input-color-border` | `border-color` | YES |
| `--slds-c-input-color-border-focus` | focus `border-color` | YES |
| `--slds-c-input-text-color` | `color` | YES |
| `--slds-c-input-text-color-focus` | focus `color` | YES |
| `--slds-c-input-shadow` | `box-shadow` | YES (color only) |
| `--slds-c-input-shadow-focus` | focus `box-shadow` | YES (color only) |

**Do NOT override:**
| Token | Maps to |
|-------|---------|
| `--slds-c-input-radius-border` | `border-radius` |
| `--slds-c-input-spacing-inline-*` | `padding-left/right` |

**Input variants:**
- `.slds-input_bare` / `.slds-input--bare` -- borderless
- `.slds-input_counter` -- numeric counter
- `.slds-input-has-icon_left` / `_right` / `_left-right` -- icon positioning

---

### Textarea
```html
<textarea class="slds-textarea"></textarea>
```

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-textarea-color-background` | `background-color` | YES |
| `--slds-c-textarea-color-background-focus` | focus `background-color` | YES |
| `--slds-c-textarea-color-border` | `border-color` | YES |
| `--slds-c-textarea-color-border-focus` | focus `border-color` | YES |
| `--slds-c-textarea-text-color` | `color` | YES |
| `--slds-c-textarea-shadow` | `box-shadow` | YES (color only) |

---

### Select
```html
<div class="slds-select_container">
  <select class="slds-select">
    <option>Option</option>
  </select>
</div>
```

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-select-color-background` | `background-color` | YES |
| `--slds-c-select-color-background-focus` | focus `background-color` | YES |
| `--slds-c-select-color-border` | `border-color` | YES |
| `--slds-c-select-color-border-focus` | focus `border-color` | YES |
| `--slds-c-select-text-color` | `color` | YES |
| `--slds-c-select-shadow` | `box-shadow` | YES (color only) |

---

### Checkbox
```html
<div class="slds-checkbox">
  <input type="checkbox" id="cb" />
  <label class="slds-checkbox__label" for="cb">
    <span class="slds-checkbox_faux"></span>
    <span class="slds-form-element__label">Label</span>
  </label>
</div>
```

**Toggle variant:**
```html
<div class="slds-checkbox_toggle">...</div>
```

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-checkbox-color-background` | `background-color` | YES |
| `--slds-c-checkbox-color-background-checked` | checked `background-color` | YES |
| `--slds-c-checkbox-color-border` | `border-color` | YES |
| `--slds-c-checkbox-color-border-checked` | checked `border-color` | YES |
| `--slds-c-checkbox-mark-color-foreground` | checkmark `background` | YES |
| `--slds-c-checkbox-shadow` | `box-shadow` | YES (color only) |
| `--slds-c-checkbox-toggle-color-background` | toggle bg | YES |
| `--slds-c-checkbox-toggle-color-background-checked` | toggle checked bg | YES |
| `--slds-c-checkbox-toggle-color-border` | toggle border | YES |
| `--slds-c-checkbox-toggle-switch-color-background` | switch knob bg | YES |
| `--slds-c-checkbox-toggle-switch-color-background-checked` | switch checked knob | YES |

---

### Radio
```html
<div class="slds-radio">
  <input type="radio" id="radio" />
  <label class="slds-radio__label" for="radio">
    <span class="slds-radio_faux"></span>
    <span class="slds-form-element__label">Label</span>
  </label>
</div>
```

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-radio-color-background` | `background-color` | YES |
| `--slds-c-radio-color-background-checked` | checked `background-color` | YES |
| `--slds-c-radio-color-border-checked` | checked `border-color` | YES |
| `--slds-c-radio-color-border-focus` | focus `border-color` | YES |
| `--slds-c-radio-mark-color-foreground` | radio dot `background-color` | YES |
| `--slds-c-radio-shadow` | `box-shadow` | YES (color only) |

---

### Combobox
```html
<div class="slds-combobox_container">
  <div class="slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click">
    <div class="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right">
      <input class="slds-input slds-combobox__input" />
    </div>
    <div class="slds-dropdown slds-dropdown_length-5 slds-dropdown_fluid">
      <ul class="slds-listbox slds-listbox_vertical">
        <li class="slds-listbox__item">
          <div class="slds-listbox__option">...</div>
        </li>
      </ul>
    </div>
  </div>
</div>
```

**Listbox hooks (dropdown options):**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-listbox-option-color-background` | option `background-color` | YES |
| `--slds-c-listbox-option-color-background-hover` | hover `background-color` | YES |
| `--slds-c-listbox-option-color-background-focus` | focus `background-color` | YES |
| `--slds-c-listbox-option-color` | option `color` | YES |
| `--slds-c-listbox-option-color-hover` | hover `color` | YES |
| `--slds-c-listbox-option-color-focus` | focus `color` | YES |

---

### Datepicker
```html
<div class="slds-datepicker">
  <div class="slds-datepicker__filter">
    <div class="slds-datepicker__filter_month">...</div>
  </div>
  <table class="slds-datepicker__month">
    <thead>...</thead>
    <tbody>
      <tr>
        <td class="slds-day" role="gridcell">1</td>
      </tr>
    </tbody>
  </table>
</div>
```

**No dedicated --slds-c-datepicker-* hooks.** Override via direct CSS selectors.
States: `.slds-is-selected`, `.slds-is-today`, `.slds-disabled-text`

---

### Slider
```html
<div class="slds-slider">
  <input type="range" class="slds-slider__range" />
  <span class="slds-slider__value">50</span>
</div>
```

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-slider-thumb-color-foreground` | thumb `background-color` | YES |
| `--slds-c-slider-thumb-color-foreground-hover` | hover thumb | YES |
| `--slds-c-slider-thumb-color-foreground-focus` | focus thumb | YES |
| `--slds-c-slider-thumb-color-foreground-active` | active thumb | YES |
| `--slds-c-slider-track-color-background` | track `background-color` | YES |
| `--slds-c-slider-thumb-shadow` | thumb `box-shadow` | YES (color only) |

---

### File Selector
```html
<div class="slds-file-selector slds-file-selector_files">
  <div class="slds-file-selector__dropzone">
    <input class="slds-file-selector__input" type="file" />
    <label class="slds-file-selector__body">
      <span class="slds-file-selector__button slds-button slds-button_neutral">Upload</span>
      <span class="slds-file-selector__text">or Drop Files</span>
    </label>
  </div>
</div>
```

**No dedicated hooks.** Uses button and form element hooks.

---

### Rich Text Editor
```html
<div class="slds-rich-text-editor">
  <div class="slds-rich-text-editor__toolbar">
    <ul class="slds-button-group-list">...</ul>
  </div>
  <div class="slds-rich-text-editor__textarea">
    <div class="slds-rich-text-area__content" contenteditable="true">...</div>
  </div>
</div>
```

**No dedicated hooks.** Override toolbar and textarea directly.

---

### Page Headers
```html
<div class="slds-page-header">
  <div class="slds-page-header__row">
    <div class="slds-page-header__col-title">
      <div class="slds-media">
        <div class="slds-media__figure">
          <span class="slds-icon_container">...</span>
        </div>
        <div class="slds-media__body">
          <div class="slds-page-header__name">
            <div class="slds-page-header__name-title">
              <h1><span class="slds-page-header__title">Title</span></h1>
            </div>
          </div>
          <p class="slds-page-header__meta-text">Meta</p>
        </div>
      </div>
    </div>
    <div class="slds-page-header__col-actions">
      <div class="slds-page-header__controls">...</div>
    </div>
  </div>
</div>
```

**Variants:** `.slds-page-header_object-home`, `.slds-page-header_vertical`, `.slds-page-header_joined`

**No dedicated --slds-c-page-header-* hooks.** Override directly:
```css
.slds-page-header { background-color; border-color; box-shadow; }
.slds-page-header__title { color; }
.slds-page-header__meta-text { color; }
```

---

### Panels
```html
<div class="slds-panel slds-panel_docked slds-panel_docked-right slds-is-open">
  <div class="slds-panel__header">
    <h2 class="slds-panel__header-title">Panel Title</h2>
    <button class="slds-panel__close">...</button>
  </div>
  <div class="slds-panel__body">
    <div class="slds-panel__section">...</div>
  </div>
</div>
```

**Variants:** `.slds-panel_docked-left`, `.slds-panel_docked-right`, `.slds-panel_filters`
**States:** `.slds-is-open`, `.slds-is-editing`

**No dedicated hooks.** Override directly:
```css
.slds-panel { background-color; border-color; }
.slds-panel__header { background-color; border-bottom-color; }
```

---

### Split View
```html
<div class="slds-split-view_container">
  <div class="slds-split-view">
    <div class="slds-split-view__header">...</div>
    <div class="slds-split-view__list-header">...</div>
    <ul>
      <li class="slds-split-view__list-item">
        <a class="slds-split-view__list-item-action">...</a>
      </li>
    </ul>
  </div>
</div>
```

---

### Vertical Navigation
```html
<nav class="slds-nav-vertical">
  <div class="slds-nav-vertical__section">
    <h2 class="slds-nav-vertical__title">Section</h2>
    <ul>
      <li class="slds-nav-vertical__item slds-is-active">
        <a class="slds-nav-vertical__action">Item</a>
      </li>
    </ul>
  </div>
</nav>
```

**Variants:** `.slds-nav-vertical_compact`, `.slds-nav-vertical_shade`
**States:** `.slds-is-active`

---

### Tabs
```html
<div class="slds-tabs_default">
  <ul class="slds-tabs_default__nav" role="tablist">
    <li class="slds-tabs_default__item slds-is-active" role="presentation">
      <a class="slds-tabs_default__link" role="tab">Tab 1</a>
    </li>
  </ul>
  <div class="slds-tabs_default__content slds-show" role="tabpanel">
    ...content...
  </div>
</div>
```

**Scoped variant:** `.slds-tabs_scoped`, `.slds-tabs_scoped__nav`, `.slds-tabs_scoped__item`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-tabs-item-text-color` | tab text `color` | YES |
| `--slds-c-tabs-item-text-color-active` | active tab text `color` | YES |
| `--slds-c-tabs-item-color-border-active` | active indicator `background-color` | YES |
| `--slds-c-tabs-item-color-border-hover` | hover indicator `background-color` | YES |
| `--slds-c-tabs-list-color-border` | tab bar `border-bottom-color` | YES |

**Do NOT override:**
| Token | Maps to |
|-------|---------|
| `--slds-c-tabs-item-spacing-*` | `padding-*` |
| `--slds-c-tabs-item-sizing-height` | `height` |
| `--slds-c-tabs-item-line-height` | `line-height` |
| `--slds-c-tabs-list-sizing-border` | `border-bottom-width` |
| `--slds-c-tabs-panel-spacing-*` | `padding-*` |

---

### Vertical Tabs
Same hook system as tabs. Uses `.slds-vertical-tabs`, `.slds-vertical-tabs__nav-item`,
`.slds-vertical-tabs__link`, `.slds-vertical-tabs__content`.

---

### Path
```html
<div class="slds-path">
  <div class="slds-path__track">
    <div class="slds-path__scroller">
      <div class="slds-path__scroller_inner">
        <ul class="slds-path__nav" role="listbox">
          <li class="slds-path__item slds-is-complete" role="presentation">
            <a class="slds-path__link" role="option">
              <span class="slds-path__stage">
                <svg>...</svg>
              </span>
              <span class="slds-path__title">Stage</span>
            </a>
          </li>
          <li class="slds-path__item slds-is-current">...</li>
          <li class="slds-path__item slds-is-incomplete">...</li>
          <li class="slds-path__item slds-is-lost">...</li>
          <li class="slds-path__item slds-is-won">...</li>
        </ul>
      </div>
    </div>
    <div class="slds-path__action">
      <button class="slds-button slds-button_brand slds-path__mark-complete">
        Mark Complete
      </button>
    </div>
  </div>
  <div class="slds-path__coach">
    <div class="slds-path__keys">...</div>
    <div class="slds-path__guidance">...</div>
  </div>
</div>
```

**States:**
- `.slds-is-complete` -- completed step (green-ish chevron)
- `.slds-is-current` -- current step (blue chevron)
- `.slds-is-incomplete` -- future step (gray chevron)
- `.slds-is-active` -- hovered/focused step
- `.slds-is-lost` -- lost opportunity
- `.slds-is-won` -- won/closed

**No dedicated --slds-c-path-* hooks.** The path chevrons use clip-path for the
arrow shape. Override colors via:
```css
.slds-path__item.slds-is-complete .slds-path__link { background-color; color; }
.slds-path__item.slds-is-current .slds-path__link { background-color; color; }
.slds-path__item.slds-is-incomplete .slds-path__link { background-color; color; }
```

---

### Global Navigation (Context Bar)
```html
<div class="slds-context-bar">
  <div class="slds-context-bar__primary">
    <div class="slds-context-bar__item slds-context-bar__dropdown-trigger">
      <div class="slds-context-bar__icon-action">
        <!-- App launcher waffle -->
      </div>
      <span class="slds-context-bar__app-name">App Name</span>
    </div>
  </div>
  <nav class="slds-context-bar__secondary">
    <ul>
      <li class="slds-context-bar__item slds-is-active">
        <a class="slds-context-bar__label-action">Tab</a>
      </li>
    </ul>
  </nav>
</div>
```

**Variants:** `.slds-context-bar_tabs` (console-style tabs)
**States:** `.slds-is-active`, `.slds-is-unsaved`, `.slds-has-notification`

**No dedicated hooks.** Override directly:
```css
.slds-context-bar { background-color; border-bottom-color; }
.slds-context-bar__item { color; }
.slds-context-bar__item:hover { background-color; }
.slds-context-bar__item.slds-is-active { background-color; border-bottom-color; }
.slds-context-bar__label-action { color; }
.slds-context-bar__app-name { color; border-right-color; }
```

---

### Breadcrumbs
```html
<nav aria-label="Breadcrumbs">
  <ol class="slds-breadcrumb slds-list_horizontal">
    <li class="slds-breadcrumb__item">
      <a>Parent</a>
    </li>
    <li class="slds-breadcrumb__item">
      <a>Child</a>
    </li>
  </ol>
</nav>
```

**Hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-breadcrumbs-spacing-inline-end` | `margin-right`, `padding-right` | NO |
| `--slds-c-breadcrumbs-spacing-inline-start` | `padding-left` | NO |

**Override directly:** link `color` inherits from global link tokens.

---

### Alert
```html
<div class="slds-notify slds-notify_alert slds-alert_warning" role="alert">
  <span class="slds-assistive-text">Warning</span>
  <span class="slds-icon_container">...</span>
  <h2>Alert message</h2>
  <button class="slds-button slds-button_icon slds-notify__close">...</button>
</div>
```

**Variants:** `.slds-alert_warning`, `.slds-alert_error`, `.slds-alert_offline`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-alert-color-background` | `background-color` | YES |
| `--slds-c-alert-color-border` | `border-color` | YES |
| `--slds-c-alert-text-color` | `color` | YES |
| `--slds-c-alert-text-color-active` | active `color` | YES |
| `--slds-c-alert-shadow` | `box-shadow` | YES (color only) |
| `--slds-c-alert-image-background` | `background-image` | YES |

---

### Toast
```html
<div class="slds-notify_container">
  <div class="slds-notify slds-notify_toast slds-theme_success" role="status">
    <span class="slds-icon_container">...</span>
    <div class="slds-notify__content">
      <h2 class="slds-text-heading_small">Message</h2>
    </div>
    <button class="slds-button slds-button_icon slds-notify__close">...</button>
  </div>
</div>
```

**Theme classes:** `.slds-theme_success`, `.slds-theme_error`, `.slds-theme_warning`, `.slds-theme_info`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-toast-color-background` | `background-color` | YES |
| `--slds-c-toast-text-color` | `color` | YES |

**Note:** `lightning/platformShowToastEvent` does NOT support `--slds-c-toast-*`.
Only `lightning/toast` and `lightning/toastContainer` do.

---

### Spinner
```html
<div class="slds-spinner_container">
  <div class="slds-spinner slds-spinner_medium" role="status">
    <span class="slds-assistive-text">Loading</span>
    <div class="slds-spinner__dot-a"></div>
    <div class="slds-spinner__dot-b"></div>
  </div>
</div>
```

**Variants:** `slds-spinner_x-small`, `_small`, `_medium`, `_large`
**Brand:** `.slds-spinner_brand`, `.slds-spinner_inverse`

**No dedicated hooks.** Override dot colors:
```css
.slds-spinner__dot-a::before, .slds-spinner__dot-b::before,
.slds-spinner__dot-a::after, .slds-spinner__dot-b::after {
  background-color: ... !important;
}
```

---

### Progress Bar
```html
<div class="slds-progress-bar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
  <span class="slds-progress-bar__value" style="width:50%;">
    <span class="slds-assistive-text">50%</span>
  </span>
</div>
```

**Variants:** `slds-progress-bar_x-small`, `_small`, `_medium`, `_large`, `_circular`, `_vertical`
**Value variants:** `.slds-progress-bar__value_success`

---

### Progress Indicator
```html
<div class="slds-progress">
  <ol class="slds-progress__list">
    <li class="slds-progress__item slds-is-completed">
      <button class="slds-button slds-progress__marker">...</button>
    </li>
    <li class="slds-progress__item slds-is-active">
      <button class="slds-button slds-progress__marker">...</button>
    </li>
  </ol>
  <div class="slds-progress-bar">...</div>
</div>
```

---

### Scoped Notification
```html
<div class="slds-scoped-notification slds-scoped-notification_light" role="status">
  <div class="slds-media">
    <div class="slds-media__figure">...</div>
    <div class="slds-media__body">Message</div>
  </div>
</div>
```

**Variants:** `.slds-scoped-notification_light`, `.slds-scoped-notification_dark`

---

### Modal
```html
<section class="slds-modal slds-fade-in-open" role="dialog">
  <div class="slds-modal__container">
    <header class="slds-modal__header">
      <button class="slds-button slds-button_icon slds-modal__close">...</button>
      <h2 class="slds-modal__title slds-hyphenate">Title</h2>
    </header>
    <div class="slds-modal__content slds-p-around_medium">
      ...content...
    </div>
    <footer class="slds-modal__footer">
      <button class="slds-button slds-button_neutral">Cancel</button>
      <button class="slds-button slds-button_brand">Save</button>
    </footer>
  </div>
</section>
<div class="slds-backdrop slds-backdrop_open"></div>
```

**Size variants:** `.slds-modal_small`, `.slds-modal_medium`, `.slds-modal_large`, `.slds-modal_full`
**Prompt variant:** `.slds-modal_prompt`
**States:** `.slds-fade-in-open` (visible), content variants `_headless`, `_footless`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-modal-header-color-background` | header `background-color` | YES |
| `--slds-c-modal-header-text-color` | header `color` | YES |
| `--slds-c-modal-content-color-background` | content `background-color` | YES |
| `--slds-c-modal-content-text-color` | content `color` | YES |
| `--slds-c-modal-footer-color-background` | footer `background-color` | YES |
| `--slds-c-modal-footer-text-color` | footer `color` | YES |
| `--slds-c-modal-color-border` | header/footer `border-color` | YES |
| `--slds-c-modal-shadow` | `box-shadow` | YES (color only) |
| `--slds-c-modal-text-color` | overall `color` | YES |
| `--slds-c-backdrop-color-background` | backdrop `background` | YES |

**Do NOT override:**
| Token | Maps to |
|-------|---------|
| `--slds-c-modal-radius-border` | `border-radius` |
| `--slds-c-modal-sizing-border` | `border-width` |
| `--slds-c-modal-header-spacing-*` | `padding-*` |
| `--slds-c-modal-footer-spacing-*` | `padding-*` |
| `--slds-c-modal-heading-font-*` | `font-size`, `font-weight`, `line-height` |

---

### Popover
```html
<section class="slds-popover slds-nubbin_bottom" role="dialog">
  <button class="slds-button slds-button_icon slds-popover__close">...</button>
  <header class="slds-popover__header">
    <h2>Title</h2>
  </header>
  <div class="slds-popover__body">
    ...content...
  </div>
  <footer class="slds-popover__footer">...</footer>
</section>
```

**Variants:** `.slds-popover_error`, `.slds-popover_warning`, `.slds-popover_brand`,
`.slds-popover_brand-dark`, `.slds-popover_walkthrough`, `.slds-popover_feature`,
`.slds-popover_einstein`, `.slds-popover_edit`, `.slds-popover_panel`,
`.slds-popover_full-width`

**Nubbin (arrow) positions:** `.slds-nubbin_top`, `_bottom`, `_left`, `_right`,
`_top-left`, `_top-right`, `_bottom-left`, `_bottom-right`

**Limited hooks:** Only `--slds-c-popover-position-zindex`. Override directly:
```css
.slds-popover { background-color; border-color; box-shadow; color; }
.slds-popover__header { background-color; border-bottom-color; }
```

---

### Tooltip
```html
<div class="slds-popover slds-popover_tooltip slds-nubbin_bottom" role="tooltip">
  <div class="slds-popover__body">Tooltip text</div>
</div>
```

Also styled via: `.slds-tooltip` / `.slds-tooltip__body`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-tooltip-color-background` | `background-color` | YES |
| `--slds-c-tooltip-text-color` | `color` | YES |

---

### Prompt
```html
<section class="slds-modal slds-modal_prompt slds-fade-in-open">
  <div class="slds-modal__container">
    <header class="slds-modal__header slds-theme_error">
      <h2 class="slds-modal__title">Prompt Title</h2>
    </header>
    <div class="slds-modal__content slds-p-around_medium">...</div>
    <footer class="slds-modal__footer slds-theme_default">
      <button class="slds-button slds-button_neutral">OK</button>
    </footer>
  </div>
</section>
```

Uses modal hooks. Header typically themed with `.slds-theme_error`, `.slds-theme_warning`, etc.

---

### Avatar
```html
<span class="slds-avatar slds-avatar_medium">
  <img src="avatar.jpg" alt="User" />
</span>

<!-- Initials variant -->
<span class="slds-avatar slds-avatar_medium">
  <abbr class="slds-avatar__initials slds-avatar-grouped__initials slds-icon-standard-user">AB</abbr>
</span>
```

**Sizes:** `.slds-avatar_x-small`, `_small`, `_medium`, `_large`
**Shape:** `.slds-avatar_circle`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-avatar-text-color` | `color` | YES |
| `--slds-c-avatar-initials-text-color` | initials `color` | YES |

---

### Badge
```html
<span class="slds-badge">Badge Label</span>
<span class="slds-badge slds-badge_inverse">Inverse</span>
<span class="slds-badge slds-badge_lightest">Lightest</span>
```

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-badge-color-background` | `background-color` | YES |
| `--slds-c-badge-color-border` | `border-color` | YES |
| `--slds-c-badge-text-color` | `color` | YES |
| `--slds-c-badge-icon-color-foreground` | icon `color` | YES |

**Do NOT override:**
| Token | Maps to |
|-------|---------|
| `--slds-c-badge-radius-border` | `border-radius` |
| `--slds-c-badge-font-size` | `font-size` |
| `--slds-c-badge-line-height` | `line-height` |
| `--slds-c-badge-sizing-border` | `border-width` |

---

### Brand Band
```html
<div class="slds-brand-band slds-brand-band_medium">
  ...page content...
</div>
```

**Variants:** `_none`, `_small`, `_medium`, `_large`, `_full`, `_cover`,
`_bottom`, `_blank`, `_user`, `_group`

**No hooks.** Override background-image/color directly.

---

### Pill
```html
<span class="slds-pill">
  <span class="slds-pill__icon_container">...</span>
  <span class="slds-pill__label">Label</span>
  <button class="slds-button slds-pill__remove">
    <svg class="slds-button__icon">...</svg>
  </button>
</span>
```

**Container:**
```html
<div class="slds-pill_container">
  <span class="slds-pill">...</span>
  <span class="slds-pill">...</span>
</div>
```

**Variants:** `.slds-pill_link`, `.slds-pill_bare`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-pill-color-background` | `background-color` | YES |
| `--slds-c-pill-color-background-hover` | hover `background-color` | YES |
| `--slds-c-pill-color-border` | `border-color` | YES |
| `--slds-c-pill-error-color-border` | error `border-color` | YES |
| `--slds-c-pill-error-text-color` | error `color` | YES |
| `--slds-c-pill-container-color-background` | container `background-color` | YES |
| `--slds-c-pill-shadow` | `box-shadow` | YES (color only) |

---

### Icon
```html
<span class="slds-icon_container slds-icon-standard-account">
  <svg class="slds-icon slds-icon_small">
    <use xlink:href="/icons/standard-sprite/svg/symbols.svg#account"></use>
  </svg>
  <span class="slds-assistive-text">Account</span>
</span>
```

**Sizes:** `.slds-icon_xx-small`, `_x-small`, `_small`, `_medium` (default), `_large`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-icon-color-foreground` | SVG `fill` | YES |
| `--slds-c-icon-color-foreground-default` | default `fill` | YES |
| `--slds-c-icon-color-background` | container `background-color` | YES |

**Note:** 1121 `.slds-icon-*` utility classes exist for icon-specific background colors.

---

### Accordion
```html
<ul class="slds-accordion">
  <li class="slds-accordion__list-item">
    <section class="slds-accordion__section slds-is-open">
      <div class="slds-accordion__summary">
        <h2 class="slds-accordion__summary-heading">
          <button class="slds-accordion__summary-action">
            <svg class="slds-accordion__summary-action-icon">...</svg>
            <span class="slds-accordion__summary-content">Title</span>
          </button>
        </h2>
      </div>
      <div class="slds-accordion__content">...content...</div>
    </section>
  </li>
</ul>
```

**States:** `.slds-is-open`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-accordion-heading-color` | heading `color` | YES |
| `--slds-c-accordion-heading-text-color-hover` | hover heading `color` | YES |
| `--slds-c-accordion-section-color-border` | section `border-top-color` | YES |
| `--slds-c-accordion-summary-color-background` | summary `background-color` | YES |

---

### Dropdown / Menu
```html
<div class="slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open">
  <button class="slds-button">...</button>
  <div class="slds-dropdown slds-dropdown_left">
    <ul class="slds-dropdown__list" role="menu">
      <li class="slds-dropdown__item" role="presentation">
        <a role="menuitem">
          <span class="slds-truncate">Action</span>
        </a>
      </li>
      <li class="slds-has-divider_top-space" role="separator"></li>
    </ul>
  </div>
</div>
```

**Position variants:** `.slds-dropdown_left`, `_right`, `_center`, `_bottom`
**Length variants:** `.slds-dropdown_length-5`, `_length-7`, `_length-10`

**Safe color hooks:**
| Token | Maps to | Safe |
|-------|---------|:---:|
| `--slds-c-dropdown-color` | text `color` | YES |
| `--slds-c-dropdown-item-color` | item `color` | YES |
| `--slds-c-dropdown-item-color-hover` | item hover `color` | YES |
| `--slds-c-dropdown-item-color-focus` | item focus `color` | YES |
| `--slds-c-dropdown-item-color-active` | item active `color` | YES |
| `--slds-c-dropdown-item-color-background` | item `background-color` | YES |
| `--slds-c-dropdown-item-color-background-hover` | item hover `background-color` | YES |
| `--slds-c-dropdown-item-color-background-focus` | item focus `background-color` | YES |
| `--slds-c-dropdown-item-color-background-active` | item active `background-color` | YES |

**Do NOT override:**
| Token | Maps to |
|-------|---------|
| `--slds-c-dropdown-font-*` | `font-family`, `font-size`, `font-weight`, etc. |
| `--slds-c-dropdown-letter-spacing` | `letter-spacing` |

---

### Tree
```html
<div class="slds-tree_container">
  <ul class="slds-tree" role="tree">
    <li class="slds-tree__item" role="treeitem" aria-expanded="true">
      <button class="slds-button slds-button_icon">
        <svg>...</svg>
      </button>
      <span class="slds-tree__item-label">Branch</span>
      <span class="slds-tree__item-meta">Meta</span>
    </li>
  </ul>
</div>
```

**States:** `aria-expanded="true"`, `.slds-is-selected`

---

### Tile
```html
<article class="slds-tile">
  <h2 class="slds-tile__title">
    <a>Title</a>
  </h2>
  <div class="slds-tile__detail">
    <dl class="slds-list_horizontal">
      <dt>Label:</dt>
      <dd>Value</dd>
    </dl>
  </div>
</article>
```

**Variants:** `.slds-tile_board`

---

### Feed
```html
<div class="slds-feed">
  <ul class="slds-feed__list">
    <li class="slds-feed__item">
      <article class="slds-post">...</article>
    </li>
  </ul>
</div>
```

---

### Activity Timeline
```html
<ul class="slds-timeline">
  <li>
    <div class="slds-timeline__item_expandable slds-timeline__item_call">
      <span class="slds-timeline__icon">
        <span class="slds-icon_container slds-icon-standard-log-a-call">
          <svg class="slds-icon slds-icon_small">...</svg>
        </span>
      </span>
      <div class="slds-timeline__media">
        <div class="slds-timeline__title">Call Title</div>
        <div class="slds-timeline__date">Date</div>
        <div class="slds-timeline__actions">...</div>
      </div>
    </div>
  </li>
</ul>
```

**Type variants:** `.slds-timeline__item_call`, `_email`, `_event`, `_task`
**States:** `.slds-is-open` (expanded)

---

### Welcome Mat
```html
<section class="slds-welcome-mat">
  <div class="slds-welcome-mat__content">
    <div class="slds-welcome-mat__info">
      <div class="slds-welcome-mat__info-content">
        <h2 class="slds-welcome-mat__info-title">Welcome</h2>
        <div class="slds-welcome-mat__info-description">...</div>
        <div class="slds-welcome-mat__info-progress">...</div>
      </div>
    </div>
    <div class="slds-welcome-mat__tiles">
      <div class="slds-welcome-mat__tile">...</div>
    </div>
  </div>
</section>
```

**Variants:** `.slds-welcome-mat_splash`, `.slds-welcome-mat_info-only`

---

### Builder Header
```html
<header class="slds-builder-header_container">
  <div class="slds-builder-header">
    <div class="slds-builder-header__item">
      <div class="slds-builder-header__item-label">Builder</div>
    </div>
    <nav class="slds-builder-header__nav">
      <ul class="slds-builder-header__nav-list">
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action">Tab</a>
        </li>
      </ul>
    </nav>
    <div class="slds-builder-header__utilities">
      <div class="slds-builder-header__utilities-item">...</div>
    </div>
  </div>
</header>
```

---

### Docked Composer
```html
<div class="slds-docked-composer slds-is-open">
  <header class="slds-docked-composer__header">
    <div class="slds-docked-composer__lead">...</div>
    <div class="slds-docked-composer__actions">...</div>
  </header>
  <div class="slds-docked-composer__body">...</div>
  <footer class="slds-docked-composer__footer">...</footer>
</div>
```

---

### Global Header
```html
<div class="slds-global-header_container">
  <header class="slds-global-header">
    <div class="slds-global-header__item">
      <div class="slds-global-header__logo">...</div>
    </div>
    <div class="slds-global-header__item slds-global-header__item_search">
      <div class="slds-form-element">
        <input class="slds-input" placeholder="Search..." />
      </div>
    </div>
    <ul class="slds-global-header__item">
      <li>
        <button class="slds-button slds-global-header__button_icon">...</button>
      </li>
    </ul>
  </header>
</div>
```

**Notification indicator:** `.slds-global-header__notification_unread`

---

## ENGINE MAPPING REFERENCE

### How the theme engine maps theme colors to tokens

| Theme Color Key | --lwc-* Token | --slds-g-* Token | --slds-c-* Token |
|-----------------|---------------|-------------------|-------------------|
| `background` | `colorBackground`, `pageColorBackground` | `color-surface-1`, `color-neutral-1` | -- |
| `surface` | `colorBackgroundAlt`, `colorBackgroundRow` | `color-surface-2` | `card-color-background` |
| `surfaceHover` | `colorBackgroundRowHover` | `color-surface-3` | -- |
| `surfaceAlt` | -- | `color-neutral-2` | -- |
| `textPrimary` | `colorTextDefault` | `color-on-surface-1` | -- |
| `textSecondary` | `colorTextWeak`, `colorTextLabel` | `color-on-surface-2` | -- |
| `textMuted` | -- | `color-on-surface-3` | -- |
| `textPlaceholder` | `colorTextPlaceholder` | -- | -- |
| `accent` | `brandPrimary`, `brandAccessible` | `color-brand-1` | `input-color-border-focus` |
| `accentHover` | `brandPrimaryActive`, `brandAccessibleActive` | `color-brand-2` | -- |
| `border` | `colorBorder`, `colorBorderSeparator` | `color-border-1`, `color-surface-4` | `card-color-border` |
| `borderInput` | `colorBorderInput` | `color-border-2` | `input-color-border` |
| `link` | `colorTextLink` | -- | -- |
| `buttonBrandBg` | `colorBackgroundButtonBrand` | -- | `button-brand-color-background` |
| `buttonBrandBorder` | -- | -- | `button-brand-color-border` |
| `buttonBrandHover` | `colorBackgroundButtonBrandHover` | -- | `button-brand-color-background-hover` |
| `buttonNeutralBg` | `colorBackgroundButtonDefault` | -- | `button-neutral-color-background` |
| `buttonNeutralBorder` | -- | -- | `button-neutral-color-border` |
| `focusRing` | `shadowOutlineFocus` | -- | -- |

### Unsupported SLDS 2 Component Hooks

Per Salesforce documentation (Summer '25), these component hooks are **defined in the
SLDS CSS** but are **NOT wired in the Cosmos runtime**:
- All `--slds-c-*` hooks when Cosmos theme is enabled
- This means: in orgs using Cosmos, setting `--slds-c-button-brand-color-background`
  in LWC `:host` has no effect

**For Chrome extensions this does not matter** -- we inject CSS at the page level and
our `var()` overrides take effect regardless of whether Salesforce's runtime supports them.

### Components Without Dedicated Hooks

These components have NO `--slds-c-*` hooks and must be themed via direct CSS selectors:
- Data Tables (`.slds-table`)
- Page Headers (`.slds-page-header`)
- Panels (`.slds-panel`)
- Split View (`.slds-split-view`)
- Path (`.slds-path`)
- Global Navigation (`.slds-context-bar`)
- Breadcrumbs (only spacing hooks)
- Datepicker (`.slds-datepicker`)
- Timepicker (`.slds-timepicker`)
- File Selector (`.slds-file-selector`)
- Rich Text Editor (`.slds-rich-text-editor`)
- Spinner (`.slds-spinner`)
- Progress Bar (`.slds-progress-bar`)
- Progress Indicator (`.slds-progress`)
- Feed (`.slds-feed`)
- Activity Timeline (`.slds-timeline`)
- Tree (only max-width hook)
- Tile (`.slds-tile`)
- Brand Band (`.slds-brand-band`)
- Welcome Mat (`.slds-welcome-mat`)
- Builder Header (`.slds-builder-header`)
- Docked Composer (`.slds-docked-composer`)
- Global Header (`.slds-global-header`)
- Scoped Notification (`.slds-scoped-notification`)
- Prompt (uses modal hooks)

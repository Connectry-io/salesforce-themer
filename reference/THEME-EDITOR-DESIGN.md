# Theme Editor — Architecture Design

## The Core Idea

Three input tiers, one derivation engine, multiple input methods.

```
 INPUT METHODS                    TIERS                      OUTPUT
 ─────────────                    ─────                      ──────
 Manual color pickers ──┐
 GenAI ("make it like   ├──→  23 Core Values  ──┐
   Notion")            ─┘     (always visible)   │
                                                 ├──→  Derivation  ──→  81 CSS keys
 URL brand extraction ──┐     ~58 Advanced       │     Engine           (full theme)
 Brand guide upload   ──┼──→  (expandable panel, │
                        │      shows derived     ─┘
                        │      values, editable)
                        │
                        └──→  All methods produce the same 23 core values.
                              The derivation engine handles the rest.
                              Advanced panel lets users override ANY derived value.
```

Every input method — manual pickers, GenAI prompt, URL extraction, brand guide
upload — produces the same output: a set of core color values. The derivation
engine is always the same. This means V2 (manual) and V3 (AI) share the same
data model and rendering pipeline.

---

## Tier 1: Core Values (23 — always visible in editor)

These are the primary controls. A user who sets all 23 gets a complete,
polished theme with full visual control over every distinct area of SF.

### Base (4)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 1 | `colorScheme` | Mode | `light` or `dark` — derivation direction |
| 2 | `background` | Page Background | Canvas everything sits on |
| 3 | `surface` | Card Background | Cards, modals, panels, dropdowns |
| 4 | `surfaceAlt` | Alternate Surface | Path items, alt table rows, hover tints |

### Brand (2)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 5 | `accent` | Accent Color | Brand buttons, active states, path, tabs, badges |
| 6 | `link` | Link Color | Hyperlinks (often = accent, but can differ) |

### Navigation (2)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 7 | `nav` | Nav Background | Top navigation bar |
| 8 | `navText` | Nav Text | Nav labels, icons, waffle dots |

### Text (3)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 9 | `textPrimary` | Primary Text | Headings, body, record values |
| 10 | `textSecondary` | Secondary Text | Labels, metadata |
| 11 | `textPlaceholder` | Placeholder Text | Input hints, disabled text |

### Borders (2)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 12 | `border` | Border Color | Card borders, separators, panel edges |
| 13 | `borderInput` | Input Border | Form fields — usually slightly stronger |

### Buttons (2)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 14 | `buttonBrandText` | Brand Button Text | Text on accent-colored buttons |
| 15 | `buttonNeutralBg` | Neutral Button | Secondary action button background |

### Tables (1)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 16 | `tableHeaderBg` | Table Header | Column header row background |

### Overlays (2)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 17 | `modalBg` | Modal Background | Edit dialogs, confirmation popups |
| 18 | `dropdownBg` | Dropdown Background | Menus, popovers, comboboxes |

### Feedback (3)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 19 | `success` | Success Color | Green states |
| 20 | `warning` | Warning Color | Amber states |
| 21 | `error` | Error Color | Red states |

### Utility (2)

| # | Key | Label | What it controls |
|---|-----|-------|------------------|
| 22 | `focusRing` | Focus Ring | Accessibility outline color |
| 23 | `scrollThumb` | Scrollbar | Scrollbar thumb color |

---

## Tier 2: Advanced Derived Values (~58 — expandable panel)

These are auto-calculated by the derivation engine from the 23 core values.
Shown in an expandable "Advanced" panel, grouped by category. Each value
displays the derived result (greyed out). User can click any value to
**override** it — the override icon appears and the value turns editable.
Clearing an override snaps it back to the derived value.

This means power users can tweak ANY of the 81 values, but casual users
never need to see them.

### Grouped display in Advanced panel:

**Surfaces** (4 derived)
- `surfaceHover` — hover state for surfaces
- `surfaceHighlight` — accent-tinted highlight
- `surfaceSelection` — selected row/item
- `searchBg` — search input background (dark themes)

**Accent Variants** (3 derived)
- `accentHover` — accent darkened for hover
- `accentActive` — accent darkened more for active/press
- `accentLight` — accent at 15% opacity for tints

**Text** (1 derived)
- `textMuted` — between secondary and placeholder

**Navigation** (8 derived)
- `navHover`, `navActive`, `navActiveBorder`, `navBorder`
- `navIcon`, `navActiveText`, `navAppName`, `navAppBorder`, `navWaffleDot`

**Links** (1 derived)
- `linkHover` — link color darkened

**Borders** (1 derived)
- `borderSeparator` — section separators

**Buttons** (5 derived)
- `buttonBrandBg`, `buttonBrandBorder`, `buttonBrandHover`
- `buttonNeutralBorder`, `buttonNeutralHover`, `buttonNeutralText`

**Tables** (5 derived)
- `tableHeaderText`, `tableAltRow`, `tableHoverRow`, `tableBorderRow`, `tableColBorder`

**Modals** (4 derived)
- `modalHeaderBg`, `modalFooterBg`, `modalBackdrop`, `modalShadow`

**Dropdowns** (2 derived)
- `dropdownItemHoverBg`, `dropdownItemHoverText`

**Tabs** (5 derived)
- `tabNavBorder`, `tabActiveColor`, `tabActiveBorder`, `tabInactiveColor`, `tabContentBg`

**Scrollbar** (2 derived)
- `scrollTrack`, `scrollThumbHover`

**Badges & Pills** (6 derived)
- `badgeBg`, `badgeText`, `badgeBorder`
- `pillBg`, `pillBorder`, `pillText`

**Panels** (2 derived)
- `panelBg`, `panelBorder`

**Search** (4 derived, dark themes only)
- `searchText`, `searchBorder`, `searchPlaceholder`, `searchFocusBorder`, `searchFocusShadow`

**Other** (2)
- `globalHeaderWhite` — keep header white (boolean)
- `specialEffects` — theme-specific FX config (Tron glow, etc.)

---

## Input Methods

All input methods produce the same output: a set of 23 core values (some or
all). The editor UI always shows the result and lets the user refine.

### Method 1: Manual (V2)
User picks colors with color pickers. This is the baseline.

### Method 2: GenAI Prompt (V3)
User types: "make it feel like Notion" or "dark theme with warm orange accents"

```
User prompt → Connectry API → Claude Haiku → 23 core values (JSON)
                                               ↓
                              Editor pre-fills with AI values
                              User can refine any value
                              Click "Apply" when happy
```

The AI prompt template:
```
Given this description: "{user_prompt}"
Generate a Salesforce Lightning theme with these 23 color values:
- colorScheme: "light" or "dark"
- background: page background hex
- surface: card/component background hex
- ... (all 23)

Return JSON only. Colors must be valid hex. Ensure WCAG AA contrast
between text colors and their backgrounds.
```

### Method 3: URL Brand Extraction (V3)
User pastes: "https://stripe.com"

```
URL → Connectry API → fetch page → extract:
  - Meta theme-color
  - Dominant colors from logo/hero (canvas analysis)
  - CSS custom properties
  - Background colors from computed styles
                              ↓
                  Map extracted palette to 23 core values
                  (accent = dominant brand color,
                   background/surface = page bg,
                   nav = header bg, etc.)
                              ↓
                  Editor pre-fills → user refines → apply
```

### Method 4: Brand Guide Upload (V3+)
User uploads PDF/image of brand guidelines.

```
Brand guide → Connectry API → Claude Vision → extract:
  - Primary color
  - Secondary color
  - Accent color
  - Background preferences
  - Typography mood (warm/cool/neutral)
                              ↓
                  Map to 23 core values → editor → apply
```

### Method 5: Brand API Lookup (V3+)
User types company name: "Stripe"

```
Company name → Brandfetch API → brand colors
                              ↓
                  Map to 23 core values → editor → apply
```

All five methods feed into the same editor with the same 23 pickers.
The user always has the final say.

---

## Derivation Engine

### Color Utility Functions

```javascript
function lighten(hex, percent)      // HSL lightness + percent
function darken(hex, percent)       // HSL lightness - percent
function alpha(hex, opacity)        // hex → rgba(r, g, b, opacity)
function contrast(hex)              // returns '#ffffff' or '#1a1a1a' for readability
function mix(hex1, hex2, weight)    // blend two colors (0 = hex1, 1 = hex2)
function saturate(hex, percent)     // HSL saturation + percent
function desaturate(hex, percent)   // HSL saturation - percent
```

### Derivation Function

```javascript
function deriveFullTheme(core) {
  // core = object with up to 23 keys from Tier 1
  // Returns full 81-key theme colors object

  const isDark = core.colorScheme === 'dark';
  const accent = core.accent;
  const surface = core.surface;
  const background = core.background;

  // Start with all 23 core values as-is
  const derived = { ...core };

  // ── Surfaces ──
  derived.surfaceHover    = derived.surfaceHover    || mix(background, surface, 0.5);
  derived.surfaceHighlight = derived.surfaceHighlight || alpha(accent, 0.10);
  derived.surfaceSelection = derived.surfaceSelection || alpha(accent, 0.15);

  // ── Accent variants ──
  derived.accentHover     = derived.accentHover     || darken(accent, isDark ? 15 : 10);
  derived.accentActive    = derived.accentActive    || darken(accent, isDark ? 25 : 20);
  derived.accentLight     = derived.accentLight     || alpha(accent, 0.15);

  // ── Text ──
  derived.textMuted       = derived.textMuted       || mix(core.textSecondary, core.textPrimary, 0.3);

  // ── Navigation (from nav + navText) ──
  derived.navHover        = derived.navHover        || 'rgba(255, 255, 255, 0.12)';
  derived.navActive       = derived.navActive       || 'rgba(255, 255, 255, 0.2)';
  derived.navActiveBorder = derived.navActiveBorder || core.navText;
  derived.navBorder       = derived.navBorder       || darken(core.nav, 10);
  derived.navIcon         = derived.navIcon         || core.navText;
  derived.navActiveText   = derived.navActiveText   || core.navText;
  derived.navAppName      = derived.navAppName      || core.navText;
  derived.navAppBorder    = derived.navAppBorder    || 'rgba(255, 255, 255, 0.2)';
  derived.navWaffleDot    = derived.navWaffleDot    || core.navText;

  // ── Links ──
  derived.link            = core.link               || accent;
  derived.linkHover       = derived.linkHover       || darken(derived.link, 15);

  // ── Borders ──
  derived.borderSeparator = derived.borderSeparator || core.border;

  // ── Buttons ──
  derived.buttonBrandBg     = derived.buttonBrandBg     || accent;
  derived.buttonBrandBorder = derived.buttonBrandBorder || accent;
  derived.buttonBrandHover  = derived.buttonBrandHover  || darken(accent, 10);
  derived.buttonNeutralBorder = derived.buttonNeutralBorder || core.borderInput;
  derived.buttonNeutralHover  = derived.buttonNeutralHover  || (isDark ? lighten(surface, 5) : darken(surface, 3));
  derived.buttonNeutralText   = derived.buttonNeutralText   || core.textPrimary;

  // ── Tables ──
  derived.tableHeaderText = derived.tableHeaderText || core.textSecondary;
  derived.tableAltRow     = derived.tableAltRow     || (isDark ? lighten(surface, 2) : darken(surface, 1));
  derived.tableHoverRow   = derived.tableHoverRow   || alpha(accent, 0.10);
  derived.tableBorderRow  = derived.tableBorderRow  || core.border;
  derived.tableColBorder  = derived.tableColBorder  || (isDark ? core.border : lighten(core.border, 5));

  // ── Modals ──
  derived.modalHeaderBg   = derived.modalHeaderBg   || (isDark ? darken(surface, 5) : surface);
  derived.modalFooterBg   = derived.modalFooterBg   || (isDark ? darken(surface, 5) : background);
  derived.modalBackdrop   = derived.modalBackdrop   || (isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.4)');
  derived.modalShadow     = derived.modalShadow     || (isDark
    ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.12)');

  // ── Dropdowns ──
  derived.dropdownItemHoverBg   = derived.dropdownItemHoverBg   || alpha(accent, 0.10);
  derived.dropdownItemHoverText = derived.dropdownItemHoverText || core.textPrimary;

  // ── Tabs ──
  derived.tabNavBorder    = derived.tabNavBorder    || core.border;
  derived.tabActiveColor  = derived.tabActiveColor  || accent;
  derived.tabActiveBorder = derived.tabActiveBorder || accent;
  derived.tabInactiveColor = derived.tabInactiveColor || core.textSecondary;
  derived.tabContentBg    = derived.tabContentBg    || surface;

  // ── Focus ──
  derived.focusRing       = core.focusRing          || `0 0 0 3px ${alpha(accent, 0.3)}`;

  // ── Scrollbar ──
  derived.scrollTrack     = derived.scrollTrack     || (isDark ? darken(background, 10) : darken(background, 2));
  derived.scrollThumbHover = derived.scrollThumbHover || core.textPlaceholder;

  // ── Badges & Pills ──
  derived.badgeBg         = derived.badgeBg         || (isDark ? alpha(accent, 0.15) : accent);
  derived.badgeText       = derived.badgeText       || (isDark ? accent : contrast(accent));
  derived.badgeBorder     = derived.badgeBorder     || (isDark ? `1px solid ${alpha(accent, 0.3)}` : 'none');
  derived.pillBg          = derived.pillBg          || alpha(accent, 0.10);
  derived.pillBorder      = derived.pillBorder      || core.borderInput;
  derived.pillText        = derived.pillText        || core.textPrimary;

  // ── Panels ──
  derived.panelBg         = derived.panelBg         || surface;
  derived.panelBorder     = derived.panelBorder     || core.border;

  // ── Search (dark themes) ──
  if (isDark) {
    derived.searchBg          = derived.searchBg          || darken(surface, 10);
    derived.searchText        = derived.searchText        || core.textPrimary;
    derived.searchBorder      = derived.searchBorder      || core.border;
    derived.searchPlaceholder = derived.searchPlaceholder || core.textSecondary;
    derived.searchFocusBorder = derived.searchFocusBorder || accent;
    derived.searchFocusShadow = derived.searchFocusShadow || `0 0 0 2px ${alpha(accent, 0.25)}`;
  }

  // ── Global ──
  derived.globalHeaderWhite = derived.globalHeaderWhite ?? true;

  return derived;
}
```

### Key design property: every derived value uses `||`

This means if a user has overridden that value in the Advanced panel, their
override wins. If they haven't, the derivation fills it in. Clearing an
override in the UI just deletes the key, and the engine re-derives it.

---

## Data Model

### Custom theme (stored in chrome.storage.sync)

```javascript
{
  "customThemes": [
    {
      "id": "custom-1713100000000",
      "name": "My Stripe Theme",
      "basedOn": "midnight",         // OOTB theme it was cloned from (for reset)
      "category": "dark",
      "author": "User",
      "createdVia": "ai",            // "manual" | "ai" | "url" | "brand-guide"
      "sourcePrompt": "make it look like Stripe",  // for AI-generated themes
      "coreOverrides": {             // Only the 23 core values that differ from base
        "accent": "#635BFF",
        "nav": "#0A2540"
      },
      "advancedOverrides": {         // Only the derived values user explicitly changed
        "buttonBrandText": "#ffffff"
      }
    }
  ]
}
```

### Resolution order (runtime)

```
1. Load base theme (full 81 keys from themes.json)
2. Apply coreOverrides (user's 23 core values)
3. Run derivation engine → fills in ~58 derived values
4. Apply advancedOverrides (user's explicit derived overrides)
5. Pass to generateThemeCSS() → full CSS output
```

Step 4 happens AFTER derivation, so advanced overrides always win over
the engine's calculations. This is critical.

### Storage budget

- chrome.storage.sync: 100KB total, 8KB per item
- Each custom theme: ~500 bytes (core + advanced overrides + metadata)
- Budget: ~150 custom themes (we'll cap at 20 for UX sanity)

---

## UI Design: Editor Panel in Options Page

### Entry points
1. "Customize" button on any OOTB theme card → clones it, opens editor
2. "Create Theme" button → starts from blank (picks light/dark first)
3. Future: "Generate with AI" button → opens AI prompt → fills editor

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Gallery           "My Custom Theme"  [Rename] [Save] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────── Editor (left) ──────────┬── Preview (right) ─────┐│
│  │                                    │                         ││
│  │  BASE                              │  ┌── Nav Bar ─────────┐││
│  │  Mode:       [Light ▾]             │  │  App  Home  Leads  │││
│  │  Background: [██ #f7f7f5]          │  └────────────────────┘││
│  │  Surface:    [██ #ffffff]           │  ┌── Page Header ────┐││
│  │  Alt Surface:[██ #eeeeed]          │  │  Lead: John Smith  │││
│  │                                    │  └────────────────────┘││
│  │  BRAND                             │  ┌── Path ────────────┐││
│  │  Accent:     [██ #4a6fa5]          │  │ ▸ New ▸ Working ▸  │││
│  │  Links:      [██ #4a6fa5]          │  └────────────────────┘││
│  │                                    │  ┌── Card ────────────┐││
│  │  NAVIGATION                        │  │  Details    Chatter│││
│  │  Nav Bar:    [██ #4a6fa5]          │  │  Name: John Smith  │││
│  │  Nav Text:   [██ #ffffff]           │  │  Email: john@...   │││
│  │                                    │  │  [Edit] [Convert]  │││
│  │  TEXT                              │  └────────────────────┘││
│  │  Primary:    [██ #2d2d2d]          │  ┌── Table ───────────┐││
│  │  Secondary:  [██ #4a5568]          │  │ Name | Email | ... │││
│  │  Placeholder:[██ #9aa5b4]          │  │ Row 1              │││
│  │                                    │  │ Row 2 (alt)        │││
│  │  BORDERS                           │  └────────────────────┘││
│  │  Borders:    [██ #e8e8e6]          │  ┌── Modal ───────────┐││
│  │  Inputs:     [██ #c4cdd6]          │  │  Edit Record       │││
│  │                                    │  │  [input] [input]   │││
│  │  BUTTONS                           │  │  [Cancel] [Save]   │││
│  │  Button Text:[██ #ffffff]           │  └────────────────────┘││
│  │  Neutral Btn:[██ #ffffff]           │                         ││
│  │                                    │                         ││
│  │  TABLES                            │                         ││
│  │  Header:     [██ #f0f0ee]          │                         ││
│  │                                    │                         ││
│  │  OVERLAYS                          │                         ││
│  │  Modal:      [██ #ffffff]           │                         ││
│  │  Dropdown:   [██ #ffffff]           │                         ││
│  │                                    │                         ││
│  │  FEEDBACK                          │                         ││
│  │  Success:    [██ #059669]          │                         ││
│  │  Warning:    [██ #d97706]          │                         ││
│  │  Error:      [██ #dc2626]          │                         ││
│  │                                    │                         ││
│  │  UTILITY                           │                         ││
│  │  Focus Ring: [██ accent@30%]       │                         ││
│  │  Scrollbar:  [██ #c4cdd6]          │                         ││
│  │                                    │                         ││
│  │  ▾ Advanced (58 derived values)    │                         ││
│  │  ┌──────────────────────────────┐  │                         ││
│  │  │ Surfaces                     │  │                         ││
│  │  │  Hover:    ██ #f0f0ee  auto  │  │                         ││
│  │  │  Highlight:██ #e8eef7  auto  │  │                         ││
│  │  │  Selection:██ #d4e3f7  auto  │  │                         ││
│  │  │                              │  │                         ││
│  │  │ Accent Variants              │  │                         ││
│  │  │  Hover:    ██ #3d5e8c  auto  │  │                         ││
│  │  │  Active:   ██ #2d4a72  auto  │  │                         ││
│  │  │  Light:    ██ rgba...  auto  │  │                         ││
│  │  │                              │  │                         ││
│  │  │ Nav (8) | Buttons (5) | ...  │  │                         ││
│  │  └──────────────────────────────┘  │                         ││
│  │                                    │                         ││
│  └────────────────────────────────────┴─────────────────────────┘│
│                                                                  │
│  [Reset to Base]  [Export JSON]  [Import JSON]  [Apply & Save]   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Advanced panel behavior
- Collapsed by default
- Each value shows: color swatch, hex value, "auto" badge
- "auto" means it's derived — clicking it makes it editable (override)
- Overridden values show an "×" button to clear the override (snap back to derived)
- Grouped by category with collapsible sub-sections

### Preview panel
- Static HTML/CSS that mirrors SLDS component structure
- Updates live as user changes colors (no network, instant)
- Shows: nav bar, page header, path, card with tabs, table, modal, buttons
- NOT an iframe of SF — it's a mock built from our SLDS reference docs
- Includes light/dark background to show the full page feel

---

## V3 AI Integration Points

### GenAI prompt → 23 values
```
POST /api/theme/generate
{
  "method": "prompt",
  "input": "make it feel like Notion — clean, minimal, warm"
}
→ { "colorScheme": "light", "background": "#ffffff", "accent": "#2F3437", ... }
```

### URL extraction → 23 values
```
POST /api/theme/generate
{
  "method": "url",
  "input": "https://stripe.com"
}
→ server fetches page, extracts dominant colors, maps to 23 values
→ { "colorScheme": "dark", "accent": "#635BFF", "nav": "#0A2540", ... }
```

### Brand guide upload → 23 values
```
POST /api/theme/generate
{
  "method": "brand-guide",
  "input": "<base64 PDF or image>"
}
→ Claude Vision extracts brand colors → maps to 23 values
→ { "accent": "#FF5A1F", "nav": "#1B1B1B", ... }
```

### Brand API lookup → 23 values
```
POST /api/theme/generate
{
  "method": "brand-lookup",
  "input": "Stripe"
}
→ Brandfetch API → brand colors → map to 23 values
```

All four return the same shape. The editor pre-fills and the user refines.

---

## Implementation Phases

### Phase 1: Derivation engine (current sprint)
- [ ] Color utility functions (lighten, darken, alpha, contrast, mix)
- [ ] `deriveFullTheme(coreValues)` function
- [ ] Validate: derive Connectry Light from its 23 core values → compare to hand-tuned
- [ ] Validate: derive all 15 OOTB themes → measure delta

### Phase 2: Custom theme storage
- [ ] `customThemes` in chrome.storage.sync schema
- [ ] Runtime resolution: base → core overrides → derive → advanced overrides
- [ ] Custom themes appear in popup + options gallery

### Phase 3: Editor UI
- [ ] 23 color pickers with grouped layout
- [ ] Live preview panel (mock SLDS components)
- [ ] Advanced panel with derived values + override capability
- [ ] Save / Reset / Rename / Delete
- [ ] Export JSON / Import JSON

### Phase 4: AI generation (V3)
- [ ] Connectry API proxy endpoint
- [ ] GenAI prompt → 23 values
- [ ] URL extraction → 23 values
- [ ] Brand guide upload → 23 values
- [ ] "Generate" button in editor UI
- [ ] Usage cap: 5-10 generations/month free, unlimited premium

---

## Open Questions

1. **Preview fidelity** — How close should the mock preview match real SF?
   Recommendation: close enough to be useful, not pixel-perfect. Show the
   main areas: nav, header, path, card, table, button, modal.

2. **Live preview on SF tab?** — Could inject custom theme CSS into the
   active SF tab as user edits (like Chrome DevTools). Powerful but complex.
   Recommendation: V2 uses mock preview. V3 adds live injection.

3. **Theme sharing format** — Export full 81 values for portability?
   Recommendation: export includes `coreOverrides` + `advancedOverrides` +
   metadata. Import auto-derives. Also support importing full 81 for
   compatibility with exported themes.

4. **Contrast validation** — Flag when text-on-background fails WCAG AA?
   Recommendation: yes, show a warning badge on failing pairs. Don't block.

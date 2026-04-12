# Effects Architecture

Single source of truth for how visual effects are authored across the
Salesforce Themer extension and future consumers.

## The problem this solves

Effects (hover lift, ambient glow, aurora, particles, background pattern, etc.)
were hand-implemented three times — once in the Salesforce content script,
once in the Builder/Hero preview CSS, once in the Guide tab cards. Intensity
ladders, keyframes, color math, and the config schema all drifted. Every
effect change required 3+ manual edits and still produced user-visible
inconsistencies across surfaces.

## The pattern: primitives + adapters

```
            ┌────────────────────────────────────────┐
            │    core/effects/engine.js              │
            │  (single source of truth)              │
            │                                        │
            │  • INTENSITY_LADDER                    │
            │  • EFFECT_METADATA                     │
            │  • EFFECT_PAIRING_MATRIX               │
            │  • deriveColors(accent)                │
            │  • renderRules(effectId, config, hex)  │
            │  • build*RuntimeConfig (canvas fx)     │
            └────┬─────────┬──────────┬──────────────┘
                 │         │          │
        ┌────────▼────┐ ┌──▼─────┐ ┌──▼────────┐
        │ SF content  │ │Builder │ │ Guide     │
        │ script      │ │/Hero   │ │ mini-card │
        │ adapter     │ │adapter │ │ adapter   │
        └─────────────┘ └────────┘ └───────────┘
         .slds-*         .preview-* .guide-*
```

**Primitives** live in `core/effects/engine.js`. Pure functions. No DOM. Return
data — CSS declaration objects, intensity multipliers, runtime configs for
canvas effects. Zero coupling to any specific surface.

**Adapters** are thin per-consumer wrappers. Each adapter knows:
1. Its selector map (`card` role → `.slds-card` vs `.preview-card` vs `.guide-effect-preview-card`)
2. Its CSS application mechanism (inject `<style>` tag / set inline custom properties / write declarations)
3. Its DOM conventions (canvas mount point, event handlers)

Adapters never hardcode effect-specific values. They call the engine and map
the returned structured IR to their DOM.

## The IR contract

`renderRules(effectId, config, accentHex)` returns:

```js
{
  cssRules: [
    {
      selectorRole: 'bodyWrapper',    // canonical role name
      declarations: { 'background-image': '...', ... },
      keyframes: [{ name, css }],     // optional
      animation: '...',               // optional
      childrenLift: true,             // optional — signal for stacking context
    },
    ...
  ],
  runtimeConfig: {                    // for canvas effects
    particles: {...},
    cursorTrail: {...},
  },
}
```

or `null` for effects not yet migrated (adapter falls through to legacy path).

## Canonical selector roles

| Role          | SF content script (`.slds-*`)     | Builder/Hero preview            | Guide mini-card                 |
|---------------|-----------------------------------|----------------------------------|---------------------------------|
| `bodyWrapper` | `body`                            | `.editor-preview-frame`          | `.guide-effect-preview`         |
| `card`        | `.slds-card`                      | `.preview-card`                  | `.guide-effect-preview-card`    |
| `brandButton` | `.slds-button_brand`              | `.preview-btn-brand`             | (n/a)                           |
| `headerTitle` | `.slds-page-header__title`        | `.preview-header-title`          | (uses preview-card text)        |
| `navActive`   | `.slds-tabs_default__item.slds-is-active a` | `.preview-tab.is-active` | (n/a)                   |

Adapters map these to their actual selectors. Adding a new consumer =
writing a new selector map. Adding a new platform (Jira, Dynamics) =
writing a new selector map in that platform's adapter.

## How to migrate a new effect

1. Move effect logic into `core/effects/engine.js`:
   - Extend `renderRules()` with a case for the effect
   - Emit a `cssRules` IR with the right selector roles + declarations
   - For canvas effects: expose `build*RuntimeConfig` primitive
2. Update each surface adapter:
   - SF content script (`effects/effects.js`): wrap the legacy code path with engine call, then delete legacy
   - Builder/Hero (`options/options.js` → `applyPreviewEffects`): add engine call + CSS custom-property binding
   - Guide (`options/options.js` → `renderGuideEffectsGrid` + `_applyGuidePlaygroundIntensity`): add engine call
3. Delete the old per-surface CSS from `options/options.css` and handwritten
   intensity arithmetic
4. Add the effect to `MIGRATED_EFFECTS` in `scripts/check-effects-drift.js`
   and add forbid-rules for any handwritten patterns that must not reappear
5. Run `node scripts/check-effects-drift.js` — must exit 0
6. Visually verify all three surfaces render identically at Subtle / Medium / Strong

## How to add a new consumer

E.g., share cards, Figma plugin, marketing site preview, Claude Desktop share:

1. Import the engine (or load the JS file — it exports a global
   `SFThemerEffectsEngine`)
2. Define your selector map for the 5 canonical roles (leave unused as `null`)
3. For each effect you want to show, call `renderRules(effectId, config, accent)`
4. Walk the returned IR, substitute selector roles, emit CSS / apply styles
5. For canvas effects, call `build*RuntimeConfig` and instantiate your
   renderer (canvas / WebGL / whatever)

That's it. No engine changes required.

## Feature flag

`window.__EFFECTS_ENGINE_V2 = true` (default) routes through the engine.
Setting it to `false` at runtime in DevTools reverts surfaces to their
legacy code paths (where those still exist). This is the safety net for
A/B comparing old vs new behavior during migration.

Once all 9 effects are migrated and validated, the flag and the legacy
fallback code are deleted.

## Relationship to V4 monorepo

ROADMAP.md anticipates a V4 monorepo refactor — moving Salesforce-specific
code into `platforms/salesforce/` while `core/` houses shared engine code.

This effects refactor is **the foundation** of that split. `core/effects/`
exists today. When V4 ships, adding `platforms/jira/` means:
- Copy `platforms/salesforce/` structure
- Write a Jira selector map for the canonical roles
- Ship

No engine changes. No new abstractions. The hard work was done here.

## Scope limits (what this architecture does NOT cover)

- **Colors / fonts** — already centralized via `themes/engine.js` +
  `scripts/sync-engine.py`. Not affected by this refactor.
- **Bundler / ES modules** — deferred. Globals-based loading works fine at
  current scale. Adopt when pain justifies it (probably V4+).
- **Non-effect visual logic** (theme switching, zero-flash injection,
  diagnostic overlay) — out of scope. Separate systems.

## Enforcement

`scripts/check-effects-drift.js` is the mechanical enforcement. It:
- Scans effects.js, options.js, options.css for forbidden handwritten
  patterns per migrated effect
- Asserts the legacy intensity ladder (behind feature flag) matches the
  canonical engine ladder
- Exits 1 on any violation

Should be wired into pre-commit hook + CI. Today it's manual.

---

Files:
- [core/effects/engine.js](../core/effects/engine.js) — the primitives
- [effects/effects.js](../effects/effects.js) — SF content script adapter
- [options/options.js](../options/options.js) — Builder + Guide adapters
- [scripts/check-effects-drift.js](../scripts/check-effects-drift.js) — enforcement

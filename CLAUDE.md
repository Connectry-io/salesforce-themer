# Salesforce Themer — Session Rules

**Before making ANY non-trivial change in this project, read these first:**

## Required reading (brain/knowledge/projects/salesforce-themer/)

- [`WORKFLOW.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/WORKFLOW.md) — End-to-end scan→patch→live flow + secret/flag reference. Read when touching the Intelligence Layer or explaining the pipeline.
- [`SECURITY.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/SECURITY.md) — Threat catalog + CSS allowlist + tier model. **Mini security review required before editing any Intel Layer critical component** (rule: `feedback_intel_security_review.md`).
- [`REVIEW-HEURISTICS.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/REVIEW-HEURISTICS.md) — Accumulating patterns from Noland's draft-patch reviews. **After any review batch, prompt Noland for his reasoning and fold it in** (rule: `feedback_intel_review_workflow.md`). Training data for the eventual auto-review agent.
- [`VISION.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/VISION.md) — Product north star: AI-powered, self-healing, multi-platform theming. Self-learning loop spec. Read before engine/backend/scanner changes.
- [`ARCHITECTURE.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/ARCHITECTURE.md) — V1→V5 structural plan. V4 moves SF code to `platforms/salesforce/`. Don't pre-emptively restructure before the milestone that introduces it.
- [`ROADMAP.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/ROADMAP.md) — Sequencing. V1/V2 are committed; V3+ is directional.
- [`COMPONENT-REGISTRY.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/COMPONENT-REGISTRY.md) — Canonical SLDS/force/records component → token map. Update this whenever you add tokens or component patterns.
- [`BACKLOG.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/BACKLOG.md) — Keep current as work completes (per feedback_backlog_hygiene).
- [`DESIGN-RULES.md`](/opt/connectry/brain/knowledge/projects/salesforce-themer/DESIGN-RULES.md) — Engine design constraints.

These docs live in `brain/knowledge` (not the repo) because they're strategic/product, not code-adjacent.

## Diagnostic scanner — read before editing `diagnostic/*`

The scanner is **not a debug tool**. It's the data feed for the V2 self-learning loop. Before changing `diagnostic/component-scanner.js`, `diagnostic/token-scanner.js`, or related files, read:

- [`project_themer_diagnostic_vision.md`](/opt/connectry/brain/memory/auto/project_themer_diagnostic_vision.md) — Scanner must be auto-discovery, diff-stable, batch-friendly. No curated lists.

## Engine editing rule

After editing `themes/engine.js`, **always run `python3 scripts/sync-engine.py`** before committing. The Chrome extension runs the copy baked into `background.js`, not `engine.js` itself. Both must be committed together.

Cache-busting reminder: Chrome's service worker cache can persist across reloads. If changes don't appear after `git pull` + extension reload, bump `manifest.json` version, then in the extension's service-worker DevTools console: `chrome.storage.local.clear().then(() => chrome.runtime.reload())`.

## Conventions

- **"Presets"** in user-facing copy, **never** "Built-in". (feedback_presets_not_builtin)
- **All Themer schemas must be designed for AI generation** — numeric storage, independent fields, semantic UI. (feedback_themer_ai_readiness)
- **Every card change must hit all 5 locations**: gallery, builder live, popup, anatomy, stencil. (feedback_card_consistency_checklist)
- **Path chevrons** use skewed background pseudo-elements, NOT border triangles. (feedback_path_chevrons)
- **Engine is recolor-only** — never strip SF structure (no `border:none`, `transparent`). Recolor borders/shadows/backgrounds. (feedback_engine_design_approach)
- **Extensive DOM study first** — for new components, ask Noland for DOM snapshots before guessing structure. (feedback_dom_screenshots)

## Shipping

- Every batch ends with `git push`. Noland tests via pull and can't see un-pushed work. (feedback_always_push_chrome_extensions)
- Regenerate share PNGs after any preset change via dev tool. (feedback_share_images)

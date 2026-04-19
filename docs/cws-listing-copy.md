# Chrome Web Store — Listing Copy

> **How to use this doc:** every section below maps 1:1 to a field in the
> Chrome Web Store developer dashboard at https://chrome.google.com/webstore/devconsole/.
> Copy the body of each section into the matching field. TODOs flag where you
> still need to make a call (screenshot capture, marquee tile, etc).

---

## 1. Extension name (max 75 chars)

```
Salesforce Themer — Themes & Customization for Lightning Experience
```
*(63 chars)*

---

## 2. Summary / Short description (max 132 chars)

This appears in CWS search results and the install card. Make it count.

```
Visually customize your Salesforce Lightning Experience. 13 handcrafted themes, free to apply. Build your own with the Theme Builder.
```
*(131 chars)*

**Alternate options if the above feels too long:**

- `Apply visual themes to Salesforce Lightning Experience. 13 free preset themes. Build your own with the Theme Builder.` *(115 chars)*
- `13 handcrafted themes for Salesforce Lightning. Apply instantly. Sync with system dark mode. Build your own with the Builder.` *(124 chars)*

---

## 3. Detailed description (max 16,000 chars)

Paste this whole block into the "Detailed description" field. Markdown is NOT
rendered by CWS — line breaks and indentation are preserved as-is.

---

```
Salesforce Themer applies handcrafted visual themes to your Salesforce
Lightning Experience — colors, typography, ambient effects, and favicon —
without changing how Salesforce works underneath.

Pick from 13 preset themes ranging from professional (Boardroom, Carbon,
Connectry) to atmospheric (Sakura, Tron, Obsidian). The theme applies
instantly across Lightning pages and the Setup admin area. Sync with your
system dark mode to flip automatically between a light and dark theme. All
free.

═══════════════════════════════════════════════════════════
HOW IT WORKS
═══════════════════════════════════════════════════════════

Themer is a recolor-only theming engine. It reads the active theme's 23
core color tokens and the engine derives 150+ downstream CSS values across
Salesforce — hover states, focus rings, modal backdrops, scrollbar tints,
borders, link colors. Salesforce structure stays untouched: nothing is
hidden, nothing is repositioned, no functionality changes.

Themes apply locally in your browser. We never read, send, or store any
data from your Salesforce org. Your data stays in Salesforce; only the
visual layer changes.

═══════════════════════════════════════════════════════════
WHAT'S INCLUDED — FREE
═══════════════════════════════════════════════════════════

• 13 preset themes (8 light, 5 dark)
• 4 effect volumes (Off / Subtle / Medium / Strong) — gentle hover lift,
  ambient glow, animated borders, particles, cursor trails, more
• Sync with system theme — automatically flip between a light and dark
  theme when your computer toggles its appearance
• Apply theme to Setup pages too (toggle on/off)
• Keyboard shortcuts for quick theme switching
• Diagnostic scanner — see exactly which Salesforce components your active
  theme covers, and which need attention

═══════════════════════════════════════════════════════════
COMING WITH PRO
═══════════════════════════════════════════════════════════

• Custom theme builder — clone any preset, tweak colors, save your own
• AI theme generation — describe a mood, paste a brand URL, or upload
  a brand guide; Themer generates a matching theme
• AI auto-paint — styles custom, managed, and edge-case components
  the engine hasn't pre-covered
• AI diagnostics — coverage reports plus suggested fixes
• Per-org themes — pin a different theme to each Salesforce org you work
  in, useful for keeping production and sandbox visually distinct
• Individual effect toggles + intensity sliders, per-theme effect configs
• Particle style picker (snow, rain, matrix, dots, embers)
• Priority email support

═══════════════════════════════════════════════════════════
WHAT WE DO NOT TOUCH
═══════════════════════════════════════════════════════════

• Your Salesforce data — never read, never sent, never stored
• Your org's structure — fields, layouts, automations untouched
• Modals, dropdowns, comboboxes — never transformed (so they stay
  predictable for accessibility and keyboard users)
• prefers-reduced-motion — all animations respect the OS setting
• Battery — particle density auto-reduces on battery power, animations
  pause when the tab isn't visible

═══════════════════════════════════════════════════════════
PRIVACY
═══════════════════════════════════════════════════════════

We collect a small set of anonymous usage counters (popup opens, theme
selections, feature interactions) so we can build the right things during
beta. No personal data, no Salesforce data, no DOM snapshots. Custom
themes you build live in your own Chrome storage.

Full details: https://connectry.io/themer/privacy/

═══════════════════════════════════════════════════════════
WHO BUILT THIS
═══════════════════════════════════════════════════════════

Connectry is a registered Salesforce ISV Partner. Our team builds native
Salesforce apps and developer tools.

The Salesforce Themer extension is not an official Salesforce product and
is not endorsed by Salesforce, Inc. Salesforce, Lightning, and related
marks are trademarks of Salesforce, Inc.

═══════════════════════════════════════════════════════════
SUPPORT
═══════════════════════════════════════════════════════════

Beta feedback, bug reports, feature requests: feedback@connectry.io
Privacy questions, data requests: privacy@connectry.io
Security disclosures: security@connectry.io

We read every email. Themer is in active development — your input shapes
what Pro becomes.
```

*(~2,800 chars — well under the 16k limit, leaves room to grow)*

---

## 4. Category

**Productivity**

(Alternate option: "Developer Tools" — but Productivity matches the audience
better. Themer is for Salesforce admins + power users, not just devs.)

---

## 5. Language

**English** (only language we support today)

---

## 6. Single purpose statement

CWS asks this in a short text field. Keep it tight and unambiguous.

```
Salesforce Themer applies user-configurable visual themes (color, typography, animations, and favicon) to the Salesforce Lightning Experience user interface in the user's browser. The extension does not read, modify, or transmit Salesforce data — it only adjusts the visual presentation layer of supported Salesforce domains.
```

---

## 7. Permission justifications

CWS asks for a justification per permission. Reviewers reject vague ones —
be specific.

### `storage`

```
Required to persist the user's selected theme, custom theme builds, per-org theme preferences, effect intensity settings, and UI state (e.g. settings panel collapse) across browser sessions. Uses chrome.storage.sync for user-facing preferences (so they sync across the user's devices) and chrome.storage.local for cached theme CSS artifacts.
```

### `activeTab`

```
Required to inject the active theme's CSS into the user's currently-focused Salesforce tab when they explicitly invoke the extension (clicking the toolbar icon, choosing a theme from the popup, or running the diagnostic scanner). The extension only acts on Salesforce tabs the user is actively viewing.
```

### `tabs`

```
Required to detect navigation across Salesforce-hosted tabs so the active theme remains visible after page transitions in Lightning Experience (which uses single-page-app navigation), and to send theme-change messages from the popup to all open Salesforce tabs at once when the user picks a new theme. Tab URLs are matched against the host_permissions allowlist; non-Salesforce tabs are never inspected or modified.
```

### `host_permissions: https://*.lightning.force.com/*` (and the other Salesforce hosts)

```
Required to inject the theme stylesheet into Salesforce Lightning Experience pages (.lightning.force.com), Salesforce Setup pages (.salesforce-setup.com, .my.salesforce-setup.com), classic Salesforce pages (.my.salesforce.com), Visualforce pages (.visualforce.com), and other Salesforce-owned domains where users access their org. The extension is a visual layer for Salesforce specifically; it does not run on any non-Salesforce domain.
```

### `host_permissions: https://pemofbbniuzogxzzioyp.supabase.co/*`

```
Required to send anonymous usage telemetry events (popup opens, theme selections, diagnostic scan counts) to our Supabase backend so we can understand which features matter during the beta. No personal data, Salesforce data, or DOM contents are sent. Full disclosure in the privacy policy at https://connectry.io/themer/privacy/.
```

---

## 8. Privacy policy URL

```
https://connectry.io/themer/privacy/
```

✅ Live, deployed via Netlify from the weareconnectry/connectry-website repo.

---

## 9. Support / homepage URL

**Homepage URL:**
```
https://connectry.io
```

**Support URL** _(TODO: decide between options)_:
- `mailto:feedback@connectry.io` — works, simple
- `https://connectry.io/themer/` — better if you build a Themer landing page; for now the mailto is fine
- `https://connectry.io/contact` — if you have a generic contact form

---

## 10. Visual assets — capture brief

**TODO: capture all of these.** Specs:

| Asset | Required? | Dimensions | Notes |
|---|---|---|---|
| Store icon | required | 128×128 PNG | the icon already in `/icons/icon-128.png` |
| Screenshot 1 | required (≥1) | 1280×800 OR 640×400 PNG | Hero shot — Sakura theme on a Lightning Records page (Account or Lead detail). Show the visual transformation clearly. |
| Screenshot 2 | recommended | 1280×800 | Themes gallery in the popup — shows Light + Dark groups, selected theme highlighted. |
| Screenshot 3 | recommended | 1280×800 | Studio Builder open with a custom theme being edited (color pickers + live preview side-by-side). |
| Screenshot 4 | recommended | 1280×800 | Diagnostic scanner panel showing coverage report on a Salesforce page. |
| Screenshot 5 | recommended | 1280×800 | A dark theme (Tron or Obsidian) on Setup — proves the "Apply to Setup" coverage. |
| Small promo tile | required for Featured | 440×280 PNG | "Salesforce Themer" + tagline + 1 theme card preview |
| Marquee promo tile | optional | 1400×560 PNG | Hero spread — 4 theme cards in a row showing the range |

**Capture tip:** use a real Salesforce dev org with realistic-looking sample
data (NOT "Test Account 1234"). Stripe Atlas sometimes provides demo orgs;
or sign up for a free Developer Edition at developer.salesforce.com. Avoid
any real customer data in screenshots.

**For the marquee:** the share-image generator at `dev/generate-share-images.html`
already produces theme-card hero images. Pull 4 of those into a single
1400×560 composite.

---

## 11. Distribution

- **Visibility:** Public
- **Regions:** All regions (no geographic restrictions needed)
- **Pricing:** Free (Pro upgrade comes later via in-app billing, not CWS payments)

---

## 12. Submission checklist (before clicking Submit)

- [ ] All TODOs in this doc resolved
- [ ] All TODOs in the privacy policy resolved (already done — Delaware, Legalinc, EIN baked in)
- [ ] Privacy policy URL loads at https://connectry.io/themer/privacy/ (verify it's live, not 404)
- [ ] feedback@connectry.io routes to a real inbox someone checks
- [ ] privacy@connectry.io routes to a real inbox someone checks
- [ ] security@connectry.io routes to a real inbox someone checks
- [ ] Manifest version bumped to a clean release number (e.g. 1.0.0 — CWS prefers semver-style for first publish; reset from 2.7.x or keep as-is, your call)
- [ ] Tagged the release in git so the in-review version is reproducible (`git tag v1.0.0 && git push --tags`)
- [ ] Screenshots captured (5 of them) — see brief above
- [ ] Promo tile (440×280) ready
- [ ] Marquee tile (1400×560) ready (optional, but worth it for Featured eligibility)
- [ ] Manual smoke test on at least 2 SF orgs (different DE / sandbox)
- [ ] Diagnostic scanner runs cleanly on at least 3 page types (Lightning Records, Setup, Reports)
- [ ] No console errors on load
- [ ] Tested with the popup → diagnostic → email flow end-to-end
- [ ] Decision: "Publish manually" so you control launch timing after approval

---

## 13. After submission — what to expect

- **Status timeline:** "Pending Review" appears immediately. First-publish reviews typically take **3–7 business days**. You'll get an email when status changes.
- **If approved:** status flips to "Published" (or stays in "Pending publication" if you chose manual publish). Your store listing goes live within ~30 minutes of clicking Publish.
- **If rejected:** you'll get an email with the specific policy violation. Fix, resubmit. Most rejections are about permission justifications, screenshots not matching functionality, or single-purpose ambiguity — all of which we've drafted carefully above.
- **Updates:** future versions go through faster review (often hours to 1–2 days). Trivial updates sometimes auto-approve.
- **Don't update during initial review** unless critical — each upload restarts the review clock.

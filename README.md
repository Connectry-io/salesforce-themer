# Salesforce Themer by Connectry

**Transform your Salesforce experience with stunning themes.**

A free Chrome extension that replaces Salesforce Lightning's default look with 6 premium themes — from polished light modes to immersive dark experiences. CSS-variable based, instant switching, zero performance impact.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/platform-Chrome%20Extension-green.svg)](https://chrome.google.com/webstore)

---

## Themes

| Theme | Style | Colors |
|-------|-------|--------|
| **Connectry** | Clean, professional light mode | ![#f7f7f5](https://placehold.co/12x12/f7f7f5/f7f7f5.png) `#f7f7f5` · ![#4a6fa5](https://placehold.co/12x12/4a6fa5/4a6fa5.png) `#4a6fa5` · ![#2d2d2d](https://placehold.co/12x12/2d2d2d/2d2d2d.png) `#2d2d2d` |
| **Midnight** | Deep navy dark mode — rich, layered depth | ![#0f1219](https://placehold.co/12x12/0f1219/0f1219.png) `#0f1219` · ![#60a5fa](https://placehold.co/12x12/60a5fa/60a5fa.png) `#60a5fa` · ![#1a1f2e](https://placehold.co/12x12/1a1f2e/1a1f2e.png) `#1a1f2e` |
| **Slate** | Professional muted greys, Linear/Notion aesthetic | ![#f8f9fa](https://placehold.co/12x12/f8f9fa/f8f9fa.png) `#f8f9fa` · ![#374151](https://placehold.co/12x12/374151/374151.png) `#374151` · ![#111827](https://placehold.co/12x12/111827/111827.png) `#111827` |
| **Tron** | Electric cyan on near-black. Neon. HIGH DRAMA | ![#0a0a0f](https://placehold.co/12x12/0a0a0f/0a0a0f.png) `#0a0a0f` · ![#00e5ff](https://placehold.co/12x12/00e5ff/00e5ff.png) `#00e5ff` · ![#e0f7fa](https://placehold.co/12x12/e0f7fa/e0f7fa.png) `#e0f7fa` |
| **Obsidian** | Matte black + amber gold. Bloomberg Terminal energy | ![#0c0c0c](https://placehold.co/12x12/0c0c0c/0c0c0c.png) `#0c0c0c` · ![#d4a853](https://placehold.co/12x12/d4a853/d4a853.png) `#d4a853` · ![#e8e6e3](https://placehold.co/12x12/e8e6e3/e8e6e3.png) `#e8e6e3` |
| **Arctic** | Crisp ice blue. Accessibility-friendly light mode | ![#f0f4f8](https://placehold.co/12x12/f0f4f8/f0f4f8.png) `#f0f4f8` · ![#2b6cb0](https://placehold.co/12x12/2b6cb0/2b6cb0.png) `#2b6cb0` · ![#1a202c](https://placehold.co/12x12/1a202c/1a202c.png) `#1a202c` |

---

## Features

- 6 premium themes — light and dark
- Instant theme switching with smooth transitions
- Cross-device sync via `chrome.storage.sync`
- Works across Salesforce Lightning Experience, Sales Cloud, Service Cloud, Setup
- Handles SPA navigation — themes persist across Salesforce page transitions
- Zero performance impact — pure CSS variable injection
- Targets Salesforce's synthetic shadow DOM correctly (CSS custom properties cascade through it)
- Covers navigation, cards, tables, modals, forms, dropdowns, tabs, and more

---

## Installation (Developer Mode)

Until the extension is live on the Chrome Web Store:

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `salesforce-themer` folder
6. Navigate to any Salesforce org — the Themer icon appears in your toolbar

---

## How It Works

Salesforce Lightning uses a **synthetic shadow DOM** — a polyfill, not native shadow DOM. This means global styles injected into `document.head` cascade into all Lightning Web Components.

The extension:
1. Injects a `<style>` tag with CSS custom property overrides at `:root`
2. Adds targeted class-based overrides for structural elements (nav, cards, tables, etc.)
3. Uses a `MutationObserver` to re-inject styles after Salesforce SPA navigation
4. Stores your preference in `chrome.storage.sync` for cross-device persistence

---

## Supported Salesforce Versions

- Lightning Experience (LEX)
- Sales Cloud
- Service Cloud
- Experience Cloud (partial)
- Salesforce Setup pages
- Salesforce Classic: not supported (separate rendering engine)

---

## Contributing

Pull requests welcome. Each theme lives in `content/themes/<name>.css` — adding a new theme is self-contained.

---

## Built by Connectry

[Connectry](https://connectry.io) builds native Salesforce apps. AppExchange-listed. Buy once, own forever.

> "Salesforce apps deserve better."

---

## License

MIT License — see [LICENSE](LICENSE) for details.

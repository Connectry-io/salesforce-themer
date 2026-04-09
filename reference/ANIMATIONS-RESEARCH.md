# Animations & Visual Effects Research

> Reference document for Salesforce Themer V2/V3 animation features.
> Covers technical approaches, performance, accessibility, and SF-specific concerns.

---

## Table of Contents

1. [Architecture: How Effects Plug Into Our System](#architecture)
2. [Effect 1: Hover Lift/Float](#hover-lift)
3. [Effect 2: Border Shimmer/Glow](#border-shimmer)
4. [Effect 3: Background Particles](#background-particles)
5. [Effect 4: Ambient Glow / Pulse](#ambient-glow)
6. [Effect 5: Animated Gradient Borders](#gradient-borders)
7. [Effect 6: Parallax / Depth on Scroll](#parallax)
8. [Effect 7: Cursor Trails](#cursor-trails)
9. [Effect 8: Typing Effects](#typing-effects)
10. [Effect 9: Aurora / Northern Lights Background](#aurora)
11. [Effect 10: Neon Flicker](#neon-flicker)
12. [CSS Houdini Assessment](#houdini)
13. [Library Comparison](#libraries)
14. [Performance Deep Dive](#performance)
15. [Toggleability Architecture](#toggleability)
16. [Accessibility](#accessibility)
17. [Battery & CPU Impact](#battery)
18. [Competitor Analysis](#competitors)
19. [Theme-to-Effect Mapping](#theme-mapping)
20. [Implementation Roadmap](#roadmap)

---

<a id="architecture"></a>
## 1. Architecture: How Effects Plug Into Our System

### Current Setup

- `content.js` injects a single `<style id="sf-themer-styles">` into `<head>`
- `engine.js` generates CSS from theme config, with `specialEffects` (fx) already used for Tron
- Theme CSS is cached in `chrome.storage.local` for zero-flash injection
- MutationObserver re-injects if SF SPA navigation removes the style tag

### Proposed Architecture for Animations

**Two layers:**

1. **CSS-only effects** -- baked into the generated CSS by `engine.js`, toggled via `specialEffects` config flags. No new injection mechanism needed. This covers: hover lift, border shimmer, ambient glow, gradient borders, aurora backgrounds, neon flicker.

2. **JS-powered effects** -- for particles, cursor trails, and anything needing real-time input. Requires a small addition to `content.js`: a `<canvas>` overlay element positioned `fixed` with `pointer-events: none`. This is a single, reusable canvas.

**Toggle mechanism:**

```js
// In theme config (themes.json):
"specialEffects": {
  "hoverLift": true,
  "borderShimmer": true,
  "particles": "snow",       // "snow" | "rain" | "matrix" | "dots" | false
  "ambientGlow": true,
  "gradientBorders": true,
  "aurora": true,
  "neonFlicker": true,
  "cursorTrail": true,
  "intensity": "subtle"      // "subtle" | "moderate" | "vivid"
}
```

**CSS class toggle approach (preferred for user control):**

```css
/* Effects only apply when this class is on <body> */
body.sf-themer-fx .slds-card { /* hover lift styles */ }
body.sf-themer-fx-hover .slds-card:hover { /* only hover effects */ }
```

This lets users toggle effects without regenerating all CSS. Just add/remove a class.

---

<a id="hover-lift"></a>
## 2. Effect 1: Hover Lift / Float

### Approach: Pure CSS

This is the easiest and most impactful effect. Uses `transform: translateY()` and `box-shadow` on hover.

### Code

```css
/* ─── Hover Lift Effect ─────────────────────────────────────── */

body.sf-themer-fx .slds-card,
body.sf-themer-fx .forceRelatedListSingleContainer,
body.sf-themer-fx .slds-button,
body.sf-themer-fx .slds-pill {
  transition:
    transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 200ms ease !important;
  will-change: transform;
}

body.sf-themer-fx .slds-card:hover {
  transform: translateY(-2px) !important;
  box-shadow:
    0 8px 25px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.08) !important;
}

body.sf-themer-fx .slds-button:hover {
  transform: translateY(-1px) !important;
}

/* Subtle float for list items */
body.sf-themer-fx .slds-table tbody tr:hover {
  transform: translateX(2px) !important;
  transition: transform 150ms ease !important;
}
```

### Performance Impact: **LOW**

- `transform` and `box-shadow` are GPU-composited (transform is; box-shadow triggers repaint but on hover only, so negligible)
- `will-change: transform` promotes element to its own compositor layer
- Only activates on hover -- zero cost when idle

### Theme Suitability

| Theme | Lift Amount | Notes |
|-------|------------|-------|
| All dark themes | -2px to -3px | More dramatic shadow on dark |
| All light themes | -1px to -2px | Subtler, lighter shadows |
| Tron | -2px + glow shadow | Cyan glow instead of dark shadow |
| High Contrast | Skip | Could interfere with focus visibility |

### SF Gotchas

- **Do NOT apply to `.slds-modal` or `.slds-dropdown`** -- these have absolute/fixed positioning and transform will break their stacking context
- **Do NOT apply to `.slds-combobox__input`** -- will break dropdown alignment
- **List view rows**: safe to apply translateX but NOT translateY (breaks row alignment)
- The cubic-bezier with overshoot (1.56) gives a satisfying "spring" feel

---

<a id="border-shimmer"></a>
## 3. Effect 2: Border Shimmer / Glow

### Approach: Pure CSS with `@keyframes`

Uses a pseudo-element with an animated linear-gradient that moves across the border area.

### Code

```css
/* ─── Border Shimmer Effect ─────────────────────────────────── */

@keyframes sf-themer-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}

body.sf-themer-fx .slds-card {
  position: relative !important;
  overflow: hidden !important;
}

/* Shimmer line across top of cards */
body.sf-themer-fx .slds-card::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 1px !important;
  background: linear-gradient(
    90deg,
    transparent 0%,
    transparent 40%,
    var(--sf-themer-accent, #4a6fa5) 50%,
    transparent 60%,
    transparent 100%
  ) !important;
  background-size: 200% 100% !important;
  animation: sf-themer-shimmer 3s ease-in-out infinite !important;
  z-index: 1 !important;
  pointer-events: none !important;
}

/* Pulsing glow on focused inputs */
@keyframes sf-themer-input-glow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(var(--sf-themer-accent-rgb), 0.2); }
  50%      { box-shadow: 0 0 0 3px rgba(var(--sf-themer-accent-rgb), 0.35); }
}

body.sf-themer-fx .slds-input:focus,
body.sf-themer-fx .slds-textarea:focus {
  animation: sf-themer-input-glow 2s ease-in-out infinite !important;
}
```

### Performance Impact: **LOW-MEDIUM**

- `background-position` animation triggers repaint, NOT reflow -- acceptable
- The pseudo-element is absolutely positioned, so it doesn't affect layout
- Limiting to cards keeps the animation count low (typically 3-8 cards visible)
- `animation-play-state: paused` can be used when tab is not visible (via `document.hidden`)

### Alternative: `@property` + Houdini-style gradient animation

```css
/* Modern browsers: animate the gradient angle directly */
@property --sf-shimmer-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes sf-themer-shimmer-rotate {
  to { --sf-shimmer-angle: 360deg; }
}

body.sf-themer-fx .slds-card::before {
  background: conic-gradient(
    from var(--sf-shimmer-angle),
    transparent 0%,
    var(--sf-themer-accent) 10%,
    transparent 20%
  ) !important;
  animation: sf-themer-shimmer-rotate 4s linear infinite !important;
}
```

`@property` is supported in Chrome 85+ (our only target), so this works well.

### Theme Suitability

| Theme | Shimmer Color | Speed |
|-------|--------------|-------|
| Tron | Cyan (#00e5ff) | 2s (faster = more electric) |
| Arctic | Ice blue (#88c8e8) | 4s (slow, glacial) |
| Ember | Orange-red (#ff6b35) | 3s |
| Sakura | Pink (#f48fb1) | 4s (gentle) |
| Terminal | Green (#00ff41) | 2s |
| Dracula | Purple (#bd93f9) | 3s |

### SF Gotchas

- `overflow: hidden` on `.slds-card` may clip dropdown menus that originate inside cards. **Mitigation**: use `overflow: clip` instead (doesn't create a scroll container, but clips painting). Chrome 90+ supports it.
- Alternatively, only apply shimmer to `.slds-card__header` to avoid overflow issues entirely.

---

<a id="background-particles"></a>
## 4. Effect 3: Background Particles (Snow, Rain, Matrix, Dots)

### Approach: **JS + Canvas overlay** (CSS-only not viable for real particles)

Particles require JS. The lightest approach is a single `<canvas>` with `requestAnimationFrame`.

### Architecture

```
content.js
  |
  +-- injects <canvas id="sf-themer-particles"> (fixed, full viewport, pointer-events: none)
  +-- runs a minimal particle engine (~80 lines)
  +-- theme config specifies particle type + density
```

### Code: Minimal Particle Engine

```js
// ─── Particle Overlay (~2KB minified) ──────────────────────────

class SFThemerParticles {
  constructor(type, config) {
    this.type = type;           // 'snow' | 'rain' | 'matrix' | 'dots'
    this.config = config;       // { color, density, speed, opacity }
    this.particles = [];
    this.canvas = null;
    this.ctx = null;
    this.raf = null;
    this.paused = false;
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sf-themer-particles';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '999',         // Below modals (SF modals are 9000+)
      opacity: this.config.opacity || '0.6',
    });
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.spawn();
    this.loop();

    // Pause when tab not visible
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!this.paused) this.loop();
    });

    // Resize handling (debounced)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      }, 200);
    });
  }

  spawn() {
    const count = this.config.density || 50;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < count; i++) {
      switch (this.type) {
        case 'snow':
          this.particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 3 + 1,
            vx: Math.random() * 0.5 - 0.25,
            vy: Math.random() * 1 + 0.3,
          });
          break;
        case 'rain':
          this.particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            len: Math.random() * 15 + 5,
            vy: Math.random() * 8 + 4,
          });
          break;
        case 'matrix':
          this.particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            char: String.fromCharCode(0x30A0 + Math.random() * 96),
            vy: Math.random() * 3 + 1,
            size: Math.random() * 10 + 10,
            opacity: Math.random(),
          });
          break;
        case 'dots':
          this.particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 2 + 0.5,
            vx: Math.random() * 0.3 - 0.15,
            vy: Math.random() * 0.3 - 0.15,
            opacity: Math.random() * 0.5 + 0.2,
          });
          break;
      }
    }
  }

  draw() {
    const { ctx, canvas, particles, type } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = this.config.color || '#ffffff';

    for (const p of particles) {
      switch (type) {
        case 'snow':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > canvas.height) { p.y = -5; p.x = Math.random() * canvas.width; }
          break;

        case 'rain':
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + p.len);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1;
          ctx.stroke();
          p.y += p.vy;
          if (p.y > canvas.height) { p.y = -p.len; p.x = Math.random() * canvas.width; }
          break;

        case 'matrix':
          ctx.font = `${p.size}px monospace`;
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity;
          ctx.fillText(p.char, p.x, p.y);
          p.y += p.vy;
          p.opacity -= 0.003;
          if (p.y > canvas.height || p.opacity <= 0) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
            p.opacity = 1;
            p.char = String.fromCharCode(0x30A0 + Math.random() * 96);
          }
          break;

        case 'dots':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity;
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  loop() {
    if (this.paused) return;
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas?.remove();
    this.particles = [];
  }
}
```

### Performance Impact: **MEDIUM**

- 50 particles at 60fps: ~0.5ms per frame on modern hardware
- Canvas compositing is GPU-accelerated
- **Critical**: pause on `document.hidden` to save battery when tab is backgrounded
- **Density tuning**: 30 particles for "subtle", 50 for "moderate", 100 for "vivid"
- Matrix text is the most expensive (font rendering); keep count at 30-40 max

### Recommended Particle Counts by Device

| Device | Snow | Rain | Matrix | Dots |
|--------|------|------|--------|------|
| Desktop | 60 | 80 | 40 | 50 |
| Laptop (battery) | 30 | 40 | 20 | 30 |
| Throttled | 15 | 20 | 10 | 15 |

Detect battery state via `navigator.getBattery()` and reduce density accordingly.

### CSS-Only "Fake Particles" Alternative

For very subtle snow-like effect without JS, you can use animated pseudo-elements with radial-gradient dots:

```css
@keyframes sf-themer-snow-fall {
  0%   { background-position: 0 0, 0 0, 0 0; }
  100% { background-position: 500px 1000px, 400px 400px, 300px 300px; }
}

body.sf-themer-fx-particles::after {
  content: '' !important;
  position: fixed !important;
  top: -100px !important;
  left: 0 !important;
  width: 100% !important;
  height: calc(100% + 100px) !important;
  pointer-events: none !important;
  z-index: 999 !important;
  background-image:
    radial-gradient(2px 2px at 100px 50px, white 50%, transparent),
    radial-gradient(3px 3px at 200px 150px, white 50%, transparent),
    radial-gradient(1px 1px at 300px 250px, white 50%, transparent);
  background-size: 500px 1000px, 400px 400px, 300px 300px;
  animation: sf-themer-snow-fall 15s linear infinite !important;
  opacity: 0.4 !important;
}
```

**Pros**: Pure CSS, no JS needed. **Cons**: Limited to ~20-30 "particles" before the gradient gets huge, no randomness, repeating pattern is noticeable. Good enough for a "lite" mode.

### Theme Suitability

| Theme | Particle Type | Color | Density |
|-------|--------------|-------|---------|
| Arctic | Snow | #ffffff | 50 |
| Terminal | Matrix rain | #00ff41 | 35 |
| Midnight | Dots (stars) | #ffffff | 40 |
| Ember | Dots (sparks) | #ff6b35 | 30 |
| Dracula | Dots (mist) | #bd93f9 | 25 |
| Nord | Snow | #d8dee9 | 40 |

### SF Gotchas

- Canvas z-index must be below SF modal overlay (`.slds-backdrop` is z-index 9000)
- `pointer-events: none` is critical -- otherwise clicks don't reach SF elements
- SF has iframes for some components (Visualforce pages) -- particles only show in main frame
- MutationObserver should also re-inject canvas if SF removes it

---

<a id="ambient-glow"></a>
## 5. Effect 4: Ambient Glow / Pulse

### Approach: Pure CSS

Soft pulsing glow around accent-colored elements using animated `box-shadow`.

### Code

```css
/* ─── Ambient Glow Pulse ────────────────────────────────────── */

@keyframes sf-themer-glow-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(var(--sf-themer-accent-rgb), 0.08); }
  50%      { box-shadow: 0 0 20px rgba(var(--sf-themer-accent-rgb), 0.18); }
}

/* Pulse on brand buttons */
body.sf-themer-fx .slds-button_brand,
body.sf-themer-fx .slds-button--brand {
  animation: sf-themer-glow-pulse 3s ease-in-out infinite !important;
}

/* Subtle glow on active nav item */
body.sf-themer-fx .slds-context-bar__item.slds-is-active {
  animation: sf-themer-glow-pulse 4s ease-in-out infinite !important;
}

/* Glow ring on focused elements */
@keyframes sf-themer-focus-glow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(var(--sf-themer-accent-rgb), 0.25); }
  50%      { box-shadow: 0 0 0 4px rgba(var(--sf-themer-accent-rgb), 0.15),
                          0 0 15px rgba(var(--sf-themer-accent-rgb), 0.1); }
}

body.sf-themer-fx .slds-input:focus {
  animation: sf-themer-focus-glow 2.5s ease-in-out infinite !important;
}
```

### Performance Impact: **LOW**

- `box-shadow` animation does trigger repaint, but only on the specific element
- With only a handful of elements glowing at once, impact is negligible
- The slow animation cycle (3-4s) means smooth, not jittery

### Subtlety Tip

Keep opacity ranges very tight: 0.05 to 0.15 for "subtle" mode. The eye perceives the movement even at very low contrast deltas.

### Theme Suitability

- **Tron**: Strong cyan glow, faster pulse (2s) -- already partially implemented in `specialEffects`
- **Dracula**: Purple glow, slow pulse (4s)
- **Ember**: Warm orange glow, medium pulse (3s)
- **Arctic**: Cool blue glow, very slow (5s) -- like breathing
- **Light themes**: Generally skip, or use very subtle shadow-only version

---

<a id="gradient-borders"></a>
## 6. Effect 5: Animated Gradient Borders

### Approach: Pure CSS with `@property` or pseudo-element mask

Two techniques, both CSS-only.

### Technique A: `@property` Animated Angle (Preferred)

```css
@property --sf-border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes sf-themer-border-rotate {
  to { --sf-border-angle: 360deg; }
}

body.sf-themer-fx .slds-card {
  position: relative !important;
  /* Remove default border */
  border: none !important;
}

body.sf-themer-fx .slds-card::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  padding: 1px !important; /* border width */
  border-radius: inherit !important;
  background: conic-gradient(
    from var(--sf-border-angle),
    var(--sf-themer-accent) 0%,
    transparent 30%,
    transparent 70%,
    var(--sf-themer-accent) 100%
  ) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask-composite: exclude !important;
  animation: sf-themer-border-rotate 4s linear infinite !important;
  pointer-events: none !important;
  z-index: 1 !important;
}
```

### Technique B: Rotating Background (Fallback)

```css
body.sf-themer-fx .slds-card {
  position: relative !important;
  border: none !important;
  background-clip: padding-box !important;
}

body.sf-themer-fx .slds-card::before {
  content: '' !important;
  position: absolute !important;
  inset: -1px !important;
  border-radius: inherit !important;
  background: linear-gradient(
    var(--sf-border-angle, 0deg),
    var(--sf-themer-accent),
    transparent,
    var(--sf-themer-accent)
  ) !important;
  z-index: -1 !important;
  animation: sf-themer-border-rotate 4s linear infinite !important;
}
```

### Performance Impact: **LOW-MEDIUM**

- `@property` animation of custom properties is very efficient in Chrome -- the browser only repaints the gradient, not the whole element
- The mask-composite trick confines painting to the 1px border area
- Limit to 5-8 elements max visible at once

### Theme Suitability

| Theme | Gradient Colors | Speed |
|-------|----------------|-------|
| Tron | Cyan to transparent | 3s |
| Dracula | Purple to pink | 5s |
| Sakura | Pink to white | 6s (gentle) |
| Ember | Orange to red | 4s |
| Nord | Blue to teal | 5s |

### SF Gotchas

- Cards that already use `::before` for other purposes (some SLDS components do) will conflict. Use `::after` as fallback.
- `position: relative` may affect z-stacking in some SF list views. Test thoroughly.
- `mask-composite: exclude` is the standard; `-webkit-mask-composite: xor` is needed for Chrome.

---

<a id="parallax"></a>
## 7. Effect 6: Parallax / Depth on Scroll

### Approach: Pure CSS (limited) or Minimal JS

### CSS-Only Parallax

```css
/* Parallax container on the main content area */
body.sf-themer-fx .oneContent {
  perspective: 1000px !important;
  overflow-y: auto !important;
}

body.sf-themer-fx .slds-card {
  transform: translateZ(0) !important;
  /* Cards appear to float above the background */
}

body.sf-themer-fx .slds-page-header {
  transform: translateZ(20px) !important;
  /* Header scrolls slower (parallax) */
}
```

**Reality check**: CSS parallax via `perspective` + `translateZ` is fragile. It requires the scrolling container to have `perspective` set, and SF's DOM structure with nested scroll containers makes this unreliable.

### JS Parallax (Recommended if pursuing this)

```js
// Minimal parallax on scroll (~20 lines)
const content = document.querySelector('.oneContent');
if (content) {
  content.addEventListener('scroll', () => {
    const y = content.scrollTop;
    const header = content.querySelector('.slds-page-header');
    if (header) {
      header.style.transform = `translateY(${y * 0.05}px)`;
    }
  }, { passive: true });
}
```

### Performance Impact: **MEDIUM-HIGH**

- Scroll-linked animations are the most dangerous for performance
- The `{ passive: true }` flag is critical -- tells browser the handler won't call `preventDefault()`
- Even with passive listeners, modifying `style.transform` on scroll can cause jank
- **Recommendation**: Skip this effect or use CSS `scroll-timeline` (Chrome 115+)

### CSS `scroll-timeline` (Modern Alternative)

```css
@keyframes sf-themer-parallax-header {
  from { transform: translateY(0); opacity: 1; }
  to   { transform: translateY(-30px); opacity: 0.7; }
}

body.sf-themer-fx .slds-page-header {
  animation: sf-themer-parallax-header linear !important;
  animation-timeline: scroll() !important;
  animation-range: 0px 300px !important;
}
```

This is CSS-only and performant because the browser can optimize scroll-linked animations. Chrome 115+ supports it, which covers our audience.

### Verdict

**Low priority**. High risk of breaking SF layouts, medium-high performance cost, and the visual payoff is small on a data-heavy app like Salesforce. If implemented, use `scroll-timeline` only.

---

<a id="cursor-trails"></a>
## 8. Effect 7: Cursor Trails

### Approach: **JS + Canvas**

Can share the same canvas overlay as particles.

### Code

```js
class SFThemerCursorTrail {
  constructor(config) {
    this.config = config; // { color, length, fade, size }
    this.points = [];
    this.canvas = document.getElementById('sf-themer-particles')
      || this.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.active = false;
  }

  createCanvas() {
    const c = document.createElement('canvas');
    c.id = 'sf-themer-cursor-trail';
    Object.assign(c.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100vw', height: '100vh',
      pointerEvents: 'none', zIndex: '998',
    });
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    document.body.appendChild(c);
    return c;
  }

  start() {
    this.active = true;
    document.addEventListener('mousemove', (e) => {
      this.points.push({
        x: e.clientX,
        y: e.clientY,
        life: 1.0,
      });
      // Keep trail length manageable
      if (this.points.length > (this.config.length || 20)) {
        this.points.shift();
      }
    }, { passive: true });
    this.draw();
  }

  draw() {
    if (!this.active) return;
    const { ctx, canvas, points } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const progress = i / points.length;
      const size = (this.config.size || 4) * progress;
      const alpha = progress * 0.5;

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = this.config.color || '#ffffff';
      ctx.globalAlpha = alpha;
      ctx.fill();

      p.life -= 0.02;
    }

    // Remove dead points
    this.points = this.points.filter(p => p.life > 0);
    ctx.globalAlpha = 1;
    requestAnimationFrame(() => this.draw());
  }

  destroy() {
    this.active = false;
    this.canvas?.remove();
  }
}
```

### Performance Impact: **LOW-MEDIUM**

- Only draws when mouse moves (20 points max)
- Canvas operations are minimal -- just circles
- The `mousemove` handler with `passive: true` has negligible overhead
- The rAF loop is cheap when there are no points to draw

### Theme Suitability

| Theme | Trail Color | Style |
|-------|------------|-------|
| Tron | Cyan glow dots | Small, bright |
| Arctic | Ice blue + white | Larger, fading |
| Ember | Orange sparks | Flickering |
| Sakura | Pink petals | Could use images |
| Terminal | Green dots | Matrix-like |

### SF Gotchas

- Canvas must be `pointer-events: none` -- critical for SF interaction
- If sharing canvas with particles, need separate draw contexts or layer the draws
- Consider disabling cursor trail inside modals/overlays for cleanliness

---

<a id="typing-effects"></a>
## 9. Effect 8: Typing Effects

### Approach: Pure CSS (limited) or JS

### CSS-Only Typing (for fixed text)

```css
@keyframes sf-themer-typing {
  from { width: 0; }
  to   { width: 100%; }
}

@keyframes sf-themer-blink-caret {
  50% { border-color: transparent; }
}

body.sf-themer-fx .slds-page-header__title {
  overflow: hidden !important;
  white-space: nowrap !important;
  border-right: 2px solid var(--sf-themer-accent) !important;
  animation:
    sf-themer-typing 2s steps(30) 1 forwards,
    sf-themer-blink-caret 0.75s step-end infinite !important;
  width: 0 !important; /* Start hidden, animate to full */
}
```

### Reality Check

Typing effects on existing SF content is problematic:
- Content length varies, so `steps()` count can't be hardcoded
- It replays on every SPA navigation (annoying after the first time)
- It interferes with SF's own text rendering and truncation

### Recommendation

**Skip for V2.** If pursued later, limit to a single decorative element (like a custom watermark or theme name display), not actual SF content. A blinking cursor accent on an otherwise static element can add character without the full typing effect.

```css
/* Blinking cursor accent -- simpler and less intrusive */
body.sf-themer-fx[data-sf-theme="terminal"] .slds-page-header__title::after {
  content: '_' !important;
  animation: sf-themer-blink-caret 1s step-end infinite !important;
  color: #00ff41 !important;
  font-weight: 300 !important;
}
```

---

<a id="aurora"></a>
## 10. Effect 9: Aurora / Northern Lights Background

### Approach: Pure CSS

This is one of the most visually stunning effects achievable with pure CSS.

### Code

```css
/* ─── Aurora Background Effect ──────────────────────────────── */

@keyframes sf-themer-aurora {
  0% {
    background-position: 0% 50%;
    filter: hue-rotate(0deg);
  }
  50% {
    background-position: 100% 50%;
    filter: hue-rotate(30deg);
  }
  100% {
    background-position: 0% 50%;
    filter: hue-rotate(0deg);
  }
}

body.sf-themer-fx-aurora::before {
  content: '' !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none !important;
  z-index: 0 !important;
  opacity: 0.07 !important; /* Very subtle -- key to not being distracting */
  background: linear-gradient(
    -45deg,
    #1a1a2e,
    #16213e,
    #0f3460,
    #1a5c3a,
    #1a1a4e,
    #2d1b69
  ) !important;
  background-size: 400% 400% !important;
  animation: sf-themer-aurora 20s ease-in-out infinite !important;
}

/* Ensure content stacks above the aurora */
body.sf-themer-fx-aurora .oneContent,
body.sf-themer-fx-aurora .slds-card,
body.sf-themer-fx-aurora .slds-page-header {
  position: relative !important;
  z-index: 1 !important;
}
```

### Advanced: Multi-layer Aurora with Blur

```css
body.sf-themer-fx-aurora::before {
  content: '' !important;
  position: fixed !important;
  inset: -50% !important; /* Overflow for blur to not show edges */
  pointer-events: none !important;
  z-index: 0 !important;
  opacity: 0.06 !important;
  background:
    radial-gradient(ellipse at 20% 50%, #1a5c3a 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, #2d1b69 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, #0f3460 0%, transparent 50%) !important;
  background-size: 200% 200% !important;
  animation: sf-themer-aurora 25s ease-in-out infinite !important;
  filter: blur(60px) !important;
}
```

### Performance Impact: **LOW**

- Single pseudo-element with `position: fixed` -- composited on its own layer
- `background-position` animation is efficient
- `filter: blur()` on a fixed element is GPU-accelerated and only computed once per frame
- The 20-25s animation cycle means very gradual changes -- low GPU load
- `hue-rotate` is lightweight when applied to a single composited layer

### Theme Suitability

| Theme | Aurora Colors | Opacity |
|-------|-------------|---------|
| Nord | Blue, teal, green (actual aurora) | 0.08 |
| Arctic | Ice blue, white, pale cyan | 0.06 |
| Midnight | Deep purple, navy, dark teal | 0.05 |
| Dracula | Purple, pink, dark cyan | 0.06 |
| Obsidian | Very subtle warm grays | 0.03 |

### SF Gotchas

- The `z-index: 0` on the pseudo-element must be below all SF content
- `position: fixed` + large blur can cause edge artifacts -- the `inset: -50%` trick handles this
- On very large monitors (4K+), the blur radius may need to increase

---

<a id="neon-flicker"></a>
## 11. Effect 10: Neon Flicker

### Approach: Pure CSS

Perfect for Tron/cyberpunk themes. Uses randomized keyframes to simulate electrical flicker.

### Code

```css
/* ─── Neon Flicker Effect ───────────────────────────────────── */

@keyframes sf-themer-neon-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
    text-shadow:
      0 0 4px #00e5ff,
      0 0 11px #00e5ff,
      0 0 19px #00e5ff,
      0 0 40px #00e5ff;
    opacity: 1;
  }
  20%, 24%, 55% {
    text-shadow: none;
    opacity: 0.8;
  }
}

/* Apply to nav item text for neon sign effect */
body.sf-themer-fx-neon .slds-context-bar__label-action .slds-truncate {
  animation: sf-themer-neon-flicker 4s infinite alternate !important;
}

/* Neon border flicker for cards */
@keyframes sf-themer-neon-border-flicker {
  0%, 18%, 22%, 25%, 53%, 57%, 100% {
    border-color: rgba(0, 229, 255, 0.4);
    box-shadow: 0 0 10px rgba(0, 229, 255, 0.15),
                inset 0 0 10px rgba(0, 229, 255, 0.05);
  }
  20%, 24%, 55% {
    border-color: rgba(0, 229, 255, 0.1);
    box-shadow: none;
  }
}

body.sf-themer-fx-neon .slds-card {
  animation: sf-themer-neon-border-flicker 5s infinite !important;
}

/* Steady glow (no flicker) for primary actions */
body.sf-themer-fx-neon .slds-button_brand {
  box-shadow:
    0 0 5px rgba(0, 229, 255, 0.3),
    0 0 10px rgba(0, 229, 255, 0.15),
    inset 0 0 5px rgba(0, 229, 255, 0.1) !important;
  transition: box-shadow 200ms ease !important;
}

body.sf-themer-fx-neon .slds-button_brand:hover {
  box-shadow:
    0 0 10px rgba(0, 229, 255, 0.5),
    0 0 20px rgba(0, 229, 255, 0.3),
    0 0 40px rgba(0, 229, 255, 0.15),
    inset 0 0 10px rgba(0, 229, 255, 0.15) !important;
}
```

### Subtlety Controls

The flicker can be annoying if too frequent. For daily use:
- Use the flicker animation on only 1-2 elements at a time (e.g., just the active nav tab)
- Set `animation-iteration-count: 3` so it flickers a few times then stops
- Use the steady glow for most elements, flicker only for decorative ones

```css
/* "Subtle" neon mode: flicker only on first load, then steady */
body.sf-themer-fx-neon .slds-context-bar__label-action .slds-truncate {
  animation: sf-themer-neon-flicker 2s 2 forwards,
             sf-themer-neon-steady 0s 2s forwards !important;
}

@keyframes sf-themer-neon-steady {
  to {
    text-shadow: 0 0 4px #00e5ff, 0 0 11px #00e5ff;
    opacity: 1;
  }
}
```

### Performance Impact: **LOW**

- `text-shadow` and `box-shadow` animations trigger repaint only -- no reflow
- Limited to a few elements
- The flicker is spaced out (4-5s cycles) with brief off-states

### Theme Suitability

- **Tron**: Primary candidate. Cyan neon.
- **Terminal**: Green neon variant (`#00ff41`)
- **Dracula**: Purple neon accent
- All other themes: Not applicable

---

<a id="houdini"></a>
## 12. CSS Houdini Assessment

### What is Houdini?

CSS Houdini is a set of APIs that expose CSS engine internals:
- **Paint API** (`CSS.paintWorklet`): custom image rendering via JS (like a mini-canvas for CSS backgrounds)
- **Properties & Values API** (`@property`): typed custom properties with animation support
- **Layout API**: custom layout algorithms (experimental)
- **Animation Worklet**: custom animation timing (experimental)

### Browser Support (Chrome-only extension = ideal)

| API | Chrome Support | Usable? |
|-----|---------------|---------|
| `@property` | Chrome 85+ | **YES** -- use freely |
| Paint API (`CSS.paintWorklet`) | Chrome 65+ | **YES, but...** (see below) |
| Animation Worklet | Chrome 71+ (flag) | No -- behind flag |
| Layout API | Experimental | No |

### `@property` -- Use This

Already shown in the gradient border section. `@property` lets you animate custom properties that CSS normally can't animate (angles, percentages, colors). This is the single most useful Houdini feature for our effects.

```css
@property --glow-intensity {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

@keyframes sf-themer-glow-breathe {
  0%, 100% { --glow-intensity: 0.1; }
  50%      { --glow-intensity: 0.3; }
}

body.sf-themer-fx .slds-card {
  animation: sf-themer-glow-breathe 4s ease-in-out infinite;
  box-shadow: 0 0 calc(var(--glow-intensity) * 30px) rgba(var(--sf-themer-accent-rgb), var(--glow-intensity));
}
```

### Paint API -- Proceed with Caution

The Paint API lets you register a JS paint worklet that can be used as a CSS `background-image`. This would be ideal for custom shimmer, particles, or noise textures.

**However, there are complications for Chrome extensions:**

1. **Worklet registration** requires calling `CSS.paintWorklet.addModule(url)` where `url` must be a worklet JS file
2. In a Chrome extension, the worklet file must be a `web_accessible_resource`
3. The worklet runs in a restricted context (no DOM, no imports)
4. Cross-origin restrictions may apply within SF pages

**Example (if we pursue it):**

```js
// Register in content.js
if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule(chrome.runtime.getURL('effects/shimmer-worklet.js'));
}
```

```js
// effects/shimmer-worklet.js
registerPaint('sf-shimmer', class {
  static get inputProperties() { return ['--shimmer-color', '--shimmer-progress']; }
  paint(ctx, size, props) {
    const color = props.get('--shimmer-color').toString();
    const progress = parseFloat(props.get('--shimmer-progress'));
    const x = progress * size.width * 2 - size.width * 0.5;
    const gradient = ctx.createLinearGradient(x, 0, x + size.width * 0.3, 0);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size.width, size.height);
  }
});
```

```css
@property --shimmer-progress {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

@keyframes sf-shimmer-move {
  to { --shimmer-progress: 1; }
}

body.sf-themer-fx .slds-card {
  background-image: paint(sf-shimmer);
  --shimmer-color: rgba(0, 229, 255, 0.15);
  animation: sf-shimmer-move 3s ease-in-out infinite;
}
```

### Verdict on Houdini

- **`@property`**: Use it. It is stable, well-supported, and unlocks smoother gradient animations.
- **Paint API**: Interesting for V3. Test whether worklet registration works reliably from a Chrome extension content script on SF pages. The payoff is custom shimmer/noise/pattern effects with GPU-accelerated painting.
- **Other Houdini APIs**: Not ready.

---

<a id="libraries"></a>
## 13. Library Comparison

### Do We Need a Library?

For our use case (Chrome extension injecting into SF), the answer is **probably not**. Here's why:

1. We only need one effect type at a time per theme
2. Our particle needs are simple (snow, rain, dots)
3. Libraries add bundle size, which matters for extension load time
4. Custom code gives us full control over performance

### If We Do Use a Library

| Library | Size (min+gzip) | Features | Verdict |
|---------|-----------------|----------|---------|
| **tsParticles** | ~40KB core | Full particle system, many presets | Too heavy. Tree-shakeable but still large. |
| **particles.js** | ~25KB | Classic, simple API | Abandoned (no updates since 2018). Skip. |
| **tsParticles Slim** | ~20KB | Reduced feature set | Better, but still large for one effect. |
| **canvas-confetti** | ~6KB | Confetti/particle bursts | Focused, small. Good for celebrations only. |
| **anime.js** | ~17KB | General animation library | Overkill. We have CSS animations. |
| **GSAP** | ~24KB core | Professional animation | Too heavy, licensing concerns for extensions. |
| **motion** (framer) | ~18KB | React-focused | Wrong paradigm (we inject CSS, not React). |

### Recommendation

**Write a custom ~2KB particle engine** (as shown in the particles section). It is smaller than any library, does exactly what we need, and has zero dependencies.

For complex effects in the future, consider **tsParticles Slim** with aggressive tree-shaking if our custom engine isn't sufficient. But for V2, custom code wins.

---

<a id="performance"></a>
## 14. Performance Deep Dive

### GPU-Accelerated vs CPU Properties

**Safe to animate (GPU-composited, no reflow or repaint):**
- `transform` (translate, scale, rotate)
- `opacity`
- `filter` (blur, brightness, hue-rotate) on composited layers
- `will-change` promotes to compositor layer

**Triggers repaint only (moderate cost):**
- `box-shadow`
- `text-shadow`
- `background-color`
- `background-position`
- `border-color`
- `outline`

**Triggers reflow (AVOID animating):**
- `width`, `height`
- `margin`, `padding`
- `top`, `left`, `right`, `bottom`
- `font-size`
- `display`

### Effect Performance Ranking

| Effect | Method | Cost | Reflow? | Repaint? | Composite? |
|--------|--------|------|---------|----------|------------|
| Hover lift | CSS transform | Minimal | No | No | Yes |
| Aurora bg | CSS bg-position + fixed | Low | No | Yes (1 el) | Partial |
| Ambient glow | CSS box-shadow | Low | No | Yes | No |
| Gradient border | CSS @property + mask | Low | No | Yes (1 el) | Partial |
| Border shimmer | CSS bg-position | Low | No | Yes | Partial |
| Neon flicker | CSS text-shadow | Low | No | Yes | No |
| Particles (canvas) | JS + Canvas | Medium | No | No | Yes |
| Cursor trail | JS + Canvas | Low-Med | No | No | Yes |
| Parallax | JS or scroll-timeline | Med-High | Maybe | Yes | Partial |
| Typing | CSS width | Medium | YES | Yes | No |

### Salesforce-Specific Performance Concerns

1. **SF pages are DOM-heavy**: typical record page has 3000-8000 DOM nodes. Animations on broadly-scoped selectors (e.g., `*:hover`) will tank performance.

2. **SF uses LWC shadow DOM (sort of)**: Lightning Web Components use synthetic shadow DOM by default. Our injected styles pierce this (they're in `<head>`), but `::before`/`::after` pseudo-elements may not render inside shadow roots. Test each component.

3. **Aura framework overhead**: SF still runs the Aura framework alongside LWC. It does its own DOM manipulation that can conflict with CSS animations (e.g., inline styles that override our animation states).

4. **SPA navigation**: SF's single-page navigation causes DOM subtrees to be destroyed and recreated. Animations that depend on DOM state (like "animate once on load") will re-trigger on every navigation. Use `animation-fill-mode: forwards` and careful scoping.

5. **iframes**: Visualforce pages, Flow screens, and some components run in iframes. Our effects won't penetrate iframes (by design -- `all_frames: true` in manifest means content.js runs in iframes too, but each frame is independent).

### Performance Budget

For a typical Salesforce page load:
- **CSS parse overhead**: Additional animation CSS adds ~0.1-0.3ms parse time. Negligible.
- **Animation paint cost**: Target < 2ms per frame total for all effects combined.
- **JS effect cost**: Target < 1ms per frame for particles/cursor.
- **Total budget**: < 3ms per frame (leaves 13ms headroom in a 16ms/60fps frame).

### Measuring Performance

Add this to content.js for debug builds:

```js
// Debug: measure animation frame cost
if (localStorage.getItem('sf-themer-perf')) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 16) {
        console.warn('[SF Themer] Long frame:', entry.duration.toFixed(1) + 'ms');
      }
    }
  });
  observer.observe({ type: 'longtask', buffered: true });
}
```

---

<a id="toggleability"></a>
## 15. Toggleability Architecture

### Requirements

1. Users can enable/disable effects per-theme
2. Toggling doesn't require regenerating the full CSS
3. Effects can be enabled/disabled independently
4. Changes take effect immediately (no page reload)

### Approach: CSS Class Toggles on `<body>`

```js
// In content.js -- effect toggle handler
function setEffectClasses(effects) {
  const body = document.body;
  if (!body) return;

  // Master toggle
  body.classList.toggle('sf-themer-fx', !!effects.enabled);

  // Individual effect toggles
  body.classList.toggle('sf-themer-fx-hover', !!effects.hoverLift);
  body.classList.toggle('sf-themer-fx-shimmer', !!effects.borderShimmer);
  body.classList.toggle('sf-themer-fx-glow', !!effects.ambientGlow);
  body.classList.toggle('sf-themer-fx-gradient', !!effects.gradientBorders);
  body.classList.toggle('sf-themer-fx-aurora', !!effects.aurora);
  body.classList.toggle('sf-themer-fx-neon', !!effects.neonFlicker);
  body.classList.toggle('sf-themer-fx-particles', !!effects.particles);
  body.classList.toggle('sf-themer-fx-cursor', !!effects.cursorTrail);
}
```

### CSS Structure

All effect CSS is always injected as part of the theme CSS. Effects are activated/deactivated purely by the body class:

```css
/* This CSS is always present, but only applies when the class exists */
body.sf-themer-fx-hover .slds-card:hover {
  transform: translateY(-2px) !important;
}

/* No class = no effect. Zero cost. */
```

### Storage Schema

```js
// In chrome.storage.sync
{
  theme: 'tron',
  effects: {
    enabled: true,           // Master toggle
    hoverLift: true,
    borderShimmer: true,
    ambientGlow: false,
    gradientBorders: true,
    aurora: false,
    neonFlicker: true,
    particles: false,        // or 'snow' | 'rain' | 'matrix' | 'dots'
    cursorTrail: false,
    intensity: 'subtle',     // 'subtle' | 'moderate' | 'vivid'
  }
}
```

### Popup UI Toggle

Each effect gets a toggle switch in the popup or options page. The master toggle disables all effects at once.

---

<a id="accessibility"></a>
## 16. Accessibility

### `prefers-reduced-motion`

This is non-negotiable. Users who have enabled "Reduce motion" in their OS settings must see zero animations.

```css
@media (prefers-reduced-motion: reduce) {
  body.sf-themer-fx *,
  body.sf-themer-fx *::before,
  body.sf-themer-fx *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

In JS (for particles/cursor):

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (prefersReducedMotion.matches) {
  // Don't start particle engine or cursor trail
  return;
}

// Also listen for changes
prefersReducedMotion.addEventListener('change', (e) => {
  if (e.matches) {
    particleEngine?.destroy();
    cursorTrail?.destroy();
  }
});
```

### Photosensitivity

- **Neon flicker**: The rapid on/off pattern could trigger photosensitive responses. Keep flicker rate below 3 flashes per second (our 4s cycle with 3 brief flickers is at the borderline -- consider slowing it down).
- **WCAG 2.3.1**: No more than 3 flashes per second. Our neon flicker design has ~3 flashes over 5 seconds, which is safe.

### Focus Visibility

- Effects must never obscure or reduce focus indicators
- `box-shadow` glow effects should enhance, not replace, the native focus ring
- Test with keyboard-only navigation

### Color Contrast

- Aurora overlays and ambient glow can reduce text contrast. At `opacity: 0.06-0.08`, the contrast reduction is < 0.1:1, which is negligible. But test with higher intensity settings.

---

<a id="battery"></a>
## 17. Battery & CPU Impact

### Tier System

Implement an automatic performance tier based on device state:

```js
async function detectPerformanceTier() {
  let tier = 'full'; // 'full' | 'reduced' | 'minimal'

  // Check battery
  if ('getBattery' in navigator) {
    const battery = await navigator.getBattery();
    if (!battery.charging && battery.level < 0.3) {
      tier = 'minimal';
    } else if (!battery.charging && battery.level < 0.6) {
      tier = 'reduced';
    }

    battery.addEventListener('levelchange', () => {
      // Re-evaluate and adjust effects
    });
  }

  // Check device memory (Chrome 63+)
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    tier = 'reduced';
  }

  // Check hardware concurrency
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    tier = tier === 'reduced' ? 'minimal' : 'reduced';
  }

  return tier;
}
```

### What Each Tier Gets

| Effect | Full | Reduced | Minimal |
|--------|------|---------|---------|
| Hover lift | Yes | Yes | Yes (no spring) |
| Border shimmer | Yes | Slower (6s) | No |
| Particles | 60 | 25 | No |
| Ambient glow | Yes | Slower (6s) | No |
| Gradient borders | Yes | Slower (8s) | No |
| Aurora | Yes | Lower opacity | No |
| Neon flicker | Yes | Steady glow only | No |
| Cursor trail | Yes | Shorter trail | No |

### Estimated Power Consumption

| Effect | Idle Page Impact | Active Use Impact |
|--------|-----------------|-------------------|
| CSS-only effects (all) | +1-3% CPU | +2-5% CPU |
| Canvas particles (60) | +3-5% CPU | +3-5% CPU |
| Canvas cursor trail | +0% (idle) | +1-2% CPU |
| All effects combined | +4-8% CPU | +5-10% CPU |

These are estimates for a modern laptop (M1/Intel 12th gen). On older hardware, double these figures.

### Power-Saving Best Practices

1. **Pause canvas when tab hidden**: `document.addEventListener('visibilitychange', ...)`
2. **Reduce particle count on battery**: detect via `navigator.getBattery()`
3. **Use `will-change` sparingly**: each promoted layer uses GPU memory (~4MB per full-viewport layer)
4. **Avoid blur on large elements**: `filter: blur(60px)` on a full-screen element costs ~2-3ms per frame on integrated GPUs. Use it only on `position: fixed` elements (composed once).
5. **requestAnimationFrame over setInterval**: always. rAF automatically pauses when tab is hidden.

---

<a id="competitors"></a>
## 18. Competitor Analysis

### Salesforce Theme Suit -- "Animation Control Center"

Based on the marketing claims and typical implementations:

**Likely approach:**
- CSS animations injected via content script (same as us)
- Toggle controls in their extension popup
- Pre-built animation presets rather than per-element customization

**What they probably offer:**
- Hover effects on cards/buttons (basic `transform` + `box-shadow`)
- Animated header gradients
- Custom scrollbar animations
- Possibly loading spinners/transitions

**What they likely DON'T do:**
- Canvas-based particles (too complex, performance risk)
- Houdini paint worklets (too cutting-edge)
- Per-theme contextual effects (snow for winter theme, etc.)

**Our differentiation opportunity:**
- Theme-specific effects (snow for Arctic, matrix for Terminal, neon for Tron)
- Per-effect granular toggles
- Performance tier auto-detection
- `prefers-reduced-motion` support
- Intensity control (subtle/moderate/vivid)

### Other Chrome Extensions with Animations

**Stylus/User CSS tools**: Some users create their own animated themes. Common patterns seen in userstyles.org:
- Animated gradient headers
- Hover scale effects
- Custom cursor (CSS `cursor: url(...)`)
- Background image parallax

**Dark Reader**: No animations. Pure color transformation. Sets the bar for performance -- their approach of CSS filter inversion is extremely efficient.

---

<a id="theme-mapping"></a>
## 19. Theme-to-Effect Mapping

### Recommended Default Effects per Theme

| Theme | Hover Lift | Shimmer | Glow | Gradient Border | Aurora | Neon | Particles | Cursor |
|-------|-----------|---------|------|----------------|--------|------|-----------|--------|
| **Connectry** | Subtle | No | No | No | No | No | No | No |
| **Connectry Dark** | Subtle | No | No | No | No | No | No | No |
| **Midnight** | Yes | Subtle | Yes | No | Yes (purple) | No | Dots (stars) | No |
| **Slate** | Subtle | No | No | No | No | No | No | No |
| **Tron** | Yes | Yes | Yes | Yes | No | Yes | No | Yes (cyan) |
| **Obsidian** | Subtle | No | Subtle | No | Subtle | No | No | No |
| **Arctic** | Yes | Ice shimmer | No | No | Yes (blue) | No | Snow | No |
| **Sakura** | Yes | Pink shimmer | Subtle | No | No | No | Petals (dots) | No |
| **Ember** | Yes | No | Warm glow | No | No | No | Sparks (dots) | No |
| **Nord** | Yes | No | Subtle | No | Yes (aurora!) | No | Snow (light) | No |
| **Terminal** | Yes | Green | No | Green | No | Green | Matrix rain | Green |
| **High Contrast** | No | No | No | No | No | No | No | No |
| **Dracula** | Yes | Purple | Purple | Purple | Subtle | Purple | Mist (dots) | No |
| **Solarized Light** | Subtle | No | No | No | No | No | No | No |
| **Solarized Dark** | Subtle | No | Subtle | No | No | No | No | No |

### Effect "Packs" (User-Facing Names)

Instead of exposing all toggle switches, offer curated packs:

- **None**: No effects. Clean.
- **Subtle**: Hover lift only. Default for most themes.
- **Alive**: Hover lift + ambient glow + shimmer. Good for dark themes.
- **Immersive**: Everything appropriate for the theme. For enthusiasts.
- **Custom**: Pick and choose individual effects.

---

<a id="roadmap"></a>
## 20. Implementation Roadmap

### V2.0 -- Foundation (CSS-Only Effects)

1. **Hover lift** on cards, buttons, list items
2. **Ambient glow** pulse on brand elements
3. **`@property` animated gradient borders** on cards
4. **Neon flicker** for Tron theme
5. **Aurora background** for Nord/Arctic/Midnight
6. **Toggleability** via body classes
7. **`prefers-reduced-motion`** support
8. **Intensity levels** (subtle/moderate/vivid)

**Effort**: Medium. All CSS, no new JS infrastructure.

### V2.5 -- Canvas Effects

9. **Particle engine** (snow, rain, matrix, dots)
10. **Cursor trail** (optional, per-theme)
11. **Performance tier** auto-detection
12. **Battery-aware** density reduction

**Effort**: Medium. Requires adding canvas injection to content.js.

### V3.0 -- Advanced

13. **CSS Houdini Paint worklets** for custom shimmer/noise
14. **Scroll-timeline parallax** (if demand exists)
15. **Sound effects** (typing clicks, ambient -- if Chrome allows)
16. **User-customizable effect colors** via theme editor

**Effort**: High. Houdini requires testing, worklet files, and fallbacks.

---

## Appendix A: CSS-Only Snow (No JS Fallback)

For Arctic/Nord when user has JS effects disabled but wants atmosphere:

```css
@keyframes sf-themer-snowfall-1 {
  0%   { background-position: 0px 0px, 0px 0px, 0px 0px; }
  100% { background-position: 500px 1000px, 400px 400px, 300px 300px; }
}

body.sf-themer-fx-particles-lite::after {
  content: '';
  position: fixed;
  top: -10px;
  left: 0;
  width: 100%;
  height: calc(100% + 10px);
  pointer-events: none;
  z-index: 998;
  opacity: 0.35;
  background-image:
    radial-gradient(1.5px 1.5px at 40px 60px, #fff 50%, transparent),
    radial-gradient(2px 2px at 120px 120px, #fff 50%, transparent),
    radial-gradient(1px 1px at 200px 200px, #ddd 50%, transparent),
    radial-gradient(2.5px 2.5px at 320px 80px, #fff 50%, transparent),
    radial-gradient(1px 1px at 400px 300px, #eee 50%, transparent),
    radial-gradient(1.5px 1.5px at 50px 350px, #fff 50%, transparent),
    radial-gradient(2px 2px at 250px 450px, #fff 50%, transparent);
  background-size: 500px 1000px, 400px 400px, 300px 300px,
                   500px 1000px, 400px 400px, 300px 300px, 500px 1000px;
  animation: sf-themer-snowfall-1 20s linear infinite;
}
```

## Appendix B: Complete `@property` Reference for Our Use Cases

```css
/* Animatable custom properties for Salesforce Themer */

@property --sf-border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@property --sf-glow-intensity {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

@property --sf-shimmer-position {
  syntax: '<percentage>';
  initial-value: -100%;
  inherits: false;
}

@property --sf-aurora-hue {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@property --sf-neon-opacity {
  syntax: '<number>';
  initial-value: 1;
  inherits: false;
}
```

## Appendix C: Namespace All Animations

To avoid collisions with SF's own animations, ALL keyframe names and class names MUST be prefixed:

- Keyframes: `sf-themer-*` (e.g., `sf-themer-shimmer`, `sf-themer-glow-pulse`)
- CSS classes: `sf-themer-fx-*` (e.g., `sf-themer-fx-hover`, `sf-themer-fx-aurora`)
- Canvas IDs: `sf-themer-*` (e.g., `sf-themer-particles`)
- CSS custom properties: `--sf-themer-*` or `--sf-*`

This prevents any naming collision with Salesforce's `slds-*` namespace or third-party extensions.

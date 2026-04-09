/**
 * Salesforce Themer — Effects Engine
 * Generates CSS for visual effects (hover lift, glow, shimmer, aurora, neon, gradient borders)
 * and manages canvas-based particle systems + cursor trails.
 *
 * This is a SEPARATE layer from the color theme engine. Effects are toggled independently
 * via body classes (body.sf-themer-fx-*) and a dedicated <style id="sf-themer-effects">.
 *
 * Architecture:
 *   - CSS effects: generated once per config change, injected as static CSS
 *   - Canvas effects: particles + cursor trail, managed by SFThemerParticles
 *   - All effects respect prefers-reduced-motion
 *   - Canvas auto-pauses when tab is hidden or on battery power
 */

'use strict';

// ─── Effect CSS Generator ─────────────────────────────────────────────────────

/**
 * Generate all effects CSS based on the active effects config.
 * @param {Object} config - Effects configuration
 * @param {Object} themeColors - Current theme's color values (for accent-aware effects)
 * @returns {string} CSS string
 */
function generateEffectsCSS(config, themeColors) {
  if (!config || config.preset === 'none') return '';

  const c = themeColors || {};
  const accent = c.accent || '#4a6fa5';
  const accentRgb = _hexToRgb(accent);
  const isDark = c.colorScheme === 'dark';

  // Intensity multipliers
  const intensity = config.intensity || 'medium';
  const mult = { subtle: 0.5, medium: 1.0, strong: 1.5 }[intensity] || 1.0;

  let css = `/* Salesforce Themer — Effects Layer */\n`;

  // Reduced motion: disable all animations
  css += `
@media (prefers-reduced-motion: reduce) {
  body[class*="sf-themer-fx"] *,
  body[class*="sf-themer-fx"] *::before,
  body[class*="sf-themer-fx"] *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;

  // ─── Hover Lift ────────────────────────────────────────────────────────────
  if (config.hoverLift) {
    const liftPx = Math.round(2 * mult);
    const shadowSpread = Math.round(25 * mult);
    const shadowAlpha = isDark ? 0.25 * mult : 0.12 * mult;
    const btnLift = Math.max(1, Math.round(1 * mult));

    css += `
/* ─── Hover Lift ─── */

body.sf-themer-fx-hover .slds-card,
body.sf-themer-fx-hover .forceRelatedListSingleContainer,
body.sf-themer-fx-hover .forceRecordCard {
  transition:
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 220ms ease !important;
}

body.sf-themer-fx-hover .slds-card:hover,
body.sf-themer-fx-hover .forceRelatedListSingleContainer:hover,
body.sf-themer-fx-hover .forceRecordCard:hover {
  transform: translateY(-${liftPx}px) !important;
  box-shadow:
    0 ${Math.round(8 * mult)}px ${shadowSpread}px rgba(0, 0, 0, ${shadowAlpha.toFixed(2)}),
    0 2px 8px rgba(0, 0, 0, ${(shadowAlpha * 0.6).toFixed(2)}) !important;
}

body.sf-themer-fx-hover .slds-button:not(.slds-button_icon):hover {
  transform: translateY(-${btnLift}px) !important;
  transition: transform 150ms ease !important;
}

body.sf-themer-fx-hover .slds-table tbody tr {
  transition: transform 150ms ease, background-color 150ms ease !important;
}

body.sf-themer-fx-hover .slds-table tbody tr:hover {
  transform: translateX(${Math.max(1, Math.round(2 * mult))}px) !important;
}

/* NEVER lift modals, dropdowns, comboboxes — breaks SF positioning */
body.sf-themer-fx-hover .slds-modal,
body.sf-themer-fx-hover .slds-modal__container,
body.sf-themer-fx-hover .slds-dropdown,
body.sf-themer-fx-hover .slds-combobox,
body.sf-themer-fx-hover .slds-combobox__input,
body.sf-themer-fx-hover .slds-popover {
  transform: none !important;
}
`;
  }

  // ─── Ambient Glow ──────────────────────────────────────────────────────────
  if (config.ambientGlow) {
    const glowMin = (0.06 * mult).toFixed(2);
    const glowMax = (0.15 * mult).toFixed(2);
    const glowSpeed = Math.round(3000 / mult);

    css += `
/* ─── Ambient Glow ─── */

@keyframes sf-themer-glow-pulse {
  0%, 100% { box-shadow: 0 0 ${Math.round(10 * mult)}px rgba(${accentRgb}, ${glowMin}); }
  50%      { box-shadow: 0 0 ${Math.round(20 * mult)}px rgba(${accentRgb}, ${glowMax}); }
}

body.sf-themer-fx-glow .slds-button_brand,
body.sf-themer-fx-glow .slds-button--brand {
  animation: sf-themer-glow-pulse ${glowSpeed}ms ease-in-out infinite !important;
}

body.sf-themer-fx-glow .slds-context-bar__item.slds-is-active {
  animation: sf-themer-glow-pulse ${Math.round(glowSpeed * 1.3)}ms ease-in-out infinite !important;
}

@keyframes sf-themer-focus-glow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(${accentRgb}, 0.2); }
  50%      { box-shadow: 0 0 0 4px rgba(${accentRgb}, 0.12),
                          0 0 ${Math.round(15 * mult)}px rgba(${accentRgb}, ${(0.08 * mult).toFixed(2)}); }
}

body.sf-themer-fx-glow .slds-input:focus,
body.sf-themer-fx-glow .slds-textarea:focus,
body.sf-themer-fx-glow .slds-select:focus {
  animation: sf-themer-focus-glow ${Math.round(2500 / mult)}ms ease-in-out infinite !important;
}
`;
  }

  // ─── Border Shimmer ────────────────────────────────────────────────────────
  if (config.borderShimmer) {
    const shimmerSpeed = Math.round(3000 / mult);

    css += `
/* ─── Border Shimmer ─── */

@keyframes sf-themer-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}

body.sf-themer-fx-shimmer .slds-card {
  position: relative !important;
  overflow: clip !important;
}

body.sf-themer-fx-shimmer .slds-card::before {
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
    rgba(${accentRgb}, ${(0.6 * mult).toFixed(2)}) 50%,
    transparent 60%,
    transparent 100%
  ) !important;
  background-size: 200% 100% !important;
  animation: sf-themer-shimmer ${shimmerSpeed}ms ease-in-out infinite !important;
  z-index: 1 !important;
  pointer-events: none !important;
}
`;
  }

  // ─── Gradient Borders (Animated conic-gradient via @property) ──────────────
  if (config.gradientBorders) {
    const rotateSpeed = Math.round(4000 / mult);
    const gradientAlpha = (0.8 * mult).toFixed(2);

    css += `
/* ─── Gradient Borders ─── */

@property --sf-border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes sf-themer-border-rotate {
  to { --sf-border-angle: 360deg; }
}

body.sf-themer-fx-gradient-border .slds-card {
  position: relative !important;
}

body.sf-themer-fx-gradient-border .slds-card::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  padding: 1px !important;
  border-radius: inherit !important;
  background: conic-gradient(
    from var(--sf-border-angle),
    rgba(${accentRgb}, ${gradientAlpha}) 0%,
    transparent 25%,
    transparent 75%,
    rgba(${accentRgb}, ${gradientAlpha}) 100%
  ) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask-composite: exclude !important;
  animation: sf-themer-border-rotate ${rotateSpeed}ms linear infinite !important;
  pointer-events: none !important;
  z-index: 1 !important;
}
`;
  }

  // ─── Aurora Background ─────────────────────────────────────────────────────
  if (config.aurora) {
    const auroraOpacity = (0.06 * mult).toFixed(3);
    const auroraSpeed = Math.round(25000 / mult);

    // Theme-aware aurora colors
    let auroraColors;
    if (config.auroraColors) {
      auroraColors = config.auroraColors;
    } else if (isDark) {
      auroraColors = '#1a1a2e, #16213e, #0f3460, #1a5c3a, #1a1a4e, #2d1b69';
    } else {
      auroraColors = '#e8f4fd, #f0e6ff, #e6fff0, #fff0e6, #e6f0ff, #f0ffe6';
    }

    css += `
/* ─── Aurora Background ─── */

@keyframes sf-themer-aurora {
  0%   { background-position: 0% 50%; filter: hue-rotate(0deg); }
  50%  { background-position: 100% 50%; filter: hue-rotate(30deg); }
  100% { background-position: 0% 50%; filter: hue-rotate(0deg); }
}

body.sf-themer-fx-aurora::before {
  content: '' !important;
  position: fixed !important;
  inset: -50% !important;
  pointer-events: none !important;
  z-index: 0 !important;
  opacity: ${auroraOpacity} !important;
  background:
    radial-gradient(ellipse at 20% 50%, ${auroraColors.split(',')[0]?.trim() || '#1a5c3a'} 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, ${auroraColors.split(',')[4]?.trim() || '#2d1b69'} 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, ${auroraColors.split(',')[2]?.trim() || '#0f3460'} 0%, transparent 50%) !important;
  background-size: 200% 200% !important;
  animation: sf-themer-aurora ${auroraSpeed}ms ease-in-out infinite !important;
  filter: blur(60px) !important;
}

body.sf-themer-fx-aurora .oneContent,
body.sf-themer-fx-aurora .slds-card,
body.sf-themer-fx-aurora .slds-page-header,
body.sf-themer-fx-aurora .slds-modal__container {
  position: relative !important;
  z-index: 1 !important;
}
`;
  }

  // ─── Neon Flicker ──────────────────────────────────────────────────────────
  if (config.neonFlicker) {
    const neonColor = config.neonColor || accent;
    const neonRgb = _hexToRgb(neonColor);
    const flickerIntensity = (0.8 * mult).toFixed(2);

    css += `
/* ─── Neon Flicker ─── */

@keyframes sf-themer-neon-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
    text-shadow:
      0 0 4px rgba(${neonRgb}, ${flickerIntensity}),
      0 0 11px rgba(${neonRgb}, ${(0.5 * mult).toFixed(2)}),
      0 0 19px rgba(${neonRgb}, ${(0.3 * mult).toFixed(2)}),
      0 0 40px rgba(${neonRgb}, ${(0.15 * mult).toFixed(2)});
  }
  20%, 24%, 55% {
    text-shadow: none;
  }
}

@keyframes sf-themer-neon-breathe {
  0%, 100% {
    text-shadow:
      0 0 4px rgba(${neonRgb}, ${(0.4 * mult).toFixed(2)}),
      0 0 10px rgba(${neonRgb}, ${(0.2 * mult).toFixed(2)});
  }
  50% {
    text-shadow:
      0 0 8px rgba(${neonRgb}, ${(0.6 * mult).toFixed(2)}),
      0 0 20px rgba(${neonRgb}, ${(0.35 * mult).toFixed(2)}),
      0 0 35px rgba(${neonRgb}, ${(0.15 * mult).toFixed(2)});
  }
}

body.sf-themer-fx-neon .slds-page-header__title,
body.sf-themer-fx-neon .slds-page-header__name-title {
  animation: sf-themer-neon-flicker ${Math.round(4000 / mult)}ms ease-in-out infinite !important;
  color: rgb(${neonRgb}) !important;
}

body.sf-themer-fx-neon .slds-context-bar__label-action,
body.sf-themer-fx-neon .slds-tabs_default__item.slds-is-active a,
body.sf-themer-fx-neon .slds-tabs--default__item.slds-active a {
  animation: sf-themer-neon-breathe ${Math.round(3000 / mult)}ms ease-in-out infinite !important;
}

body.sf-themer-fx-neon .slds-card__header-title {
  animation: sf-themer-neon-breathe ${Math.round(5000 / mult)}ms ease-in-out infinite !important;
}
`;
  }

  // ─── Cursor Trail ──────────────────────────────────────────────────────────
  // (Canvas-based — CSS only provides the container z-index rules)
  if (config.cursorTrail) {
    css += `
/* ─── Cursor Trail (canvas container rules) ─── */

#sf-themer-fx-canvas {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  pointer-events: none !important;
  z-index: 998 !important;
}
`;
  }

  // ─── Particles ─────────────────────────────────────────────────────────────
  // (Canvas-based — CSS only provides the container z-index rules)
  if (config.particles) {
    css += `
/* ─── Particles (canvas container rules) ─── */

#sf-themer-particles {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  pointer-events: none !important;
  z-index: 997 !important;
}
`;
  }

  return css;
}


// ─── Particle System ──────────────────────────────────────────────────────────

class SFThemerParticles {
  constructor(type, config) {
    this.type = type;            // 'snow' | 'rain' | 'matrix' | 'dots' | 'embers'
    this.config = {
      color: '#ffffff',
      density: 50,
      speed: 1,
      opacity: 0.6,
      ...config,
    };
    this.particles = [];
    this.canvas = null;
    this.ctx = null;
    this.raf = null;
    this.paused = false;
    this.onBattery = false;
    this._boundVisibility = null;
    this._resizeTimer = null;
  }

  init() {
    // Remove existing canvas if present
    document.getElementById('sf-themer-particles')?.remove();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sf-themer-particles';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '997',
      opacity: String(this.config.opacity),
    });
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._detectBattery();
    this._spawn();
    this._loop();

    // Pause when tab not visible
    this._boundVisibility = () => {
      this.paused = document.hidden;
      if (!this.paused && !this.raf) this._loop();
    };
    document.addEventListener('visibilitychange', this._boundVisibility);

    // Resize handling (debounced)
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      }, 200);
    });
  }

  _detectBattery() {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        this.onBattery = !battery.charging;
        battery.addEventListener('chargingchange', () => {
          this.onBattery = !battery.charging;
          // Reduce density on battery
          if (this.onBattery && this.particles.length > this.config.density * 0.5) {
            this.particles.length = Math.floor(this.config.density * 0.5);
          }
        });
      }).catch(() => {});
    }
  }

  _getDensity() {
    const base = this.config.density;
    return this.onBattery ? Math.floor(base * 0.5) : base;
  }

  _spawn() {
    const count = this._getDensity();
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this._createParticle(w, h, true));
    }
  }

  _createParticle(w, h, randomY) {
    const speed = this.config.speed;
    switch (this.type) {
      case 'snow':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -5,
          r: Math.random() * 3 + 1,
          vx: (Math.random() * 0.5 - 0.25) * speed,
          vy: (Math.random() * 1 + 0.3) * speed,
          wobble: Math.random() * Math.PI * 2,
        };
      case 'rain':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -20,
          len: Math.random() * 15 + 5,
          vy: (Math.random() * 8 + 4) * speed,
        };
      case 'matrix':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -20,
          char: String.fromCharCode(0x30A0 + Math.random() * 96),
          vy: (Math.random() * 3 + 1) * speed,
          size: Math.random() * 10 + 10,
          opacity: Math.random(),
        };
      case 'dots':
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2 + 0.5,
          vx: (Math.random() * 0.3 - 0.15) * speed,
          vy: (Math.random() * 0.3 - 0.15) * speed,
          opacity: Math.random() * 0.5 + 0.2,
          pulsePhase: Math.random() * Math.PI * 2,
        };
      case 'embers':
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : h + 10,
          r: Math.random() * 2 + 0.5,
          vx: (Math.random() * 1 - 0.5) * speed,
          vy: -(Math.random() * 1.5 + 0.5) * speed,
          opacity: Math.random() * 0.7 + 0.3,
          life: 1.0,
          decay: Math.random() * 0.003 + 0.001,
        };
      default:
        return { x: 0, y: 0, r: 1, vx: 0, vy: 0 };
    }
  }

  _draw() {
    const { ctx, canvas, particles, type } = this;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = this.config.color;
    const w = canvas.width;
    const h = canvas.height;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      switch (type) {
        case 'snow':
          p.wobble += 0.01;
          p.x += p.vx + Math.sin(p.wobble) * 0.3;
          p.y += p.vy;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.fill();
          if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
          if (p.x < -5) p.x = w + 5;
          if (p.x > w + 5) p.x = -5;
          break;

        case 'rain':
          p.y += p.vy;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 0.5, p.y + p.len);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1;
          ctx.stroke();
          if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
          break;

        case 'matrix':
          p.y += p.vy;
          p.opacity -= 0.003;
          ctx.font = `${p.size}px monospace`;
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity;
          ctx.fillText(p.char, p.x, p.y);
          if (p.y > h || p.opacity <= 0) {
            p.y = -20;
            p.x = Math.random() * w;
            p.opacity = 1;
            p.char = String.fromCharCode(0x30A0 + Math.random() * 96);
          }
          break;

        case 'dots':
          p.pulsePhase += 0.005;
          p.x += p.vx;
          p.y += p.vy;
          const pulse = 0.5 + Math.sin(p.pulsePhase) * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * pulse;
          ctx.fill();
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          break;

        case 'embers':
          p.x += p.vx + Math.sin(p.life * 10) * 0.3;
          p.y += p.vy;
          p.life -= p.decay;
          if (p.life <= 0) {
            particles[i] = this._createParticle(w, h, false);
            break;
          }
          const emberR = p.r * p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, emberR, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * p.life;
          ctx.fill();
          // Orange/red glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, emberR * 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * p.life * 0.2;
          ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  _loop() {
    if (this.paused) { this.raf = null; return; }
    this._draw();
    this.raf = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._boundVisibility) {
      document.removeEventListener('visibilitychange', this._boundVisibility);
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
  }
}


// ─── Cursor Trail ─────────────────────────────────────────────────────────────

class SFThemerCursorTrail {
  constructor(config) {
    this.config = {
      color: '#ffffff',
      length: 20,
      size: 4,
      opacity: 0.5,
      ...config,
    };
    this.points = [];
    this.canvas = null;
    this.ctx = null;
    this.active = false;
    this.raf = null;
    this._boundMove = null;
    this._boundVisibility = null;
  }

  init() {
    document.getElementById('sf-themer-fx-canvas')?.remove();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sf-themer-fx-canvas';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '998',
    });
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.active = true;
    this._boundMove = (e) => {
      this.points.push({ x: e.clientX, y: e.clientY, life: 1.0 });
      if (this.points.length > this.config.length) this.points.shift();
    };
    document.addEventListener('mousemove', this._boundMove, { passive: true });

    this._boundVisibility = () => {
      if (document.hidden) {
        this.points = [];
      }
    };
    document.addEventListener('visibilitychange', this._boundVisibility);

    this._draw();

    window.addEventListener('resize', () => {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
  }

  _draw() {
    if (!this.active || !this.ctx) return;
    const { ctx, canvas, points } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const progress = (i + 1) / points.length;
      const size = this.config.size * progress;
      const alpha = progress * this.config.opacity;

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = this.config.color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      p.life -= 0.02;
    }

    // Remove dead points
    this.points = this.points.filter(p => p.life > 0);
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame(() => this._draw());
  }

  destroy() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._boundMove) document.removeEventListener('mousemove', this._boundMove);
    if (this._boundVisibility) document.removeEventListener('visibilitychange', this._boundVisibility);
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.points = [];
  }
}


// ─── Utility ──────────────────────────────────────────────────────────────────

function _hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '74, 111, 165';
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '74, 111, 165';
}


// ─── Body Class Manager ──────────────────────────────────────────────────────

/**
 * Apply the correct body.sf-themer-fx-* classes based on effects config.
 * @param {Object} config - Effects configuration
 */
function applyEffectsClasses(config) {
  if (!document.body) return;
  const body = document.body;

  // Remove all existing fx classes
  const existing = [...body.classList].filter(c => c.startsWith('sf-themer-fx'));
  existing.forEach(c => body.classList.remove(c));

  if (!config || config.preset === 'none') return;

  if (config.hoverLift) body.classList.add('sf-themer-fx-hover');
  if (config.ambientGlow) body.classList.add('sf-themer-fx-glow');
  if (config.borderShimmer) body.classList.add('sf-themer-fx-shimmer');
  if (config.gradientBorders) body.classList.add('sf-themer-fx-gradient-border');
  if (config.aurora) body.classList.add('sf-themer-fx-aurora');
  if (config.neonFlicker) body.classList.add('sf-themer-fx-neon');
  if (config.particles) body.classList.add('sf-themer-fx-particles');
  if (config.cursorTrail) body.classList.add('sf-themer-fx-cursor');
}


// Export for content.js
if (typeof module !== 'undefined') {
  module.exports = {
    generateEffectsCSS,
    SFThemerParticles,
    SFThemerCursorTrail,
    applyEffectsClasses,
  };
}

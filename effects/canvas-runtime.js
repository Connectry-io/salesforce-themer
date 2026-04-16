/**
 * Salesforce Themer — Canvas Runtime Manager
 *
 * Unified lifecycle for canvas-based effects (aurora, particles, cursorTrail).
 * Consumes the `runtimeConfig` IR produced by core/effects/engine.js:
 *
 *   {
 *     aurora?:      { blobs: [{color,x,y,radius}], opacity, cycleMs, zIndex },
 *     particles?:   { type, color, density, speed, opacity, zIndex },
 *     cursorTrail?: { style, color, length, size, opacity, zIndex },
 *   }
 *
 * Call SFThemerCanvasRuntime.manager.sync(runtimeConfig) whenever the
 * effects config or theme changes. The manager diffs desired vs current
 * state and mounts/unmounts/updates renderers accordingly.
 *
 * Each renderer owns its own <canvas> element, RAF loop, and cleanup:
 *   - AuroraRenderer     — #sf-themer-fx-aurora-canvas   (z-index: -1, behind)
 *   - ParticleRenderer   — #sf-themer-particles          (z-index: 997, above)
 *   - CursorTrailRenderer— #sf-themer-fx-cursor-canvas   (z-index: 998, above)
 *
 * Shared machinery (in BaseRenderer): visibilitychange pause, debounced
 * resize, battery-aware density throttling (particles only).
 */

'use strict';

(function (global) {

// ────────────────────────────────────────────────────────────────────────────
// BaseRenderer — shared canvas lifecycle. Subclasses override _draw() and
// optionally _onInit / _onResize / _onConfigChange / _onDestroy hooks.
// ────────────────────────────────────────────────────────────────────────────

class BaseRenderer {
  constructor(canvasId, defaultZIndex, config) {
    this.canvasId = canvasId;
    this.zIndex = (config && typeof config.zIndex === 'number') ? config.zIndex : defaultZIndex;
    this.config = config;
    this.canvas = null;
    this.ctx = null;
    this.raf = null;
    this.paused = false;
    this._boundResize = null;
    this._boundVisibility = null;
    this._resizeTimer = null;
  }

  init() {
    const existing = document.getElementById(this.canvasId);
    if (existing) existing.remove();

    const canvas = document.createElement('canvas');
    canvas.id = this.canvasId;
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: String(this.zIndex),
    });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const host = document.body || document.documentElement;
    host.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this._boundVisibility = () => {
      this.paused = document.hidden;
      if (!this.paused && !this.raf) this._loop();
    };
    document.addEventListener('visibilitychange', this._boundVisibility);

    this._boundResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (typeof this._onResize === 'function') this._onResize();
      }, 200);
    };
    window.addEventListener('resize', this._boundResize);

    if (typeof this._onInit === 'function') this._onInit();
    this._loop();
  }

  updateConfig(next) {
    this.config = next;
    // Allow subclasses to react to config changes without a full re-init.
    if (typeof this._onConfigChange === 'function') this._onConfigChange();
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._boundVisibility) {
      document.removeEventListener('visibilitychange', this._boundVisibility);
    }
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
    }
    clearTimeout(this._resizeTimer);
    this._boundVisibility = null;
    this._boundResize = null;
    this._resizeTimer = null;
    if (typeof this._onDestroy === 'function') this._onDestroy();
    if (this.canvas) this.canvas.remove();
    this.canvas = null;
    this.ctx = null;
  }

  _loop() {
    if (this.paused || !this.canvas) { this.raf = null; return; }
    this._draw();
    this.raf = requestAnimationFrame(() => this._loop());
  }

  _draw() { /* override */ }
}


// ────────────────────────────────────────────────────────────────────────────
// AuroraRenderer — 3 radial-gradient blobs on a fullscreen canvas behind
// SF content (z-index: -1). Each blob drifts on a slow sine path so the
// layer reads as "moving ambient light". No filter:blur (expensive) —
// radial gradients fade naturally, which gives soft edges for free.
// ────────────────────────────────────────────────────────────────────────────

class AuroraRenderer extends BaseRenderer {
  constructor(config) {
    super('sf-themer-fx-aurora-canvas', -1, config);
    this._startTime = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }

  _draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const cfg = this.config || {};
    const blobs = cfg.blobs || [];
    const cycleMs = cfg.cycleMs || 25000;
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    const t = ((now - this._startTime) / cycleMs) * Math.PI * 2;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Math.max(0, Math.min(1, cfg.opacity != null ? cfg.opacity : 0.35));
    ctx.globalCompositeOperation = 'source-over';

    // Drift amplitude ~15% of canvas — enough to read as movement without
    // pushing blobs off-screen. Each blob gets a different phase + y-speed
    // so they don't visibly orbit in lockstep.
    const amp = 0.15;
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const phase = t + i * (Math.PI * 2 / 3);
      const cx = (blob.x + Math.cos(phase) * amp) * w;
      const cy = (blob.y + Math.sin(phase * 1.3) * amp) * h;
      const r = (blob.radius || 0.5) * Math.max(w, h);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, blob.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }
}


// ────────────────────────────────────────────────────────────────────────────
// ParticleRenderer — lifted from the old SFThemerParticles class in
// effects.js. Config math (density/speed/opacity ladder) moved to the
// engine; this class just renders.
// ────────────────────────────────────────────────────────────────────────────

class ParticleRenderer extends BaseRenderer {
  constructor(config) {
    super('sf-themer-particles', 997, config);
    this.particles = [];
    this.onBattery = false;
  }

  _onInit() {
    this.canvas.style.opacity = String(this.config.opacity != null ? this.config.opacity : 0.5);
    this._detectBattery();
    this._spawn();
  }

  _onConfigChange() {
    if (!this.canvas) return;
    this.canvas.style.opacity = String(this.config.opacity != null ? this.config.opacity : 0.5);
    this._spawn();
  }

  _onResize() {
    this._spawn();
  }

  _detectBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(battery => {
      this.onBattery = !battery.charging;
      battery.addEventListener('chargingchange', () => {
        this.onBattery = !battery.charging;
        const density = this.config.density || 50;
        if (this.onBattery && this.particles.length > density * 0.5) {
          this.particles.length = Math.floor(density * 0.5);
        }
      });
    }).catch(() => {});
  }

  _getDensity() {
    const base = this.config.density || 50;
    return this.onBattery ? Math.floor(base * 0.5) : base;
  }

  _spawn() {
    if (!this.canvas) return;
    const count = this._getDensity();
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this._createParticle(w, h, true));
    }
  }

  _createParticle(w, h, randomY) {
    const speed = this.config.speed || 1;
    const type = this.config.type || 'snow';
    switch (type) {
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
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const particles = this.particles;
    const type = this.config.type || 'snow';
    const color = this.config.color || '#ffffff';
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

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

        case 'dots': {
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
        }

        case 'embers': {
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
          ctx.beginPath();
          ctx.arc(p.x, p.y, emberR * 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * p.life * 0.2;
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  _onDestroy() {
    this.particles = [];
  }
}


// ────────────────────────────────────────────────────────────────────────────
// CursorTrailRenderer — lifted from SFThemerCursorTrail. Four styles:
// glow (soft dots), comet (elongated teardrop + streak), sparkle (radial
// halo), line (continuous tapered stroke through recent points).
// ────────────────────────────────────────────────────────────────────────────

class CursorTrailRenderer extends BaseRenderer {
  constructor(config) {
    super('sf-themer-fx-cursor-canvas', 998, config);
    this.points = [];
    this._boundMove = null;
    this._boundVisibilityClear = null;
  }

  _onInit() {
    this._boundMove = (e) => {
      const length = this.config.length || 20;
      this.points.push({ x: e.clientX, y: e.clientY, life: 1.0 });
      if (this.points.length > length) this.points.shift();
    };
    document.addEventListener('mousemove', this._boundMove, { passive: true });

    this._boundVisibilityClear = () => {
      if (document.hidden) this.points = [];
    };
    document.addEventListener('visibilitychange', this._boundVisibilityClear);
  }

  _onDestroy() {
    if (this._boundMove) document.removeEventListener('mousemove', this._boundMove);
    if (this._boundVisibilityClear) document.removeEventListener('visibilitychange', this._boundVisibilityClear);
    this._boundMove = null;
    this._boundVisibilityClear = null;
    this.points = [];
  }

  _draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const points = this.points;
    const cfg = this.config || {};
    const style = cfg.style || 'glow';
    const color = cfg.color || '#ffffff';
    const size = cfg.size || 4;
    const opacity = cfg.opacity != null ? cfg.opacity : 0.5;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (style === 'line' && points.length > 1) {
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1], p1 = points[i];
        const progress = i / points.length;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = size * progress;
        ctx.lineCap = 'round';
        ctx.globalAlpha = progress * opacity;
        ctx.stroke();
      }
      for (const p of points) p.life -= 0.02;
    } else {
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const progress = (i + 1) / points.length;

        if (style === 'comet') {
          const s = size * progress * 2.2;
          const alpha = progress * opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = alpha;
          ctx.fill();
          if (i > 0) {
            const prev = points[i - 1];
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = s * 0.9;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * 0.7;
            ctx.stroke();
          }
        } else if (style === 'sparkle') {
          const s = size * (0.5 + progress * 0.7);
          const alpha = progress * opacity;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 4);
          grad.addColorStop(0, color);
          grad.addColorStop(0.3, color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s * 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const s = size * progress;
          const alpha = progress * opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
        p.life -= 0.02;
      }
    }
    this.points = this.points.filter(p => p.life > 0);
    ctx.globalAlpha = 1;
  }
}


// ────────────────────────────────────────────────────────────────────────────
// CanvasRuntimeManager — reconciles desired vs. current renderer state.
// Call sync() whenever the effects config or theme colors change. For an
// effect whose config changed but whose key stayed active, updateConfig is
// called in-place (no canvas tear-down) — avoids a mount/unmount flash.
// ────────────────────────────────────────────────────────────────────────────

const RENDERERS = {
  aurora:      AuroraRenderer,
  particles:   ParticleRenderer,
  cursorTrail: CursorTrailRenderer,
};

class CanvasRuntimeManager {
  constructor() {
    this.active = {};
  }

  sync(runtimeConfig, opts) {
    const reducedMotion = !!(opts && opts.reducedMotion);
    const desired = reducedMotion ? {} : (runtimeConfig || {});
    const desiredKeys = Object.keys(desired);
    const currentKeys = Object.keys(this.active);

    for (const key of currentKeys) {
      if (!desiredKeys.includes(key)) {
        try { this.active[key].destroy(); } catch (_) {}
        delete this.active[key];
      }
    }

    for (const key of desiredKeys) {
      const config = desired[key];
      if (!config) continue;
      const RendererClass = RENDERERS[key];
      if (!RendererClass) continue;
      if (this.active[key]) {
        this.active[key].updateConfig(config);
      } else {
        const renderer = new RendererClass(config);
        try { renderer.init(); } catch (err) {
          console.warn('[SFT canvas-runtime] init failed for', key, err);
          continue;
        }
        this.active[key] = renderer;
      }
    }
  }

  destroyAll() {
    for (const key of Object.keys(this.active)) {
      try { this.active[key].destroy(); } catch (_) {}
    }
    this.active = {};
  }
}


// ────────────────────────────────────────────────────────────────────────────
// Exports — single shared manager instance plus the classes for testing.
// ────────────────────────────────────────────────────────────────────────────

global.SFThemerCanvasRuntime = {
  manager: new CanvasRuntimeManager(),
  CanvasRuntimeManager,
  BaseRenderer,
  AuroraRenderer,
  ParticleRenderer,
  CursorTrailRenderer,
  VERSION: '1.0.0',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = global.SFThemerCanvasRuntime;
}

})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));

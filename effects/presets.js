/**
 * Salesforce Themer — Effects Presets
 *
 * Defines preset effect configurations and theme-to-effect SUGGESTIONS (hints).
 *
 * Presets: None / Subtle / Alive / Immersive / Custom
 * Each preset is a complete effects config with per-effect intensity.
 *
 * IMPORTANT:
 *  - OOTB theme suggestions are HINTS ONLY — never auto-applied.
 *    User must explicitly click "Try these effects" to apply.
 *  - Custom themes store a SNAPSHOT of effects at creation time —
 *    they are fully decoupled from the global config after creation.
 *  - Effect colors (aurora, neon, particles) are derived from the
 *    current theme's accent at render time — not stored in the preset.
 */

'use strict';

// ─── Preset Definitions ───────────────────────────────────────────────────────

const EFFECTS_PRESETS = {
  none: {
    preset: 'none',
    hoverLift: false, hoverLiftIntensity: 'medium',
    ambientGlow: false, ambientGlowIntensity: 'medium',
    borderEffect: 'none', borderEffectIntensity: 'medium',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: false, cursorTrailIntensity: 'medium',
    backgroundPattern: 'none', backgroundPatternIntensity: 'medium',
  },

  subtle: {
    preset: 'subtle',
    hoverLift: true, hoverLiftIntensity: 'subtle',
    ambientGlow: false, ambientGlowIntensity: 'subtle',
    borderEffect: 'none', borderEffectIntensity: 'subtle',
    aurora: false, auroraIntensity: 'subtle',
    neonFlicker: false, neonFlickerIntensity: 'subtle',
    particles: false, particlesIntensity: 'subtle',
    cursorTrail: false, cursorTrailIntensity: 'subtle',
    backgroundPattern: 'none', backgroundPatternIntensity: 'subtle',
  },

  alive: {
    preset: 'alive',
    hoverLift: true, hoverLiftIntensity: 'medium',
    ambientGlow: true, ambientGlowIntensity: 'medium',
    borderEffect: 'shimmer', borderEffectIntensity: 'medium',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: false, cursorTrailIntensity: 'medium',
    backgroundPattern: 'none', backgroundPatternIntensity: 'medium',
  },

  immersive: {
    preset: 'immersive',
    hoverLift: true, hoverLiftIntensity: 'strong',
    ambientGlow: true, ambientGlowIntensity: 'strong',
    borderEffect: 'gradient', borderEffectIntensity: 'strong',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: true, cursorTrailIntensity: 'medium',
    backgroundPattern: 'none', backgroundPatternIntensity: 'medium',
  },
};


// ─── Preset Descriptions (UI copy) ────────────────────────────────────────────

const PRESET_DESCRIPTIONS = {
  none: {
    name: 'None',
    tagline: 'No animations',
    body: 'Clean and focused. Recommended for accessibility needs, low-power devices, or distraction-free work.',
    icon: '○',
  },
  subtle: {
    name: 'Subtle',
    tagline: 'Gentle hover lift on cards',
    body: 'Cards and buttons lift slightly on hover. Nothing else. Perfect for everyday use — adds polish without distraction.',
    icon: '◐',
  },
  alive: {
    name: 'Alive',
    tagline: 'Hover lift, ambient glow, border shimmer',
    body: 'Adds pulsing glow on active elements and a shimmer line across card tops. Best for dashboards and visual interest.',
    icon: '◉',
  },
  immersive: {
    name: 'Immersive',
    tagline: 'Full effects pack + cursor trail',
    body: 'The works: hover lift, glow, shimmer, rotating gradient borders, and a light cursor trail. Best for demos, dark themes, and dramatic moments.',
    icon: '✦',
  },
};


// ─── Effect Descriptions (UI copy for control panel) ────────────────────────

const EFFECT_DESCRIPTIONS = {
  hoverLift: {
    name: 'Hover Lift',
    short: 'Cards lift on hover',
    long: 'Cards, buttons, and list items gently float up when you hover. Modals and dropdowns are never affected.',
  },
  ambientGlow: {
    name: 'Ambient Glow',
    short: 'Pulsing glow on accent elements',
    long: 'Brand buttons, active nav items, and focused inputs gain a slow pulsing glow in your theme accent color.',
  },
  borderEffect: {
    name: 'Border',
    short: 'Animated card edges — shimmer or gradient',
    long: 'Adds motion to card edges. Shimmer sweeps a thin line across the top; Gradient rotates a color ring around the perimeter. Pick one style per theme.',
  },
  aurora: {
    name: 'Aurora Background',
    short: 'Slow-moving ambient background',
    long: 'A soft, slow-moving gradient glow sits behind all content, like northern lights. Colors derive from your theme accent.',
  },
  neonFlicker: {
    name: 'Neon Flicker',
    short: 'Glowing text with flicker',
    long: 'Page titles and active navigation gain a neon text glow with occasional flicker, like a sign.',
  },
  particles: {
    name: 'Particles',
    short: 'Snow, rain, matrix, dots, embers',
    long: 'Animated background particles. Pick from snow, rain, matrix rain, floating dots, or rising embers.',
  },
  cursorTrail: {
    name: 'Cursor Trail',
    short: 'Light trail follows your mouse',
    long: 'A short glowing trail follows your mouse pointer, fading as it goes.',
  },
};


// ─── Theme → Suggested Effects Mapping (HINTS ONLY) ─────────────────────────
//
// These are SUGGESTIONS. They show as a "Try these effects" badge on theme cards.
// When clicked, the suggested config is copied into the global effectsConfig.
// Themes NEVER auto-apply their suggested effects.
//
// Effect colors are derived from theme accent at render time — we don't store
// curated colors here, which means suggestions stay portable across themes.

// Each preset lists WHICH effects it ships with; the user's Volume knob
// sets the intensity for all of them in lockstep. `base` seeds the config,
// `extras` layers on effect-type choices (particles style, border style)
// and enablement booleans. Per-effect intensity overrides are intentionally
// absent — volume owns intensity.
const THEME_EFFECTS_MAP = {
  // ─── Baselines with zero effects (SF defaults + a11y)
  'salesforce':        { base: 'none' },
  'salesforce-cosmos': { base: 'none' },
  'salesforce-dark':   { base: 'none' },
  'high-contrast':     { base: 'none' },

  // ─── Light themes
  'connectry': { base: 'subtle' },
  'slate':     { base: 'subtle' },
  'arctic': {
    base: 'subtle',
    extras: { ambientGlow: true, borderEffect: 'shimmer', aurora: true, particles: 'snow' },
  },
  'sakura': {
    base: 'subtle',
    extras: { borderEffect: 'shimmer' },
  },
  'boardroom': { base: 'subtle' },
  'carbon':    { base: 'subtle' },

  // ─── Dark themes
  'connectry-dark': {
    base: 'subtle',
    extras: { ambientGlow: true },
  },
  'tron': {
    base: 'subtle',
    extras: { ambientGlow: true, borderEffect: 'gradient', cursorTrail: true, neonFlicker: true },
  },
  'obsidian': {
    base: 'subtle',
    extras: { ambientGlow: true },
  },
  'nord': {
    base: 'subtle',
    extras: { aurora: true },
  },
  'dracula': {
    base: 'subtle',
    extras: { ambientGlow: true, borderEffect: 'shimmer' },
  },
  'graphite': { base: 'subtle' },
};


// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Get the SHIPPED effects config for a theme. THEME_EFFECTS_MAP is the source
 * of truth — each theme ships with its own effects baked in. Free users
 * cannot edit these directly; they have the Volume knob to scale them, or
 * they can clone the theme to customize.
 *
 * Returns a complete effects config (all 8 effect keys present).
 */
function getThemeEffects(themeId) {
  const mapping = THEME_EFFECTS_MAP[themeId];
  if (!mapping) return { ...EFFECTS_PRESETS.none };

  const base = EFFECTS_PRESETS[mapping.base] || EFFECTS_PRESETS.none;
  return {
    ...base,
    ...(mapping.extras || {}),
    preset: mapping.base,
  };
}

/**
 * Apply the Volume knob to a shipped effects config. Volume sets the
 * intensity of every enabled effect in lockstep:
 *   - 'off':    all effects disabled
 *   - 'subtle': every enabled effect → 'subtle' intensity
 *   - 'medium': every enabled effect → 'medium' intensity (theme baseline)
 *   - 'strong': every enabled effect → 'strong' intensity
 *
 * The theme's identity (which effects are enabled, what particle style,
 * what border style) is preserved at every volume; only loudness changes.
 * Everything scales together for cohesion.
 *
 * Accepts legacy values for forward-compat: 'default' → 'medium',
 * 'immersive' → 'strong', 'alive' → 'medium', 'none' → 'off'.
 */
function _normalizeVolume(v) {
  if (v === 'default' || v === 'alive') return 'medium';
  if (v === 'immersive') return 'strong';
  if (v === 'none') return 'off';
  if (v === 'off' || v === 'subtle' || v === 'medium' || v === 'strong') return v;
  return 'medium';
}

function applyVolume(config, volume) {
  if (!config) return { ...EFFECTS_PRESETS.none };
  const v = _normalizeVolume(volume);
  if (v === 'off') {
    return {
      ...config,
      hoverLift: false,
      ambientGlow: false,
      borderEffect: 'none',
      aurora: false,
      neonFlicker: false,
      particles: false,
      cursorTrail: false,
      backgroundPattern: 'none',
    };
  }
  // 'subtle' | 'medium' | 'strong' → clamp every intensity field
  const out = { ...config };
  const effects = ['hoverLift', 'ambientGlow', 'borderEffect', 'aurora', 'neonFlicker', 'particles', 'cursorTrail', 'backgroundPattern'];
  for (const eff of effects) {
    out[eff + 'Intensity'] = v;
  }
  return out;
}

// Backwards-compat aliases — old code may call these. Will be removed after
// the Phase 0 migration sweep.
function getSuggestedConfig(themeId) { return getThemeEffects(themeId); }
function getSuggestedPreset(themeId) {
  const mapping = THEME_EFFECTS_MAP[themeId];
  return mapping ? mapping.base : 'none';
}

/**
 * Resolve the ACTIVE effects config at runtime under the V3 model.
 *
 * Resolution rules:
 *   - Custom themes: use customTheme.effects (snapshot, decoupled — unchanged)
 *   - OOTB themes:  use the theme's SHIPPED effects, scaled by the user's Volume
 *   - Missing/unknown theme: return 'none' preset
 *
 * The Volume knob ('off' | 'subtle' | 'medium' | 'strong') is the only
 * effect-related setting free users can touch on OOTB themes. It sets the
 * intensity of every enabled effect in lockstep; it never changes which
 * effects are on. Legacy values ('default', 'immersive', 'alive', 'none')
 * are auto-normalized for back-compat.
 *
 * @param {string} activeThemeId - Current theme ID
 * @param {string} volume - Effects volume: 'off' | 'subtle' | 'medium' | 'strong'
 * @param {Object|null} customTheme - The custom theme object if one is active
 * @returns {Object} Complete effects config
 */
function resolveActiveEffects(activeThemeId, volume, customTheme) {
  // Custom theme active → use its snapshot, no volume scaling
  // (custom themes have full per-effect control via the builder)
  if (customTheme && customTheme.id === activeThemeId && customTheme.effects) {
    return { ...EFFECTS_PRESETS.none, ...customTheme.effects };
  }

  // OOTB theme → use shipped effects scaled by volume
  const shipped = getThemeEffects(activeThemeId);
  return applyVolume(shipped, volume || 'default');
}

/**
 * Create the initial effects config for a brand-new custom theme.
 *
 * @param {string} startMode - 'basic' (suggested effects for the base theme) or 'global' (copy of current global config)
 * @param {string} baseThemeId - The OOTB theme this custom theme is being cloned from
 * @param {Object} globalEffectsConfig - Current global effects config (used when mode=global)
 * @returns {Object} Snapshot effects config to store in customTheme.effects
 */
function initialCustomThemeEffects(startMode, baseThemeId, globalEffectsConfig) {
  if (startMode === 'global' && globalEffectsConfig) {
    return { ...EFFECTS_PRESETS.none, ...globalEffectsConfig };
  }
  // Default to the base theme's suggested effects
  return getSuggestedConfig(baseThemeId);
}


// ─── Getters for UI ──────────────────────────────────────────────────────────

function getPresetNames() {
  return ['none', 'subtle', 'alive', 'immersive'];
}

function getPresetDisplayInfo() {
  return getPresetNames().map(id => ({
    id,
    ...PRESET_DESCRIPTIONS[id],
  }));
}

function getEffectKeys() {
  return Object.keys(EFFECT_DESCRIPTIONS);
}

function getEffectDescription(effect) {
  return EFFECT_DESCRIPTIONS[effect] || null;
}


// Export
if (typeof module !== 'undefined') {
  module.exports = {
    EFFECTS_PRESETS,
    PRESET_DESCRIPTIONS,
    EFFECT_DESCRIPTIONS,
    THEME_EFFECTS_MAP,
    getThemeEffects,
    applyVolume,
    _normalizeVolume,
    getSuggestedConfig,    // backwards-compat alias
    getSuggestedPreset,    // backwards-compat alias
    resolveActiveEffects,
    initialCustomThemeEffects,
    getPresetNames,
    getPresetDisplayInfo,
    getEffectKeys,
    getEffectDescription,
  };
}

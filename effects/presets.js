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
    borderShimmer: false, borderShimmerIntensity: 'medium',
    gradientBorders: false, gradientBordersIntensity: 'medium',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: false, cursorTrailIntensity: 'medium',
  },

  subtle: {
    preset: 'subtle',
    hoverLift: true, hoverLiftIntensity: 'subtle',
    ambientGlow: false, ambientGlowIntensity: 'subtle',
    borderShimmer: false, borderShimmerIntensity: 'subtle',
    gradientBorders: false, gradientBordersIntensity: 'subtle',
    aurora: false, auroraIntensity: 'subtle',
    neonFlicker: false, neonFlickerIntensity: 'subtle',
    particles: false, particlesIntensity: 'subtle',
    cursorTrail: false, cursorTrailIntensity: 'subtle',
  },

  alive: {
    preset: 'alive',
    hoverLift: true, hoverLiftIntensity: 'medium',
    ambientGlow: true, ambientGlowIntensity: 'medium',
    borderShimmer: true, borderShimmerIntensity: 'medium',
    gradientBorders: false, gradientBordersIntensity: 'medium',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: false, cursorTrailIntensity: 'medium',
  },

  immersive: {
    preset: 'immersive',
    hoverLift: true, hoverLiftIntensity: 'strong',
    ambientGlow: true, ambientGlowIntensity: 'strong',
    borderShimmer: true, borderShimmerIntensity: 'medium',
    gradientBorders: true, gradientBordersIntensity: 'strong',
    aurora: false, auroraIntensity: 'medium',
    neonFlicker: false, neonFlickerIntensity: 'medium',
    particles: false, particlesIntensity: 'medium',
    cursorTrail: true, cursorTrailIntensity: 'medium',
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
  borderShimmer: {
    name: 'Border Shimmer',
    short: 'Animated light sweep on cards',
    long: 'A thin line of light sweeps across the top of each card, giving a subtle animated edge.',
  },
  gradientBorders: {
    name: 'Gradient Borders',
    short: 'Rotating gradient card edges',
    long: 'Card borders become animated conic gradients that slowly rotate around the edge.',
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

const THEME_EFFECTS_MAP = {
  // ─── Light themes: hover lift by default
  'connectry':       { base: 'subtle' },
  'slate':           { base: 'subtle' },
  'arctic': {
    base: 'alive',
    extras: { aurora: true, auroraIntensity: 'medium', particles: 'snow', particlesIntensity: 'medium' },
  },
  'sakura': {
    base: 'subtle',
    extras: { borderShimmer: true, borderShimmerIntensity: 'subtle' },
  },
  'high-contrast':   { base: 'none' },
  'solarized-light': { base: 'subtle' },

  // ─── Dark themes: richer effects
  'connectry-dark': {
    base: 'subtle',
    extras: { ambientGlow: true, ambientGlowIntensity: 'subtle' },
  },
  'midnight': {
    base: 'subtle',
    extras: { aurora: true, auroraIntensity: 'subtle', particles: 'dots', particlesIntensity: 'subtle' },
  },
  'tron': {
    base: 'immersive',
    extras: { neonFlicker: true, neonFlickerIntensity: 'strong', ambientGlow: true, ambientGlowIntensity: 'strong' },
  },
  'obsidian': {
    base: 'subtle',
    extras: { ambientGlow: true, ambientGlowIntensity: 'subtle' },
  },
  'ember': {
    base: 'subtle',
    extras: { ambientGlow: true, ambientGlowIntensity: 'medium', particles: 'embers', particlesIntensity: 'subtle' },
  },
  'nord': {
    base: 'subtle',
    extras: { aurora: true, auroraIntensity: 'subtle' },
  },
  'terminal': {
    base: 'alive',
    extras: { neonFlicker: true, neonFlickerIntensity: 'medium', particles: 'matrix', particlesIntensity: 'medium' },
  },
  'dracula': {
    base: 'subtle',
    extras: { ambientGlow: true, ambientGlowIntensity: 'medium', borderShimmer: true, borderShimmerIntensity: 'medium' },
  },
  'solarized-dark': {
    base: 'subtle',
    extras: { ambientGlow: true, ambientGlowIntensity: 'subtle' },
  },
};


// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Get the suggested effects config for a theme (used when the user clicks the
 * "Try these effects" hint on an OOTB theme card). Returns a complete config.
 */
function getSuggestedConfig(themeId) {
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
 * Get the suggested preset name (for display on hint badges).
 */
function getSuggestedPreset(themeId) {
  const mapping = THEME_EFFECTS_MAP[themeId];
  return mapping ? mapping.base : 'none';
}

/**
 * Resolve the ACTIVE effects config at runtime.
 *
 * Resolution rules:
 *   - OOTB themes: use global effectsConfig
 *   - Custom themes: use customTheme.effects (snapshot, decoupled)
 *   - Missing config: return 'none' preset
 *
 * @param {string} activeThemeId - Current theme ID
 * @param {Object} globalEffectsConfig - Extension-wide effects config from storage
 * @param {Object|null} customTheme - The custom theme object if one is active
 * @returns {Object} Complete effects config
 */
function resolveActiveEffects(activeThemeId, globalEffectsConfig, customTheme) {
  // Custom theme active → use its snapshot
  if (customTheme && customTheme.id === activeThemeId && customTheme.effects) {
    return { ...EFFECTS_PRESETS.none, ...customTheme.effects };
  }

  // OOTB theme → use global effects config
  if (globalEffectsConfig) {
    return { ...EFFECTS_PRESETS.none, ...globalEffectsConfig };
  }

  // Default: no effects
  return { ...EFFECTS_PRESETS.none };
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
    getSuggestedConfig,
    getSuggestedPreset,
    resolveActiveEffects,
    initialCustomThemeEffects,
    getPresetNames,
    getPresetDisplayInfo,
    getEffectKeys,
    getEffectDescription,
  };
}

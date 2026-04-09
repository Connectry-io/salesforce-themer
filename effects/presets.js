/**
 * Salesforce Themer — Effects Presets
 * Defines preset effect configurations and theme-to-effect pairings.
 *
 * Presets: None / Subtle / Alive / Immersive / Custom
 * Each preset is a complete effects config object.
 * Custom = user has toggled individual effects manually.
 */

'use strict';

// ─── Preset Definitions ───────────────────────────────────────────────────────

const EFFECTS_PRESETS = {
  none: {
    preset: 'none',
    intensity: 'medium',
    hoverLift: false,
    ambientGlow: false,
    borderShimmer: false,
    gradientBorders: false,
    aurora: false,
    neonFlicker: false,
    particles: false,
    cursorTrail: false,
  },

  subtle: {
    preset: 'subtle',
    intensity: 'subtle',
    hoverLift: true,
    ambientGlow: false,
    borderShimmer: false,
    gradientBorders: false,
    aurora: false,
    neonFlicker: false,
    particles: false,
    cursorTrail: false,
  },

  alive: {
    preset: 'alive',
    intensity: 'medium',
    hoverLift: true,
    ambientGlow: true,
    borderShimmer: true,
    gradientBorders: false,
    aurora: false,
    neonFlicker: false,
    particles: false,
    cursorTrail: false,
  },

  immersive: {
    preset: 'immersive',
    intensity: 'strong',
    hoverLift: true,
    ambientGlow: true,
    borderShimmer: true,
    gradientBorders: true,
    aurora: false,
    neonFlicker: false,
    particles: false,
    cursorTrail: true,
  },
};


// ─── Theme → Suggested Effects Mapping ────────────────────────────────────────
// These are DEFAULTS that a theme suggests. The user can always override.
// Each entry extends a base preset with theme-specific additions.

const THEME_EFFECTS_MAP = {
  // ─── Light themes: hover lift only
  'connectry': {
    base: 'subtle',
    overrides: {},
  },
  'slate': {
    base: 'subtle',
    overrides: {},
  },
  'arctic': {
    base: 'alive',
    overrides: {
      aurora: true,
      auroraColors: '#e8f4fd, #d1ecf9, #bae1f5, #c8ebd7, #d1e3f9, #e0f0e6',
      particles: 'snow',
      particleColor: '#c8e6f5',
      particleDensity: 45,
      particleSpeed: 0.7,
      particleOpacity: 0.4,
    },
  },
  'sakura': {
    base: 'subtle',
    overrides: {
      borderShimmer: true,
      intensity: 'subtle',
    },
  },
  'high-contrast': {
    base: 'none',
    overrides: {},
  },
  'solarized-light': {
    base: 'subtle',
    overrides: {},
  },

  // ─── Dark themes: richer effects
  'connectry-dark': {
    base: 'subtle',
    overrides: {
      ambientGlow: true,
    },
  },
  'midnight': {
    base: 'subtle',
    overrides: {
      aurora: true,
      auroraColors: '#0d1117, #161b22, #0f2440, #0d2818, #1a0d2e, #1a1a2e',
      particles: 'dots',
      particleColor: '#ffffff',
      particleDensity: 35,
      particleSpeed: 0.4,
      particleOpacity: 0.3,
    },
  },
  'tron': {
    base: 'immersive',
    overrides: {
      neonFlicker: true,
      neonColor: '#00e5ff',
      gradientBorders: true,
      ambientGlow: true,
      intensity: 'strong',
    },
  },
  'obsidian': {
    base: 'subtle',
    overrides: {
      ambientGlow: true,
    },
  },
  'ember': {
    base: 'subtle',
    overrides: {
      ambientGlow: true,
      particles: 'embers',
      particleColor: '#ff6b35',
      particleDensity: 25,
      particleSpeed: 0.8,
      particleOpacity: 0.5,
    },
  },
  'nord': {
    base: 'subtle',
    overrides: {
      aurora: true,
      auroraColors: '#2e3440, #3b4252, #1a3a4a, #1a4a3a, #2e3450, #3b3252',
    },
  },
  'terminal': {
    base: 'alive',
    overrides: {
      neonFlicker: true,
      neonColor: '#00ff41',
      particles: 'matrix',
      particleColor: '#00ff41',
      particleDensity: 35,
      particleSpeed: 1.2,
      particleOpacity: 0.4,
    },
  },
  'dracula': {
    base: 'subtle',
    overrides: {
      ambientGlow: true,
      borderShimmer: true,
    },
  },
  'solarized-dark': {
    base: 'subtle',
    overrides: {
      ambientGlow: true,
    },
  },
};


// ─── Resolve Config ──────────────────────────────────────────────────────────

/**
 * Resolve a full effects config for a theme.
 * Priority: user overrides > theme suggestion > base preset
 *
 * @param {string} themeId - Current theme ID
 * @param {Object|null} userConfig - User's stored effects config (from chrome.storage.sync)
 * @returns {Object} Complete effects config
 */
function resolveEffectsConfig(themeId, userConfig) {
  // If user has explicitly chosen a config, use it
  if (userConfig && userConfig.preset !== undefined) {
    // 'custom' preset means individual toggles are set by user
    if (userConfig.preset === 'custom') {
      return { ...EFFECTS_PRESETS.none, ...userConfig };
    }
    // Named preset — use the preset as base, apply any user tweaks
    const base = EFFECTS_PRESETS[userConfig.preset] || EFFECTS_PRESETS.none;
    return { ...base, ...userConfig };
  }

  // No user config — use theme's suggested effects
  const mapping = THEME_EFFECTS_MAP[themeId];
  if (!mapping) return { ...EFFECTS_PRESETS.none };

  const base = EFFECTS_PRESETS[mapping.base] || EFFECTS_PRESETS.none;
  return { ...base, ...mapping.overrides };
}

/**
 * Get the suggested preset name for a theme.
 * @param {string} themeId
 * @returns {string} Preset name ('none' | 'subtle' | 'alive' | 'immersive')
 */
function getSuggestedPreset(themeId) {
  const mapping = THEME_EFFECTS_MAP[themeId];
  return mapping ? mapping.base : 'none';
}

/**
 * Get all available preset names.
 * @returns {string[]}
 */
function getPresetNames() {
  return ['none', 'subtle', 'alive', 'immersive'];
}

/**
 * Get display info for presets (for UI).
 * @returns {Object[]}
 */
function getPresetDisplayInfo() {
  return [
    { id: 'none', name: 'None', description: 'No visual effects', icon: '○' },
    { id: 'subtle', name: 'Subtle', description: 'Hover lift on cards & buttons', icon: '◐' },
    { id: 'alive', name: 'Alive', description: 'Glow, shimmer & hover effects', icon: '◉' },
    { id: 'immersive', name: 'Immersive', description: 'Full effects with trails & borders', icon: '✦' },
  ];
}


// Export
if (typeof module !== 'undefined') {
  module.exports = {
    EFFECTS_PRESETS,
    THEME_EFFECTS_MAP,
    resolveEffectsConfig,
    getSuggestedPreset,
    getPresetNames,
    getPresetDisplayInfo,
  };
}

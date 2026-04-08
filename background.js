const THEME_ORDER = ['connectry', 'midnight', 'slate', 'tron', 'obsidian', 'arctic'];

const LIGHT_THEMES = new Set(['connectry', 'slate', 'arctic']);
const DARK_THEMES = new Set(['midnight', 'tron', 'obsidian']);

// Fetch and cache a theme's CSS text into chrome.storage.local
async function cacheThemeCSS(themeName) {
  if (!themeName || themeName === 'none') return;
  try {
    const url = chrome.runtime.getURL(`content/themes/${themeName}.css`);
    const response = await fetch(url);
    if (!response.ok) return;
    const css = await response.text();
    await chrome.storage.local.set({ [`themeCSS_${themeName}`]: css });
  } catch (_) {
    // Non-critical — content script will fall back to fetch
  }
}

// Pre-cache all themes on install/update so first-load flash is eliminated
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      theme: 'connectry',
      autoMode: false,
      lightTheme: 'connectry',
      darkTheme: 'midnight',
      lastLightTheme: 'connectry',
      lastDarkTheme: 'midnight',
      orgThemes: {},
    });
  }

  // Cache all themes regardless of install/update
  for (const name of THEME_ORDER) {
    await cacheThemeCSS(name);
  }
});

// Re-cache whenever theme CSS might change (e.g. extension update)
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'sync') return;
  if (changes.theme?.newValue) {
    await cacheThemeCSS(changes.theme.newValue);
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-theme') {
    const result = await chrome.storage.sync.get({ theme: 'connectry', autoMode: false });
    if (result.autoMode) return; // Don't cycle while auto mode is active
    const idx = THEME_ORDER.indexOf(result.theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    await applyAndSaveTheme(next);
  }

  if (command === 'toggle-dark-light') {
    const result = await chrome.storage.sync.get({
      theme: 'connectry',
      lastLightTheme: 'connectry',
      lastDarkTheme: 'midnight',
      autoMode: false,
    });
    if (result.autoMode) return;

    const current = result.theme;
    let next;
    if (DARK_THEMES.has(current)) {
      next = result.lastLightTheme;
    } else {
      next = result.lastDarkTheme;
    }
    await applyAndSaveTheme(next);
  }
});

async function applyAndSaveTheme(themeName) {
  const result = await chrome.storage.sync.get({
    lastLightTheme: 'connectry',
    lastDarkTheme: 'midnight',
  });

  const updates = { theme: themeName };
  if (LIGHT_THEMES.has(themeName)) {
    updates.lastLightTheme = themeName;
  } else if (DARK_THEMES.has(themeName)) {
    updates.lastDarkTheme = themeName;
  }
  await chrome.storage.sync.set(updates);
  await cacheThemeCSS(themeName);
  await broadcastThemeToActiveTabs(themeName);
}

async function broadcastThemeToActiveTabs(themeName) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme: themeName }).catch(() => {});
    }
  } catch (_) {}
}

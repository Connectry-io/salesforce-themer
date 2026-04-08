(() => {
  'use strict';

  let THEMES = [];
  let syncState = {};
  let activeFilter = 'all';

  // ─── Theme registry loading ──────────────────────────────────────────────

  async function loadThemes() {
    const url = chrome.runtime.getURL('themes/themes.json');
    const response = await fetch(url);
    const data = await response.json();
    THEMES = data.themes;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function getThemeById(id) {
    return THEMES.find(t => t.id === id) || null;
  }

  function getLightThemes() {
    return THEMES.filter(t => t.category === 'light');
  }

  function getDarkThemes() {
    return THEMES.filter(t => t.category === 'dark');
  }

  function isLightTheme(id) {
    const t = getThemeById(id);
    return t ? t.category === 'light' : false;
  }

  function isDarkTheme(id) {
    const t = getThemeById(id);
    return t ? t.category === 'dark' : false;
  }

  // ─── Swatch generation ────────────────────────────────────────────────────

  function buildSwatch(theme) {
    const c = theme.colors;
    // Pick 4 representative colors: bg, surface, accent, text
    const colors = [c.background, c.surface, c.accent, c.textPrimary];
    return colors.map(col => `<span style="background:${col};"></span>`).join('');
  }

  // ─── Theme grid rendering ─────────────────────────────────────────────────

  function renderThemeGrid(activeThemeId) {
    const grid = document.getElementById('themeGrid');
    grid.innerHTML = '';

    for (const theme of THEMES) {
      const isActive = theme.id === activeThemeId;
      const card = document.createElement('button');
      card.className = `theme-card${isActive ? ' is-active' : ''}${activeFilter !== 'all' && theme.category !== activeFilter ? ' is-hidden' : ''}`;
      card.dataset.theme = theme.id;
      card.role = 'radio';
      card.setAttribute('aria-checked', String(isActive));
      card.setAttribute('title', theme.name);

      card.innerHTML = `
        <div class="theme-swatch">${buildSwatch(theme)}</div>
        <div class="theme-card-body">
          <div class="theme-card-header">
            <span class="theme-name">${theme.name}</span>
            <span class="theme-category-badge ${theme.category}">${theme.category === 'light' ? 'Light' : 'Dark'}</span>
          </div>
          <div class="theme-description">${theme.description}</div>
        </div>
        <button class="theme-apply-btn" data-apply="${theme.id}" tabindex="-1">
          ${isActive ? 'Active' : 'Apply'}
        </button>
        <div class="theme-check" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;

      card.addEventListener('click', (e) => {
        // Don't double-fire when clicking the inner apply button
        if (e.target.dataset.apply) {
          selectTheme(e.target.dataset.apply);
        } else {
          selectTheme(theme.id);
        }
      });

      grid.appendChild(card);
    }
  }

  function updateGridActiveState(activeThemeId) {
    document.querySelectorAll('.theme-card').forEach(card => {
      const id = card.dataset.theme;
      const isActive = id === activeThemeId;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-checked', String(isActive));
      const btn = card.querySelector('.theme-apply-btn');
      if (btn) btn.textContent = isActive ? 'Active' : 'Apply';
    });
  }

  // ─── Filter pills ─────────────────────────────────────────────────────────

  function bindFilterPills() {
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeFilter = pill.dataset.filter;
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');

        document.querySelectorAll('.theme-card').forEach(card => {
          const theme = getThemeById(card.dataset.theme);
          if (!theme) return;
          const hidden = activeFilter !== 'all' && theme.category !== activeFilter;
          card.classList.toggle('is-hidden', hidden);
        });
      });
    });
  }

  // ─── Theme selection ──────────────────────────────────────────────────────

  async function selectTheme(themeId) {
    const updates = { theme: themeId };
    if (isLightTheme(themeId)) updates.lastLightTheme = themeId;
    if (isDarkTheme(themeId)) updates.lastDarkTheme = themeId;

    await chrome.storage.sync.set(updates);
    syncState = { ...syncState, ...updates };

    updateGridActiveState(themeId);
    updateHeaderMeta(themeId);

    // Apply to any active SF tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme: themeId }).catch(() => {});
      }
    } catch (_) {}
  }

  // ─── Auto mode toggle ─────────────────────────────────────────────────────

  async function handleAutoModeToggle() {
    const toggle = document.getElementById('autoModeToggle');
    const autoMode = toggle.checked;
    await chrome.storage.sync.set({ autoMode });
    syncState = { ...syncState, autoMode };

    if (autoMode) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = isDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'setTheme', theme: next }).catch(() => {});
        }
      } catch (_) {}
    }
  }

  // ─── Per-org settings ────────────────────────────────────────────────────

  function renderOrgList(orgThemes) {
    const container = document.getElementById('orgList');
    const row = document.getElementById('orgSettingsRow');

    if (!orgThemes || Object.keys(orgThemes).length === 0) {
      row.hidden = true;
      return;
    }

    row.hidden = false;
    container.innerHTML = '';

    for (const [hostname, themeId] of Object.entries(orgThemes)) {
      const theme = getThemeById(themeId);
      const themeName = theme ? theme.name : themeId;
      const shortHost = hostname.replace('.lightning.force.com', '').replace('.my.salesforce.com', '');

      const item = document.createElement('div');
      item.className = 'org-item';
      item.innerHTML = `
        <span class="org-item-host" title="${hostname}">${shortHost}</span>
        <span class="org-item-theme">${themeName}</span>
        <button class="org-item-remove" data-host="${hostname}">Remove</button>
      `;

      item.querySelector('.org-item-remove').addEventListener('click', async () => {
        const updated = { ...(syncState.orgThemes || {}) };
        delete updated[hostname];
        await chrome.storage.sync.set({ orgThemes: updated });
        syncState.orgThemes = updated;
        renderOrgList(updated);
      });

      container.appendChild(item);
    }
  }

  // ─── Header meta ─────────────────────────────────────────────────────────

  function updateHeaderMeta(activeThemeId) {
    const meta = document.getElementById('headerMeta');
    const theme = getThemeById(activeThemeId);
    const name = theme ? theme.name : activeThemeId;
    meta.innerHTML = `
      <div class="header-theme-dot"></div>
      <span>Active: ${name}</span>
      <span style="color: var(--color-border)">·</span>
      <span>${THEMES.length} themes</span>
    `;
  }

  // ─── Version ──────────────────────────────────────────────────────────────

  function setVersion() {
    const manifest = chrome.runtime.getManifest();
    const el = document.getElementById('versionLabel');
    if (el && manifest.version) el.textContent = `v${manifest.version}`;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    await loadThemes();

    syncState = await chrome.storage.sync.get({
      theme: 'connectry',
      autoMode: false,
      lastLightTheme: 'connectry',
      lastDarkTheme: 'connectry-dark',
      orgThemes: {},
      themeScope: 'both',
    });

    let activeTheme = syncState.theme;
    if (syncState.autoMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = prefersDark
        ? (syncState.lastDarkTheme || 'connectry-dark')
        : (syncState.lastLightTheme || 'connectry');
    }

    renderThemeGrid(activeTheme);
    bindFilterPills();
    updateHeaderMeta(activeTheme);
    renderOrgList(syncState.orgThemes);
    setVersion();

    // Auto mode toggle
    const autoToggle = document.getElementById('autoModeToggle');
    autoToggle.checked = syncState.autoMode;
    autoToggle.addEventListener('change', handleAutoModeToggle);

    // Theme scope select
    const scopeSelect = document.getElementById('themeScopeSelect');
    scopeSelect.value = syncState.themeScope || 'both';
    scopeSelect.addEventListener('change', async () => {
      await chrome.storage.sync.set({ themeScope: scopeSelect.value });
      syncState.themeScope = scopeSelect.value;
    });

    // Listen for storage changes from other windows/tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.theme) {
        syncState.theme = changes.theme.newValue;
        updateGridActiveState(syncState.theme);
        updateHeaderMeta(syncState.theme);
      }
      if (changes.autoMode) {
        syncState.autoMode = changes.autoMode.newValue;
        autoToggle.checked = changes.autoMode.newValue;
      }
      if (changes.orgThemes) {
        syncState.orgThemes = changes.orgThemes.newValue;
        renderOrgList(syncState.orgThemes);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Theme Editor
  // ═══════════════════════════════════════════════════════════════════════════

  // Inline derivation utilities (subset — matches themes/derive.js)
  function _pc(color) {
    if (!color || typeof color !== 'string') return null;
    color = color.trim();
    if (color[0] === '#') {
      const h = color.slice(1);
      if (h.length === 3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
      if (h.length >= 6) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
    }
    return null;
  }
  function _hex(r,g,b) {
    const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
    return '#'+c(r)+c(g)+c(b);
  }
  function _toHsl(r,g,b) {
    r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;
    if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}
    return{h:h*360,s:s*100,l:l*100};
  }
  function _fromHsl(h,s,l) {
    h/=360;s/=100;l/=100;if(s===0){const v=Math.round(l*255);return{r:v,g:v,b:v};}
    const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
    const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
    return{r:Math.round(hue2rgb(p,q,h+1/3)*255),g:Math.round(hue2rgb(p,q,h)*255),b:Math.round(hue2rgb(p,q,h-1/3)*255)};
  }
  function _lighten(hex,amt){const c=_pc(hex);if(!c)return hex;const h=_toHsl(c.r,c.g,c.b);h.l=Math.min(100,h.l+amt);const r=_fromHsl(h.h,h.s,h.l);return _hex(r.r,r.g,r.b);}
  function _darken(hex,amt){const c=_pc(hex);if(!c)return hex;const h=_toHsl(c.r,c.g,c.b);h.l=Math.max(0,h.l-amt);const r=_fromHsl(h.h,h.s,h.l);return _hex(r.r,r.g,r.b);}
  function _alpha(hex,op){const c=_pc(hex);if(!c)return hex;return `rgba(${c.r}, ${c.g}, ${c.b}, ${op})`;}
  function _contrast(hex){const c=_pc(hex);if(!c)return '#ffffff';const[rs,gs,bs]=[c.r,c.g,c.b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return(0.2126*rs+0.7152*gs+0.0722*bs)>0.35?'#1a1a1a':'#ffffff';}
  function _mix(h1,h2,w){const c1=_pc(h1),c2=_pc(h2);if(!c1||!c2)return h1;w=Math.max(0,Math.min(1,w));return _hex(c1.r+(c2.r-c1.r)*w,c1.g+(c2.g-c1.g)*w,c1.b+(c2.b-c1.b)*w);}

  const CORE_KEYS = [
    'colorScheme','background','surface','surfaceAlt','accent','link',
    'nav','navText','textPrimary','textSecondary','textPlaceholder',
    'border','borderInput','buttonBrandText','buttonNeutralBg',
    'tableHeaderBg','modalBg','dropdownBg','success','warning','error',
    'focusRing','scrollThumb',
  ];

  const ADVANCED_GROUPS = {
    'Surfaces': ['surfaceHover','surfaceHighlight','surfaceSelection'],
    'Accent Variants': ['accentHover','accentActive','accentLight'],
    'Text': ['textMuted'],
    'Navigation': ['navHover','navActive','navActiveBorder','navBorder','navIcon','navActiveText','navAppName','navAppBorder','navWaffleDot'],
    'Links': ['linkHover'],
    'Borders': ['borderSeparator'],
    'Buttons': ['buttonBrandBg','buttonBrandBorder','buttonBrandHover','buttonNeutralBorder','buttonNeutralHover','buttonNeutralText'],
    'Tables': ['tableHeaderText','tableAltRow','tableHoverRow','tableBorderRow','tableColBorder'],
    'Modals': ['modalHeaderBg','modalFooterBg','modalBackdrop','modalShadow'],
    'Dropdowns': ['dropdownItemHoverBg','dropdownItemHoverText'],
    'Tabs': ['tabNavBorder','tabActiveColor','tabActiveBorder','tabInactiveColor','tabContentBg'],
    'Scrollbar': ['scrollTrack','scrollThumbHover'],
    'Badges & Pills': ['badgeBg','badgeText','badgeBorder','pillBg','pillBorder','pillText'],
    'Panels': ['panelBg','panelBorder'],
  };

  // Derivation engine (mirrors themes/derive.js)
  function deriveFullTheme(input) {
    const c = { ...input };
    const isDark = c.colorScheme === 'dark';
    const d = (k, fn) => { if (c[k] === undefined || c[k] === null) c[k] = fn(); };

    d('surfaceHover', () => isDark ? _lighten(c.surface, 5) : _darken(c.surface, 3));
    d('surfaceHighlight', () => _alpha(c.accent, 0.10));
    d('surfaceSelection', () => _alpha(c.accent, 0.15));
    d('accentHover', () => _darken(c.accent, isDark ? 15 : 10));
    d('accentActive', () => _darken(c.accent, isDark ? 25 : 20));
    d('accentLight', () => _alpha(c.accent, 0.15));
    d('textMuted', () => _mix(c.textSecondary, c.textPlaceholder, isDark ? 0.6 : 0.4));
    d('navHover', () => 'rgba(255, 255, 255, 0.12)');
    d('navActive', () => 'rgba(255, 255, 255, 0.2)');
    d('navActiveBorder', () => c.navText);
    d('navBorder', () => _mix(c.nav, '#000000', isDark ? 0.3 : 0.15));
    d('navIcon', () => c.navText);
    d('navActiveText', () => c.navText);
    d('navAppName', () => c.navText);
    d('navAppBorder', () => 'rgba(255, 255, 255, 0.2)');
    d('navWaffleDot', () => c.navText);
    d('linkHover', () => isDark ? _lighten(c.link, 12) : _darken(c.link, 20));
    d('borderSeparator', () => c.border);
    d('buttonBrandBg', () => c.accent);
    d('buttonBrandBorder', () => c.accent);
    d('buttonBrandHover', () => _darken(c.accent, 10));
    d('buttonNeutralBorder', () => c.borderInput);
    d('buttonNeutralHover', () => isDark ? _lighten(c.surface, 5) : _darken(c.surface, 3));
    d('buttonNeutralText', () => c.textPrimary);
    d('tableHeaderText', () => c.textSecondary);
    d('tableAltRow', () => isDark ? _lighten(c.surface, 2) : _darken(c.surface, 1));
    d('tableHoverRow', () => _alpha(c.accent, 0.10));
    d('tableBorderRow', () => c.border);
    d('tableColBorder', () => isDark ? c.border : _lighten(c.border, 5));
    d('modalHeaderBg', () => isDark ? _darken(c.surface, 5) : c.surface);
    d('modalFooterBg', () => isDark ? _darken(c.surface, 5) : c.background);
    d('modalBackdrop', () => isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.4)');
    d('modalShadow', () => isDark ? '0 20px 60px rgba(0, 0, 0, 0.6)' : '0 20px 60px rgba(0, 0, 0, 0.12)');
    d('dropdownItemHoverBg', () => _alpha(c.accent, 0.10));
    d('dropdownItemHoverText', () => c.textPrimary);
    d('tabNavBorder', () => c.border);
    d('tabActiveColor', () => c.accent);
    d('tabActiveBorder', () => c.accent);
    d('tabInactiveColor', () => c.textSecondary);
    d('tabContentBg', () => c.surface);
    d('focusRing', () => `0 0 0 3px ${_alpha(c.accent, 0.3)}`);
    d('scrollTrack', () => isDark ? _darken(c.background, 10) : _darken(c.background, 2));
    d('scrollThumbHover', () => c.textPlaceholder);
    d('badgeBg', () => isDark ? _alpha(c.accent, 0.15) : c.accent);
    d('badgeText', () => isDark ? c.accent : _contrast(c.accent));
    d('badgeBorder', () => isDark ? `1px solid ${_alpha(c.accent, 0.3)}` : 'none');
    d('pillBg', () => _alpha(c.accent, 0.10));
    d('pillBorder', () => c.borderInput);
    d('pillText', () => c.textPrimary);
    d('panelBg', () => c.surface);
    d('panelBorder', () => c.border);
    d('searchBg', () => isDark ? _darken(c.surface, 10) : c.surface);
    d('searchText', () => c.textPrimary);
    d('searchBorder', () => isDark ? c.border : c.borderInput);
    d('searchPlaceholder', () => isDark ? c.textSecondary : c.textPlaceholder);
    d('searchFocusBorder', () => c.accent);
    d('searchFocusShadow', () => `0 0 0 2px ${_alpha(c.accent, 0.25)}`);
    d('globalHeaderWhite', () => true);
    return c;
  }

  // ─── Editor State ─────────────────────────────────────────────────────────

  let editorState = {
    active: false,
    basedOn: null,          // OOTB theme id
    customId: null,         // custom-TIMESTAMP or null (new)
    coreOverrides: {},
    advancedOverrides: {},
  };

  function getEditorCoreValues() {
    const base = getThemeById(editorState.basedOn);
    if (!base) return {};
    const core = {};
    for (const k of CORE_KEYS) {
      core[k] = editorState.coreOverrides[k] ?? base.colors[k];
    }
    return core;
  }

  function getFullEditorTheme() {
    const core = getEditorCoreValues();
    const derived = deriveFullTheme(core);
    Object.assign(derived, editorState.advancedOverrides);
    return derived;
  }

  // ─── Open / Close Editor ──────────────────────────────────────────────────

  function openEditor(baseThemeId, customTheme) {
    editorState.active = true;
    editorState.basedOn = customTheme ? customTheme.basedOn : baseThemeId;

    if (customTheme) {
      editorState.customId = customTheme.id;
      editorState.coreOverrides = { ...(customTheme.coreOverrides || {}) };
      editorState.advancedOverrides = { ...(customTheme.advancedOverrides || {}) };
      document.getElementById('editorName').value = customTheme.name;
    } else {
      editorState.customId = null;
      editorState.coreOverrides = {};
      editorState.advancedOverrides = {};
      const base = getThemeById(baseThemeId);
      document.getElementById('editorName').value = base ? `My ${base.name}` : 'My Custom Theme';
    }

    document.getElementById('galleryView').hidden = true;
    document.getElementById('editorView').hidden = false;

    populateEditorFields();
    renderAdvancedPanel();
    updatePreview();
  }

  function closeEditor() {
    editorState.active = false;
    document.getElementById('galleryView').hidden = false;
    document.getElementById('editorView').hidden = true;
  }

  // ─── Populate Fields ──────────────────────────────────────────────────────

  function populateEditorFields() {
    const full = getFullEditorTheme();

    // Color scheme dropdown
    document.getElementById('editorColorScheme').value = full.colorScheme || 'light';

    // All color fields
    document.querySelectorAll('#editorView .editor-group .editor-field[data-key]').forEach(field => {
      const key = field.dataset.key;
      if (key === 'colorScheme') return;
      const val = full[key] || '#000000';
      const swatch = field.querySelector('.color-swatch-input');
      const hex = field.querySelector('.color-hex-input');
      if (swatch && hex) {
        // color input only accepts #rrggbb
        const parsed = _pc(val);
        const hexVal = parsed ? _hex(parsed.r, parsed.g, parsed.b) : val;
        swatch.value = hexVal;
        hex.value = hexVal;
      }
    });
  }

  // ─── Render Advanced Panel ────────────────────────────────────────────────

  function renderAdvancedPanel() {
    const body = document.getElementById('advancedBody');
    body.innerHTML = '';
    const full = getFullEditorTheme();

    for (const [groupName, keys] of Object.entries(ADVANCED_GROUPS)) {
      const group = document.createElement('div');
      group.className = 'editor-group';
      group.innerHTML = `<h3 class="editor-group-title">${groupName}</h3>`;

      for (const key of keys) {
        const val = full[key];
        if (val === undefined) continue;
        const isOverridden = editorState.advancedOverrides[key] !== undefined;
        const parsed = _pc(typeof val === 'string' ? val : '');
        const isColorVal = parsed !== null;

        const field = document.createElement('div');
        field.className = `editor-field${isOverridden ? ' is-overridden' : ''}`;
        field.dataset.key = key;
        field.dataset.advanced = 'true';

        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

        if (isColorVal) {
          const hexVal = _hex(parsed.r, parsed.g, parsed.b);
          field.innerHTML = `
            <label>${label}</label>
            <div class="color-input-wrap">
              <input type="color" class="color-swatch-input" value="${hexVal}" />
              <input type="text" class="color-hex-input" value="${hexVal}" spellcheck="false" />
              <span class="advanced-auto-badge">auto</span>
              <button class="advanced-clear-btn" title="Reset to derived">&times;</button>
            </div>
          `;
        } else {
          field.innerHTML = `
            <label>${label}</label>
            <div class="color-input-wrap">
              <input type="text" class="color-hex-input" value="${val}" spellcheck="false" style="width:140px" />
              <span class="advanced-auto-badge">auto</span>
              <button class="advanced-clear-btn" title="Reset to derived">&times;</button>
            </div>
          `;
        }

        group.appendChild(field);
      }

      body.appendChild(group);
    }

    // Bind advanced field events
    bindAdvancedEvents();
  }

  // ─── Preview Update ───────────────────────────────────────────────────────

  function updatePreview() {
    const full = getFullEditorTheme();
    const frame = document.getElementById('editorPreview');

    // Background for the whole preview
    frame.style.backgroundColor = full.background;

    // data-bind="key" → set background-color
    frame.querySelectorAll('[data-bind]').forEach(el => {
      const key = el.dataset.bind;
      if (full[key]) el.style.backgroundColor = full[key];
    });

    // data-bind-color="key" → set color
    frame.querySelectorAll('[data-bind-color]').forEach(el => {
      const key = el.dataset.bindColor;
      if (full[key]) el.style.color = full[key];
    });

    // data-bind-border-color="key" → set border-color
    frame.querySelectorAll('[data-bind-border-color]').forEach(el => {
      const key = el.dataset.bindBorderColor;
      if (full[key]) el.style.borderColor = full[key];
    });

    // data-bind-border="key" → set border-bottom-color
    frame.querySelectorAll('[data-bind-border]').forEach(el => {
      const key = el.dataset.bindBorder;
      if (full[key]) el.style.borderBottomColor = full[key];
    });
  }

  // ─── Event Binding ────────────────────────────────────────────────────────

  function bindEditorEvents() {
    // Back button
    document.getElementById('editorBackBtn').addEventListener('click', closeEditor);

    // Color scheme dropdown
    document.getElementById('editorColorScheme').addEventListener('change', (e) => {
      editorState.coreOverrides.colorScheme = e.target.value;
      onEditorChange();
    });

    // Core color fields
    document.querySelectorAll('#editorView .editor-group:not(.editor-advanced-body .editor-group) .editor-field[data-key]').forEach(field => {
      const key = field.dataset.key;
      if (key === 'colorScheme') return;

      const swatch = field.querySelector('.color-swatch-input');
      const hex = field.querySelector('.color-hex-input');

      if (swatch) {
        swatch.addEventListener('input', () => {
          hex.value = swatch.value;
          editorState.coreOverrides[key] = swatch.value;
          onEditorChange();
        });
      }

      if (hex) {
        hex.addEventListener('change', () => {
          let val = hex.value.trim();
          if (val && val[0] !== '#') val = '#' + val;
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            if (swatch) swatch.value = val;
            editorState.coreOverrides[key] = val;
            onEditorChange();
          }
        });
      }
    });

    // Save button
    document.getElementById('editorSaveBtn').addEventListener('click', saveCustomTheme);

    // Reset button
    document.getElementById('editorResetBtn').addEventListener('click', () => {
      editorState.coreOverrides = {};
      editorState.advancedOverrides = {};
      populateEditorFields();
      renderAdvancedPanel();
      updatePreview();
    });

    // Export button
    document.getElementById('editorExportBtn').addEventListener('click', exportThemeJSON);

    // Import button
    document.getElementById('editorImportBtn').addEventListener('click', () => {
      document.getElementById('editorImportFile').click();
    });
    document.getElementById('editorImportFile').addEventListener('change', importThemeJSON);

    // Create theme button
    document.getElementById('createThemeBtn').addEventListener('click', () => {
      openEditor('connectry', null);
    });
  }

  function bindAdvancedEvents() {
    document.querySelectorAll('#advancedBody .editor-field').forEach(field => {
      const key = field.dataset.key;

      const swatch = field.querySelector('.color-swatch-input');
      const hex = field.querySelector('.color-hex-input');
      const clearBtn = field.querySelector('.advanced-clear-btn');

      if (swatch) {
        swatch.addEventListener('input', () => {
          hex.value = swatch.value;
          editorState.advancedOverrides[key] = swatch.value;
          field.classList.add('is-overridden');
          updatePreview();
        });
      }

      if (hex) {
        hex.addEventListener('change', () => {
          let val = hex.value.trim();
          if (val && val[0] !== '#') val = '#' + val;
          editorState.advancedOverrides[key] = val;
          if (swatch && /^#[0-9a-fA-F]{6}$/.test(val)) swatch.value = val;
          field.classList.add('is-overridden');
          updatePreview();
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          delete editorState.advancedOverrides[key];
          field.classList.remove('is-overridden');
          // Recalculate derived value
          const full = getFullEditorTheme();
          const val = full[key] || '';
          const parsed = _pc(val);
          if (hex) hex.value = parsed ? _hex(parsed.r, parsed.g, parsed.b) : val;
          if (swatch && parsed) swatch.value = _hex(parsed.r, parsed.g, parsed.b);
          updatePreview();
        });
      }
    });
  }

  function onEditorChange() {
    // Reset advanced overrides that are now stale
    // (user changed a core value — derived values should recalculate)
    populateEditorFields();
    renderAdvancedPanel();
    updatePreview();
  }

  // ─── Save / Export / Import ───────────────────────────────────────────────

  async function saveCustomTheme() {
    const name = document.getElementById('editorName').value.trim() || 'My Custom Theme';
    const id = editorState.customId || `custom-${Date.now()}`;
    const base = getThemeById(editorState.basedOn);

    const custom = {
      id,
      name,
      basedOn: editorState.basedOn,
      category: (editorState.coreOverrides.colorScheme || base?.colors?.colorScheme) || 'light',
      author: 'User',
      createdVia: 'manual',
      coreOverrides: { ...editorState.coreOverrides },
      advancedOverrides: { ...editorState.advancedOverrides },
    };

    // Load existing custom themes
    const { customThemes = [] } = await chrome.storage.sync.get('customThemes');

    // Replace or append
    const idx = customThemes.findIndex(t => t.id === id);
    if (idx >= 0) {
      customThemes[idx] = custom;
    } else {
      customThemes.push(custom);
    }

    await chrome.storage.sync.set({ customThemes });
    editorState.customId = id;

    // Apply the theme
    await selectTheme(id);

    // Visual feedback
    const btn = document.getElementById('editorSaveBtn');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save Theme'; }, 1500);
  }

  function exportThemeJSON() {
    const full = getFullEditorTheme();
    const name = document.getElementById('editorName').value.trim() || 'custom-theme';
    const data = {
      name,
      basedOn: editorState.basedOn,
      category: full.colorScheme || 'light',
      coreOverrides: editorState.coreOverrides,
      advancedOverrides: editorState.advancedOverrides,
      fullColors: full,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importThemeJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.coreOverrides) {
          editorState.coreOverrides = data.coreOverrides;
          editorState.advancedOverrides = data.advancedOverrides || {};
          document.getElementById('editorName').value = data.name || 'Imported Theme';
          if (data.basedOn && getThemeById(data.basedOn)) {
            editorState.basedOn = data.basedOn;
          }
          populateEditorFields();
          renderAdvancedPanel();
          updatePreview();
        } else if (data.fullColors) {
          // Full theme import — extract core, rest goes to advanced
          editorState.coreOverrides = {};
          editorState.advancedOverrides = {};
          for (const [k, v] of Object.entries(data.fullColors)) {
            if (CORE_KEYS.includes(k)) editorState.coreOverrides[k] = v;
            else editorState.advancedOverrides[k] = v;
          }
          document.getElementById('editorName').value = data.name || 'Imported Theme';
          populateEditorFields();
          renderAdvancedPanel();
          updatePreview();
        }
      } catch (err) {
        console.error('[Themer] Import error:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ─── Customize button on theme cards ──────────────────────────────────────

  function addCustomizeButtons() {
    document.querySelectorAll('.theme-card').forEach(card => {
      const themeId = card.dataset.theme;
      if (!themeId) return;

      const btn = document.createElement('button');
      btn.className = 'theme-customize-btn';
      btn.title = 'Customize this theme';
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor(themeId, null);
      });

      card.appendChild(btn);
    });
  }

  // ─── Init (extended) ──────────────────────────────────────────────────────

  init().catch(err => console.error('[Themer options] Init error:', err));

  // Bind editor after DOM is ready
  setTimeout(() => {
    bindEditorEvents();
    addCustomizeButtons();
  }, 100);
})();

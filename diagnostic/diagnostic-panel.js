/**
 * Diagnostic Panel — Salesforce Themer
 *
 * Shadow DOM-isolated floating overlay for theme diagnostics.
 * Injected into the Salesforce page by content.js on demand.
 *
 * Registered on window.__sfThemerDiag — inert until instantiated.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  const HOST_ID = 'sf-themer-diagnostic-host';

  // ─── SVG icons ──────────────────────────────────────────────────────────

  const ICONS = {
    logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="12" r="3.5" fill="#e4e4e7"/>
      <line x1="9.5" y1="12" x2="14.5" y2="12" stroke="#4A6FA5" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="18" cy="12" r="3.5" fill="#4A6FA5"/>
    </svg>`,
    minimize: `<svg viewBox="0 0 14 14" fill="none"><path d="M3 7h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    close: `<svg viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    scan: `<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.4"/><path d="M7 4v3h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    spinner: `<svg viewBox="0 0 14 14" fill="none"><path d="M7 2a5 5 0 1 1-4.33 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    chevron: `<svg viewBox="0 0 10 10" fill="none" width="10" height="10"><path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    copy: `<svg viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="7" height="8" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M10 3.5V3a1.2 1.2 0 0 0-1.2-1.2H4.2A1.2 1.2 0 0 0 3 3v5.8A1.2 1.2 0 0 0 4.2 10H4.5" stroke="currentColor" stroke-width="1.3"/></svg>`,
    badge: `<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="3" fill="currentColor" opacity="0.6"/><line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/><circle cx="18" cy="12" r="3" fill="currentColor"/></svg>`,
  };

  // ─── Panel class ────────────────────────────────────────────────────────

  class DiagnosticPanel {
    constructor({ currentTheme, styleId }) {
      this.currentTheme = currentTheme;
      this.styleId = styleId;
      this.host = null;
      this.shadow = null;
      this.panel = null;
      this.isOpen = false;
      this.isMinimized = false;
      this.scanResults = null;        // token scan
      this.componentResults = null;   // component scan
      this.fixReport = null;          // generated CSS fixes
      this.themeColors = null;        // active theme color config
      this.patchSummary = null;       // custom patches summary
      this.hasScanned = false;        // true after first scan
      this.autoScanEnabled = false;  // continuous scan mode
      this.testingProgress = null;   // guided testing progress
      this._panelTheme = 'dark';     // 'dark' | 'light'
      this._configuredThemeName = null;
      this._dragState = null;
      this._cssLoaded = false;
      this._cssText = '';
      this.aiSuggestion = null;  // { id, output, status, error }
      this.aiBusy = false;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────

    async toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        await this.open();
      }
    }

    async open() {
      if (this.isOpen) return;
      this.isOpen = true;
      this.isMinimized = false;
      console.log('[SFT Diag] Opening panel...');
      // Persist open state so panel reopens after page refresh
      try { chrome.storage.local.set({ diagnosticPanelOpen: true }); } catch (_) {}

      // Load CSS, testing progress, theme colors, and patch summary in parallel
      const loads = [];
      if (!this._cssLoaded) loads.push(this._loadCSS());
      if (ns.getTestingProgress) {
        loads.push(
          ns.getTestingProgress(this.currentTheme).then(p => { this.testingProgress = p || {}; })
        );
      } else {
        this.testingProgress = {};
      }
      // Load theme colors — if current theme is 'none', resolve the configured
      // theme from storage so we still get the swatch + can generate fixes
      loads.push(this._loadThemeColors());
      if (ns.getPatchSummary) {
        loads.push(
          ns.getPatchSummary().then(s => { this.patchSummary = s; })
        );
      }
      if (loads.length) await Promise.all(loads);

      // Restore panel preferences
      try {
        const pref = await chrome.storage.local.get(['diagnosticPanelTheme', 'diagnosticAutoScan']);
        if (pref.diagnosticPanelTheme === 'light') this._panelTheme = 'light';
        if (pref.diagnosticAutoScan) this.autoScanEnabled = true;
      } catch (_) {}

      this._createHost();
      // Apply light mode class if needed
      if (this._panelTheme === 'light') {
        this.host.classList.add('diag-light');
      }
      this._renderPanel();
      this._setupDrag();
      await this._restorePosition();

      // Run initial scan automatically
      this._autoScan();
    }

    close() {
      if (!this.isOpen) return;
      try { chrome.storage.local.set({ diagnosticPanelOpen: false }); } catch (_) {}
      const el = this.shadow?.querySelector('.diag-panel, .diag-badge');
      if (el && el.classList.contains('diag-panel')) {
        el.classList.add('is-closing');
        el.addEventListener('animationend', () => this._destroyHost(), { once: true });
      } else {
        this._destroyHost();
      }
      this.isOpen = false;
      this.isMinimized = false;
    }

    minimize() {
      this.isMinimized = true;
      this._savePosition();
      this._renderBadge();
    }

    restore() {
      this.isMinimized = false;
      this._renderPanel();
      this._setupDrag();
      this._restorePosition();
    }

    destroy() {
      this._destroyHost();
      this.isOpen = false;
      this.isMinimized = false;
    }

    updateTheme(themeName) {
      this.currentTheme = themeName;
      this.testingProgress = null; // Reset — different theme
      this.themeColors = null;     // Clear — need to re-resolve for new theme
      this.themeDisplayName = null; // Clear — need to re-resolve label
      this.fixReport = null;       // Clear — fixes depend on theme colors
      if (ns.clearThemeCache) ns.clearThemeCache();
      if (this.isOpen && !this.isMinimized) {
        this._updateInfoBar();
        // Reload theme colors + display name for the new theme, then re-render
        const pending = [];
        if (ns.resolveThemeColors) {
          pending.push(ns.resolveThemeColors(themeName).then(c => { this.themeColors = c; }));
        }
        if (ns.resolveThemeName) {
          pending.push(ns.resolveThemeName(themeName).then(n => { this.themeDisplayName = n; }));
        }
        Promise.all(pending).then(() => {
          if (this.isOpen && !this.isMinimized) this._updateInfoBar();
        });
      }
    }

    _togglePanelTheme() {
      this._panelTheme = this._panelTheme === 'dark' ? 'light' : 'dark';
      if (this.host) {
        this.host.classList.toggle('diag-light', this._panelTheme === 'light');
      }
      // Persist preference
      try { chrome.storage.local.set({ diagnosticPanelTheme: this._panelTheme }); } catch (_) {}
    }

    _toggleAutoScan() {
      this.autoScanEnabled = !this.autoScanEnabled;
      // Persist preference
      try { chrome.storage.local.set({ diagnosticAutoScan: this.autoScanEnabled }); } catch (_) {}
      // Re-render scan bar to reflect state
      const scanBar = this.shadow?.querySelector('.diag-scan-bar');
      if (scanBar) scanBar.outerHTML = this._scanBarHTML();
      // If just enabled, run an immediate scan
      if (this.autoScanEnabled) this._autoScan();
    }

    /** Called by content.js when SPA navigation occurs. */
    onNavigate() {
      if (!this.isOpen || this.isMinimized) return;
      if (!this.autoScanEnabled) {
        // Not auto-scanning — just update the scan button label with new page type
        const scanBar = this.shadow?.querySelector('.diag-scan-bar');
        if (scanBar) scanBar.outerHTML = this._scanBarHTML();
        return;
      }
      // Auto-scan on navigation
      this._autoScan();
    }

    /** Run all scans silently and refresh the active tab. */
    async _autoScan() {
      console.log('[SFT Diag] Auto-scanning on navigation...');

      // Small delay — let SF finish rendering the new page
      await new Promise(r => setTimeout(r, 500));

      // Always load latest testing progress first
      if (ns.getTestingProgress) {
        this.testingProgress = await ns.getTestingProgress(this.currentTheme) || {};
      }

      // Token scan
      try {
        if (ns.scanTokens) {
          this.scanResults = ns.scanTokens(this.currentTheme);
        }
      } catch (_) {}

      // Component scan
      try {
        if (ns.scanComponents) {
          this.componentResults = ns.scanComponents();
        }
      } catch (_) {}

      // Generate fixes from scan results
      try {
        if (ns.generateFullFixReport && this.themeColors) {
          this.fixReport = ns.generateFullFixReport(this.scanResults, this.componentResults, this.themeColors);
        }
      } catch (_) {}

      // Load patch summary
      try {
        if (ns.getPatchSummary) {
          this.patchSummary = await ns.getPatchSummary();
        }
      } catch (_) {}

      // Save testing progress for detected page type
      const pageType = ns.detectPageType?.();
      console.log('[SFT Diag] Page type:', pageType?.id || 'none', 'URL:', location.pathname.slice(0, 60));
      if (pageType && ns.saveTestResult) {
        const tokenCoverage = this.scanResults?.coverage || null;
        const s = this.componentResults?.summary;
        const componentHealth = s && s.totalStandardFound > 0
          ? ((s.totalStyled + s.totalPartial * 0.5) / s.totalStandardFound) * 100
          : null;
        await ns.saveTestResult(this.currentTheme, pageType.id, { tokenCoverage, componentHealth });
        // Reload progress to include the save we just did
        this.testingProgress = await ns.getTestingProgress(this.currentTheme) || {};
      }

      this.hasScanned = true;
      this._lastScanTime = new Date();

      // Update info bar (page may have changed)
      this._updateInfoBar();

      // Refresh unified results
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._unifiedResultsHTML();
      // Update scan button text
      const scanBar = this.shadow?.querySelector('.diag-scan-bar');
      if (scanBar) scanBar.outerHTML = this._scanBarHTML();
    }

    // ── Host management ───────────────────────────────────────────────────

    _createHost() {
      this._destroyHost();
      this.host = document.createElement('div');
      this.host.id = HOST_ID;
      // Inline styles as fallback — ensures visibility even if CSS fetch fails
      this.host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483640;';
      this.shadow = this.host.attachShadow({ mode: 'open' });
      document.body.appendChild(this.host);
    }

    _destroyHost() {
      if (this.host) {
        this.host.remove();
        this.host = null;
        this.shadow = null;
        this.panel = null;
      }
    }

    async _loadThemeColors() {
      // Try the current theme first
      if (this.currentTheme && this.currentTheme !== 'none' && ns.resolveThemeColors) {
        this.themeColors = await ns.resolveThemeColors(this.currentTheme);
        if (this.themeColors) return;
      }
      // If theme is 'none' or resolution failed, look up the configured theme
      // from storage so we still have colors for the swatch + fix generation
      try {
        const syncData = await chrome.storage.sync.get({
          theme: 'connectry', autoMode: false,
          lastLightTheme: 'connectry', lastDarkTheme: 'connectry-dark',
        });
        const configuredTheme = syncData.autoMode
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches
            ? syncData.lastDarkTheme : syncData.lastLightTheme)
          : syncData.theme;
        if (configuredTheme && configuredTheme !== 'none' && ns.resolveThemeColors) {
          this.themeColors = await ns.resolveThemeColors(configuredTheme);
          // Store the configured name so the swatch shows what WOULD apply
          if (this.themeColors && this.currentTheme === 'none') {
            this._configuredThemeName = configuredTheme;
          }
        }
      } catch (_) {}
    }

    async _loadCSS() {
      try {
        const url = chrome.runtime.getURL('diagnostic/diagnostic-panel.css');
        const res = await fetch(url);
        this._cssText = await res.text();
        this._cssLoaded = true;
      } catch (err) {
        console.warn('[SFT Diag] Failed to load panel CSS:', err.message);
        this._cssText = '';
        this._cssLoaded = true;
      }
    }

    // ── Render: full panel ────────────────────────────────────────────────

    _renderPanel() {
      if (!this.shadow) return;

      const themeName = this.currentTheme || 'none';
      const injected = themeName !== 'none';

      this.shadow.innerHTML = `
        <style>${this._cssText}</style>
        <div class="diag-panel">
          ${this._headerHTML()}
          ${this._infoBarHTML(themeName, injected)}
          ${this._scanBarHTML()}
          <div class="diag-results">
            ${this._unifiedResultsHTML()}
          </div>
          ${this._footerHTML()}
        </div>
      `;

      this.panel = this.shadow.querySelector('.diag-panel');
      this._bindEvents();
    }

    _headerHTML() {
      return `
        <div class="diag-header">
          <div class="diag-header-logo">${ICONS.logo}</div>
          <div class="diag-header-text">
            <div class="diag-header-title">Theme Diagnostic</div>
            <div class="diag-header-subtitle">Powered by Connectry AI</div>
          </div>
          <div class="diag-header-actions">
            <button class="diag-icon-btn" data-action="toggleQAMode" title="QA mode: also load draft-tier engine patches in this tab (Connectry HQ only)" style="font-size:9px;font-weight:600;letter-spacing:0.04em;width:auto;padding:0 8px;">
              <span data-qa-label>QA</span>
            </button>
            <button class="diag-icon-btn" data-action="toggleAdvancedMode" title="Advanced mode: rich enrichment + screenshot for AI suggestions" style="font-size:9px;font-weight:600;letter-spacing:0.04em;width:auto;padding:0 8px;">
              <span data-advanced-label>ADV</span>
            </button>
            <button class="diag-icon-btn" data-action="togglePanelTheme" title="Toggle light/dark panel">
              <svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.4"/><path d="M7 2a5 5 0 0 1 0 10z" fill="currentColor"/></svg>
            </button>
            <button class="diag-icon-btn" data-action="minimize" title="Minimize">${ICONS.minimize}</button>
            <button class="diag-icon-btn" data-action="close" title="Close">${ICONS.close}</button>
          </div>
        </div>`;
    }

    _detectOrgTheme() {
      // Detects SLDS version reliably (1 vs 2) from DOM signals.
      // The specific brand-theme name (Lightning / Cosmos / Einstein /
      // custom) CANNOT be reliably inferred from CSS alone — any org can
      // customize colors. So we only report SLDS version with confidence.
      // A "likely" tentative name is included when brand colors exactly
      // match a factory default, but it's a hint, not a claim.
      try {
        const styleTag = document.getElementById(this.styleId);
        if (styleTag) {
          return this._cachedOrgDetection || { slds: null, likely: null };
        }
        const cs = getComputedStyle(document.documentElement);

        // SLDS version detection — SLDS 2 uses light-dark() token values
        // and the --slds-g-* family with specific surface markers.
        const surface1 = (cs.getPropertyValue('--slds-g-color-surface-1') || '').trim();
        const usesLightDark = /light-dark\(/i.test(surface1);
        const slds = usesLightDark ? 'SLDS 2' : 'SLDS 1';

        // Tentative name guess — factory color fingerprints only
        const accent1 = (cs.getPropertyValue('--slds-g-color-accent-1') || '').trim();
        const lwcBrand = (cs.getPropertyValue('--lwc-brandPrimary') || '').trim();
        const fp = (accent1 + '|' + lwcBrand).toLowerCase().replace(/\s+/g, '');
        const FACTORY = [
          { slds: 'SLDS 1', likely: 'Lightning', match: /(65,148,249|#4194f9)/ },
          { slds: 'SLDS 2', likely: 'Cosmos',    match: /light-dark\(/ },
        ];
        let likely = null;
        for (const f of FACTORY) {
          if (f.slds === slds && f.match.test(fp)) { likely = f.likely; break; }
        }

        const d = { slds, likely };
        this._cachedOrgDetection = d;
        return d;
      } catch (_) {
        return { slds: null, likely: null };
      }
    }

    _infoBarHTML(themeName, injected) {
      // Compact org label: drop SF domain suffixes, then take first segment
      // ("connectry.lightning.force.com" → "connectry";
      //  "orgfarm-bb7d6e1c20-dev.my.salesforce-setup.com" → "orgfarm-bb7…-dev")
      const fullHost = location.hostname;
      let host = fullHost
        .replace(/\.my\.salesforce(-setup)?\.com$/i, '')
        .replace(/\.lightning\.force\.com$/i, '')
        .replace(/\.develop\.my\.salesforce(-setup)?\.com$/i, '')
        .split('.')[0];
      if (host.length > 18) {
        host = host.slice(0, 10) + '…' + host.slice(-4);
      }
      const orgDetect = this._detectOrgTheme();

      // Display name:
      //  - theme === 'none' but a theme is configured → "<configured> (off)"
      //  - theme === 'none' and no configured theme → "Theme off"
      //  - otherwise the active theme name (don't rely on injected, which
      //    briefly flickers false during view transitions)
      const themeLabel = this.themeDisplayName || themeName;
      const displayName = (themeName === 'none')
        ? (this._configuredThemeName ? `${this._configuredThemeName} (off)` : 'Theme off')
        : themeLabel;

      // Build 2x2 swatch grid from theme colors (bg, surface, accent, text)
      let swatchHTML = '';
      if (this.themeColors) {
        const c = this.themeColors;
        swatchHTML = `<div class="diag-swatch">
          <span style="background:${c.background || '#eee'}"></span>
          <span style="background:${c.surface || '#fff'}"></span>
          <span style="background:${c.accent || '#4a6fa5'}"></span>
          <span style="background:${c.textPrimary || '#333'}"></span>
        </div>`;
      }

      const orgBadge = orgDetect.slds
        ? `<span class="diag-org-badge" title="${orgDetect.likely ? 'Brand colors match ' + orgDetect.likely + ' factory defaults — admins can still customize, so this is a hint, not a guarantee' : 'SLDS version detected from :root tokens'}">${this._escapeHtml(orgDetect.slds)}${orgDetect.likely ? ' · ~' + this._escapeHtml(orgDetect.likely) : ''}</span>`
        : '';

      return `
        <div class="diag-info-bar">
          <div class="diag-minicard">
            ${swatchHTML}
            <span class="diag-minicard-name">${this._escapeHtml(displayName)}</span>
            <span class="diag-info-dot ${injected ? 'is-on' : 'is-off'}"></span>
            <span class="diag-minicard-org" title="${this._escapeHtml(fullHost)}">${this._escapeHtml(host)}</span>
            ${orgBadge}
          </div>
          <div class="diag-heartbeat" id="diagHeartbeat"></div>
        </div>`;
    }

    _scanBarHTML() {
      const pageType = ns.detectPageType?.();
      const pageLabel = pageType ? ` · ${pageType.label}` : '';

      if (this.autoScanEnabled) {
        // Walk-through mode — show stop button, no manual scan
        const summary = this.testingProgress && ns.getCompletionSummary
          ? ns.getCompletionSummary(this.testingProgress) : null;
        const progress = summary ? `${summary.completed}/${summary.total}` : '';
        return `
          <div class="diag-scan-bar">
            <div class="diag-scan-row">
              <div class="diag-walkthrough-status">
                <span class="diag-autoscan-dot"></span>
                <span>Walk-through active${progress ? ` — ${progress} pages` : ''}</span>
              </div>
              <button class="diag-scan-btn diag-autoscan-btn is-active" data-action="toggleAutoScan">
                <span>Stop</span>
              </button>
            </div>
            <div class="diag-autoscan-hint">Navigate to each page — results update automatically</div>
          </div>`;
      }

      // Manual mode — show scan button + walk-through + scan all themes
      return `
        <div class="diag-scan-bar">
          <div class="diag-scan-row">
            <button class="diag-scan-btn diag-scan-btn--primary" data-action="scanAll">
              ${ICONS.scan}
              <span>${this.hasScanned ? 'Re-Scan' : 'Scan'}${pageLabel}</span>
            </button>
            <button class="diag-scan-btn diag-autoscan-btn" data-action="toggleAutoScan" title="Start walk-through: auto-scan each page as you navigate">
              <span>Walk-Through</span>
            </button>
          </div>
          <div class="diag-scan-row" style="margin-top:6px">
            <button class="diag-scan-btn diag-scan-btn--secondary" data-action="scanThemesPresets" title="Scan this page against every preset theme">
              <span>Scan Presets</span>
            </button>
            <button class="diag-scan-btn diag-scan-btn--secondary" data-action="scanThemesMine" title="Scan this page against your custom themes">
              <span>My Themes</span>
            </button>
            <button class="diag-scan-btn diag-scan-btn--secondary" data-action="scanThemesAll" title="Scan this page against every preset + custom theme">
              <span>All</span>
            </button>
          </div>
        </div>`;
    }

    _emptyHTML() {
      return `
        <div class="diag-empty">
          <div class="diag-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 8v4M12 15v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="diag-empty-title">No scan yet</div>
          <div class="diag-empty-desc">Hit "Scan This Page" to check how your theme is landing.</div>
        </div>`;
    }

    // ── Unified section builders ──────────────────────────────────────────

    _healthSummaryHTML() {
      const tokenPct = this.scanResults ? Math.round(this.scanResults.coverage * 100) : null;
      const s = this.componentResults?.summary;
      const compPct = s && s.totalStandardFound > 0
        ? Math.round(((s.totalStyled + s.totalPartial * 0.5) / s.totalStandardFound) * 100)
        : null;

      // Combined score (average of both, or whichever is available)
      let overallPct, overallLevel;
      if (tokenPct !== null && compPct !== null) {
        overallPct = Math.round((tokenPct + compPct) / 2);
      } else {
        overallPct = tokenPct ?? compPct ?? 0;
      }
      overallLevel = overallPct >= 85 ? 'good' : overallPct >= 60 ? 'ok' : 'bad';

      const gapCount = this.scanResults?.gaps?.length || 0;
      const unstyledCount = s?.totalUnstyled || 0;
      const hardcodedCount = s?.totalHardcoded || 0;
      const issueCount = gapCount + unstyledCount + hardcodedCount;

      // Last scan timestamp
      const timeStr = this._lastScanTime
        ? this._lastScanTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';

      return `
        <div class="diag-coverage">
          <div class="diag-coverage-header">
            <span class="diag-coverage-label">Theme Health</span>
            ${timeStr ? `<span class="diag-scan-time">${timeStr}</span>` : ''}
            <span class="diag-coverage-pct is-${overallLevel}">${overallPct}%</span>
          </div>
          <div class="diag-coverage-bar">
            <div class="diag-coverage-fill is-${overallLevel}" style="width:${overallPct}%"></div>
          </div>
          <div class="diag-coverage-stats">
            ${tokenPct !== null ? `<span class="diag-coverage-stat"><strong>${tokenPct}%</strong> tokens</span>` : ''}
            ${compPct !== null ? `<span class="diag-coverage-stat"><strong>${compPct}%</strong> components</span>` : ''}
            <span class="diag-coverage-stat"><strong>${issueCount}</strong> issue${issueCount !== 1 ? 's' : ''}</span>
          </div>
          ${this.hasScanned ? (() => {
            const hasIssues = issueCount > 0;
            const disabled = !hasIssues || this.aiBusy;
            const label = this.aiBusy
              ? 'Thinking…'
              : hasIssues
                ? `✨ Suggest Fix with AI (${issueCount})`
                : '✨ All clean — nothing to suggest';
            return `
              <div style="display:flex;gap:6px;margin-top:10px">
                <button class="diag-scan-btn diag-scan-btn--primary"
                        ${disabled ? 'disabled' : `data-action="suggestAIFix"`}
                        style="flex:1;${disabled ? 'opacity:0.45;cursor:not-allowed' : ''}"
                        title="${hasIssues ? 'Send these gaps to Claude for a CSS patch' : 'No gaps detected on this page — try another page'}">
                  ${label}
                </button>
              </div>`;
          })() : ''}
        </div>`;
    }

    _tokenFixesSection() {
      const fr = this.fixReport;
      if (!fr?.tokenFixes?.fixes?.length) return '';

      return `
        <div class="diag-section" data-section="tokenFixes">
          <div class="diag-section-header">
            <span class="diag-section-title">Token Gaps</span>
            <span class="diag-section-badge">
              <span class="diag-section-badge-item is-gap">${fr.tokenFixes.fixes.length}</span>
            </span>
            <button class="diag-copy-inline" data-action="suggestAIFix" title="Ask Claude to generate a patch from these gaps">${this.aiBusy ? 'Thinking…' : 'Suggest Fix with AI'}</button>
            <button class="diag-copy-inline" data-action="copyTokenFixes" title="Copy CSS for Connectry to fix in engine">Copy for Connectry</button>
            <span class="diag-section-chevron">${ICONS.chevron}</span>
          </div>
          <div class="diag-section-body">
            <div class="diag-route-hint">Standard tokens — copy &amp; send to Connectry for permanent engine fix</div>
            ${fr.tokenFixes.fixes.map(f => this._fixRowHTML(f)).join('')}
            ${fr.tokenFixes.unknownGaps.length ? `<div class="diag-gaps-desc" style="padding:6px 0 2px;opacity:0.5">${fr.tokenFixes.unknownGaps.length} unmapped: ${fr.tokenFixes.unknownGaps.slice(0, 3).join(', ')}${fr.tokenFixes.unknownGaps.length > 3 ? '...' : ''}</div>` : ''}
          </div>
        </div>`;
    }

    _componentIssuesSection() {
      const s = this.componentResults.summary;
      const cr = this.componentResults;
      const activeStandard = Object.entries(cr.standard)
        .filter(([, v]) => v.found > 0 && (v.unstyled > 0 || v.partial > 0));

      // Managed packages (third-party AppExchange)
      const managedIssues = cr.managed?.length > 0;

      if (!activeStandard.length && !s.totalHardcoded && !managedIssues) return '';

      let html = `
        <div class="diag-section" data-section="componentIssues">
          <div class="diag-section-header">
            <span class="diag-section-title">Standard / Managed</span>
            <span class="diag-section-badge">
              ${s.totalUnstyled ? `<span class="diag-section-badge-item is-fail">${s.totalUnstyled} unstyled</span>` : ''}
              ${s.totalPartial ? `<span class="diag-section-badge-item is-gap">${s.totalPartial} partial</span>` : ''}
              ${cr.managed?.length ? `<span class="diag-section-badge-item is-gap">${cr.managed.length} pkg</span>` : ''}
            </span>
            <span class="diag-section-chevron">${ICONS.chevron}</span>
          </div>
          <div class="diag-section-body">
            <div class="diag-route-hint">Standard SF &amp; managed package issues — Connectry engine fixes</div>`;

      if (activeStandard.length) {
        html += activeStandard.map(([type, data]) => this._componentRowHTML(type, data)).join('');
      }

      if (cr.managed?.length) {
        const pkgNames = [...new Set(cr.managed.map(m => m.packageName))];
        html += `<div class="diag-gaps-desc" style="padding:6px 0 2px">Managed packages: <strong>${pkgNames.join(', ')}</strong> (${cr.managed.length} components)</div>`;
        html += cr.managed.map(c => this._customComponentRowHTML(c)).join('');
      }

      if (s.totalHardcoded > 0) {
        html += `<div class="diag-gaps-desc" style="padding:6px 0 2px">${s.totalHardcoded} element${s.totalHardcoded > 1 ? 's' : ''} use inline colors the theme can't reach.</div>`;
      }

      html += '</div></div>';
      return html;
    }

    _lwcPatchesSection() {
      const patches = this.fixReport.componentPatches;
      if (!patches?.length) return '';

      return `
        <div class="diag-section" data-section="lwcPatches">
          <div class="diag-section-header">
            <span class="diag-section-title">Custom LWCs</span>
            <span class="diag-section-badge">
              <span class="diag-section-badge-item is-pass">${patches.length} fixable</span>
            </span>
            <button class="diag-copy-inline" data-action="copyComponentPatches" title="Copy CSS patches">Copy CSS</button>
            <span class="diag-section-chevron">${ICONS.chevron}</span>
          </div>
          <div class="diag-section-body">
            <div class="diag-route-hint">Your org's custom components — click Enable to apply a local patch</div>
            ${patches.map(p => this._patchRowHTML(p)).join('')}
          </div>
        </div>`;
    }

    _activePatchesSection() {
      if (!this.patchSummary?.total) return '';

      return `
        <div class="diag-section is-open" data-section="activePatches">
          <div class="diag-section-header">
            <span class="diag-section-title">Active Patches</span>
            <span class="diag-section-badge">
              <span class="diag-section-badge-item is-pass">${this.patchSummary.enabled} on</span>
              ${this.patchSummary.disabled > 0 ? `<span class="diag-section-badge-item is-fail">${this.patchSummary.disabled} off</span>` : ''}
            </span>
            <span class="diag-section-chevron">${ICONS.chevron}</span>
          </div>
          <div class="diag-section-body">
            ${this.patchSummary.tags.map(t => this._activePatchRowHTML(t)).join('')}
          </div>
        </div>`;
    }

    _testingChecklistSection() {
      if (!ns.PAGE_TYPES || !this.testingProgress) return '';

      const summary = ns.getCompletionSummary(this.testingProgress);
      const currentPage = ns.detectPageType?.();
      const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
      const level = pct >= 80 ? 'good' : pct >= 40 ? 'ok' : 'bad';

      // Group items by group field
      const lightningItems = summary.items.filter(i => (i.group || 'lightning') === 'lightning');
      const setupItems = summary.items.filter(i => i.group === 'setup');

      const lightningDone = lightningItems.filter(i => i.completed).length;
      const setupDone = setupItems.filter(i => i.completed).length;

      let html = '';

      // Lightning section
      html += `
        <div class="diag-section is-open" data-section="testLightning">
          <div class="diag-section-header">
            <span class="diag-section-title">Lightning Pages</span>
            <span class="diag-section-badge">
              <span class="diag-section-badge-item is-${lightningDone >= lightningItems.length ? 'pass' : lightningDone > 0 ? 'gap' : 'fail'}">${lightningDone}/${lightningItems.length}</span>
            </span>
            <span class="diag-section-chevron">${ICONS.chevron}</span>
          </div>
          <div class="diag-section-body">
            <div class="diag-test-checklist">
              ${lightningItems.map(item => this._testItemHTML(item, currentPage)).join('')}
            </div>
          </div>
        </div>`;

      // Setup section
      if (setupItems.length) {
        html += `
          <div class="diag-section${setupDone > 0 ? ' is-open' : ''}" data-section="testSetup">
            <div class="diag-section-header">
              <span class="diag-section-title">Setup Pages</span>
              <span class="diag-section-badge">
                <span class="diag-section-badge-item is-${setupDone >= setupItems.length ? 'pass' : setupDone > 0 ? 'gap' : 'fail'}">${setupDone}/${setupItems.length}</span>
              </span>
              <span class="diag-section-chevron">${ICONS.chevron}</span>
            </div>
            <div class="diag-section-body">
              <div class="diag-test-checklist">
                ${setupItems.map(item => this._testItemHTML(item, currentPage)).join('')}
              </div>
            </div>
          </div>`;
      }

      // Total progress + reset
      if (summary.completed > 0) {
        html += `
          <div class="diag-test-total">
            <span class="diag-test-total-label">Total: ${summary.completed}/${summary.total} pages scanned</span>
            <button class="diag-test-reset" data-action="resetProgress">Reset</button>
          </div>`;
      }

      return html;
    }

    _testItemHTML(item, currentPage) {
      const isCurrent = currentPage && item.id === currentPage.id;
      const statusClass = item.completed ? 'is-done' : isCurrent ? 'is-current' : 'is-pending';
      const tokenPct = item.result?.tokenCoverage != null ? `${Math.round(item.result.tokenCoverage * 100)}%` : '';
      const compPct = item.result?.componentHealth != null ? `${Math.round(item.result.componentHealth)}%` : '';

      // Format last-scanned date
      let dateStr = '';
      if (item.result?.timestamp) {
        const d = new Date(item.result.timestamp);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        dateStr = isToday
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }

      return `
        <div class="diag-test-item ${statusClass}" data-test-id="${item.id}">
          <span class="diag-test-check">
            ${item.completed
              ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="var(--dp-good, #22c55e)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
              : isCurrent
                ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="3" fill="var(--dp-accent, #4a6fa5)"/></svg>'
                : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke="var(--dp-text-3, rgba(255,255,255,0.15))" stroke-width="1.2"/></svg>'
            }
          </span>
          <span class="diag-test-label">${this._escapeHtml(item.label)}</span>
          ${item.manual ? '<span class="diag-test-manual" data-tooltip="This element is transient — open it on screen, then click Scan to capture it.">manual</span>' : ''}
          ${dateStr ? `<span class="diag-test-date">${dateStr}</span>` : ''}
          ${tokenPct ? `<span class="diag-test-score">${tokenPct}</span>` : ''}
          ${compPct ? `<span class="diag-test-score is-comp">${compPct}</span>` : ''}
        </div>`;
    }

    _resultsHTML() {
      const r = this.scanResults;
      if (!r) return this._emptyHTML();

      const pct = Math.round(r.coverage * 100);
      const level = pct >= 90 ? 'good' : pct >= 60 ? 'ok' : 'bad';

      let html = '';

      // Coverage meter
      html += `
        <div class="diag-coverage">
          <div class="diag-coverage-header">
            <span class="diag-coverage-label">Token Coverage</span>
            <span class="diag-coverage-pct is-${level}">${pct}%</span>
          </div>
          <div class="diag-coverage-bar">
            <div class="diag-coverage-fill is-${level}" style="width:${pct}%"></div>
          </div>
          <div class="diag-coverage-stats">
            <span class="diag-coverage-stat"><strong>${r.summary.provided}</strong> provided</span>
            <span class="diag-coverage-stat"><strong>${r.summary.total}</strong> total</span>
            <span class="diag-coverage-stat"><strong>${r.summary.pageUsesCount}</strong> used on page</span>
          </div>
        </div>`;

      // Gaps callout (if any)
      if (r.gaps.length > 0) {
        html += `
          <div class="diag-gaps-callout">
            <div class="diag-gaps-title">${r.gaps.length} gap${r.gaps.length > 1 ? 's' : ''} detected</div>
            <div class="diag-gaps-desc">Salesforce uses these tokens on this page, but your theme doesn't override them.</div>
            <div class="diag-gaps-list">
              ${r.gaps.map(g => `<span class="diag-gap-chip">${this._escapeHtml(g)}</span>`).join('')}
            </div>
          </div>`;
      }

      // Token sections
      for (const [key, cat] of Object.entries(r.categories)) {
        const passCount = cat.tokens.filter(t => t.provided).length;
        const failCount = cat.tokens.filter(t => !t.provided && !t.usedByPage).length;
        const gapCount = cat.tokens.filter(t => !t.provided && t.usedByPage).length;

        html += `
          <div class="diag-section" data-section="${key}">
            <div class="diag-section-header">
              <span class="diag-section-title">${this._escapeHtml(cat.label)}</span>
              <span class="diag-section-badge">
                ${passCount ? `<span class="diag-section-badge-item is-pass">${passCount} set</span>` : ''}
                ${gapCount ? `<span class="diag-section-badge-item is-gap">${gapCount} gap</span>` : ''}
                ${failCount ? `<span class="diag-section-badge-item is-fail">${failCount} unset</span>` : ''}
              </span>
              <span class="diag-section-chevron">${ICONS.chevron}</span>
            </div>
            <div class="diag-section-body">
              ${cat.tokens.map(t => this._tokenRowHTML(t)).join('')}
            </div>
          </div>`;
      }

      return html;
    }

    /** Single unified view — no tabs. Everything in one scroll. */
    _unifiedResultsHTML() {
      if (!this.hasScanned) return this._emptyHTML();

      let html = '';

      // ── 1. Health summary (token coverage + component health combined) ──
      html += this._healthSummaryHTML();

      // ── 1b. AI suggestion card (if present or in progress) ──
      if (this.aiSuggestion || this.aiBusy) html += this._aiSuggestionHTML();

      // ── 2. Issues: token gaps with inline fixes ──
      if (this.fixReport?.tokenFixes?.fixes?.length > 0) {
        html += this._tokenFixesSection();
      }

      // ── 3. Issues: component problems ──
      if (this.componentResults) {
        const s = this.componentResults.summary;
        if (s.totalUnstyled > 0 || s.totalPartial > 0 || s.totalHardcoded > 0) {
          html += this._componentIssuesSection();
        }
      }

      // ── 4. Custom LWC patches (with Enable buttons) ──
      if (this.fixReport?.componentPatches?.length > 0) {
        html += this._lwcPatchesSection();
      }

      // ── 5. Active patches ──
      if (this.patchSummary?.total > 0) {
        html += this._activePatchesSection();
      }

      // ── 6. Testing checklist (always visible) ──
      html += this._testingChecklistSection();

      // ── 7. Copy all fixes button ──
      if (this.fixReport?.fullCSS) {
        const total = (this.fixReport.summary?.tokenGapsFixed || 0) + (this.fixReport.summary?.componentsPatched || 0);
        if (total > 0) {
          html += `
            <div class="diag-fix-actions">
              <button class="diag-scan-btn diag-scan-btn--primary" data-action="copyFullCSS" style="width:100%">
                ${ICONS.copy}
                <span>Copy All Fixes (${total} rules)</span>
              </button>
            </div>`;
        }
      }

      return html;
    }

    _emptyComponentHTML() {
      return `
        <div class="diag-empty">
          <div class="diag-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
            </svg>
          </div>
          <div class="diag-empty-title">No component scan yet</div>
          <div class="diag-empty-desc">Scans the page for SLDS components, custom LWCs, and managed package elements to check theme coverage.</div>
        </div>`;
    }

    _componentResultsHTML() {
      const r = this.componentResults;
      if (!r) return this._emptyComponentHTML();

      const s = r.summary;
      let html = '';

      // Summary header
      const healthPct = s.totalStandardFound > 0
        ? Math.round(((s.totalStyled + s.totalPartial * 0.5) / s.totalStandardFound) * 100)
        : 100;
      const level = healthPct >= 85 ? 'good' : healthPct >= 60 ? 'ok' : 'bad';

      html += `
        <div class="diag-coverage">
          <div class="diag-coverage-header">
            <span class="diag-coverage-label">Component Health</span>
            <span class="diag-coverage-pct is-${level}">${healthPct}%</span>
          </div>
          <div class="diag-coverage-bar">
            <div class="diag-coverage-fill is-${level}" style="width:${healthPct}%"></div>
          </div>
          <div class="diag-coverage-stats">
            <span class="diag-coverage-stat"><strong>${s.totalStyled}</strong> styled</span>
            <span class="diag-coverage-stat"><strong>${s.totalPartial}</strong> partial</span>
            <span class="diag-coverage-stat"><strong>${s.totalUnstyled}</strong> unstyled</span>
          </div>
        </div>`;

      // Standard components section
      const activeStandard = Object.entries(r.standard).filter(([, v]) => v.found > 0);
      if (activeStandard.length > 0) {
        html += `
          <div class="diag-section is-open" data-section="standard">
            <div class="diag-section-header">
              <span class="diag-section-title">Standard Components</span>
              <span class="diag-section-badge">
                <span class="diag-section-badge-item is-pass">${s.standardTypes} types</span>
                <span class="diag-section-badge-item ${s.totalUnstyled ? 'is-fail' : 'is-pass'}">${s.totalStandardFound} found</span>
              </span>
              <span class="diag-section-chevron">${ICONS.chevron}</span>
            </div>
            <div class="diag-section-body">
              ${activeStandard.map(([type, data]) => this._componentRowHTML(type, data)).join('')}
            </div>
          </div>`;
      }

      // Custom LWCs section
      if (r.custom.length > 0) {
        html += `
          <div class="diag-section" data-section="custom">
            <div class="diag-section-header">
              <span class="diag-section-title">Custom LWCs</span>
              <span class="diag-section-badge">
                <span class="diag-section-badge-item is-gap">${r.custom.length} found</span>
              </span>
              <span class="diag-section-chevron">${ICONS.chevron}</span>
            </div>
            <div class="diag-section-body">
              ${r.custom.map(c => this._customComponentRowHTML(c)).join('')}
            </div>
          </div>`;
      }

      // Managed packages section
      if (r.managed.length > 0) {
        const pkgNames = [...new Set(r.managed.map(m => m.packageName))];
        html += `
          <div class="diag-section" data-section="managed">
            <div class="diag-section-header">
              <span class="diag-section-title">Managed Packages</span>
              <span class="diag-section-badge">
                <span class="diag-section-badge-item is-gap">${pkgNames.join(', ')}</span>
              </span>
              <span class="diag-section-chevron">${ICONS.chevron}</span>
            </div>
            <div class="diag-section-body">
              ${r.managed.map(c => this._customComponentRowHTML(c)).join('')}
            </div>
          </div>`;
      }

      // Hardcoded color warnings
      if (s.totalHardcoded > 0) {
        html += `
          <div class="diag-gaps-callout">
            <div class="diag-gaps-title">${s.totalHardcoded} hardcoded color${s.totalHardcoded > 1 ? 's' : ''} detected</div>
            <div class="diag-gaps-desc">These elements use inline color values instead of CSS tokens. The theme can't reach them.</div>
          </div>`;
      }

      return html;
    }

    _componentRowHTML(type, data) {
      const total = data.styled + data.partial + data.unstyled;
      const pct = total > 0 ? Math.round((data.styled / total) * 100) : 100;
      const status = pct >= 90 ? 'pass' : pct >= 50 ? 'gap' : 'fail';

      return `
        <div class="diag-token-row">
          <span class="diag-token-status is-${status}"></span>
          <span class="diag-token-name" style="font-family:inherit;font-size:11px">${this._escapeHtml(data.label)}</span>
          <span class="diag-comp-counts">
            <span class="diag-comp-count is-styled">${data.styled}</span>
            ${data.partial ? `<span class="diag-comp-count is-partial">${data.partial}</span>` : ''}
            ${data.unstyled ? `<span class="diag-comp-count is-unstyled">${data.unstyled}</span>` : ''}
          </span>
          <span class="diag-token-value">${data.found} found</span>
        </div>`;
    }

    _customComponentRowHTML(comp) {
      const hasIssues = comp.styling?.usesDefaults || comp.styling?.hardcodedIssues?.length > 0;
      const status = !comp.styling ? 'gap' : hasIssues ? 'gap' : 'pass';

      return `
        <div class="diag-token-row">
          <span class="diag-token-status is-${status}"></span>
          <span class="diag-token-name">&lt;${this._escapeHtml(comp.tag)}&gt;</span>
          ${comp.packageName ? `<span class="diag-comp-pkg">${this._escapeHtml(comp.packageName)}</span>` : ''}
          <span class="diag-token-value">${comp.count}x</span>
        </div>`;
    }

    _testingTabHTML() {
      if (!ns.PAGE_TYPES || !this.testingProgress) {
        return `
          <div class="diag-empty">
            <div class="diag-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="diag-empty-title">Loading...</div>
          </div>`;
      }

      const summary = ns.getCompletionSummary(this.testingProgress);
      const currentPage = ns.detectPageType?.();
      const nextSuggestion = ns.suggestNext(this.testingProgress);

      let html = '';

      // Progress bar
      const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
      const level = pct >= 80 ? 'good' : pct >= 40 ? 'ok' : 'bad';

      html += `
        <div class="diag-coverage">
          <div class="diag-coverage-header">
            <span class="diag-coverage-label">Testing Progress</span>
            <span class="diag-coverage-pct is-${level}">${summary.completed}/${summary.total}</span>
          </div>
          <div class="diag-coverage-bar">
            <div class="diag-coverage-fill is-${level}" style="width:${pct}%"></div>
          </div>
        </div>`;

      // Current page detection
      if (currentPage) {
        const alreadyDone = this.testingProgress[currentPage.id]?.completed;
        html += `
          <div class="diag-test-current">
            <span class="diag-test-current-label">Current page</span>
            <span class="diag-test-current-name">${this._escapeHtml(currentPage.label)}</span>
            ${alreadyDone
              ? '<span class="diag-test-current-status is-done">Tested</span>'
              : '<span class="diag-test-current-status is-pending">Not yet tested</span>'
            }
          </div>`;
      }

      // Next suggestion
      if (nextSuggestion && (!currentPage || nextSuggestion.id !== currentPage.id)) {
        html += `
          <div class="diag-test-hint">
            <span class="diag-test-hint-label">Next:</span>
            <span class="diag-test-hint-text">${this._escapeHtml(nextSuggestion.hint)}</span>
          </div>`;
      }

      // Checklist
      html += '<div class="diag-test-checklist">';
      for (const item of summary.items) {
        const isCurrent = currentPage && item.id === currentPage.id;
        const statusClass = item.completed ? 'is-done' : isCurrent ? 'is-current' : 'is-pending';
        const tokenPct = item.result?.tokenCoverage != null ? `${Math.round(item.result.tokenCoverage * 100)}%` : '';
        const compPct = item.result?.componentHealth != null ? `${Math.round(item.result.componentHealth)}%` : '';

        html += `
          <div class="diag-test-item ${statusClass}" data-test-id="${item.id}">
            <span class="diag-test-check">
              ${item.completed
                ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="#22c55e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                : isCurrent
                  ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="3" fill="#4a6fa5"/></svg>'
                  : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke="rgba(255,255,255,0.15)" stroke-width="1.2"/></svg>'
              }
            </span>
            <span class="diag-test-label">${this._escapeHtml(item.label)}</span>
            ${item.manual ? '<span class="diag-test-manual">manual</span>' : ''}
            ${tokenPct ? `<span class="diag-test-score">${tokenPct}</span>` : ''}
            ${compPct ? `<span class="diag-test-score is-comp">${compPct}</span>` : ''}
          </div>`;
      }
      html += '</div>';

      // Reset button
      if (summary.completed > 0) {
        html += `
          <div class="diag-test-actions">
            <button class="diag-test-reset" data-action="resetProgress">Reset progress for this theme</button>
          </div>`;
      }

      return html;
    }

    // ── Fixes tab ──────────────────────────────────────────────────────────

    _fixesTabHTML() {
      if (!this.fixReport && !this.patchSummary) {
        return `
          <div class="diag-empty">
            <div class="diag-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="diag-empty-title">No fixes generated yet</div>
            <div class="diag-empty-desc">Run a scan first, then hit "Generate Fixes" to auto-generate CSS rules for any gaps found.</div>
          </div>`;
      }

      let html = '';
      const fr = this.fixReport;

      if (fr) {
        // Summary
        const total = fr.summary.tokenGapsFixed + fr.summary.componentsPatched;
        html += `
          <div class="diag-coverage">
            <div class="diag-coverage-header">
              <span class="diag-coverage-label">Auto-Generated Fixes</span>
              <span class="diag-coverage-pct is-${total > 0 ? 'ok' : 'good'}">${total}</span>
            </div>
            <div class="diag-coverage-stats">
              <span class="diag-coverage-stat"><strong>${fr.summary.tokenGapsFixed}</strong> token fixes</span>
              <span class="diag-coverage-stat"><strong>${fr.summary.componentsPatched}</strong> component patches</span>
              <span class="diag-coverage-stat"><strong>${fr.summary.tokenGapsUnknown}</strong> unmapped</span>
            </div>
          </div>`;

        // Token gap fixes section
        if (fr.tokenFixes.fixes.length > 0) {
          html += `
            <div class="diag-section is-open" data-section="tokenFixes">
              <div class="diag-section-header">
                <span class="diag-section-title">Token Gap Fixes</span>
                <span class="diag-section-badge">
                  <span class="diag-section-badge-item is-pass">${fr.tokenFixes.fixes.length} rules</span>
                </span>
                <button class="diag-copy-inline" data-action="copyTokenFixes" title="Copy CSS to clipboard">Copy CSS</button>
                <span class="diag-section-chevron">${ICONS.chevron}</span>
              </div>
              <div class="diag-section-body">
                ${fr.tokenFixes.fixes.map(f => this._fixRowHTML(f)).join('')}
              </div>
            </div>`;
        }

        // Unknown gaps (tokens we couldn't map)
        if (fr.tokenFixes.unknownGaps.length > 0) {
          html += `
            <div class="diag-section" data-section="unknownGaps">
              <div class="diag-section-header">
                <span class="diag-section-title">Unmapped Gaps</span>
                <span class="diag-section-badge">
                  <span class="diag-section-badge-item is-gap">${fr.tokenFixes.unknownGaps.length}</span>
                </span>
                <span class="diag-section-chevron">${ICONS.chevron}</span>
              </div>
              <div class="diag-section-body">
                <div class="diag-gaps-desc" style="padding:6px 0 4px">These tokens don't have an automatic mapping yet. Copy the report for manual review.</div>
                ${fr.tokenFixes.unknownGaps.map(g => `<div class="diag-token-row"><span class="diag-token-status is-gap"></span><span class="diag-token-name">${this._escapeHtml(g)}</span></div>`).join('')}
              </div>
            </div>`;
        }

        // Component patches section
        if (fr.componentPatches.length > 0) {
          html += `
            <div class="diag-section is-open" data-section="componentPatches">
              <div class="diag-section-header">
                <span class="diag-section-title">Custom LWC Patches</span>
                <span class="diag-section-badge">
                  <span class="diag-section-badge-item is-pass">${fr.componentPatches.length} components</span>
                </span>
                <button class="diag-copy-inline" data-action="copyComponentPatches" title="Copy CSS to clipboard">Copy CSS</button>
                <span class="diag-section-chevron">${ICONS.chevron}</span>
              </div>
              <div class="diag-section-body">
                ${fr.componentPatches.map(p => this._patchRowHTML(p)).join('')}
              </div>
            </div>`;
        }

        // Full CSS copy button
        if (fr.fullCSS) {
          html += `
            <div class="diag-fix-actions">
              <button class="diag-scan-btn diag-scan-btn--primary" data-action="copyFullCSS" style="width:100%">
                ${ICONS.copy}
                <span>Copy All Fixes (${total} rules)</span>
              </button>
            </div>`;
        }
      }

      // Active patches section
      if (this.patchSummary && this.patchSummary.total > 0) {
        html += `
          <div class="diag-section is-open" data-section="activePatches">
            <div class="diag-section-header">
              <span class="diag-section-title">Active Patches</span>
              <span class="diag-section-badge">
                <span class="diag-section-badge-item is-pass">${this.patchSummary.enabled} on</span>
                ${this.patchSummary.disabled > 0 ? `<span class="diag-section-badge-item is-fail">${this.patchSummary.disabled} off</span>` : ''}
              </span>
              <span class="diag-section-chevron">${ICONS.chevron}</span>
            </div>
            <div class="diag-section-body">
              ${this.patchSummary.tags.map(t => this._activePatchRowHTML(t)).join('')}
            </div>
          </div>`;
      }

      return html;
    }

    _fixRowHTML(fix) {
      const isColor = fix.value && /^(#|rgb|hsl)/.test(fix.value);
      const swatch = isColor
        ? `<span class="diag-token-swatch" style="background:${fix.value}"></span>`
        : '';

      return `
        <div class="diag-token-row">
          <span class="diag-token-status is-pass"></span>
          <span class="diag-token-name" title="${this._escapeHtml(fix.token)}">${this._escapeHtml(fix.token)}</span>
          ${swatch}
          <span class="diag-token-value" title="${this._escapeHtml(fix.colorKey)}">${this._escapeHtml(fix.value)}</span>
        </div>`;
    }

    _patchRowHTML(patch) {
      return `
        <div class="diag-patch-row">
          <div class="diag-patch-header">
            <span class="diag-token-status is-pass"></span>
            <span class="diag-token-name">&lt;${this._escapeHtml(patch.tag)}&gt;</span>
            <button class="diag-patch-action" data-action="savePatch" data-tag="${this._escapeHtml(patch.tag)}" title="Save & activate this patch">Enable</button>
          </div>
          <div class="diag-patch-rules">
            ${patch.rules.map(r => `<div class="diag-patch-rule">${this._escapeHtml(r.property)}: ${this._escapeHtml(r.value.slice(0, 60))}</div>`).join('')}
          </div>
        </div>`;
    }

    _activePatchRowHTML(patch) {
      return `
        <div class="diag-token-row">
          <span class="diag-token-status is-${patch.enabled ? 'pass' : 'fail'}"></span>
          <span class="diag-token-name">&lt;${this._escapeHtml(patch.tag)}&gt;</span>
          <span class="diag-comp-pkg">${patch.source}</span>
          <button class="diag-patch-toggle" data-action="togglePatch" data-tag="${this._escapeHtml(patch.tag)}" data-enabled="${patch.enabled}">${patch.enabled ? 'Disable' : 'Enable'}</button>
          <button class="diag-patch-remove" data-action="removePatch" data-tag="${this._escapeHtml(patch.tag)}" title="Remove patch">×</button>
        </div>`;
    }

    _tokenRowHTML(t) {
      const status = t.provided ? 'pass' : t.usedByPage ? 'gap' : 'fail';
      const isColor = t.value && /^(#|rgb|hsl)/.test(t.value);
      const swatch = isColor
        ? `<span class="diag-token-swatch" style="background:${t.value}"></span>`
        : '';

      return `
        <div class="diag-token-row">
          <span class="diag-token-status is-${status}"></span>
          <span class="diag-token-name" title="${this._escapeHtml(t.token)}">${this._escapeHtml(t.token)}</span>
          ${swatch}
          <span class="diag-token-value" title="${this._escapeHtml(t.value || 'not set')}">${this._escapeHtml(t.value || '—')}</span>
        </div>`;
    }

    _footerHTML() {
      return `
        <div class="diag-footer">
          <span class="diag-footer-brand">Powered by <strong>Connectry AI</strong></span>
          <div class="diag-footer-actions">
            <button class="diag-copy-btn" data-action="copyDOM" title="Copy DOM structure snapshot to clipboard">
              <span>DOM</span>
            </button>
            <button class="diag-copy-btn" data-action="copy" title="Copy scan report to clipboard">
              ${ICONS.copy}
              <span>Copy</span>
            </button>
            <button class="diag-copy-btn diag-report-btn" data-action="viewReport" title="Open full interactive report in new tab">
              <span>View Report</span>
            </button>
          </div>
        </div>`;
    }

    // ── Render: minimized badge ───────────────────────────────────────────

    _renderBadge() {
      if (!this.shadow) return;
      this.shadow.innerHTML = `
        <style>${this._cssText}</style>
        <div class="diag-badge" data-action="restore" title="Open Diagnostic Panel">
          ${ICONS.badge}
        </div>
      `;
      this.shadow.querySelector('.diag-badge').addEventListener('click', () => this.restore());
    }

    // ── Update helpers ────────────────────────────────────────────────────

    _updateInfoBar() {
      const bar = this.shadow?.querySelector('.diag-info-bar');
      if (!bar) return;
      // "on" = a theme is active. Don't use style-tag presence — flickers
      // during view transitions and gives the wrong signal.
      const themeName = this.currentTheme || 'none';
      const injected = themeName !== 'none';
      bar.outerHTML = this._infoBarHTML(themeName, injected);
    }

    // ── Event binding ─────────────────────────────────────────────────────

    _bindEvents() {
      if (!this.shadow) return;

      // Initial advanced-mode + QA-mode chip state.
      this._refreshAdvancedChip().catch(() => {});
      this._refreshQAChip().catch(() => {});

      // Action buttons
      this.shadow.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'close') this.close();
        else if (action === 'minimize') this.minimize();
        else if (action === 'togglePanelTheme') this._togglePanelTheme();
        else if (action === 'toggleAdvancedMode') this._toggleAdvancedMode(btn);
        else if (action === 'toggleQAMode') this._toggleQAMode(btn);
        else if (action === 'scanAll') this._runScanAll(btn);
        else if (action === 'scanThemesPresets') this._runMultiThemeScan('presets');
        else if (action === 'scanThemesMine') this._runMultiThemeScan('custom');
        else if (action === 'scanThemesAll') this._runMultiThemeScan('all');
        else if (action === 'toggleAutoScan') this._toggleAutoScan();
        else if (action === 'resetProgress') this._resetTestingProgress();
        else if (action === 'copyTokenFixes') this._copyTokenFixes(btn);
        else if (action === 'suggestAIFix') this._suggestAIFix(btn);
        else if (action === 'acceptAISuggestion') this._decideAISuggestion('accepted');
        else if (action === 'rejectAISuggestion') this._decideAISuggestion('rejected');
        else if (action === 'dismissAISuggestion') { this.aiSuggestion = null; this._rerender(); }
        else if (action === 'copyComponentPatches') this._copyComponentPatches(btn);
        else if (action === 'copyFullCSS') this._copyFullCSS(btn);
        else if (action === 'savePatch') this._savePatch(btn);
        else if (action === 'togglePatch') this._togglePatch(btn);
        else if (action === 'removePatch') this._removePatchAction(btn);
        else if (action === 'viewReport') this._openHTMLReport();
        else if (action === 'copy') this._copyReport(btn);
        else if (action === 'copyDOM') this._copyDOMSnapshot(btn);
      });

      // Section collapse toggles
      this.shadow.addEventListener('click', (e) => {
        const header = e.target.closest('.diag-section-header');
        if (!header) return;
        const section = header.closest('.diag-section');
        if (section) section.classList.toggle('is-open');
      });
    }

    // ── Scan execution ────────────────────────────────────────────────────

    async _runScanAll(btn) {
      // Prevent double-click
      if (this._scanning) return;
      this._scanning = true;

      btn.classList.add('is-scanning');
      const iconSpan = btn.querySelector('svg');
      const textSpan = btn.querySelector('span');
      if (iconSpan) iconSpan.outerHTML = ICONS.spinner;
      if (textSpan) textSpan.textContent = 'Scanning...';

      // Show heartbeat animation
      const hb = this.shadow?.getElementById('diagHeartbeat');
      if (hb) hb.classList.add('is-active');
      this.panel?.classList.add('is-scanning');

      // Record start time — enforce minimum 800ms so animation is visible
      const scanStart = Date.now();

      // Let the UI paint the spinner before running sync scans
      await new Promise(r => setTimeout(r, 80));

      // Load theme colors if not cached
      if (!this.themeColors) {
        await this._loadThemeColors();
      }

      // 1. Token scan
      try {
        if (ns.scanTokens) {
          this.scanResults = ns.scanTokens(this.currentTheme);
        }
      } catch (err) {
        console.error('[SFT Diag] Token scan failed:', err);
      }

      // 2. Component scan
      try {
        if (ns.scanComponents) {
          this.componentResults = ns.scanComponents();
        }
      } catch (err) {
        console.error('[SFT Diag] Component scan failed:', err);
      }

      // 3. Generate fixes
      try {
        if (ns.generateFullFixReport && this.themeColors) {
          this.fixReport = ns.generateFullFixReport(this.scanResults, this.componentResults, this.themeColors);
        }
      } catch (_) {}

      // 4. Load patch summary
      try {
        if (ns.getPatchSummary) {
          this.patchSummary = await ns.getPatchSummary();
        }
      } catch (_) {}

      // 5. Save testing progress
      const pageType = ns.detectPageType?.();
      if (pageType && ns.saveTestResult) {
        const tokenCoverage = this.scanResults?.coverage || null;
        const s = this.componentResults?.summary;
        const componentHealth = s && s.totalStandardFound > 0
          ? ((s.totalStyled + s.totalPartial * 0.5) / s.totalStandardFound) * 100
          : null;

        await ns.saveTestResult(this.currentTheme, pageType.id, {
          tokenCoverage,
          componentHealth,
        });
        this.testingProgress = await ns.getTestingProgress?.(this.currentTheme) || {};
      }

      this.hasScanned = true;
      this._lastScanTime = new Date();

      // Wait for minimum animation time so heartbeat is visible
      const elapsed = Date.now() - scanStart;
      if (elapsed < 800) {
        await new Promise(r => setTimeout(r, 800 - elapsed));
      }

      // Stop heartbeat
      const hb2 = this.shadow?.getElementById('diagHeartbeat');
      if (hb2) hb2.classList.remove('is-active');
      this.panel?.classList.remove('is-scanning');

      // Re-render unified view
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._unifiedResultsHTML();

      // Update info bar
      this._updateInfoBar();

      // Show success state on scan button, then reset
      const scanBar = this.shadow?.querySelector('.diag-scan-bar');
      if (scanBar) {
        scanBar.innerHTML = `
          <button class="diag-scan-btn diag-scan-btn--success" style="width:100%" disabled>
            <svg viewBox="0 0 14 14" fill="none" width="14" height="14"><path d="M3 7l3 3 5-5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Scanned</span>
          </button>`;
        // After 1.2s, swap back to the real Re-Scan button
        setTimeout(() => {
          const bar = this.shadow?.querySelector('.diag-scan-bar');
          if (bar) bar.outerHTML = this._scanBarHTML();
        }, 1200);
      }

      this._scanning = false;
    }

    // ── Multi-theme scan ───────────────────────────────────────────────────
    // Cycles through N themes, applies each, scans tokens+components, then
    // restores the user's original theme. Non-destructive: no state saved.

    async _runMultiThemeScan(mode) {
      if (this._scanning || this._multiScanning) return;
      this._multiScanning = true;
      this._multiScanAborted = false;

      // Build theme list based on mode
      const presets = (await ns.listPresetThemes?.()) || [];
      const customs = (await ns.listCustomThemes?.()) || [];
      let themes;
      if (mode === 'presets') themes = presets;
      else if (mode === 'custom') themes = customs;
      else themes = [...presets, ...customs];

      if (!themes.length) {
        this._multiScanning = false;
        this._showMultiScanEmpty(mode);
        return;
      }

      const originalTheme = this.currentTheme;
      const results = [];

      // Replace results area with progress view
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._multiScanProgressHTML(0, themes.length, themes[0]?.name || '');

      for (let i = 0; i < themes.length; i++) {
        if (this._multiScanAborted) break;
        const theme = themes[i];

        // Update progress
        if (resultsEl) resultsEl.innerHTML = this._multiScanProgressHTML(i, themes.length, theme.name);

        // Apply theme (fire-and-wait)
        try {
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'setTheme', theme: theme.id }, () => resolve());
          });
        } catch (_) {}

        // Let the view transition + CSS inject settle
        await new Promise(r => setTimeout(r, 500));

        // Scan this theme
        let tokenResults = null, componentResults = null;
        try { tokenResults = ns.scanTokens?.(theme.id); } catch (_) {}
        try { componentResults = ns.scanComponents?.(); } catch (_) {}

        const coverage = tokenResults?.coverage ?? null;
        const gaps = tokenResults?.summary?.gaps ?? null;
        const cs = componentResults?.summary;
        const totalFound = cs?.totalStandardFound || 0;
        const componentHealth = totalFound > 0
          ? ((cs.totalStyled + cs.totalPartial * 0.5) / totalFound) * 100
          : null;

        results.push({
          id: theme.id,
          name: theme.name,
          coverage: coverage != null ? Math.round(coverage * 100) : null,
          gaps,
          componentHealth: componentHealth != null ? Math.round(componentHealth) : null,
          styled: cs?.totalStyled ?? 0,
          partial: cs?.totalPartial ?? 0,
          unstyled: cs?.totalUnstyled ?? 0,
          total: totalFound,
        });
      }

      // Restore user's original theme
      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'setTheme', theme: originalTheme }, () => resolve());
        });
      } catch (_) {}

      this._multiScanning = false;
      this._multiScanResults = { mode, results, ranAt: new Date() };

      // Render the matrix
      const el = this.shadow?.querySelector('.diag-results');
      if (el) el.innerHTML = this._multiScanResultsHTML();
    }

    _multiScanProgressHTML(done, total, currentName) {
      const pct = Math.round((done / total) * 100);
      return `
        <div class="diag-card" style="padding:14px">
          <div style="font-weight:600;margin-bottom:8px">Scanning ${total} themes…</div>
          <div style="font-size:12px;opacity:0.7;margin-bottom:6px">
            ${done} / ${total} — currently: <strong>${this._escapeHtml(currentName || '')}</strong>
          </div>
          <div style="height:6px;background:rgba(128,128,128,0.15);border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--diag-accent,#4a6fa5);transition:width 200ms"></div>
          </div>
          <div style="font-size:11px;opacity:0.6;margin-top:8px">Your original theme will be restored when done.</div>
        </div>`;
    }

    _multiScanResultsHTML() {
      const { mode, results } = this._multiScanResults || {};
      if (!results?.length) return '<div class="diag-card" style="padding:14px">No themes scanned.</div>';

      // Sort: best coverage first, then component health
      const sorted = [...results].sort((a, b) => {
        if ((b.coverage ?? -1) !== (a.coverage ?? -1)) return (b.coverage ?? -1) - (a.coverage ?? -1);
        return (b.componentHealth ?? -1) - (a.componentHealth ?? -1);
      });

      const modeLabel = mode === 'presets' ? 'Presets' : mode === 'custom' ? 'My Themes' : 'All Themes';
      const avgCoverage = Math.round(
        sorted.reduce((s, r) => s + (r.coverage || 0), 0) / sorted.length
      );

      const rows = sorted.map(r => {
        const covClass = r.coverage >= 100 ? 'pass' : r.coverage >= 95 ? 'warn' : 'fail';
        const healthClass = r.componentHealth >= 80 ? 'pass' : r.componentHealth >= 50 ? 'warn' : 'fail';
        return `
          <tr>
            <td style="padding:6px 8px;font-weight:500">${this._escapeHtml(r.name)}</td>
            <td style="padding:6px 8px;text-align:right" class="diag-cov-${covClass}">${r.coverage != null ? r.coverage + '%' : '—'}</td>
            <td style="padding:6px 8px;text-align:right;opacity:0.8">${r.gaps != null ? r.gaps : '—'}</td>
            <td style="padding:6px 8px;text-align:right" class="diag-cov-${healthClass}">${r.componentHealth != null ? r.componentHealth + '%' : '—'}</td>
            <td style="padding:6px 8px;text-align:right;opacity:0.7;font-size:11px">${r.styled}/${r.total}</td>
          </tr>`;
      }).join('');

      return `
        <div class="diag-card" style="padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div>
              <div style="font-weight:600">${modeLabel} scan — ${sorted.length} themes</div>
              <div style="font-size:11px;opacity:0.7;margin-top:2px">Avg coverage: ${avgCoverage}% · ${location.pathname.slice(0,60)}</div>
            </div>
            <button class="diag-scan-btn" data-action="scanThemesPresets" style="font-size:11px;padding:4px 10px">Re-run</button>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="border-bottom:1px solid rgba(128,128,128,0.2);opacity:0.7;font-size:11px">
                <th style="padding:6px 8px;text-align:left">Theme</th>
                <th style="padding:6px 8px;text-align:right">Tokens</th>
                <th style="padding:6px 8px;text-align:right">Gaps</th>
                <th style="padding:6px 8px;text-align:right">Health</th>
                <th style="padding:6px 8px;text-align:right">Styled</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    _showMultiScanEmpty(mode) {
      const el = this.shadow?.querySelector('.diag-results');
      if (!el) return;
      const msg = mode === 'custom'
        ? 'No custom themes yet. Create one in the Builder to include it in scans.'
        : 'No themes found.';
      el.innerHTML = `<div class="diag-card" style="padding:14px">${msg}</div>`;
    }

    async _resetTestingProgress() {
      if (ns.clearTestingProgress) {
        await ns.clearTestingProgress(this.currentTheme);
      }
      this.testingProgress = {};
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._unifiedResultsHTML();
    }

    // ── Patch management ─────────────────────────────────────────────────

    async _copyTokenFixes(btn) {
      if (!this.fixReport?.tokenFixes?.css) return;
      await this._clipboardCopy(this.fixReport.tokenFixes.css, btn, 'Copy CSS');
    }

    async _copyComponentPatches(btn) {
      if (!this.fixReport?.componentPatches?.length) return;
      const css = this.fixReport.componentPatches.map(p => p.css).join('\n\n');
      await this._clipboardCopy(css, btn, 'Copy CSS');
    }

    async _copyFullCSS(btn) {
      if (!this.fixReport?.fullCSS) return;
      const textSpan = btn.querySelector('span');
      await this._clipboardCopy(this.fixReport.fullCSS, btn, textSpan?.textContent || 'Copy All Fixes');
    }

    // ── AI suggestion (Connectry Intelligence Layer) ─────────────────────

    _rerender() {
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._unifiedResultsHTML();
    }

    _aiSuggestionHTML() {
      const s = this.aiSuggestion;
      if (!s && this.aiBusy) {
        return `
          <div class="diag-card" style="padding:14px;border-left:3px solid #4A6FA5;margin-bottom:10px">
            <div style="font-weight:600;margin-bottom:4px">AI suggestion in progress…</div>
            <div style="font-size:11px;opacity:0.7">${this._escapeHtml(this.aiProgress || 'Working…')}</div>
          </div>`;
      }
      if (!s) return '';
      if (s.error) {
        return `
          <div class="diag-card" style="padding:14px;border-left:3px solid #b91c1c;margin-bottom:10px">
            <div style="font-weight:600;margin-bottom:4px">AI suggestion failed</div>
            <div style="font-size:11px;opacity:0.7">${this._escapeHtml(s.error)}</div>
            <button class="diag-copy-inline" data-action="dismissAISuggestion" style="margin-top:8px">Dismiss</button>
          </div>`;
      }
      const out = s.output || {};
      const css = out.patch_css || '';
      const isPending = s.status === 'pending';
      const statusBadge = s.status === 'accepted'
        ? '<span class="diag-section-badge-item is-pass">accepted</span>'
        : s.status === 'rejected'
          ? '<span class="diag-section-badge-item is-fail">rejected</span>'
          : '<span class="diag-section-badge-item is-gap">pending review</span>';
      return `
        <div class="diag-card" style="padding:14px;border-left:3px solid #4A6FA5;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-weight:600">AI suggestion #${s.id} ${statusBadge}</div>
            <div style="font-size:11px;opacity:0.6">${this._escapeHtml(out.risk || '')} risk · ${(out.affected_components || []).join(', ')}</div>
          </div>
          ${out.notes ? `<div style="font-size:11px;opacity:0.75;margin-bottom:8px">${this._escapeHtml(out.notes)}</div>` : ''}
          <pre style="background:#0a0a0a;color:#d4d4d8;padding:8px;border-radius:4px;font-size:10px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word">${this._escapeHtml(css)}</pre>
          ${isPending ? `
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="diag-scan-btn diag-scan-btn--primary" data-action="acceptAISuggestion">Accept &amp; publish</button>
              <button class="diag-copy-inline" data-action="rejectAISuggestion">Reject</button>
              <button class="diag-copy-inline" data-action="dismissAISuggestion">Dismiss</button>
            </div>` : `
            <div style="margin-top:8px">
              <button class="diag-copy-inline" data-action="dismissAISuggestion">Dismiss</button>
            </div>`}
        </div>`;
    }

    async _refreshAdvancedChip() {
      const intel = window.ConnectryIntel;
      if (!intel) return;
      const on = await intel.getAdvancedMode();
      const btn = this.shadow?.querySelector('[data-action="toggleAdvancedMode"]');
      if (btn) {
        btn.style.background = on ? 'rgba(124,58,237,0.25)' : '';
        btn.style.color = on ? '#a78bfa' : '';
        btn.title = on
          ? 'Advanced mode ON — sends DOM + computed styles + screenshot to AI'
          : 'Advanced mode OFF — sends only token names. Click to enable rich AI suggestions.';
      }
    }

    async _toggleAdvancedMode(btn) {
      const intel = window.ConnectryIntel;
      if (!intel) return;
      const cur = await intel.getAdvancedMode();
      await intel.setAdvancedMode(!cur);
      this._refreshAdvancedChip();
    }

    async _refreshQAChip() {
      const intel = window.ConnectryIntel;
      if (!intel) return;
      const on = await intel.getQAMode();
      const btn = this.shadow?.querySelector('[data-action="toggleQAMode"]');
      if (btn) {
        btn.style.background = on ? 'rgba(34,197,94,0.25)' : '';
        btn.style.color = on ? '#86efac' : '';
        btn.title = on
          ? 'QA mode ON — draft + published engine patches load here (HQ only). Refresh SF tab to apply.'
          : 'QA mode OFF — only published engine patches load (what customers see). Click to also preview drafts.';
      }
    }

    async _toggleQAMode(_btn) {
      const intel = window.ConnectryIntel;
      if (!intel) return;
      const cur = await intel.getQAMode();
      await intel.setQAMode(!cur);
      this._refreshQAChip();
    }

    _setAIProgress(stage) {
      this.aiProgress = stage;
      this._rerender();
    }

    /**
     * Classify a scan as 'standard' | 'managed' | 'custom' based on the
     * component-scanner output. Used to route the accept action:
     *   custom  → save locally via ns.savePatch (per-user)
     *   standard|managed → publish to app_configs (all users get on next load)
     */
    _classifyScanSource() {
      const cr = this.componentResults;
      if (!cr) return 'standard';
      if (cr.managed?.length && (!cr.summary?.totalUnstyled && !cr.summary?.totalPartial)) return 'managed';
      // Heuristic: if the only issues are custom LWCs, route local.
      const standardIssues = (cr.summary?.totalUnstyled || 0) + (cr.summary?.totalPartial || 0);
      const customIssues = (this.fixReport?.componentPatches?.length || 0);
      if (!standardIssues && !cr.managed?.length && customIssues > 0) return 'custom';
      if (cr.managed?.length) return 'managed';
      return 'standard';
    }

    async _suggestAIFix(_btn) {
      const intel = window.ConnectryIntel;
      const enrich = window.__sfThemerEnrichment;
      if (!intel) {
        this.aiSuggestion = { error: 'ConnectryIntel client not loaded' };
        this._rerender();
        return;
      }
      const consent = await intel.getConsent();
      if (!consent) {
        const ok = window.confirm(
          'AI Suggest Fix sends your scan findings to the Connectry Intelligence Layer.\n\n' +
          'Advanced mode (your local default) also sends:\n' +
          '  • DOM structure of affected elements (text content stripped)\n' +
          '  • Computed styles\n' +
          '  • A screenshot of the visible viewport\n' +
          '  • Your active theme tokens\n\n' +
          'Enable?'
        );
        if (!ok) return;
        await intel.setConsent(true);
      }

      // Combine token gaps + unstyled/partial component issues so we can run
      // even when token coverage is clean but components have issues.
      const tokenGaps = this.scanResults?.gaps || [];
      const componentGaps = [];
      const cr = this.componentResults;
      if (cr) {
        for (const [type, data] of Object.entries(cr.standard || {})) {
          if (data.unstyled > 0 || data.partial > 0) {
            componentGaps.push(`component:${type} (${data.unstyled} unstyled, ${data.partial} partial)`);
          }
        }
        for (const m of cr.managed || []) {
          componentGaps.push(`managed:${m.tag || m.packageName}`);
        }
      }
      const gaps = [...tokenGaps, ...componentGaps].slice(0, 12);
      if (!gaps.length) {
        this.aiSuggestion = { error: 'No issues to fix on this scan.' };
        this._rerender();
        return;
      }

      const advanced = await intel.getAdvancedMode();
      const source = this._classifyScanSource();
      this.aiBusy = true;
      this.aiSuggestion = null;
      this._setAIProgress(advanced ? 'Capturing screenshot…' : 'Building findings…');

      let findingsPayload;
      let screenshotDataUrl = null;
      if (advanced && enrich) {
        const built = await enrich.buildAdvancedFindings({
          gaps,
          themeColors: this.themeColors || {},
          includeScreenshot: true,
        });
        findingsPayload = built.payload;
        screenshotDataUrl = built.screenshotDataUrl;
      } else {
        findingsPayload = {
          mode: 'silent',
          gaps: gaps.map((g, i) => ({ id: `gap-${i + 1}`, token: g })),
        };
      }

      this._setAIProgress('Calling Claude (10–30s)…');

      const context = {
        themeId: this.currentTheme?.id || this._configuredThemeName || null,
        page: location.pathname,
        scan_source: source,
        activeTokens: this.themeColors || {},
      };

      const r = await intel.suggestFix({
        intent: 'gap_to_patch',
        findings: findingsPayload,
        context,
        screenshotDataUrl,
        mode: advanced ? 'advanced' : 'silent',
      });

      this.aiBusy = false;
      this.aiProgress = null;
      if (r?.error) {
        this.aiSuggestion = { error: r.error, source };
      } else {
        this.aiSuggestion = {
          id: r.suggestion_id,
          output: r.output,
          status: 'pending',
          source,
          mode: advanced ? 'advanced' : 'silent',
        };
      }
      this._rerender();
    }

    /**
     * Live-inject CSS into the current SF tab so accepted patches are visible
     * without a page refresh. Persists for next load via patch-loader.js
     * (which fetches the now-published config at document_start).
     */
    _liveInjectAcceptedCSS(css) {
      if (!css) return;
      const STYLE_ID = 'sf-themer-intel-patch';
      let el = document.getElementById(STYLE_ID);
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
      }
      el.dataset.intelSource = 'live-accepted';
      el.textContent = (el.textContent || '') + '\n\n' + css;
    }

    async _decideAISuggestion(decision) {
      const intel = window.ConnectryIntel;
      if (!intel || !this.aiSuggestion?.id) return;
      const reason = decision === 'rejected'
        ? (window.prompt('Reject reason (optional)') || null)
        : null;

      const sugg = this.aiSuggestion;
      const isCustom = sugg.source === 'custom';
      // For custom: don't publish to server — save locally instead.
      const publish = decision === 'accepted' && !isCustom;

      // SECURITY: default tier on accept is 'draft' (HQ preview only).
      // Promotion to 'published' is a separate step (SQL flip or future UI
      // button) that requires the PUBLISH_SECRET. See SECURITY.md.
      const r = await intel.decideSuggestion(sugg.id, {
        decision,
        rejectReason: reason,
        publish,
        tier: 'draft',
      });

      if (r?.error) {
        this.aiSuggestion.error = r.error;
        this._rerender();
        return;
      }

      this.aiSuggestion.status = decision;

      if (decision === 'accepted') {
        const css = sugg.output?.patch_css || '';
        if (isCustom) {
          // Save into the local patch store so it persists per-user.
          if (ns.savePatch) {
            const tag = `ai-${sugg.id}`;
            await ns.savePatch(tag, { css, rules: [], source: 'ai' }, true);
            if (ns.injectPatches) await ns.injectPatches();
            if (ns.getPatchSummary) this.patchSummary = await ns.getPatchSummary();
          } else {
            this._liveInjectAcceptedCSS(css);
          }
        } else {
          // Standard/managed: server published; also live-inject so it shows now.
          this._liveInjectAcceptedCSS(css);
        }
      }
      this._rerender();
    }

    async _savePatch(btn) {
      const tag = btn.dataset.tag;
      if (!tag || !this.fixReport) return;

      const patch = this.fixReport.componentPatches.find(p => p.tag === tag);
      if (!patch || !ns.savePatch) return;

      await ns.savePatch(tag, { css: patch.css, rules: patch.rules, source: 'auto' }, true);

      // Re-inject patches
      if (ns.injectPatches) await ns.injectPatches();

      // Refresh patch summary and re-render
      if (ns.getPatchSummary) this.patchSummary = await ns.getPatchSummary();
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._unifiedResultsHTML();

      // Visual feedback
      btn.textContent = 'Saved!';
      setTimeout(() => { btn.textContent = 'Enable'; }, 1500);
    }

    async _togglePatch(btn) {
      const tag = btn.dataset.tag;
      const currentlyEnabled = btn.dataset.enabled === 'true';
      if (!tag || !ns.togglePatch) return;

      await ns.togglePatch(tag, !currentlyEnabled);
      if (ns.injectPatches) await ns.injectPatches();
      if (ns.getPatchSummary) this.patchSummary = await ns.getPatchSummary();

      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._unifiedResultsHTML();
    }

    async _removePatchAction(btn) {
      const tag = btn.dataset.tag;
      if (!tag || !ns.removePatch) return;

      await ns.removePatch(tag);
      if (ns.injectPatches) await ns.injectPatches();
      if (ns.getPatchSummary) this.patchSummary = await ns.getPatchSummary();

      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._unifiedResultsHTML();
    }

    /** Shared clipboard helper with visual feedback. */
    async _clipboardCopy(text, btn, resetLabel) {
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('is-copied');
        const textSpan = btn.querySelector('span') || btn;
        const original = textSpan.textContent;
        textSpan.textContent = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          textSpan.textContent = resetLabel || original;
        }, 2000);
      } catch (err) {
        console.warn('[SFT Diag] Clipboard write failed:', err.message);
      }
    }

    // ── Copy report ───────────────────────────────────────────────────────

    _openHTMLReport() {
      if (!ns.openReport) {
        console.warn('[SFT Diag] Report generator not loaded');
        return;
      }
      ns.openReport({
        themeName: this.currentTheme,
        themeColors: this.themeColors,
        scanResults: this.scanResults,
        componentResults: this.componentResults,
        fixReport: this.fixReport,
        testingProgress: this.testingProgress,
        patchSummary: this.patchSummary,
      });
    }

    async _copyReport(btn) {
      if (!this.scanResults) return;

      const r = this.scanResults;
      const pct = Math.round(r.coverage * 100);

      let report = `# Salesforce Themer — Diagnostic Report\n\n`;
      report += `- **Theme**: ${r.theme}\n`;
      report += `- **URL**: ${r.url}\n`;
      report += `- **Timestamp**: ${r.timestamp}\n`;
      report += `- **CSS Injected**: ${r.styleInjected ? 'Yes' : 'No'} (${r.styleSizeKB} KB)\n`;
      report += `- **Token Coverage**: ${pct}% (${r.summary.provided}/${r.summary.total})\n`;
      report += `- **Page Uses**: ${r.summary.pageUsesCount} tokens\n`;
      report += `- **Gaps**: ${r.summary.gaps}\n\n`;

      if (r.gaps.length) {
        report += `## Gaps (SF uses, theme doesn't set)\n\n`;
        for (const g of r.gaps) {
          report += `- \`${g}\`\n`;
        }
        report += '\n';
      }

      for (const [, cat] of Object.entries(r.categories)) {
        report += `## ${cat.label}\n\n`;
        report += `| Status | Token | Value |\n|--------|-------|-------|\n`;
        for (const t of cat.tokens) {
          const st = t.provided ? 'SET' : t.usedByPage ? 'GAP' : '—';
          report += `| ${st} | \`${t.token}\` | ${t.value || '—'} |\n`;
        }
        report += '\n';
      }

      // Testing progress (if available)
      if (this.testingProgress && ns.getCompletionSummary) {
        const ts = ns.getCompletionSummary(this.testingProgress);
        report += `## Testing Progress (${ts.completed}/${ts.total})\n\n`;
        for (const item of ts.items) {
          const check = item.completed ? 'x' : ' ';
          const scores = [];
          if (item.result?.tokenCoverage != null) scores.push(`tokens: ${Math.round(item.result.tokenCoverage * 100)}%`);
          if (item.result?.componentHealth != null) scores.push(`components: ${Math.round(item.result.componentHealth)}%`);
          report += `- [${check}] ${item.label}${scores.length ? ` — ${scores.join(', ')}` : ''}\n`;
        }
        report += '\n';
      }

      // Component scan results (if available)
      if (this.componentResults) {
        const cr = this.componentResults;
        const cs = cr.summary;
        report += `## Component Scan\n\n`;
        report += `- **Standard Types**: ${cs.standardTypes} types, ${cs.totalStandardFound} total\n`;
        report += `- **Styled**: ${cs.totalStyled} | **Partial**: ${cs.totalPartial} | **Unstyled**: ${cs.totalUnstyled}\n`;
        report += `- **Hardcoded Colors**: ${cs.totalHardcoded}\n`;
        report += `- **Custom LWCs**: ${cs.customLWCCount}\n`;
        if (cs.managedPackages.length) {
          report += `- **Managed Packages**: ${cs.managedPackages.join(', ')} (${cs.managedComponentCount} components)\n`;
        }
        report += '\n';

        // Standard components detail
        const active = Object.entries(cr.standard).filter(([, v]) => v.found > 0);
        if (active.length) {
          report += `### Standard Components\n\n`;
          report += `| Component | Found | Styled | Partial | Unstyled |\n|-----------|-------|--------|---------|----------|\n`;
          for (const [, data] of active) {
            report += `| ${data.label} | ${data.found} | ${data.styled} | ${data.partial} | ${data.unstyled} |\n`;
          }
          report += '\n';
        }

        // Custom LWCs
        if (cr.custom.length) {
          report += `### Custom LWCs\n\n`;
          for (const c of cr.custom) {
            const status = c.styling?.usesDefaults ? 'DEFAULT COLORS' : 'themed';
            report += `- \`<${c.tag}>\` (${c.count}x) — ${status}\n`;
          }
          report += '\n';
        }

        // Managed packages
        if (cr.managed.length) {
          report += `### Managed Package Components\n\n`;
          for (const c of cr.managed) {
            report += `- \`<${c.tag}>\` [${c.packageName}] (${c.count}x)\n`;
          }
          report += '\n';
        }
      }

      report += `\n---\n*Generated by Salesforce Themer Diagnostic — Powered by Connectry AI*\n`;

      try {
        await navigator.clipboard.writeText(report);
        const textSpan = btn.querySelector('span');
        btn.classList.add('is-copied');
        if (textSpan) textSpan.textContent = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (textSpan) textSpan.textContent = 'Copy Report';
        }, 2000);
      } catch (err) {
        console.warn('[SFT Diag] Clipboard write failed:', err.message);
      }
    }

    async _copyDOMSnapshot(btn) {
      if (!ns.captureDOMSnapshot) {
        console.warn('[SFT Diag] DOM snapshot not available');
        return;
      }

      const snapshot = ns.captureDOMSnapshot();
      const json = JSON.stringify(snapshot, null, 2);

      try {
        await navigator.clipboard.writeText(json);
        const textSpan = btn.querySelector('span');
        btn.classList.add('is-copied');
        if (textSpan) textSpan.textContent = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (textSpan) textSpan.textContent = 'DOM';
        }, 2000);
      } catch (err) {
        console.warn('[SFT Diag] Clipboard write failed:', err.message);
      }
    }

    // ── Drag ──────────────────────────────────────────────────────────────

    _setupDrag() {
      const header = this.shadow?.querySelector('.diag-header');
      if (!header) return;

      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.diag-icon-btn')) return;
        e.preventDefault();

        const rect = this.host.getBoundingClientRect();
        this._dragState = {
          startX: e.clientX,
          startY: e.clientY,
          origRight: window.innerWidth - rect.right,
          origTop: rect.top,
        };

        const onMove = (ev) => {
          if (!this._dragState) return;
          const dx = ev.clientX - this._dragState.startX;
          const dy = ev.clientY - this._dragState.startY;
          const newTop = Math.max(0, Math.min(window.innerHeight - 60, this._dragState.origTop + dy));
          const newRight = Math.max(0, Math.min(window.innerWidth - 100, this._dragState.origRight - dx));
          this.host.style.top = newTop + 'px';
          this.host.style.right = newRight + 'px';
        };

        const onUp = () => {
          this._dragState = null;
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          this._savePosition();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    // ── Position persistence ──────────────────────────────────────────────

    async _savePosition() {
      try {
        const style = this.host?.style;
        if (!style) return;
        await chrome.storage.local.set({
          diagnosticPanelPosition: {
            top: style.top || '16px',
            right: style.right || '16px',
          },
        });
      } catch (_) {}
    }

    async _restorePosition() {
      try {
        const data = await chrome.storage.local.get('diagnosticPanelPosition');
        const pos = data.diagnosticPanelPosition;
        if (pos && this.host) {
          this.host.style.top = pos.top;
          this.host.style.right = pos.right;
        }
      } catch (_) {}
    }

    // ── Util ──────────────────────────────────────────────────────────────

    _escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  // ─── Export ─────────────────────────────────────────────────────────────

  ns.DiagnosticPanel = DiagnosticPanel;
})();

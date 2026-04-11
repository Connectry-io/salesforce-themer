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
      this.activeTab = 'tokens';      // 'tokens' | 'components' | 'testing'
      this.testingProgress = null;   // guided testing progress
      this._dragState = null;
      this._cssLoaded = false;
      this._cssText = '';
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

      if (!this._cssLoaded) {
        await this._loadCSS();
      }

      this._createHost();
      this._renderPanel();
      this._setupDrag();
      await this._restorePosition();
    }

    close() {
      if (!this.isOpen) return;
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
      if (this.isOpen && !this.isMinimized) {
        this._updateInfoBar();
      }
    }

    /** Called by content.js when SPA navigation occurs. */
    onNavigate() {
      if (!this.isOpen || this.isMinimized) return;
      if (this.activeTab === 'testing') {
        this._refreshTabContent();
      }
    }

    // ── Host management ───────────────────────────────────────────────────

    _createHost() {
      this._destroyHost();
      this.host = document.createElement('div');
      this.host.id = HOST_ID;
      this.shadow = this.host.attachShadow({ mode: 'closed' });
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

      const styleTag = document.getElementById(this.styleId);
      const injected = !!styleTag;
      const themeName = this.currentTheme || 'none';

      this.shadow.innerHTML = `
        <style>${this._cssText}</style>
        <div class="diag-panel">
          ${this._headerHTML()}
          ${this._infoBarHTML(themeName, injected)}
          ${this._tabBarHTML()}
          ${this._scanBarHTML()}
          <div class="diag-results">
            ${this._activeTabContent()}
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
            <button class="diag-icon-btn" data-action="minimize" title="Minimize">${ICONS.minimize}</button>
            <button class="diag-icon-btn" data-action="close" title="Close">${ICONS.close}</button>
          </div>
        </div>`;
    }

    _infoBarHTML(themeName, injected) {
      const host = location.hostname.replace('.my.salesforce.com', '').replace('.lightning.force.com', '');
      return `
        <div class="diag-info-bar">
          <span class="diag-info-dot ${injected ? 'is-on' : 'is-off'}"></span>
          <span class="diag-info-chip"><strong>${this._escapeHtml(themeName)}</strong></span>
          <span class="diag-info-chip">${this._escapeHtml(host)}</span>
        </div>`;
    }

    _tabBarHTML() {
      return `
        <div class="diag-tab-bar">
          <button class="diag-tab ${this.activeTab === 'tokens' ? 'is-active' : ''}" data-tab="tokens">Tokens</button>
          <button class="diag-tab ${this.activeTab === 'components' ? 'is-active' : ''}" data-tab="components">Components</button>
          <button class="diag-tab ${this.activeTab === 'testing' ? 'is-active' : ''}" data-tab="testing">Testing</button>
        </div>`;
    }

    _scanBarHTML() {
      if (this.activeTab === 'testing') {
        const pageType = ns.detectPageType?.();
        const label = pageType
          ? `Scan This Page (${pageType.label})`
          : 'Scan This Page';
        return `
          <div class="diag-scan-bar">
            <button class="diag-scan-btn" data-action="scanForTesting">
              ${ICONS.scan}
              <span>${label}</span>
            </button>
          </div>`;
      }
      const isTokenTab = this.activeTab === 'tokens';
      return `
        <div class="diag-scan-bar">
          <button class="diag-scan-btn" data-action="${isTokenTab ? 'scan' : 'scanComponents'}">
            ${ICONS.scan}
            <span>${isTokenTab ? 'Run Token Scan' : 'Scan Components'}</span>
          </button>
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
          <div class="diag-empty-desc">Hit "Run Token Scan" to check how your theme's CSS tokens are landing on this page.</div>
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

    _activeTabContent() {
      if (this.activeTab === 'components') {
        return this.componentResults ? this._componentResultsHTML() : this._emptyComponentHTML();
      }
      if (this.activeTab === 'testing') {
        return this._testingTabHTML();
      }
      return this.scanResults ? this._resultsHTML() : this._emptyHTML();
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
          <button class="diag-copy-btn" data-action="copy" title="Copy scan report to clipboard">
            ${ICONS.copy}
            <span>Copy Report</span>
          </button>
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
      const styleTag = document.getElementById(this.styleId);
      bar.innerHTML = this._infoBarHTML(this.currentTheme || 'none', !!styleTag).replace(/<\/?div[^>]*>/g, '').trim();
    }

    // ── Event binding ─────────────────────────────────────────────────────

    _bindEvents() {
      if (!this.shadow) return;

      // Action buttons
      this.shadow.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'close') this.close();
        else if (action === 'minimize') this.minimize();
        else if (action === 'scan') this._runScan(btn);
        else if (action === 'scanComponents') this._runComponentScan(btn);
        else if (action === 'scanForTesting') this._runTestingScan(btn);
        else if (action === 'resetProgress') this._resetTestingProgress();
        else if (action === 'copy') this._copyReport(btn);
      });

      // Tab switching
      this.shadow.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-tab]');
        if (!tab) return;
        const tabName = tab.dataset.tab;
        if (tabName === this.activeTab) return;
        this.activeTab = tabName;
        this._refreshTabContent();
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

    async _runScan(btn) {
      if (!ns.scanTokens) {
        console.warn('[SFT Diag] Token scanner not loaded');
        return;
      }

      btn.classList.add('is-scanning');
      const iconSpan = btn.querySelector('svg');
      const textSpan = btn.querySelector('span');
      if (iconSpan) iconSpan.outerHTML = ICONS.spinner;
      if (textSpan) textSpan.textContent = 'Scanning...';

      // Small delay so the UI updates before the sync scan runs
      await new Promise(r => setTimeout(r, 50));

      try {
        this.scanResults = ns.scanTokens(this.currentTheme);
      } catch (err) {
        console.error('[SFT Diag] Scan failed:', err);
      }

      // Re-render results
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) {
        resultsEl.innerHTML = this.scanResults ? this._resultsHTML() : this._emptyHTML();
      }

      // Reset button
      btn.classList.remove('is-scanning');
      const newIcon = btn.querySelector('svg');
      const newText = btn.querySelector('span');
      if (newIcon) newIcon.outerHTML = ICONS.scan;
      if (newText) newText.textContent = 'Run Token Scan';
    }

    async _refreshTabContent() {
      // Load testing progress if switching to testing tab
      if (this.activeTab === 'testing' && this.testingProgress === null) {
        this.testingProgress = await ns.getTestingProgress?.(this.currentTheme) || {};
      }
      // Update tab bar active state
      const tabs = this.shadow?.querySelectorAll('[data-tab]');
      if (tabs) {
        tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === this.activeTab));
      }
      // Update scan button
      const scanBar = this.shadow?.querySelector('.diag-scan-bar');
      if (scanBar) scanBar.outerHTML = this._scanBarHTML();
      // Update results
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._activeTabContent();
      // Re-bind scan button (replaced via outerHTML)
      this._bindScanButton();
    }

    _bindScanButton() {
      const btn = this.shadow?.querySelector('.diag-scan-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'scan') this._runScan(btn);
        else if (action === 'scanComponents') this._runComponentScan(btn);
      });
    }

    async _runComponentScan(btn) {
      if (!ns.scanComponents) {
        console.warn('[SFT Diag] Component scanner not loaded');
        return;
      }

      btn.classList.add('is-scanning');
      const iconSpan = btn.querySelector('svg');
      const textSpan = btn.querySelector('span');
      if (iconSpan) iconSpan.outerHTML = ICONS.spinner;
      if (textSpan) textSpan.textContent = 'Scanning...';

      await new Promise(r => setTimeout(r, 50));

      try {
        this.componentResults = ns.scanComponents();
      } catch (err) {
        console.error('[SFT Diag] Component scan failed:', err);
      }

      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) {
        resultsEl.innerHTML = this.componentResults ? this._componentResultsHTML() : this._emptyComponentHTML();
      }

      btn.classList.remove('is-scanning');
      const newIcon = btn.querySelector('svg');
      const newText = btn.querySelector('span');
      if (newIcon) newIcon.outerHTML = ICONS.scan;
      if (newText) newText.textContent = 'Scan Components';
    }

    async _runTestingScan(btn) {
      btn.classList.add('is-scanning');
      const textSpan = btn.querySelector('span');
      const iconSpan = btn.querySelector('svg');
      if (iconSpan) iconSpan.outerHTML = ICONS.spinner;
      if (textSpan) textSpan.textContent = 'Scanning...';

      await new Promise(r => setTimeout(r, 50));

      // Determine page type (auto-detect or manual fallback)
      let pageType = ns.detectPageType?.();
      let pageId = pageType?.id || 'unknown';

      // If no auto-detect and this is a manual type, check if user
      // triggered from a manual checklist item
      if (!pageType) {
        // For manual page types (modal, dropdown), we still scan
        // and mark the first unfinished manual type
        const progress = this.testingProgress || {};
        const manualTypes = ns.PAGE_TYPES?.filter(p => p.manual && !progress[p.id]?.completed);
        if (manualTypes?.length) {
          pageType = manualTypes[0];
          pageId = pageType.id;
        }
      }

      // Run both scans
      let tokenCoverage = null;
      let componentHealth = null;

      try {
        if (ns.scanTokens) {
          const tokenResult = ns.scanTokens(this.currentTheme);
          this.scanResults = tokenResult;
          tokenCoverage = tokenResult.coverage;
        }
      } catch (_) {}

      try {
        if (ns.scanComponents) {
          const compResult = ns.scanComponents();
          this.componentResults = compResult;
          const s = compResult.summary;
          componentHealth = s.totalStandardFound > 0
            ? ((s.totalStyled + s.totalPartial * 0.5) / s.totalStandardFound) * 100
            : 100;
        }
      } catch (_) {}

      // Save result
      if (pageId !== 'unknown' && ns.saveTestResult) {
        await ns.saveTestResult(this.currentTheme, pageId, {
          tokenCoverage,
          componentHealth,
        });
        // Reload progress
        this.testingProgress = await ns.getTestingProgress?.(this.currentTheme) || {};
      }

      // Re-render testing tab
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._testingTabHTML();

      // Reset button
      btn.classList.remove('is-scanning');
      const newIcon = btn.querySelector('svg');
      const newText = btn.querySelector('span');
      if (newIcon) newIcon.outerHTML = ICONS.scan;
      if (newText) {
        const pt = ns.detectPageType?.();
        newText.textContent = pt ? `Scan This Page (${pt.label})` : 'Scan This Page';
      }
    }

    async _resetTestingProgress() {
      if (ns.clearTestingProgress) {
        await ns.clearTestingProgress(this.currentTheme);
      }
      this.testingProgress = {};
      const resultsEl = this.shadow?.querySelector('.diag-results');
      if (resultsEl) resultsEl.innerHTML = this._testingTabHTML();
    }

    // ── Copy report ───────────────────────────────────────────────────────

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

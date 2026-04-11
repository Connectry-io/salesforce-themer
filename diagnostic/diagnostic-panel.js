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
      this.scanResults = null;
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
      if (this.isOpen && !this.isMinimized) {
        this._updateInfoBar();
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
          ${this._scanBarHTML()}
          <div class="diag-results">
            ${this.scanResults ? this._resultsHTML() : this._emptyHTML()}
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

    _scanBarHTML() {
      return `
        <div class="diag-scan-bar">
          <button class="diag-scan-btn" data-action="scan">
            ${ICONS.scan}
            <span>Run Token Scan</span>
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
        else if (action === 'copy') this._copyReport(btn);
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

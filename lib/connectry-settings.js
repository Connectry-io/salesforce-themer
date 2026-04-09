/**
 * Connectry Settings Shell — reusable JS for Connectry extension settings pages.
 *
 * Provides:
 *   - CxTabs: ARIA-compliant tab navigation with keyboard support
 *   - CxDialog: simple modal dialog primitive
 *   - Remembers last active tab via localStorage
 *
 * Used by Salesforce Themer and future Connectry extensions.
 */

(function(global) {
  'use strict';

  // ─── Tabs ────────────────────────────────────────────────────────────────

  class CxTabs {
    constructor(container, options = {}) {
      this.container = container;
      this.storageKey = options.storageKey || 'cx-active-tab';
      this.onChange = options.onChange || null;

      this.tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      this.panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
      this._init();
    }

    _init() {
      if (!this.tabs.length) return;

      this.tabs.forEach((tab, i) => {
        if (!tab.id) tab.id = `cx-tab-${tab.dataset.tab || i}`;
        tab.setAttribute('tabindex', '-1');

        tab.addEventListener('click', () => {
          this.activate(tab.dataset.tab);
          tab.focus();
        });

        tab.addEventListener('keydown', (e) => this._handleKey(e));
      });

      this.panels.forEach(panel => {
        const tabName = panel.dataset.tabpanel;
        const tab = this.tabs.find(t => t.dataset.tab === tabName);
        if (tab) panel.setAttribute('aria-labelledby', tab.id);
        panel.setAttribute('tabindex', '0');
      });

      // Restore last active tab if valid, otherwise use the first active or first tab
      let initial = null;
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved && this.tabs.some(t => t.dataset.tab === saved)) initial = saved;
      } catch (_) {}

      if (!initial) {
        const preActive = this.tabs.find(t => t.classList.contains('is-active'));
        initial = preActive ? preActive.dataset.tab : this.tabs[0].dataset.tab;
      }

      this.activate(initial, { silent: true });
    }

    activate(tabName, { silent = false } = {}) {
      if (!tabName) return;

      this.tabs.forEach(tab => {
        const active = tab.dataset.tab === tabName;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.setAttribute('tabindex', active ? '0' : '-1');
      });

      this.panels.forEach(panel => {
        const active = panel.dataset.tabpanel === tabName;
        panel.hidden = !active;
      });

      try { localStorage.setItem(this.storageKey, tabName); } catch (_) {}

      if (!silent && typeof this.onChange === 'function') {
        this.onChange(tabName);
      }
    }

    getActive() {
      const active = this.tabs.find(t => t.classList.contains('is-active'));
      return active ? active.dataset.tab : null;
    }

    _handleKey(e) {
      const navKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!navKeys.includes(e.key)) return;
      e.preventDefault();

      const idx = this.tabs.indexOf(e.target);
      if (idx === -1) return;

      let nextIdx = idx;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % this.tabs.length;
      if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + this.tabs.length) % this.tabs.length;
      if (e.key === 'Home') nextIdx = 0;
      if (e.key === 'End') nextIdx = this.tabs.length - 1;

      const nextTab = this.tabs[nextIdx];
      nextTab.focus();
      this.activate(nextTab.dataset.tab);
    }
  }

  // ─── Dialog ──────────────────────────────────────────────────────────────

  class CxDialog {
    /**
     * Create a modal dialog.
     * @param {Object} opts
     * @param {string} opts.title - Dialog title
     * @param {string|HTMLElement} opts.body - HTML string or element for body
     * @param {Array<{label: string, variant?: string, onClick?: Function, close?: boolean}>} opts.actions
     */
    constructor(opts) {
      this.opts = opts || {};
      this.el = null;
      this._boundKey = null;
    }

    open() {
      if (this.el) return;

      const backdrop = document.createElement('div');
      backdrop.className = 'cx-dialog-backdrop';
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });

      const dialog = document.createElement('div');
      dialog.className = 'cx-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      if (this.opts.title) dialog.setAttribute('aria-label', this.opts.title);

      const header = document.createElement('div');
      header.className = 'cx-dialog-header';
      header.innerHTML = `<h2 class="cx-dialog-title">${_escape(this.opts.title || '')}</h2>
        <button class="cx-dialog-close" aria-label="Close">&times;</button>`;

      const body = document.createElement('div');
      body.className = 'cx-dialog-body';
      if (typeof this.opts.body === 'string') {
        body.innerHTML = this.opts.body;
      } else if (this.opts.body instanceof HTMLElement) {
        body.appendChild(this.opts.body);
      }

      const footer = document.createElement('div');
      footer.className = 'cx-dialog-footer';
      const actions = this.opts.actions || [{ label: 'Close', variant: 'secondary', close: true }];
      for (const action of actions) {
        const btn = document.createElement('button');
        btn.className = `cx-btn cx-btn-${action.variant || 'secondary'}`;
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          if (typeof action.onClick === 'function') action.onClick(this);
          if (action.close !== false) this.close();
        });
        footer.appendChild(btn);
      }

      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);
      this.el = backdrop;

      header.querySelector('.cx-dialog-close').addEventListener('click', () => this.close());

      // Escape to close
      this._boundKey = (e) => {
        if (e.key === 'Escape') this.close();
      };
      document.addEventListener('keydown', this._boundKey);

      // Focus first button
      requestAnimationFrame(() => {
        const firstBtn = footer.querySelector('.cx-btn');
        if (firstBtn) firstBtn.focus();
      });
    }

    close() {
      if (!this.el) return;
      if (this._boundKey) {
        document.removeEventListener('keydown', this._boundKey);
        this._boundKey = null;
      }
      this.el.remove();
      this.el = null;
      if (typeof this.opts.onClose === 'function') this.opts.onClose();
    }
  }

  function _escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Export ──────────────────────────────────────────────────────────────

  global.Connectry = global.Connectry || {};
  global.Connectry.Settings = {
    Tabs: CxTabs,
    Dialog: CxDialog,
    escape: _escape,
  };
})(window);

/**
 * Report Generator — Salesforce Themer Diagnostic
 *
 * Content-script side. Stashes the scan opts in chrome.storage.session
 * and opens diagnostic/report.html (an extension-hosted page) with
 * the storage key in the URL. Rendering + interactivity live in
 * diagnostic/report.js, which runs on the chrome-extension:// origin
 * where inline scripts + window.print() aren't blocked by SF's CSP.
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  /**
   * Open the interactive report in a new tab.
   *
   * @param {Object} opts
   * @param {string} opts.themeName
   * @param {Object} opts.themeColors
   * @param {Object} opts.scanResults
   * @param {Object} opts.componentResults
   * @param {Object} opts.fixReport
   * @param {Object} opts.testingProgress
   * @param {Object} opts.patchSummary
   * @param {string} opts.screenshotDataUrl
   */
  ns.openReport = async function openReport(opts) {
    try {
      const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random().toString(36).slice(2)));
      const key = 'sft-report-' + id;
      const payload = {
        ...opts,
        host: location.hostname,
        pageUrl: location.href,
        generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
      await chrome.storage.session.set({ [key]: payload });
      // Delegate tab creation to the background worker — content scripts
      // can't reliably window.open a chrome-extension:// URL (user gesture
      // lost across the storage.set await), and popup blockers sometimes
      // intervene. Background has unrestricted chrome.tabs access.
      await chrome.runtime.sendMessage({ action: 'openReportTab', reportId: id });
    } catch (err) {
      console.error('[SFT Diag] openReport failed:', err);
    }
  };
})();

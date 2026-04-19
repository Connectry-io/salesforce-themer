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
   * @param {Object} opts.multiScan - Optional multi-theme comparison payload
   */
  ns.openReport = async function openReport(opts) {
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random().toString(36).slice(2)));
    const key = 'sft-report-' + id;
    const payload = {
      ...opts,
      host: location.hostname,
      pageUrl: location.href,
      generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    // Content scripts don't have access to chrome.storage.session by
    // default (its accessLevel is TRUSTED_CONTEXTS only). Use local —
    // works in every context, payload gets cleaned up by report.js after
    // render, and the size limits are fine for our payload (~100KB max
    // with a screenshot).
    try {
      await chrome.storage.local.set({ [key]: payload });
    } catch (err) {
      console.error('[SFT Diag] openReport: storage write failed', err);
      alert('Could not prepare report — storage write failed. Check the console.');
      return;
    }

    // Delegate tab open to the background worker. Request a response so
    // errors surface instead of silently failing.
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'openReportTab', reportId: id });
      if (!resp?.ok) {
        console.error('[SFT Diag] openReport: background replied with error', resp);
        alert('Could not open report tab. Check the extension service-worker console.');
      }
    } catch (err) {
      console.error('[SFT Diag] openReport: sendMessage failed', err);
      alert('Could not reach the extension background — try reloading the extension.');
    }
  };
})();

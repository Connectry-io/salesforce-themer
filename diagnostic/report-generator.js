/**
 * Report Generator — Salesforce Themer Diagnostic
 *
 * Generates a full interactive HTML report from diagnostic scan results.
 * Connectry-branded, opens in a new browser tab via blob URL.
 *
 * Registered on window.__sfThemerDiag — inert until called.
 */
(() => {
  'use strict';

  const ns = (window.__sfThemerDiag = window.__sfThemerDiag || {});

  /**
   * Generate a self-contained HTML report and open it in a new tab.
   *
   * @param {Object} opts
   * @param {string} opts.themeName - Active theme name
   * @param {Object} opts.themeColors - Theme color config
   * @param {Object} opts.scanResults - Token scan results
   * @param {Object} opts.componentResults - Component scan results
   * @param {Object} opts.fixReport - Generated fix report
   * @param {Object} opts.testingProgress - Testing checklist progress
   * @param {Object} opts.patchSummary - Active patches summary
   */
  ns.openReport = function openReport(opts) {
    const html = buildReportHTML(opts);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up after a delay (browser needs time to load)
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildReportHTML(opts) {
    const {
      themeName = 'unknown',
      themeColors,
      scanResults,
      componentResults,
      fixReport,
      testingProgress,
      patchSummary,
      screenshotDataUrl,
    } = opts;

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
    const host = location.hostname.replace('.my.salesforce.com', '').replace('.lightning.force.com', '');
    const pageUrl = location.href;

    // KPIs
    const tokenPct = scanResults ? Math.round(scanResults.coverage * 100) : null;
    const s = componentResults?.summary;
    const compPct = s && s.totalStandardFound > 0
      ? Math.round(((s.totalStyled + s.totalPartial * 0.5) / s.totalStandardFound) * 100)
      : null;
    const overallPct = (tokenPct !== null && compPct !== null)
      ? Math.round((tokenPct + compPct) / 2)
      : (tokenPct ?? compPct ?? 0);
    const gapCount = scanResults?.gaps?.length || 0;
    const fixCount = fixReport?.summary?.tokenGapsFixed || 0;
    const patchCount = fixReport?.summary?.componentsPatched || 0;

    // Swatch colors
    const swatchCols = themeColors
      ? [themeColors.background, themeColors.surface, themeColors.accent, themeColors.textPrimary]
      : [];

    // Build sections
    const tokenGapsSection = buildTokenGapsSection(scanResults, fixReport);
    const componentSection = buildComponentSection(componentResults);
    const lwcPatchesSection = buildLWCPatchesSection(fixReport);
    const activePatchesSection = buildActivePatchesSection(patchSummary);
    const testingSection = buildTestingSection(testingProgress);
    const cssFixBlock = fixReport?.fullCSS ? buildCSSFixBlock(fixReport.fullCSS) : '';
    const screenshotSection = buildScreenshotSection(screenshotDataUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Theme Diagnostic Report — ${esc(themeName)} | Connectry</title>
<style>
  :root {
    --cx-bg: #0f1115;
    --cx-bg-grad: linear-gradient(135deg, #1a1d23 0%, #0f1115 100%);
    --cx-surface: #1a1d23;
    --cx-surface-2: #22262e;
    --cx-border: rgba(255,255,255,0.06);
    --cx-border-strong: rgba(255,255,255,0.1);
    --cx-text: #e4e4e7;
    --cx-text-2: rgba(255,255,255,0.55);
    --cx-text-3: rgba(255,255,255,0.3);
    --cx-accent: #4a6fa5;
    --cx-accent-2: #93b5e0;
    --cx-accent-light: rgba(74,111,165,0.15);
    --cx-good: #22c55e;
    --cx-warn: #eab308;
    --cx-bad: #ef4444;
    --cx-radius: 8px;
    --cx-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }
  [data-theme="light"] {
    --cx-bg: #f8f9fb;
    --cx-bg-grad: linear-gradient(135deg, #ffffff 0%, #f1f3f8 100%);
    --cx-surface: #ffffff;
    --cx-surface-2: #f1f3f8;
    --cx-border: rgba(0,0,0,0.06);
    --cx-border-strong: rgba(0,0,0,0.1);
    --cx-text: #1a1a1a;
    --cx-text-2: #4a5568;
    --cx-text-3: #8a94a6;
    --cx-accent: #3d5e8e;
    --cx-accent-2: #4a6fa5;
    --cx-accent-light: rgba(74,111,165,0.1);
    --cx-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: var(--cx-bg);
    color: var(--cx-text);
    line-height: 1.6;
    padding: 0;
  }

  /* Toolbar — sticky top bar with brand + actions */
  .report-toolbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; gap: 12px;
    padding: 10px 40px;
    background: var(--cx-surface);
    border-bottom: 1px solid var(--cx-border);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .report-toolbar-brand {
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; font-weight: 600; color: var(--cx-text-2);
    letter-spacing: 0.02em;
  }
  .report-toolbar-brand svg { width: 22px; height: 22px; }
  .report-toolbar-brand strong { color: var(--cx-accent-2); font-weight: 700; }
  .report-toolbar-actions { margin-left: auto; display: flex; gap: 8px; }
  .report-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 12px; font-family: inherit; font-size: 12px; font-weight: 600;
    background: var(--cx-surface-2); color: var(--cx-text-2);
    border: 1px solid var(--cx-border); border-radius: 6px;
    cursor: pointer; transition: all 150ms ease;
  }
  .report-btn:hover { background: var(--cx-accent-light); color: var(--cx-accent-2); border-color: var(--cx-accent); }
  .report-btn svg { width: 14px; height: 14px; }
  .report-btn--primary { background: var(--cx-accent-light); color: var(--cx-accent-2); border-color: rgba(74,111,165,0.3); }

  /* Header */
  .report-header {
    background: var(--cx-bg-grad);
    border-bottom: 1px solid var(--cx-border);
    padding: 32px 40px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .report-logo svg { width: 36px; height: 36px; }
  .report-header-text h1 { font-size: 22px; font-weight: 700; color: var(--cx-text); letter-spacing: -0.01em; }
  .report-header-text p { font-size: 12px; color: var(--cx-text-2); margin-top: 2px; }
  .report-header-text p strong { color: var(--cx-accent-2); font-weight: 700; }
  .report-header-meta { margin-left: auto; text-align: right; font-size: 11px; color: var(--cx-text-3); line-height: 1.6; }

  /* Container */
  .report-body { max-width: 900px; margin: 0 auto; padding: 32px 40px 60px; }

  /* Theme card */
  .report-theme-card {
    display: flex; align-items: center; gap: 16px;
    padding: 16px 20px; background: var(--cx-surface);
    border: 1px solid var(--cx-border); border-radius: var(--cx-radius);
    margin-bottom: 24px;
  }
  .report-swatch { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; width: 40px; height: 40px; border-radius: 8px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--cx-border-strong); flex-shrink: 0; }
  .report-swatch span { display: block; }
  .report-theme-info { flex: 1; min-width: 0; }
  .report-theme-name { font-size: 16px; font-weight: 700; color: var(--cx-text); }
  .report-theme-org { font-size: 12px; color: var(--cx-text-2); }

  /* KPI row */
  .kpi-row { display: flex; gap: 12px; margin-bottom: 24px; }
  .kpi-card {
    flex: 1; padding: 16px; background: var(--cx-surface);
    border: 1px solid var(--cx-border); border-radius: var(--cx-radius); text-align: center;
  }
  .kpi-value { font-size: 28px; font-weight: 800; line-height: 1.2; }
  .kpi-value.good { color: var(--cx-good); }
  .kpi-value.ok { color: var(--cx-warn); }
  .kpi-value.bad { color: var(--cx-bad); }
  .kpi-label { font-size: 11px; color: var(--cx-text-2); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }

  /* Screenshot section */
  .report-section {
    margin-bottom: 20px;
    background: var(--cx-surface);
    border: 1px solid var(--cx-border);
    border-radius: var(--cx-radius);
    padding: 14px 16px;
  }
  .report-section .section-title { margin-bottom: 10px; display: block; }
  .section-meta { color: var(--cx-text-3); font-size: 11px; font-weight: 400; letter-spacing: 0; margin-left: 6px; }
  .screenshot-frame {
    background: #000;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--cx-border);
  }
  .screenshot-frame img {
    display: block;
    width: 100%;
    height: auto;
  }

  /* Sections */
  .section { margin-bottom: 20px; }
  .section-header {
    display: flex; align-items: center; gap: 8px; padding: 10px 16px;
    background: var(--cx-surface); border: 1px solid var(--cx-border);
    border-radius: var(--cx-radius) var(--cx-radius) 0 0; cursor: pointer;
    user-select: none;
  }
  .section-header:hover { background: var(--cx-surface-2); }
  .section-title { font-size: 13px; font-weight: 600; color: var(--cx-text); flex: 1; }
  .section-badge {
    font-size: 10px; font-weight: 600; padding: 2px 8px;
    border-radius: 10px; white-space: nowrap;
  }
  .section-badge.good { background: rgba(34,197,94,0.12); color: var(--cx-good); }
  .section-badge.warn { background: rgba(234,179,8,0.12); color: var(--cx-warn); }
  .section-badge.bad { background: rgba(239,68,68,0.12); color: var(--cx-bad); }
  .section-badge.info { background: var(--cx-accent-light); color: var(--cx-accent); }
  .section-chevron { font-size: 14px; color: var(--cx-text-3); transition: transform 0.2s; }
  .section.is-open .section-chevron { transform: rotate(180deg); }
  .section-body {
    border: 1px solid var(--cx-border); border-top: none;
    border-radius: 0 0 var(--cx-radius) var(--cx-radius);
    background: var(--cx-surface); padding: 0 16px;
    display: none;
  }
  .section.is-open .section-body { display: block; }
  .section-hint { font-size: 10px; color: var(--cx-text-3); font-style: italic; padding: 8px 0 4px; }

  /* Rows */
  .row {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03);
    font-size: 12px;
  }
  .row { border-bottom-color: var(--cx-border) !important; }
  .row:last-child { border-bottom: none; }
  .row-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .row-dot.pass { background: var(--cx-good); }
  .row-dot.gap { background: var(--cx-warn); }
  .row-dot.fail { background: var(--cx-bad); }
  .row-name { flex: 1; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11px; color: var(--cx-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-value { font-size: 11px; color: var(--cx-text-3); text-align: right; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
  .row-swatch { width: 14px; height: 14px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1); flex-shrink: 0; }

  /* Testing checklist */
  .test-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 12px; }
  .test-item:last-child { border-bottom: none; }
  .test-check { width: 16px; text-align: center; flex-shrink: 0; }
  .test-label { flex: 1; color: var(--cx-text); }
  .test-manual { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.05); color: var(--cx-text-3); }
  .test-score { font-size: 10px; color: var(--cx-text-2); font-weight: 600; }
  .test-done .test-label { color: var(--cx-text-2); }

  /* CSS code block */
  .css-block {
    margin: 16px 0; padding: 16px; background: var(--cx-surface-2);
    border: 1px solid var(--cx-border); border-radius: var(--cx-radius);
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 11px; line-height: 1.7; color: var(--cx-text-2);
    white-space: pre-wrap; word-break: break-all;
    max-height: 400px; overflow-y: auto;
  }
  .css-block-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px;
  }
  .css-block-title { font-size: 12px; font-weight: 600; color: var(--cx-text); }
  .css-block-copy {
    padding: 4px 12px; font-size: 11px; font-weight: 500;
    background: var(--cx-accent-light); color: var(--cx-accent);
    border: 1px solid rgba(74,111,165,0.2); border-radius: 4px;
    cursor: pointer; border: none; font-family: inherit;
  }
  .css-block-copy:hover { background: rgba(74,111,165,0.25); }

  /* Footer */
  .report-footer {
    text-align: center; padding: 32px 0 16px;
    font-size: 11px; color: var(--cx-text-3);
    border-top: 1px solid var(--cx-border); margin-top: 32px;
  }
  .report-footer a { color: var(--cx-accent); text-decoration: none; }
  .report-footer a:hover { text-decoration: underline; }

  /* Print — force light theme, expand all sections, hide interactive UI */
  @media print {
    :root, [data-theme="dark"], [data-theme="light"] {
      --cx-bg: #fff;
      --cx-bg-grad: #fff;
      --cx-surface: #fff;
      --cx-surface-2: #f5f5f5;
      --cx-border: rgba(0,0,0,0.1);
      --cx-border-strong: rgba(0,0,0,0.15);
      --cx-text: #1a1a1a;
      --cx-text-2: #333;
      --cx-text-3: #666;
    }
    body { background: #fff; color: #1a1a1a; }
    .report-toolbar { display: none; }
    .report-header { background: #f5f5f5; }
    .section-body { display: block !important; }
    .section-chevron { display: none; }
    .css-block-copy { display: none; }
    .css-block { max-height: none; overflow: visible; }
    .report-section, .section { break-inside: avoid; }
    .report-body { padding: 20px 24px; max-width: none; }
  }

  /* Toggle sections */
  .section-header { cursor: pointer; }
  /* Light-mode-specific logo gradient fix */
  [data-theme="light"] .report-logo svg circle:first-child { fill: #2D2D2D; }
</style>
</head>
<body data-theme="dark">

<div class="report-toolbar">
  <div class="report-toolbar-brand">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="12" r="3.5" fill="currentColor" opacity="0.7"/>
      <line x1="9.5" y1="12" x2="14.5" y2="12" stroke="#4A6FA5" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="18" cy="12" r="3.5" fill="#4A6FA5"/>
    </svg>
    <span>Connectry <strong>Diagnostic</strong></span>
  </div>
  <div class="report-toolbar-actions">
    <button class="report-btn" id="themeToggleBtn" title="Toggle light/dark">
      <svg viewBox="0 0 14 14" fill="none" id="themeToggleIcon"></svg>
      <span id="themeToggleLabel">Light</span>
    </button>
    <button class="report-btn report-btn--primary" id="savePdfBtn" title="Open print dialog — choose 'Save as PDF'">
      <svg viewBox="0 0 14 14" fill="none"><path d="M4 2v6M4 8l-2-2M4 8l2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10v1.5A1.5 1.5 0 0 0 3.5 13h7A1.5 1.5 0 0 0 12 11.5V10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <span>Save as PDF</span>
    </button>
  </div>
</div>

<div class="report-header">
  <div class="report-logo">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="12" r="3.5" fill="#e4e4e7"/>
      <line x1="9.5" y1="12" x2="14.5" y2="12" stroke="#4A6FA5" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="18" cy="12" r="3.5" fill="#4A6FA5"/>
    </svg>
  </div>
  <div class="report-header-text">
    <h1>Theme Diagnostic Report</h1>
    <p>Powered by Connectry <strong>AI</strong></p>
  </div>
  <div class="report-header-meta">
    ${esc(timestamp)}<br>
    ${esc(pageUrl.slice(0, 80))}
  </div>
</div>

<div class="report-body">

  <!-- Theme card -->
  <div class="report-theme-card">
    ${swatchCols.length ? `<div class="report-swatch">${swatchCols.map(c => `<span style="background:${esc(c)}"></span>`).join('')}</div>` : ''}
    <div class="report-theme-info">
      <div class="report-theme-name">${esc(themeName)}</div>
      <div class="report-theme-org">${esc(host)} &middot; ${esc(location.hostname)}</div>
    </div>
  </div>

  <!-- KPIs — mirror the panel's Page Health card stats -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-value ${overallPct >= 85 ? 'good' : overallPct >= 60 ? 'ok' : 'bad'}">${overallPct}%</div>
      <div class="kpi-label">Page Health</div>
    </div>
    ${tokenPct !== null ? `<div class="kpi-card"><div class="kpi-value ${tokenPct >= 90 ? 'good' : tokenPct >= 60 ? 'ok' : 'bad'}">${tokenPct}%</div><div class="kpi-label">Tokens</div></div>` : ''}
    ${compPct !== null ? `<div class="kpi-card"><div class="kpi-value ${compPct >= 85 ? 'good' : compPct >= 60 ? 'ok' : 'bad'}">${compPct}%</div><div class="kpi-label">Components</div></div>` : ''}
    <div class="kpi-card">
      <div class="kpi-value ${gapCount === 0 ? 'good' : gapCount <= 5 ? 'ok' : 'bad'}">${gapCount}</div>
      <div class="kpi-label">Issues</div>
    </div>
  </div>

  <!-- Sections -->
  ${screenshotSection}
  ${tokenGapsSection}
  ${componentSection}
  ${lwcPatchesSection}
  ${activePatchesSection}
  ${testingSection}
  ${cssFixBlock}

  <div class="report-footer">
    Built with care by <a href="https://connectry.io" target="_blank">Connectry</a><br>
    Report is a point-in-time snapshot. Re-scan for current state.
  </div>
</div>

<script>
  // Section collapse
  document.querySelectorAll('.section-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.section').classList.toggle('is-open'));
  });

  // Copy buttons
  document.querySelectorAll('.css-block-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.css-block-wrapper').querySelector('.css-block');
      navigator.clipboard.writeText(block.textContent).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
  });

  // Save as PDF — opens the native print dialog, user picks "Save as PDF"
  document.getElementById('savePdfBtn').addEventListener('click', () => window.print());

  // Light/dark toggle — persists in localStorage, respects OS preference on first visit
  const SUN = '<path d="M7 1.2v1.4M7 11.4v1.4M1.2 7h1.4M11.4 7h1.4M2.9 2.9l1 1M10.1 10.1l1 1M2.9 11.1l1-1M10.1 3.9l1-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="7" cy="7" r="2.8" stroke="currentColor" stroke-width="1.4"/>';
  const MOON = '<path d="M11.5 8.5a4.5 4.5 0 0 1-5.9-5.9 4.8 4.8 0 1 0 5.9 5.9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>';
  const body = document.body;
  const icon = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleLabel');
  const btn = document.getElementById('themeToggleBtn');
  function applyTheme(t) {
    body.setAttribute('data-theme', t);
    icon.innerHTML = t === 'dark' ? SUN : MOON;
    label.textContent = t === 'dark' ? 'Light' : 'Dark';
    btn.title = 'Switch to ' + (t === 'dark' ? 'light' : 'dark');
  }
  const saved = localStorage.getItem('cx-report-theme');
  const prefers = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(saved || prefers);
  btn.addEventListener('click', () => {
    const cur = body.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('cx-report-theme', next);
  });
</script>
</body>
</html>`;
  }

  // ─── Section builders ──────────────────────────────────────────────────

  function buildScreenshotSection(screenshotDataUrl) {
    if (!screenshotDataUrl) return '';
    const kb = Math.round((screenshotDataUrl.length * 0.75) / 1024);
    return `
    <section class="report-section">
      <h2 class="section-title">Viewport Screenshot <span class="section-meta">~${kb} KB · captured at scan time</span></h2>
      <div class="screenshot-frame">
        <img src="${screenshotDataUrl}" alt="Viewport screenshot captured during scan" />
      </div>
    </section>`;
  }

  function buildTokenGapsSection(scanResults, fixReport) {
    if (!scanResults) return '';
    const gaps = scanResults.gaps || [];
    const fixes = fixReport?.tokenFixes?.fixes || [];
    const unknowns = fixReport?.tokenFixes?.unknownGaps || [];
    if (!gaps.length && !fixes.length) return '';

    const badgeClass = gaps.length === 0 ? 'good' : gaps.length <= 5 ? 'warn' : 'bad';
    let rows = '';
    for (const f of fixes) {
      const isColor = f.value && /^(#|rgb|hsl)/.test(f.value);
      rows += `<div class="row"><span class="row-dot gap"></span><span class="row-name">${esc(f.token)}</span>${isColor ? `<span class="row-swatch" style="background:${esc(f.value)}"></span>` : ''}<span class="row-value">${esc(f.value)}</span></div>`;
    }
    for (const g of unknowns) {
      rows += `<div class="row"><span class="row-dot fail"></span><span class="row-name">${esc(g)}</span><span class="row-value">unmapped</span></div>`;
    }

    return `
    <div class="section${gaps.length ? ' is-open' : ''}">
      <div class="section-header">
        <span class="section-title">Token Gaps</span>
        <span class="section-badge ${badgeClass}">${gaps.length} gap${gaps.length !== 1 ? 's' : ''}</span>
        <span class="section-chevron">&#9662;</span>
      </div>
      <div class="section-body">
        <div class="section-hint">Standard tokens — send to Connectry for permanent engine fix</div>
        ${rows}
      </div>
    </div>`;
  }

  function buildComponentSection(componentResults) {
    if (!componentResults) return '';
    const s = componentResults.summary;
    const active = Object.entries(componentResults.standard).filter(([, v]) => v.found > 0);
    if (!active.length) return '';

    let rows = '';
    for (const [, data] of active) {
      const total = data.styled + data.partial + data.unstyled;
      const pct = total > 0 ? Math.round((data.styled / total) * 100) : 100;
      const dotClass = pct >= 90 ? 'pass' : pct >= 50 ? 'gap' : 'fail';
      rows += `<div class="row"><span class="row-dot ${dotClass}"></span><span class="row-name" style="font-family:inherit">${esc(data.label)}</span><span class="row-value">${data.styled}/${total} styled</span></div>`;
    }

    // Managed packages
    if (componentResults.managed?.length) {
      const pkgs = [...new Set(componentResults.managed.map(m => m.packageName))];
      rows += `<div class="row"><span class="row-dot gap"></span><span class="row-name" style="font-family:inherit">Managed: ${esc(pkgs.join(', '))}</span><span class="row-value">${componentResults.managed.length} components</span></div>`;
    }

    const healthPct = s.totalStandardFound > 0
      ? Math.round(((s.totalStyled + s.totalPartial * 0.5) / s.totalStandardFound) * 100)
      : 100;
    const badgeClass = healthPct >= 85 ? 'good' : healthPct >= 60 ? 'warn' : 'bad';

    return `
    <div class="section is-open">
      <div class="section-header">
        <span class="section-title">Components</span>
        <span class="section-badge ${badgeClass}">${healthPct}% health</span>
        <span class="section-badge info">${s.standardTypes} types</span>
        <span class="section-chevron">&#9662;</span>
      </div>
      <div class="section-body">
        <div class="section-hint">Standard SF &amp; managed package components</div>
        ${rows}
      </div>
    </div>`;
  }

  function buildLWCPatchesSection(fixReport) {
    const patches = fixReport?.componentPatches;
    if (!patches?.length) return '';

    let rows = '';
    for (const p of patches) {
      rows += `<div class="row"><span class="row-dot pass"></span><span class="row-name">&lt;${esc(p.tag)}&gt;</span><span class="row-value">${p.rules.length} rules</span></div>`;
    }

    return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Custom LWC Patches</span>
        <span class="section-badge info">${patches.length} fixable</span>
        <span class="section-chevron">&#9662;</span>
      </div>
      <div class="section-body">
        <div class="section-hint">Your org's custom components — apply local patches in the diagnostic panel</div>
        ${rows}
      </div>
    </div>`;
  }

  function buildActivePatchesSection(patchSummary) {
    if (!patchSummary?.total) return '';
    let rows = '';
    for (const t of patchSummary.tags) {
      rows += `<div class="row"><span class="row-dot ${t.enabled ? 'pass' : 'fail'}"></span><span class="row-name">&lt;${esc(t.tag)}&gt;</span><span class="row-value">${t.enabled ? 'enabled' : 'disabled'}</span></div>`;
    }
    return `
    <div class="section is-open">
      <div class="section-header">
        <span class="section-title">Active Patches</span>
        <span class="section-badge good">${patchSummary.enabled} on</span>
        ${patchSummary.disabled ? `<span class="section-badge bad">${patchSummary.disabled} off</span>` : ''}
        <span class="section-chevron">&#9662;</span>
      </div>
      <div class="section-body">${rows}</div>
    </div>`;
  }

  function buildTestingSection(testingProgress) {
    if (!testingProgress || !ns.PAGE_TYPES) return '';
    const summary = ns.getCompletionSummary?.(testingProgress);
    if (!summary) return '';

    const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
    const badgeClass = pct >= 80 ? 'good' : pct >= 40 ? 'warn' : 'bad';

    let rows = '';
    for (const item of summary.items) {
      const isDone = item.completed;
      const tokenPct = item.result?.tokenCoverage != null ? `${Math.round(item.result.tokenCoverage * 100)}%` : '';
      const compPct = item.result?.componentHealth != null ? `${Math.round(item.result.componentHealth)}%` : '';
      rows += `
        <div class="test-item ${isDone ? 'test-done' : ''}">
          <span class="test-check">${isDone ? '&#10003;' : '&#9675;'}</span>
          <span class="test-label">${esc(item.label)}</span>
          ${item.manual ? '<span class="test-manual">manual</span>' : ''}
          ${tokenPct ? `<span class="test-score">${tokenPct}</span>` : ''}
          ${compPct ? `<span class="test-score">${compPct}</span>` : ''}
        </div>`;
    }

    return `
    <div class="section is-open">
      <div class="section-header">
        <span class="section-title">Testing Progress</span>
        <span class="section-badge ${badgeClass}">${summary.completed}/${summary.total}</span>
        <span class="section-chevron">&#9662;</span>
      </div>
      <div class="section-body">${rows}</div>
    </div>`;
  }

  function buildCSSFixBlock(fullCSS) {
    if (!fullCSS) return '';
    return `
    <div class="css-block-wrapper">
      <div class="css-block-header">
        <span class="css-block-title">Generated CSS Fixes</span>
        <button class="css-block-copy">Copy</button>
      </div>
      <div class="css-block">${esc(fullCSS)}</div>
    </div>`;
  }
})();

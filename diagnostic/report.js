/**
 * Theme Diagnostic Report — extension page script
 *
 * Loaded by diagnostic/report.html. Reads an opts blob from
 * chrome.storage.session (keyed by the ?id=... URL param), renders
 * the report into the page, and wires up interactivity.
 *
 * Lives on chrome-extension:// origin so SF's CSP doesn't block it.
 */
(async () => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) {
    showFailure('Missing report ID.');
    return;
  }

  const key = 'sft-report-' + id;
  let opts;
  try {
    const stored = await chrome.storage.session.get(key);
    opts = stored[key];
  } catch (err) {
    console.error('[SFT Report] storage read failed', err);
    showFailure('Could not read report data.');
    return;
  }
  if (!opts) {
    showFailure('Report data not found. Reload the panel and try again.');
    return;
  }

  renderReport(opts);
  wireInteractivity();

  // Release the stored blob after rendering (the tab is loaded, we don't
  // need it anymore).
  try { await chrome.storage.session.remove(key); } catch (_) {}

  function showFailure(msg) {
    const app = document.getElementById('app') || document.body;
    app.innerHTML = `<div style="padding:60px 24px;text-align:center;font-family:system-ui;color:#888">${esc(msg)}</div>`;
  }

  // ─── Rendering ─────────────────────────────────────────────────────────

  function renderReport(opts) {
    const {
      themeName = 'unknown',
      themeColors,
      scanResults,
      componentResults,
      fixReport,
      patchSummary,
      screenshotDataUrl,
      host: optHost,
      pageUrl: optPageUrl,
      generatedAt,
    } = opts;

    const timestamp = generatedAt || new Date().toISOString().replace('T', ' ').slice(0, 19);
    const fullHost = optHost || '';
    const host = fullHost.replace('.my.salesforce.com', '').replace('.lightning.force.com', '').split('.')[0] || fullHost;
    const pageUrl = optPageUrl || '';

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

    const swatchCols = themeColors
      ? [themeColors.background, themeColors.surface, themeColors.accent, themeColors.textPrimary]
      : [];

    document.title = `Theme Diagnostic — ${themeName} | Connectry`;

    const app = document.getElementById('app');
    app.innerHTML = `
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
          <input type="text" id="searchBox" class="report-search" placeholder="Filter components / tokens…" />
          <button class="report-btn" id="themeToggleBtn" title="Toggle light/dark">
            <svg class="icon-sun" viewBox="0 0 14 14" fill="none" width="14" height="14">
              <circle cx="7" cy="7" r="2.8" stroke="currentColor" stroke-width="1.4"/>
              <path d="M7 1.2v1.4M7 11.4v1.4M1.2 7h1.4M11.4 7h1.4M2.9 2.9l1 1M10.1 10.1l1 1M2.9 11.1l1-1M10.1 3.9l1-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <svg class="icon-moon" viewBox="0 0 14 14" fill="none" width="14" height="14">
              <path d="M11.5 8.5a4.5 4.5 0 0 1-5.9-5.9 4.8 4.8 0 1 0 5.9 5.9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            </svg>
            <span class="icon-label-dark">Light</span>
            <span class="icon-label-light">Dark</span>
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
        <div class="report-theme-card">
          ${swatchCols.length ? `<div class="report-swatch">${swatchCols.map(c => `<span style="background:${esc(c)}"></span>`).join('')}</div>` : ''}
          <div class="report-theme-info">
            <div class="report-theme-name">${esc(themeName)}</div>
            <div class="report-theme-org">${esc(host)} &middot; ${esc(fullHost)}</div>
          </div>
        </div>

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
          ${patchSummary?.total ? `<div class="kpi-card"><div class="kpi-value ${patchSummary.enabled > 0 ? 'ok' : 'good'}">${patchSummary.enabled}/${patchSummary.total}</div><div class="kpi-label">Patches</div></div>` : ''}
        </div>

        ${buildScreenshotSection(screenshotDataUrl)}
        ${buildTokenGapsSection(scanResults, fixReport)}
        ${buildComponentSection(componentResults)}
        ${buildLWCPatchesSection(fixReport)}
        ${buildActivePatchesSection(patchSummary)}
        ${buildCSSFixBlock(fixReport?.fullCSS)}

        <div class="report-footer">
          Built with care by <a href="https://connectry.io" target="_blank">Connectry</a><br>
          Report is a point-in-time snapshot. Re-scan for current state.
        </div>
      </div>
    `;
  }

  // ─── Interactivity ─────────────────────────────────────────────────────

  function wireInteractivity() {
    // Section collapse
    document.querySelectorAll('.section-header').forEach(h => {
      h.addEventListener('click', () => h.closest('.section').classList.toggle('is-open'));
    });

    // CSS copy
    document.querySelectorAll('.css-block-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const block = btn.closest('.css-block-wrapper').querySelector('.css-block');
        navigator.clipboard.writeText(block.textContent).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      });
    });

    // Save as PDF
    const pdfBtn = document.getElementById('savePdfBtn');
    if (pdfBtn) pdfBtn.addEventListener('click', () => window.print());

    // Theme toggle — CSS-driven via [data-theme] on <body>
    const themeBtn = document.getElementById('themeToggleBtn');
    const applyTheme = (t) => {
      document.body.setAttribute('data-theme', t);
      if (themeBtn) themeBtn.title = 'Switch to ' + (t === 'dark' ? 'light' : 'dark');
    };
    let saved = null;
    try { saved = localStorage.getItem('cx-report-theme'); } catch (_) {}
    const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light' : 'dark';
    applyTheme(saved || prefers);
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.body.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('cx-report-theme', next); } catch (_) {}
      });
    }

    // Live filter — hides non-matching rows. Auto-expands sections with matches.
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', () => {
        const q = searchBox.value.trim().toLowerCase();
        document.querySelectorAll('.section').forEach(section => {
          const rows = section.querySelectorAll('.row');
          if (!rows.length) return;
          let matchCount = 0;
          rows.forEach(row => {
            if (!q) {
              row.classList.remove('is-hidden');
              matchCount++;
            } else {
              const text = row.textContent.toLowerCase();
              const match = text.includes(q);
              row.classList.toggle('is-hidden', !match);
              if (match) matchCount++;
            }
          });
          // Drop existing empty-filter note, add if no matches and query active
          const body = section.querySelector('.section-body');
          const existingNote = body?.querySelector('.filter-empty');
          if (existingNote) existingNote.remove();
          if (q && matchCount === 0 && body) {
            const note = document.createElement('div');
            note.className = 'filter-empty';
            note.textContent = 'No matches in this section.';
            body.appendChild(note);
          }
          // Auto-expand sections with matches while searching
          if (q && matchCount > 0) section.classList.add('is-open');
        });
      });
    }
  }

  // ─── Section builders ──────────────────────────────────────────────────

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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

    const badgeClass = gaps.length === 0 ? 'good' : gaps.length <= 5 ? 'warn' : 'bad';
    const badgeText = gaps.length === 0 ? 'all covered' : `${gaps.length} gap${gaps.length !== 1 ? 's' : ''}`;

    let body;
    if (!gaps.length && !fixes.length) {
      body = `<div class="section-hint">All tokens the page uses are provided by this theme — no gaps.</div>`;
    } else {
      let rows = '';
      for (const f of fixes) {
        const isColor = f.value && /^(#|rgb|hsl)/.test(f.value);
        rows += `<div class="row"><span class="row-dot gap"></span><span class="row-name">${esc(f.token)}</span>${isColor ? `<span class="row-swatch" style="background:${esc(f.value)}"></span>` : ''}<span class="row-value">${esc(f.value)}</span></div>`;
      }
      for (const g of unknowns) {
        rows += `<div class="row"><span class="row-dot fail"></span><span class="row-name">${esc(g)}</span><span class="row-value">unmapped</span></div>`;
      }
      body = `<div class="section-hint">Standard tokens — send to Connectry for permanent engine fix.</div>${rows}`;
    }

    return `
      <div class="section${gaps.length ? ' is-open' : ''}">
        <div class="section-header">
          <span class="section-title">Tokens</span>
          <span class="section-badge ${badgeClass}">${badgeText}</span>
          <span class="section-chevron">&#9662;</span>
        </div>
        <div class="section-body">${body}</div>
      </div>`;
  }

  function buildComponentSection(componentResults) {
    if (!componentResults) return '';
    const s = componentResults.summary;
    const active = Object.entries(componentResults.standard).filter(([, v]) => v.found > 0);
    if (!active.length && !componentResults.managed?.length) return '';

    let rows = '';
    for (const [, data] of active) {
      const total = data.styled + data.partial + data.unstyled;
      const pct = total > 0 ? Math.round((data.styled / total) * 100) : 100;
      const dotClass = pct >= 90 ? 'pass' : pct >= 50 ? 'gap' : 'fail';
      rows += `<div class="row"><span class="row-dot ${dotClass}"></span><span class="row-name" style="font-family:inherit">${esc(data.label)}</span><span class="row-value">${data.styled}/${total} styled</span></div>`;
    }
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
          <div class="section-hint">Standard SF &amp; managed package components on this page.</div>
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
          <div class="section-hint">Your org's custom components — apply local patches in the diagnostic panel.</div>
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

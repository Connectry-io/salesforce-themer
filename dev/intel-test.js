'use strict';

const intel = self.ConnectryIntel;
const $ = (id) => document.getElementById(id);
let lastSuggestionId = null;

async function refreshConsentState() {
  const c = await intel.getConsent();
  $('consent').checked = c;
  $('consent-state').textContent = c ? 'granted' : 'denied';
}

$('consent').addEventListener('change', async (e) => {
  await intel.setConsent(e.target.checked);
  refreshConsentState();
});

$('btn-config').addEventListener('click', async () => {
  $('out-config').textContent = '...';
  const bundled = chrome.runtime.getURL('intelligence/bundled/global.css');
  const r = await intel.fetchConfig('patches/global', { bundledFallbackUrl: bundled });
  $('out-config').textContent = JSON.stringify(r, null, 2);
});

$('btn-event').addEventListener('click', async () => {
  $('out-event').textContent = '...';
  const r = await intel.sendEvent('scan.findings', {
    sampleGaps: ['--slds-c-button-brand-color-background', '--slds-g-color-accent-1'],
    page: 'dev-tester',
    themeId: 'cosmos',
  });
  $('out-event').textContent = JSON.stringify(r, null, 2);
});

$('btn-suggest').addEventListener('click', async () => {
  $('out-suggest').textContent = '...';
  const r = await intel.suggestFix({
    intent: 'gap_to_patch',
    findings: {
      gaps: [
        {
          id: 'gap-001',
          component: 'slds-path__item',
          issue: 'unstyled — falls back to default SLDS gray',
          dom_snippet: '<li class="slds-path__item slds-is-current"><a class="slds-path__link">Step 2</a></li>',
        },
      ],
    },
    context: {
      themeId: 'cosmos',
      activeTokens: {
        '--theme-accent': '#7c3aed',
        '--theme-accent-fg': '#ffffff',
      },
    },
  });
  $('out-suggest').textContent = JSON.stringify(r, null, 2);
  if (r?.suggestion_id) {
    lastSuggestionId = r.suggestion_id;
    $('decide-controls').style.display = 'block';
  }
});

$('btn-accept').addEventListener('click', async () => {
  if (!lastSuggestionId) return;
  const r = await intel.decideSuggestion(lastSuggestionId, { decision: 'accepted', publish: true });
  $('out-decide').textContent = JSON.stringify(r, null, 2);
});

$('btn-reject').addEventListener('click', async () => {
  if (!lastSuggestionId) return;
  const r = await intel.decideSuggestion(lastSuggestionId, {
    decision: 'rejected',
    rejectReason: $('reject-reason').value || null,
  });
  $('out-decide').textContent = JSON.stringify(r, null, 2);
});

refreshConsentState();

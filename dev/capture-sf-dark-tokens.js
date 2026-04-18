/**
 * SF Dark Mode Token Capture
 * ============================================================
 * Run this in Chrome DevTools console on a Salesforce tab where:
 *   1. The org has SLDS 2 / Cosmos theme enabled
 *   2. Dark mode is enabled in org settings
 *   3. Your user profile is set to "Dark" (profile menu → Dark)
 *
 * It captures the computed values of every --lwc-color* and
 * --slds-g-color-* token at `:root` and a representative card
 * element, then prints a JSON blob you can paste back to Archy.
 *
 * SF doesn't publish flat dark-mode hex values — they're
 * runtime-resolved from the org's brand color. This script is
 * the only way to get accurate values for the salesforce-dark
 * baseline preset.
 *
 * Usage:
 *   1. Open any themed SF page (e.g. Home)
 *   2. Disable Themer temporarily (chrome://extensions → toggle off)
 *      so you capture SF's native tokens, not ours
 *   3. DevTools → Console → paste the entire contents of this file
 *   4. Copy the `=== SF DARK TOKEN CAPTURE ===` JSON block
 *   5. Paste it in the next Archy session
 */

(() => {
  const NEEDED_PREFIXES = ['--lwc-color', '--slds-g-color', '--slds-c-'];

  // Harvest all CSS custom properties from :root
  function harvestTokens(el) {
    const computed = getComputedStyle(el);
    const out = {};
    // Walk the full computed-property list
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (NEEDED_PREFIXES.some((p) => prop.startsWith(p))) {
        const value = computed.getPropertyValue(prop).trim();
        if (value) out[prop] = value;
      }
    }
    return out;
  }

  // Root tokens (global design system values)
  const rootTokens = harvestTokens(document.documentElement);

  // Also sample from a card if present — some tokens resolve differently in component scope
  const sampleCard = document.querySelector('.slds-card, article.slds-card') || document.body;
  const cardTokens = harvestTokens(sampleCard);

  // Also capture SLDS 2 surface elevation on representative elements
  const surfaceSamples = {};
  const surfaceSelectors = {
    body: 'body',
    card: '.slds-card',
    modal: '.slds-modal__container',
    nav: '.slds-context-bar, one-app-nav-bar, .oneGlobalNav',
    globalHeader: '.slds-global-header, .slds-global-header_container, header#oneHeader',
    pageHeader: '.slds-page-header',
    table: '.slds-table',
    input: '.slds-input, input.slds-input',
  };
  for (const [name, sel] of Object.entries(surfaceSelectors)) {
    const el = document.querySelector(sel);
    if (el) {
      const cs = getComputedStyle(el);
      surfaceSamples[name] = {
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        borderColor: cs.borderTopColor,
      };
    }
  }

  // Detect current SF theme state
  const meta = {
    timestamp: new Date().toISOString(),
    url: location.href.slice(0, 200),
    hostname: location.hostname,
    bodyClasses: document.body.className,
    htmlDataset: Object.assign({}, document.documentElement.dataset),
    colorSchemeAttr: document.documentElement.getAttribute('data-slds-theme')
      || document.documentElement.getAttribute('color-scheme')
      || document.body.getAttribute('data-slds-theme')
      || 'unknown',
    prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    sldsVersion: document.querySelector('[data-slds-version]')?.getAttribute('data-slds-version')
      || (document.body.className.match(/slds-scope|slds-2/)?.[0] || 'unknown'),
  };

  const capture = {
    meta,
    rootTokens,
    cardTokens,
    surfaceSamples,
    tokenCount: Object.keys(rootTokens).length,
  };

  console.log('=== SF DARK TOKEN CAPTURE ===');
  console.log(JSON.stringify(capture, null, 2));
  console.log('=== END CAPTURE ===');
  console.log(
    `Captured ${capture.tokenCount} root tokens. ` +
      `Copy the JSON block above (between === markers) and paste it back to Archy.`
  );

  // Also write to clipboard if the API is available
  try {
    const text = JSON.stringify(capture, null, 2);
    navigator.clipboard?.writeText(text).then(
      () => console.log('✓ Capture also copied to clipboard.'),
      () => {}
    );
  } catch {}

  return capture;
})();

/**
 * Host gate — runs FIRST in content_scripts at document_start.
 *
 * The manifest matches `*.lightning.force.com`, `*.my.salesforce.com`,
 * etc. (post-v2.6.1 narrowing) plus a handful of legacy hosts. Even with
 * that narrowing, some SF-branded subdomains under `force.com` or
 * `visualforce.com` are NOT actual Salesforce org tabs and must NEVER
 * be themed or patched (help, trailhead, AppExchange, etc.).
 *
 * This script centralizes the "is this a real SF org tab?" decision so
 * every other content script can make a single-line bail-out check:
 *
 *     if (window.__sftHostGate?.shouldSkip) return;
 *
 * Previously this logic lived only in content/content.js, which loads
 * LAST in the script array — meaning 19 other scripts (including
 * patch-loader, which injects AI-patch CSS) ran on non-org hosts
 * regardless. Shipping this gate was a customer-visible fix (v2.6.1):
 * the patches were recoloring SLDS brand buttons on help.salesforce.com
 * to transparent/ghost, since theme tokens were undefined there.
 *
 * This file is the single source of truth for host gating. If you add
 * a new content script with side effects, check `__sftHostGate`
 * before doing anything to the DOM.
 */
(() => {
  'use strict';

  if (window.__sftHostGate) return; // already evaluated this frame

  const hostname = window.location.hostname;
  const pathname = window.location.pathname + window.location.search;

  // Non-org Salesforce subdomains that should NEVER be themed.
  // Keep in sync with content/content.js NON_ORG_HOSTS (same list).
  const NON_ORG_HOSTS = [
    'appexchange.salesforce.com',
    'developer.salesforce.com',
    'help.salesforce.com',
    'trailhead.salesforce.com',
    'trailblazer.salesforce.com',
    'admin.salesforce.com',
    'partners.salesforce.com',
    'www.salesforce.com',
    'login.salesforce.com',
    'test.salesforce.com',
    'status.salesforce.com',
    'trust.salesforce.com',
    'ideas.salesforce.com',
    'success.salesforce.com',
    'certification.salesforce.com',
    'medium.salesforce.com',
  ];
  const isNonOrgHost = NON_ORG_HOSTS.includes(hostname);

  // Positive check: must look like an org instance, Setup host, or VF host.
  const isOrgHost = (
    hostname.endsWith('.my.salesforce.com') ||
    hostname.endsWith('.lightning.force.com') ||
    hostname.endsWith('.my.salesforce-setup.com') ||
    hostname.endsWith('.salesforce-setup.com') ||
    hostname.endsWith('.visualforce.com') ||
    hostname.endsWith('.cloudforce.com') ||
    hostname.endsWith('.force.com')
  );

  // Skip login, verification, and other pre-auth pages — don't theme them.
  const skipPatterns = [
    '/login',
    '/_ui/identity/',
    '/setup/secur/',
    '/secur/login',
    '/one/one.app?login',
  ];
  const isPreAuthPath = skipPatterns.some((p) => pathname.includes(p));

  const shouldSkip = isNonOrgHost || !isOrgHost || isPreAuthPath;

  window.__sftHostGate = Object.freeze({
    hostname,
    pathname,
    isNonOrgHost,
    isOrgHost,
    isPreAuthPath,
    shouldSkip,
  });

  if (shouldSkip) {
    // One-line diagnostic so we can tell from a page console why no theming
    // is happening. Keep terse — this runs on every SF-adjacent page load.
    console.log('[SFT host-gate] skipping', { hostname, isNonOrgHost, isOrgHost, isPreAuthPath });
  }
})();

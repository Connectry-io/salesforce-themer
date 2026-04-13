/**
 * Connectry Intelligence Layer — client (Phase 0)
 *
 * Talks to three Edge Functions on the Connectry Supabase project:
 *   GET  /functions/v1/config/:product/:key
 *   POST /functions/v1/events
 *   POST /functions/v1/ai-suggest          (and /ai-suggest/:id/decide)
 *
 * Hard rules (Clawdy review):
 *   1. NO runtime CODE fetch from server. Only CSS patches and JSON configs
 *      cross the wire. This file never evals or `new Function`s anything.
 *   2. Always fall back to bundled assets if the backend is unreachable —
 *      the extension must keep working offline.
 *   3. Privacy: telemetry is opt-in. Callers must check the consent flag
 *      before posting events that contain DOM snippets or screenshots.
 */
(() => {
  'use strict';

  const ns = (self.ConnectryIntel = self.ConnectryIntel || {});
  if (ns._loaded) return;
  ns._loaded = true;

  const PROJECT_REF = 'pemofbbniuzogxzzioyp';
  const BASE_URL = `https://${PROJECT_REF}.supabase.co/functions/v1`;
  const PRODUCT_ID = 'themer';

  // Phase 0: shared dev secret. This ships in the extension binary, which
  // means it is NOT actually secret — it's a soft gate to keep casual
  // crawlers off /events. Real auth lands in Phase 1 with Supabase Auth.
  const DEV_SHARED_SECRET = '54f3bfa43f131c8392b68a1572c4acd37177a421f5968522ba98c35a8ba90106';

  const TIMEOUT_MS = 4000;

  // ── anonymous user id (extension-local, no PII) ──────────────────────────

  async function getAnonUserId() {
    if (!chrome?.storage?.local) return null;
    const { sfThemerAnonId } = await chrome.storage.local.get('sfThemerAnonId');
    if (sfThemerAnonId) return sfThemerAnonId;
    const id = 'anon_' + crypto.randomUUID();
    await chrome.storage.local.set({ sfThemerAnonId: id });
    return id;
  }

  async function getConsent() {
    if (!chrome?.storage?.local) return false;
    const { sfThemerTelemetryConsent } = await chrome.storage.local.get('sfThemerTelemetryConsent');
    return sfThemerTelemetryConsent === true;
  }

  async function setConsent(value) {
    if (!chrome?.storage?.local) return;
    await chrome.storage.local.set({ sfThemerTelemetryConsent: !!value });
  }

  // ── timeout-safe fetch ──────────────────────────────────────────────────

  function fetchWithTimeout(url, opts = {}, timeoutMs = TIMEOUT_MS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: ctrl.signal })
      .finally(() => clearTimeout(timer));
  }

  // ── /config — CSS patch / JSON config fetch with bundled fallback ───────

  /**
   * Fetch a hosted patch/config. Falls back to a bundled asset when the
   * backend is unreachable or returns 404. Returns { content, contentType,
   * etag, version, source: 'remote'|'bundled'|'cache' }.
   */
  async function fetchConfig(key, { namespace = 'default', bundledFallbackUrl = null } = {}) {
    const cacheKey = `intelCfg:${PRODUCT_ID}:${namespace}:${key}`;
    const cached = await readCache(cacheKey);

    try {
      const headers = {};
      if (cached?.etag) headers['if-none-match'] = cached.etag;
      const res = await fetchWithTimeout(
        `${BASE_URL}/config/${encodeURIComponent(PRODUCT_ID)}/${key}?namespace=${encodeURIComponent(namespace)}`,
        { method: 'GET', headers },
      );
      if (res.status === 304 && cached) {
        return { ...cached, source: 'cache' };
      }
      if (res.ok) {
        const content = await res.text();
        const out = {
          content,
          contentType: res.headers.get('content-type') || 'text/css',
          etag: res.headers.get('etag') || '',
          version: Number(res.headers.get('x-config-version') || 0),
          source: 'remote',
        };
        await writeCache(cacheKey, out);
        return out;
      }
      // Non-OK (404, 5xx) → try bundled fallback below.
    } catch (err) {
      console.warn('[ConnectryIntel] config fetch failed, falling back', err);
    }

    if (cached) return { ...cached, source: 'cache' };
    if (bundledFallbackUrl) {
      try {
        const res = await fetch(bundledFallbackUrl);
        if (res.ok) {
          return {
            content: await res.text(),
            contentType: bundledFallbackUrl.endsWith('.json') ? 'application/json' : 'text/css',
            etag: '',
            version: 0,
            source: 'bundled',
          };
        }
      } catch (e) {
        console.warn('[ConnectryIntel] bundled fallback failed', e);
      }
    }
    return null;
  }

  async function readCache(key) {
    if (!chrome?.storage?.local) return null;
    const obj = await chrome.storage.local.get(key);
    return obj?.[key] || null;
  }
  async function writeCache(key, value) {
    if (!chrome?.storage?.local) return;
    await chrome.storage.local.set({ [key]: value });
  }

  // ── /events — telemetry ingest ──────────────────────────────────────────

  async function sendEvent(eventType, payload, { requireConsent = true } = {}) {
    if (requireConsent && !(await getConsent())) return { skipped: 'no-consent' };
    const anonId = await getAnonUserId();
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-connectry-secret': DEV_SHARED_SECRET,
        },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          event_type: eventType,
          anon_user_id: anonId,
          session_id: ns._sessionId || (ns._sessionId = crypto.randomUUID()),
          payload,
          user_agent: navigator.userAgent,
        }),
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  // ── /ai-suggest — request a fix from the LLM ────────────────────────────

  async function suggestFix({ intent, findings, context, screenshotDataUrl = null, mode = 'silent' }) {
    if (!(await getConsent())) {
      return { error: 'consent-required', message: 'Telemetry consent required for AI suggestions.' };
    }
    const anonId = await getAnonUserId();
    try {
      const body = {
        product_id: PRODUCT_ID,
        intent,
        findings,
        context: context || {},
        mode,
        anon_user_id: anonId,
      };
      if (screenshotDataUrl) body.screenshot_data_url = screenshotDataUrl;
      const res = await fetchWithTimeout(`${BASE_URL}/ai-suggest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-connectry-secret': DEV_SHARED_SECRET,
        },
        body: JSON.stringify(body),
      }, 60_000);
      if (!res.ok) return { error: `HTTP ${res.status}: ${await res.text()}` };
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  // ── Advanced-mode toggle (separate from telemetry consent) ───────────────
  // Telemetry consent: legal/privacy gate. Advanced mode: capability flag.
  // Public Web Store build will default Advanced=false; users opt in via the
  // panel's "Advanced Scan" toggle. Noland's local dev install leaves it on.

  async function getAdvancedMode() {
    if (!chrome?.storage?.local) return false;
    const { sfThemerAdvancedMode } = await chrome.storage.local.get('sfThemerAdvancedMode');
    return sfThemerAdvancedMode === true;
  }

  async function setAdvancedMode(value) {
    if (!chrome?.storage?.local) return;
    await chrome.storage.local.set({ sfThemerAdvancedMode: !!value });
  }

  // ── QA mode (Connectry-internal) ─────────────────────────────────────────
  // When ON, the patch-loader includes 'qa'-tier patches from app_configs
  // alongside 'global'. Customer installs must keep this OFF. See SECURITY.md
  // ("Tier model"). Also: when ON, accepted suggestions get a "publish to
  // global" UI option. When OFF, accept always lands in qa or local tier.

  async function getQAMode() {
    if (!chrome?.storage?.local) return false;
    const { sfThemerQAMode } = await chrome.storage.local.get('sfThemerQAMode');
    return sfThemerQAMode === true;
  }

  async function setQAMode(value) {
    if (!chrome?.storage?.local) return;
    await chrome.storage.local.set({ sfThemerQAMode: !!value });
  }

  // ── Publish secret (Connectry HQ only) ───────────────────────────────────
  // Stored in chrome.storage.local on Noland's machine; sent only when the
  // user explicitly publishes a suggestion to the 'global' tier. Never bundled
  // with the public Web Store build.

  async function getPublishSecret() {
    if (!chrome?.storage?.local) return null;
    const { sfThemerPublishSecret } = await chrome.storage.local.get('sfThemerPublishSecret');
    return sfThemerPublishSecret || null;
  }

  async function setPublishSecret(value) {
    if (!chrome?.storage?.local) return;
    if (value) await chrome.storage.local.set({ sfThemerPublishSecret: value });
    else await chrome.storage.local.remove('sfThemerPublishSecret');
  }

  // Preview-first vocabulary: decision is one of 'approved', 'reverted',
  // 'dismissed'. The draft has already been auto-written by /ai-suggest;
  // decide just acts on the linked app_configs row.
  //
  //   approved  → promote draft to 'published' (requires publish secret)
  //   reverted  → set is_active=false on the draft
  //   dismissed → no tier change, suggestion closed out
  async function decideSuggestion(id, { decision, rejectReason = null }) {
    const anonId = await getAnonUserId();
    const headers = {
      'content-type': 'application/json',
      'x-connectry-secret': DEV_SHARED_SECRET,
    };
    if (decision === 'approved') {
      const ps = await getPublishSecret();
      if (!ps) {
        return {
          error: 'publish-secret-missing',
          message: 'Approving (→ publishing) requires the Connectry publish secret. Set chrome.storage.local.sfThemerPublishSecret on the HQ machine.',
        };
      }
      headers['x-connectry-publish-secret'] = ps;
    }
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/ai-suggest/${encodeURIComponent(id)}/decide`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          decision,
          reject_reason: rejectReason,
          decided_by: anonId,
        }),
      });
      if (!res.ok) return { error: `HTTP ${res.status}: ${await res.text()}` };
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  Object.assign(ns, {
    PRODUCT_ID,
    fetchConfig,
    sendEvent,
    suggestFix,
    decideSuggestion,
    getConsent,
    setConsent,
    getAdvancedMode,
    setAdvancedMode,
    getQAMode,
    setQAMode,
    getPublishSecret,
    setPublishSecret,
    getAnonUserId,
  });
})();

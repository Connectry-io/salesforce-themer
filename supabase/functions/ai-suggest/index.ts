// POST /ai-suggest                — generate a suggestion from scan findings
// POST /ai-suggest/:id/decide     — accept or reject a pending suggestion
//
// Shared-secret auth in Phase 0. Uses the active prompt_templates row for
// (product_id, intent). Design rule (Clawdy): NO runtime code fetch from the
// server — only CSS patches and JSON configs cross the wire. The model's job
// is to generate CSS deltas, not JavaScript.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.32.1";
import { checkSharedSecret, handleCors, json, supabaseAdmin } from "../_shared/auth.ts";
import { validatePatchCSS } from "../_shared/css-validator.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authFail = checkSharedSecret(req);
  if (authFail) return authFail;

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/+/, "").split("/");
  // parts[0] === 'ai-suggest'
  if (parts.length >= 3 && parts[2] === "decide") {
    return await handleDecide(req, parts[1]);
  }
  return await handleSuggest(req);
});

async function handleSuggest(req: Request): Promise<Response> {
  let body: {
    product_id?: string;
    namespace?: string;
    intent?: string;
    findings?: unknown;
    context?: unknown;
    anon_user_id?: string | null;
    mode?: string;
    screenshot_data_url?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const { product_id, intent, findings } = body;
  if (!product_id || !intent || findings === undefined) {
    return json({ error: "product_id, intent, findings required" }, 400);
  }

  const { url, serviceKey } = supabaseAdmin();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: tmpl, error: tmplErr } = await db
    .from("prompt_templates")
    .select("id, version, model, system_prompt, user_template, params")
    .eq("product_id", product_id)
    .eq("intent", intent)
    .not("promoted_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tmplErr) return json({ error: tmplErr.message }, 500);
  if (!tmpl) return json({ error: `no active prompt for ${product_id}.${intent}` }, 404);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

  const mode = body.mode ?? "silent";
  const userText = renderTemplate(tmpl.user_template, {
    mode,
    findings: JSON.stringify(findings, null, 2),
    context: JSON.stringify(body.context ?? {}, null, 2),
  });

  // Build content blocks — attach the screenshot as a vision input when present.
  const userContent: Array<Record<string, unknown>> = [];
  if (body.screenshot_data_url && typeof body.screenshot_data_url === "string") {
    const m = body.screenshot_data_url.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
    if (m) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: m[1], data: m[2] },
      });
    }
  }
  userContent.push({ type: "text", text: userText });

  const client = new Anthropic({ apiKey: anthropicKey });
  const params = tmpl.params ?? {};
  let modelResp;
  try {
    modelResp = await client.messages.create({
      model: tmpl.model,
      max_tokens: params.max_tokens ?? 2048,
      temperature: params.temperature ?? 0.2,
      system: tmpl.system_prompt,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (e) {
    return json({ error: `anthropic: ${(e as Error).message}` }, 502);
  }

  const text = modelResp.content
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n");

  const parsed = parseSuggestion(text);

  // SECURITY: validate CSS before we auto-write the draft. On failure,
  // store the suggestion as 'rejected' with the reason so future sessions
  // can see why it never made it to draft.
  const patchCss = (parsed as { patch_css?: string })?.patch_css;
  const configKey = (parsed as { config_key?: string })?.config_key;
  let validation: { ok: true } | { ok: false, reason: string } | null = null;
  if (patchCss && configKey) {
    validation = validatePatchCSS(patchCss);
  }

  const status = validation?.ok
    ? "previewing"   // auto-written as draft, awaiting human verdict in-tab
    : "rejected";    // either no patch_css/config_key, or allowlist violation

  const rejectReason = validation && !validation.ok
    ? `css-allowlist-violation: ${validation.reason}`
    : !patchCss || !configKey
      ? "no patch_css/config_key in output"
      : null;

  const { data: row, error: insErr } = await db
    .from("ai_suggestions")
    .insert({
      product_id,
      namespace: body.namespace ?? "default",
      intent,
      template_id: tmpl.id,
      input_payload: {
        findings,
        context: body.context ?? null,
        mode,
        screenshot_attached: !!body.screenshot_data_url,
      },
      output_payload: parsed,
      model: tmpl.model,
      tokens_input: modelResp.usage?.input_tokens ?? null,
      tokens_output: modelResp.usage?.output_tokens ?? null,
      status,
      reject_reason: rejectReason,
      decided_by: body.anon_user_id ?? null,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  // If CSS passes the allowlist, auto-write it to app_configs at tier=draft
  // so the extension can live-inject and patch-loader will pick it up on
  // next page load for HQ tabs with QA mode on.
  let appliedConfigId: number | null = null;
  if (validation?.ok && patchCss && configKey) {
    const etag = await sha256(patchCss);
    const { data: latest } = await db
      .from("app_configs")
      .select("version")
      .eq("product_id", product_id)
      .eq("namespace", body.namespace ?? "default")
      .eq("key", configKey)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;
    const { data: cfg, error: cfgErr } = await db
      .from("app_configs")
      .insert({
        product_id,
        namespace: body.namespace ?? "default",
        key: configKey,
        version: nextVersion,
        content_type: "text/css",
        content: patchCss,
        etag,
        is_active: true,
        tier: "draft",
        created_by: `ai-suggest:${row.id}`,
      })
      .select("id")
      .single();
    if (!cfgErr && cfg) {
      appliedConfigId = cfg.id;
      await db.from("ai_suggestions").update({
        applied_config_id: appliedConfigId,
      }).eq("id", row.id);
    }
  }

  return json({
    suggestion_id: row.id,
    model: tmpl.model,
    template_version: tmpl.version,
    status,
    reject_reason: rejectReason,
    applied_config_id: appliedConfigId,
    output: parsed,
  });
}

async function handleDecide(req: Request, id: string): Promise<Response> {
  let body: {
    decision?: string;
    reject_reason?: string;
    decided_by?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  // New preview-first vocabulary:
  //   approved  → promote the linked draft in app_configs to tier='published'
  //   reverted  → set the linked draft is_active=false (un-ship it)
  //   dismissed → leave the draft where it is, mark suggestion dismissed
  // Legacy: 'accepted' and 'rejected' are still accepted for back-compat
  // (pre-preview-flow callers) and treated as dismissed (no tier change).
  const decision = body.decision;
  const validDecisions = new Set(["approved", "reverted", "dismissed", "accepted", "rejected"]);
  if (!decision || !validDecisions.has(decision)) {
    return json({ error: "decision must be 'approved' | 'reverted' | 'dismissed'" }, 400);
  }

  // Promotion to 'published' requires PUBLISH_SECRET.
  if (decision === "approved") {
    const expected = Deno.env.get("PUBLISH_SECRET");
    if (!expected) {
      return json({ error: "server misconfigured: PUBLISH_SECRET unset" }, 500);
    }
    const got = req.headers.get("x-connectry-publish-secret");
    if (got !== expected) {
      return json(
        { error: "publish-forbidden: x-connectry-publish-secret missing or wrong" },
        403,
      );
    }
  }

  const { url, serviceKey } = supabaseAdmin();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: sugg, error: fetchErr } = await db
    .from("ai_suggestions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!sugg) return json({ error: "suggestion not found" }, 404);
  if (!["previewing", "pending"].includes(sugg.status)) {
    return json({ error: `already ${sugg.status}` }, 409);
  }

  const update: Record<string, unknown> = {
    status: decision,
    decided_by: body.decided_by ?? null,
    decided_at: new Date().toISOString(),
  };
  if (decision === "reverted" || decision === "rejected") {
    update.reject_reason = body.reject_reason ?? null;
  }

  // Act on the linked draft in app_configs based on the decision.
  // applied_config_id was set by /ai-suggest when the draft was auto-written.
  const appliedConfigId = sugg.applied_config_id as number | null;

  if (decision === "approved" && appliedConfigId) {
    // Promote the linked draft to tier='published'.
    const { error: promoteErr } = await db
      .from("app_configs")
      .update({ tier: "published" })
      .eq("id", appliedConfigId);
    if (promoteErr) return json({ error: `promote failed: ${promoteErr.message}` }, 500);
  } else if (decision === "reverted" && appliedConfigId) {
    // Un-ship the draft. Loader will stop returning it on the next fetch.
    const { error: revertErr } = await db
      .from("app_configs")
      .update({ is_active: false })
      .eq("id", appliedConfigId);
    if (revertErr) return json({ error: `revert failed: ${revertErr.message}` }, 500);
  }
  // 'dismissed' and legacy 'accepted'/'rejected': no tier change — the draft
  // stays as-is (is_active=true, tier='draft'). Suggestion is closed out.

  const { error: updErr } = await db.from("ai_suggestions").update(update).eq("id", id);
  if (updErr) return json({ error: updErr.message }, 500);

  return json({ ok: true, id, status: decision, applied_config_id: appliedConfigId });
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function parseSuggestion(text: string): Record<string, unknown> {
  // Prefer a ```json fenced block, fall back to first {...} blob.
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const blob = fenced ? fenced[1] : text.match(/\{[\s\S]*\}/)?.[0];
  if (blob) {
    try { return JSON.parse(blob); } catch { /* fall through */ }
  }
  return { raw: text };
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

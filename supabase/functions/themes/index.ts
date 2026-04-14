// POST /themes
// Creates or updates a custom theme. Shared-secret authenticated (Phase 0).
// Writes the `themes` row AND the matching `app_configs` row atomically via
// the save_theme() RPC. Rendered CSS is served by the existing
// GET /config/themer/themes/user/<slug> route (ETag-cacheable).
//
// Body:
//   {
//     slug?:         string,     // omit to create, pass to update
//     owner:         string,     // 'studio:<user>' — caller-asserted for now
//     name:          string,
//     base_tokens:   object,     // 23-color input config (engine source of truth)
//     overrides:     object,     // per-token post-derivation tweaks
//     rendered_css:  string      // engine-rendered bundle (cache)
//   }
//
// Response: { slug, etag, version, key }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { checkSharedSecret, handleCors, json, supabaseAdmin } from "../_shared/auth.ts";

const MAX_CSS_BYTES = 512 * 1024; // 512 KB cap — presets are ~40 KB, 12x headroom.
const SLUG_RE = /^theme_[a-z0-9]{12}$/;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // GET /themes — public listing of published custom themes. Used by the
  // popup's "My Themes" panel to surface themes saved from other machines.
  // No auth; the rendered CSS is already publicly fetchable via /config.
  if (req.method === "GET") {
    const { url: sbUrl, serviceKey } = supabaseAdmin();
    const db = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await db
      .from("themes")
      .select("slug, name, owner, updated_at, rendered_css_etag")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: error.message }, 500);
    return json({ themes: data ?? [] });
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authFail = checkSharedSecret(req);
  if (authFail) return authFail;

  let body: {
    slug?: string;
    owner?: string;
    name?: string;
    base_tokens?: Record<string, unknown>;
    overrides?: Record<string, unknown>;
    rendered_css?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const owner = (body.owner ?? "").trim();
  const name = (body.name ?? "").trim();
  const baseTokens = body.base_tokens;
  const overrides = body.overrides ?? {};
  const rendered = body.rendered_css ?? "";

  if (!owner) return json({ error: "owner required" }, 400);
  if (!name) return json({ error: "name required" }, 400);
  if (!baseTokens || typeof baseTokens !== "object") {
    return json({ error: "base_tokens must be an object" }, 400);
  }
  if (typeof rendered !== "string" || rendered.length === 0) {
    return json({ error: "rendered_css required" }, 400);
  }
  if (new Blob([rendered]).size > MAX_CSS_BYTES) {
    return json({ error: `rendered_css exceeds ${MAX_CSS_BYTES} bytes` }, 413);
  }

  let slug = (body.slug ?? "").trim();
  if (slug) {
    if (!SLUG_RE.test(slug)) return json({ error: "invalid slug format" }, 400);
  } else {
    slug = generateSlug();
  }

  const etag = await sha256(rendered);

  const { url: sbUrl, serviceKey } = supabaseAdmin();
  const db = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await db.rpc("save_theme", {
    p_slug: slug,
    p_owner: owner,
    p_name: name,
    p_base_tokens: baseTokens,
    p_overrides: overrides,
    p_rendered_css: rendered,
    p_etag: etag,
  });

  if (error) {
    // 42501 from the RPC = ownership mismatch on update
    if ((error as { code?: string }).code === "42501") {
      return json({ error: "forbidden: theme owned by another user" }, 403);
    }
    return json({ error: error.message }, 500);
  }

  return json(data, 200);
});

function generateSlug(): string {
  // 12 chars of url-safe base36 from crypto.getRandomValues
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = n.toString(36);
  // toString(36) on n <= 2^64 yields up to 13 chars; pad / trim to 12.
  if (s.length < 12) s = s.padStart(12, "0");
  if (s.length > 12) s = s.slice(-12);
  return `theme_${s}`;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

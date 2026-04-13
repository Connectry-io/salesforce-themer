// GET /config/:product/:key[?namespace=default]
// Returns the active config for (product, namespace, key). ETag-cacheable.
// Publicly readable (no shared secret) so extensions can fetch patches at
// document_start without shipping a secret in the binary.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { handleCors, json, supabaseAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  // Path is /config/:product/:key — but ":key" may contain slashes we want to preserve.
  const parts = url.pathname.replace(/^\/+/, "").split("/");
  // parts[0] === 'config' (function name), parts[1] === product, parts[2..] === key segments
  if (parts.length < 3 || parts[0] !== "config") {
    return json({ error: "usage: /config/:product/:key" }, 400);
  }
  const product = parts[1];
  const key = parts.slice(2).join("/");
  const namespace = url.searchParams.get("namespace") ?? "default";

  const { url: sbUrl, serviceKey } = supabaseAdmin();
  const db = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });

  // Index route: GET /config/:product/_index?prefix=patches/
  // Returns JSON list of active (key, version, etag) for the product+namespace,
  // optionally filtered by key prefix. Lets the extension discover which
  // patches exist without hardcoding keys in the client.
  if (key === "_index") {
    const prefix = url.searchParams.get("prefix") ?? "";
    // SECURITY (T4): tier filter. Default 'global' — public callers without
    // ?tier= only ever see globally published patches. QA mode in the
    // extension explicitly requests ?tier=global,qa to also see internal.
    // 'engine' rows are excluded from the loader's view by design (engine wins).
    const tierParam = url.searchParams.get("tier") ?? "global";
    const tiers = tierParam.split(",").map((t) => t.trim()).filter(Boolean);
    const validTiers = tiers.filter((t) => ["qa", "global"].includes(t));
    if (validTiers.length === 0) validTiers.push("global");
    let q = db
      .from("app_configs")
      .select("key, version, etag, content_type, created_at, tier")
      .eq("product_id", product)
      .eq("namespace", namespace)
      .eq("is_active", true)
      .in("tier", validTiers)
      .order("key", { ascending: true });
    if (prefix) q = q.like("key", `${prefix}%`);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    // Deduplicate to the highest active version per key (should already be the
    // case since publish sets is_active only on the latest, but defensive).
    const byKey = new Map<string, typeof data[number]>();
    for (const row of data ?? []) {
      const cur = byKey.get(row.key);
      if (!cur || row.version > cur.version) byKey.set(row.key, row);
    }
    return json({ product, namespace, prefix, entries: Array.from(byKey.values()) });
  }

  const { data, error } = await db
    .from("app_configs")
    .select("version, content_type, content, etag, created_at")
    .eq("product_id", product)
    .eq("namespace", namespace)
    .eq("key", key)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "not found" }, 404);

  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === data.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag: data.etag,
        "cache-control": "public, max-age=60, stale-while-revalidate=3600",
      },
    });
  }

  return new Response(data.content, {
    status: 200,
    headers: {
      "content-type": data.content_type,
      etag: data.etag,
      "x-config-version": String(data.version),
      "cache-control": "public, max-age=60, stale-while-revalidate=3600",
      "access-control-allow-origin": "*",
    },
  });
});

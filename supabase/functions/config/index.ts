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

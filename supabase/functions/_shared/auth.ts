// Shared-secret auth for Phase 0. Every Edge Function validates the
// `x-connectry-secret` header against the DEV_SHARED_SECRET env var.
// Phase 1 will replace this with Supabase Auth + entitlement checks.

export function checkSharedSecret(req: Request): Response | null {
  const expected = Deno.env.get("DEV_SHARED_SECRET");
  if (!expected) {
    return json({ error: "server misconfigured: DEV_SHARED_SECRET unset" }, 500);
  }
  const got = req.headers.get("x-connectry-secret");
  if (got !== expected) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-connectry-secret, x-connectry-publish-secret, if-none-match",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      ...extraHeaders,
    },
  });
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type, x-connectry-secret, x-connectry-publish-secret, if-none-match",
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-max-age": "86400",
      },
    });
  }
  return null;
}

export function supabaseAdmin() {
  // Imported lazily so local tooling doesn't need the dep just to type-check.
  return {
    url: Deno.env.get("SUPABASE_URL")!,
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  };
}

// POST /events — telemetry ingest. Shared-secret auth in Phase 0.
// Body: { product_id, namespace?, event_type, anon_user_id?, session_id?, payload, user_agent? }
// Accepts a single event or an array.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { checkSharedSecret, handleCors, json, supabaseAdmin } from "../_shared/auth.ts";

type Event = {
  product_id: string;
  namespace?: string;
  event_type: string;
  anon_user_id?: string | null;
  session_id?: string | null;
  payload: unknown;
  user_agent?: string | null;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authFail = checkSharedSecret(req);
  if (authFail) return authFail;

  let body: Event | Event[];
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const events = Array.isArray(body) ? body : [body];
  if (events.length === 0) return json({ inserted: 0 });
  if (events.length > 500) return json({ error: "max 500 events per request" }, 413);

  for (const e of events) {
    if (!e?.product_id || !e?.event_type || e?.payload === undefined) {
      return json({ error: "each event requires product_id, event_type, payload" }, 400);
    }
  }

  const { url, serviceKey } = supabaseAdmin();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const rows = events.map((e) => ({
    product_id: e.product_id,
    namespace: e.namespace ?? "default",
    event_type: e.event_type,
    anon_user_id: e.anon_user_id ?? null,
    session_id: e.session_id ?? null,
    payload: e.payload,
    user_agent: e.user_agent ?? req.headers.get("user-agent"),
  }));

  const { error, count } = await db
    .from("telemetry_events")
    .insert(rows, { count: "exact" });

  if (error) return json({ error: error.message }, 500);
  return json({ inserted: count ?? rows.length });
});

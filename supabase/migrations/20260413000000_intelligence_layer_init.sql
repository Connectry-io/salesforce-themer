-- Connectry Intelligence Layer — Phase 0 schema
-- Product-aware from day 1. Themer is the first consumer; Launchpad, Command
-- Center, and AppExchange apps will reuse the same tables.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. app_configs — hosted CSS patches and JSON configs, versioned per product
-- ---------------------------------------------------------------------------
create table if not exists app_configs (
  id            bigserial primary key,
  product_id    text        not null,        -- 'themer', 'launchpad', 'command-center', ...
  namespace     text        not null default 'default',
  key           text        not null,        -- e.g. 'patches/slds-path', 'presets/cosmos'
  version       integer     not null default 1,
  content_type  text        not null,        -- 'text/css', 'application/json'
  content       text        not null,
  etag          text        not null,
  is_active     boolean     not null default true,
  created_by    text,                        -- which Edge Function / human committed it
  created_at    timestamptz not null default now(),
  unique (product_id, namespace, key, version)
);

create index if not exists app_configs_lookup_idx
  on app_configs (product_id, namespace, key, is_active, version desc);

-- ---------------------------------------------------------------------------
-- 2. telemetry_events — scanner findings, usage analytics, errors
-- ---------------------------------------------------------------------------
create table if not exists telemetry_events (
  id           bigserial primary key,
  product_id   text        not null,
  namespace    text        not null default 'default',
  event_type   text        not null,        -- 'scan.findings', 'patch.applied', 'error', ...
  anon_user_id text,                        -- opaque, extension-generated; nullable
  session_id   text,
  payload      jsonb       not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists telemetry_events_product_idx
  on telemetry_events (product_id, event_type, created_at desc);

create index if not exists telemetry_events_payload_gin
  on telemetry_events using gin (payload);

-- ---------------------------------------------------------------------------
-- 3. prompt_templates — versioned AI prompts per product+intent
-- ---------------------------------------------------------------------------
create table if not exists prompt_templates (
  id             bigserial primary key,
  product_id     text        not null,
  intent         text        not null,      -- 'gap_to_patch', 'preset_from_brand', ...
  version        integer     not null default 1,
  model          text        not null,      -- 'claude-opus-4-6', 'claude-haiku-4-5-20251001'
  system_prompt  text        not null,
  user_template  text        not null,      -- handlebars-style placeholders
  params         jsonb       not null default '{}'::jsonb, -- max_tokens, temperature, etc.
  notes          text,
  promoted_at    timestamptz,               -- non-null == active version for (product_id, intent)
  created_at     timestamptz not null default now(),
  unique (product_id, intent, version)
);

create unique index if not exists prompt_templates_active_idx
  on prompt_templates (product_id, intent)
  where promoted_at is not null;

-- ---------------------------------------------------------------------------
-- 4. ai_suggestions — AI proposals awaiting human accept/reject
-- ---------------------------------------------------------------------------
create table if not exists ai_suggestions (
  id             bigserial primary key,
  product_id     text        not null,
  namespace      text        not null default 'default',
  intent         text        not null,
  template_id    bigint      references prompt_templates(id),
  input_payload  jsonb       not null,      -- redacted scan findings + context
  output_payload jsonb       not null,      -- model response parsed
  model          text        not null,
  tokens_input   integer,
  tokens_output  integer,
  status         text        not null default 'pending', -- pending | accepted | rejected | superseded
  reject_reason  text,                                  -- Clawdy review: capture why humans rejected
  decided_by     text,                                  -- anon_user_id or staff handle
  decided_at     timestamptz,
  applied_config_id bigint    references app_configs(id), -- set when accepted + published as a patch
  created_at     timestamptz not null default now()
);

create index if not exists ai_suggestions_status_idx
  on ai_suggestions (product_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: lock everything down. Edge Functions use the service-role key and
-- bypass RLS; no client-side access in Phase 0.
-- ---------------------------------------------------------------------------
alter table app_configs       enable row level security;
alter table telemetry_events  enable row level security;
alter table prompt_templates  enable row level security;
alter table ai_suggestions    enable row level security;

-- (No permissive policies — anon/authenticated clients get nothing until
-- Phase 1 when we add identity and entitlement checks.)

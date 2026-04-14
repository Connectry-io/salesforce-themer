-- Themer V2.5 Migration B: themes table.
--
-- Source of truth for custom / paid themes. The rendered CSS is also mirrored
-- into app_configs at key='themes/user/<slug>' (tier='published',
-- content_type='text/css', is_active=true) so the existing ETag-cacheable
-- GET /config/themer/<key> edge function serves it at runtime.
--
-- base_tokens + overrides = structured config (authoritative on re-render).
-- rendered_css_etag / rendered_at = cache metadata mirroring the app_configs row.
--
-- Presets stay bundled in the extension binary (see ARCHITECTURE.md § V2.5).
-- Org-scoping + RLS deferred until real auth lands (see BACKLOG.md).

create table if not exists themes (
  id                 bigserial   primary key,
  slug               text        not null unique,   -- 'theme_<12-char nanoid>', the activeThemeId
  owner              text        not null,          -- 'studio:<user>' until auth; opaque string
  name               text        not null,
  base_tokens        jsonb       not null,          -- 23-color input config
  overrides          jsonb       not null default '{}'::jsonb,  -- post-derivation per-token tweaks
  rendered_css_etag  text,
  rendered_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists themes_owner_idx
  on themes (owner, updated_at desc);

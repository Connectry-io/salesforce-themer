-- Rename tier values for clarity. See SECURITY.md ("Tier model") + the
-- 2026-04-13 terminology alignment: the hosted patches ARE the engine
-- (once Migration A/B land), so the old 'engine' value is retired.
--
--   qa      → draft      (accepted, HQ-only preview)
--   global  → published  (live for all customers)
--   local   → local      (unchanged; per-user chrome.storage.local)
--   engine  → retired    (no rows use it; drop from the CHECK)

alter table app_configs drop constraint if exists app_configs_tier_check;

update app_configs set tier = 'draft'     where tier = 'qa';
update app_configs set tier = 'published' where tier = 'global';
-- Safety: any stray 'engine' rows (shouldn't exist yet) become 'published'.
update app_configs set tier = 'published' where tier = 'engine';

alter table app_configs
  alter column tier set default 'draft';

alter table app_configs
  add constraint app_configs_tier_check
  check (tier in ('draft', 'published', 'local'));

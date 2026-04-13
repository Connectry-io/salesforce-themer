-- Tier model for Connectry Intelligence Layer.
-- See: brain/knowledge/projects/salesforce-themer/SECURITY.md ("Tier model").
--
-- engine = graduated to engine code; loader skips
-- qa     = internal Connectry QA only (loaded when sfThemerQAMode=true)
-- local  = per-user local patch (lives in chrome.storage.local, not here)
-- global = published to all users (requires PUBLISH_SECRET)

alter table app_configs
  add column if not exists tier text not null default 'qa'
    check (tier in ('engine','qa','local','global'));

create index if not exists app_configs_tier_idx
  on app_configs (product_id, namespace, tier, is_active, key);

-- Backfill: every existing row pre-dates the tier model.
-- The two patches accepted on 2026-04-13 (id 1, id 2) were published as
-- "global" by intent. Mark them so the loader keeps serving them.
update app_configs set tier = 'global' where tier = 'qa' and id <= 2;

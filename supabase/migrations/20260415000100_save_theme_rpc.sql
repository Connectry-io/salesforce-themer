-- Atomic save for a custom theme: upsert the `themes` row AND write a new
-- versioned `app_configs` row at key='themes/user/<slug>' in one transaction.
--
-- Called only from the /themes Edge Function (service role). The function is
-- SECURITY DEFINER so it can bypass RLS; the Edge Function is responsible for
-- authenticating the caller and passing the correct owner string.
--
-- On update (slug already exists), ownership is verified: attempting to update
-- a theme owned by someone else raises exception SQLSTATE 42501 (insufficient
-- privilege). The Edge Function maps that to HTTP 403.

create or replace function save_theme(
  p_slug         text,
  p_owner        text,
  p_name         text,
  p_base_tokens  jsonb,
  p_overrides    jsonb,
  p_rendered_css text,
  p_etag         text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key          text := 'themes/user/' || p_slug;
  v_existing     record;
  v_next_version int;
begin
  select id, owner into v_existing from themes where slug = p_slug;

  if v_existing.id is not null and v_existing.owner <> p_owner then
    raise exception 'theme % owned by another user', p_slug
      using errcode = '42501';
  end if;

  insert into themes (slug, owner, name, base_tokens, overrides, rendered_css_etag, rendered_at)
  values (p_slug, p_owner, p_name, p_base_tokens, p_overrides, p_etag, now())
  on conflict (slug) do update
    set name              = excluded.name,
        base_tokens       = excluded.base_tokens,
        overrides         = excluded.overrides,
        rendered_css_etag = excluded.rendered_css_etag,
        rendered_at       = now(),
        updated_at        = now();

  select coalesce(max(version), 0) + 1 into v_next_version
  from app_configs
  where product_id = 'themer' and namespace = 'default' and key = v_key;

  update app_configs
    set is_active = false
    where product_id = 'themer' and namespace = 'default' and key = v_key and is_active = true;

  insert into app_configs (product_id, namespace, key, version, content_type, content, etag, is_active, tier, created_by)
  values ('themer', 'default', v_key, v_next_version, 'text/css', p_rendered_css, p_etag, true, 'published',
          'studio:' || p_owner);

  return jsonb_build_object(
    'slug', p_slug,
    'etag', p_etag,
    'version', v_next_version,
    'key', v_key
  );
end;
$$;

revoke all on function save_theme(text, text, text, jsonb, jsonb, text, text) from public, anon, authenticated;

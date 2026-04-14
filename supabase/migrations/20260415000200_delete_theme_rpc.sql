-- Delete a custom theme. Removes the `themes` row and flips the matching
-- app_configs row to is_active=false (keeps history for audit — a bad
-- delete can be reverted by flipping is_active back on).
--
-- Ownership enforced: deleting a theme owned by someone else raises
-- SQLSTATE 42501 (mapped to HTTP 403 in the Edge Function).
create or replace function delete_theme(
  p_slug  text,
  p_owner text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key      text := 'themes/user/' || p_slug;
  v_existing record;
begin
  select id, owner into v_existing from themes where slug = p_slug;

  if v_existing.id is null then
    return jsonb_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  end if;

  if v_existing.owner <> p_owner then
    raise exception 'theme % owned by another user', p_slug
      using errcode = '42501';
  end if;

  delete from themes where slug = p_slug;

  update app_configs
    set is_active = false
    where product_id = 'themer' and namespace = 'default' and key = v_key and is_active = true;

  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;

revoke all on function delete_theme(text, text) from public, anon, authenticated;

-- Items opened from the DI Decision (pdi) agenda keep the pdi item they came from, so the room's results can go back
-- to the right item (dbqm45/pdi docs/plan-wyniki-sprintdecka.md). Optional: rooms made by hand have none.

alter table public.items add column external_ref text check (external_ref ~ '^[A-Za-z0-9._-]{1,128}$');

-- Host marks an item with the pdi item it came from; once per item.
create function public.set_item_ref(p_item_id uuid, p_ref text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.items;
begin
  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then
    perform private.fail('item_not_found', 'P0002');
  end if;
  perform private.require_participant(v_item.room_id, p_host => true);
  if p_ref is null or p_ref !~ '^[A-Za-z0-9._-]{1,128}$' then
    perform private.fail('invalid_external_ref', '22023');
  end if;
  if v_item.external_ref is not null then
    perform private.fail('external_ref_set', '22023');
  end if;
  update public.items set external_ref = p_ref where id = p_item_id;
end;
$$;

-- The marked items of a room, for any member (the results the host sends back are built from the room state).
create function public.get_item_refs(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where slug = p_slug;
  if v_room.id is null then
    perform private.fail('room_not_found', 'P0002');
  end if;
  perform private.require_participant(v_room.id, p_open => false);
  return coalesce((
    select jsonb_agg(jsonb_build_object('item_id', i.id, 'external_ref', i.external_ref) order by i.position)
    from public.items i where i.room_id = v_room.id and i.external_ref is not null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.set_item_ref(uuid, text) from public, anon;
revoke all on function public.get_item_refs(text) from public, anon;
grant execute on function public.set_item_ref(uuid, text) to authenticated;
grant execute on function public.get_item_refs(text) to authenticated;

-- Risk deck (docs/PLAN.md, section 12): rooms choose their deck when created.
-- Votes and estimates are validated against the room's deck, so cast_vote and
-- finalize_item need no change.

alter table public.rooms drop constraint rooms_deck_check;
alter table public.rooms add constraint rooms_deck_check check (deck in ('fibonacci', 'risk'));

-- Keep in sync with src/lib/deck.ts (checked by src/lib/deck-sql.test.ts).
create or replace function private.deck_cards(p_deck text)
returns text[]
language sql immutable set search_path = ''
as $$
  select case p_deck
    when 'fibonacci' then array['0', '0.5', '1', '2', '3', '5', '8', '13', '21', '?', 'break']
    when 'risk' then array['low', 'medium', 'high', 'very_high', '?', 'break']
  end;
$$;
revoke all on function private.deck_cards(text) from public;

-- create_room gains the deck; the old two-argument version goes away.
drop function public.create_room(text, text);

create function public.create_room(p_title text, p_display_name text, p_deck text default 'fibonacci')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_title text := private.clean_text(p_title, 120, 'invalid_title');
  v_name text := private.clean_text(p_display_name, 32, 'invalid_display_name');
  v_secret text := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'), '=');
  v_room public.rooms;
  v_participant_id uuid;
begin
  if private.deck_cards(p_deck) is null then
    perform private.fail('invalid_deck', '22023');
  end if;
  if (select count(*) from public.rooms where owner_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    perform private.fail('rate_limited');
  end if;

  loop
    begin
      insert into public.rooms (slug, title, deck, owner_id, host_secret_hash)
      values (private.random_slug(), v_title, p_deck, v_uid, private.hash_secret(v_secret))
      returning * into v_room;
      exit;
    exception when unique_violation then
      -- slug collision (practically impossible): try another one
    end;
  end loop;

  insert into public.participants (room_id, user_id, display_name, role)
  values (v_room.id, v_uid, v_name, 'host')
  returning id into v_participant_id;

  return jsonb_build_object(
    'room_id', v_room.id,
    'slug', v_room.slug,
    'participant_id', v_participant_id,
    'host_secret', v_secret
  );
end;
$$;

revoke all on function public.create_room(text, text, text) from public, anon;
grant execute on function public.create_room(text, text, text) to authenticated;

-- The join screen shows which deck the room uses.
create or replace function public.get_room_preview(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  perform private.require_user();
  select * into v_room from public.rooms where slug = p_slug;
  if v_room.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'title', v_room.title,
    'status', v_room.status,
    'deck', v_room.deck,
    'participant_count', (select count(*) from public.participants where room_id = v_room.id),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('display_name', p.display_name, 'role', p.role)
                       order by (p.role = 'host') desc, p.joined_at)
      from (
        select * from public.participants where room_id = v_room.id
        order by (role = 'host') desc, joined_at limit 5
      ) p
    ), '[]'::jsonb),
    'current_item', (
      select jsonb_build_object(
        'title', i.title,
        'position', i.position,
        'item_count', (select count(*) from public.items where room_id = v_room.id),
        'round_status', (select r.status from public.rounds r where r.item_id = i.id order by r.number desc limit 1)
      )
      from public.items i where i.id = v_room.current_item_id
    )
  );
end;
$$;

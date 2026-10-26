-- Sprintdeck rooms backend (docs/PLAN.md, sections 3–4).
--
-- * Clients never write to tables directly: every change goes through a
--   SECURITY DEFINER function below, which checks identity, role and state.
-- * Reads are limited by RLS to room members; vote values are visible only
--   for your own vote or once the round is revealed.
-- * Every state change bumps rooms.version and broadcasts an event on the
--   private channel `room:<room_id>`. Events never carry vote values.
-- * Errors are raised with a snake_case code as the message (e.g. `not_host`),
--   which the client maps to a UI text.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[0-9A-Za-z]{12}$'),
  title            text not null check (char_length(title) between 1 and 120),
  status           text not null default 'open' check (status in ('open', 'closed')),
  deck             text not null default 'fibonacci' check (deck in ('fibonacci')),
  owner_id         uuid not null references auth.users on delete cascade,
  host_secret_hash text not null,
  current_item_id  uuid,
  version          bigint not null default 0,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table public.participants (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  role         text not null check (role in ('host', 'voter', 'observer')),
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id)
);
create unique index participants_one_host on public.participants (room_id) where role = 'host';
create index participants_user_id on public.participants (user_id);

create table public.items (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  description    text check (char_length(description) <= 2000),
  position       int not null,
  status         text not null default 'pending'
                 check (status in ('pending', 'estimating', 'estimated', 'skipped')),
  final_estimate text,
  finalized_by   uuid references public.participants on delete set null,
  finalized_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index items_room_id on public.items (room_id, position);

alter table public.rooms
  add constraint rooms_current_item_id_fkey
  foreign key (current_item_id) references public.items on delete set null;

create table public.rounds (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items on delete cascade,
  room_id     uuid not null references public.rooms on delete cascade,
  number      int not null check (number >= 1),
  status      text not null check (status in ('voting', 'revealed')),
  started_at  timestamptz not null default now(),
  revealed_at timestamptz,
  unique (item_id, number)
);
-- At most one open round per room.
create unique index rounds_one_voting on public.rounds (room_id) where status = 'voting';
create index rounds_room_id on public.rounds (room_id);

create table public.votes (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.rounds on delete cascade,
  participant_id uuid not null references public.participants on delete cascade,
  value          text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (round_id, participant_id)
);
create index votes_participant_id on public.votes (participant_id);

create table public.decision_notes (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items on delete cascade,
  author_id  uuid references public.participants on delete set null,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index decision_notes_item_id on public.decision_notes (item_id);

-- ---------------------------------------------------------------------------
-- Internal helpers (schema `private` is not exposed through the API)
-- ---------------------------------------------------------------------------

create function private.is_room_member(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.participants
    where room_id = p_room_id and user_id = (select auth.uid())
  );
$$;

-- `room:<uuid>` → uuid; anything else → null.
create function private.room_id_from_topic(p_topic text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when p_topic ~ '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then substring(p_topic from 6)::uuid
  end;
$$;

revoke all on function private.is_room_member(uuid) from public;
revoke all on function private.room_id_from_topic(text) from public;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.room_id_from_topic(text) to authenticated;

-- Keep in sync with src/lib/deck.ts (checked by src/lib/deck-sql.test.ts).
create function private.deck_cards(p_deck text)
returns text[]
language sql immutable set search_path = ''
as $$
  select case p_deck
    when 'fibonacci' then array['0', '0.5', '1', '2', '3', '5', '8', '13', '21', '?', 'break']
  end;
$$;

create function private.is_numeric_card(p_value text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_value not in ('?', 'break');
$$;

create function private.fail(p_code text, p_errcode text default 'P0001')
returns void
language plpgsql set search_path = ''
as $$
begin
  raise exception using message = p_code, errcode = p_errcode;
end;
$$;

create function private.require_user()
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    perform private.fail('not_authenticated', '28000');
  end if;
  return v_uid;
end;
$$;

create function private.clean_text(p_value text, p_max int, p_code text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if char_length(v) < 1 or char_length(v) > p_max or v ~ '[[:cntrl:]]' then
    perform private.fail(p_code, '22023');
  end if;
  return v;
end;
$$;

-- Optional multi-line text: empty → null; control characters other than new lines are rejected.
create function private.clean_optional_text(p_value text, p_max int, p_code text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if v = '' then
    return null;
  end if;
  if char_length(v) > p_max or v ~ '[\x01-\x09\x0b-\x1f\x7f]' then
    perform private.fail(p_code, '22023');
  end if;
  return v;
end;
$$;

create function private.random_slug()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  bytes bytea := extensions.gen_random_bytes(32);
  result text := '';
  b int;
  i int := 0;
begin
  while char_length(result) < 12 loop
    if i >= 32 then
      bytes := extensions.gen_random_bytes(32);
      i := 0;
    end if;
    b := get_byte(bytes, i);
    i := i + 1;
    -- 248 = 4 × 62: rejecting the rest keeps every character equally likely.
    if b < 248 then
      result := result || substr(alphabet, (b % 62) + 1, 1);
    end if;
  end loop;
  return result;
end;
$$;

create function private.hash_secret(p_secret text)
returns text
language sql immutable set search_path = ''
as $$
  select encode(extensions.digest(p_secret, 'sha256'), 'hex');
$$;

-- The caller's participant row in a room, optionally requiring host and/or an open room.
create function private.require_participant(p_room_id uuid, p_host boolean default false, p_open boolean default true)
returns public.participants
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_participant public.participants;
  v_status text;
begin
  select status into v_status from public.rooms where id = p_room_id;
  if v_status is null then
    perform private.fail('room_not_found', 'P0002');
  end if;

  select * into v_participant from public.participants where room_id = p_room_id and user_id = v_uid;
  if v_participant.id is null then
    perform private.fail('not_a_member', '42501');
  end if;
  if p_host and v_participant.role <> 'host' then
    perform private.fail('not_host', '42501');
  end if;
  if p_open and v_status <> 'open' then
    perform private.fail('room_closed');
  end if;
  return v_participant;
end;
$$;

-- Bumps the room version, records activity and broadcasts an event to room members.
create function private.emit(p_room_id uuid, p_event text, p_payload jsonb default '{}')
returns bigint
language plpgsql set search_path = ''
as $$
declare
  v_version bigint;
begin
  update public.rooms
  set version = version + 1, last_activity_at = now()
  where id = p_room_id
  returning version into v_version;

  perform realtime.send(
    p_payload || jsonb_build_object('room_id', p_room_id, 'version', v_version),
    p_event,
    'room:' || p_room_id,
    true
  );
  return v_version;
end;
$$;

-- Next pending item after the given one (by position), or null.
create function private.next_pending_item(p_room_id uuid, p_after_position int)
returns uuid
language sql stable set search_path = ''
as $$
  select id from public.items
  where room_id = p_room_id and status = 'pending'
  order by (position <= p_after_position), position
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: read-only access for room members
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.items enable row level security;
alter table public.rounds enable row level security;
alter table public.votes enable row level security;
alter table public.decision_notes enable row level security;

revoke all on public.rooms, public.participants, public.items, public.rounds, public.votes, public.decision_notes
  from anon, authenticated;

-- host_secret_hash is never readable by clients.
grant select (id, slug, title, status, deck, owner_id, current_item_id, version, created_at, last_activity_at)
  on public.rooms to authenticated;
grant select on public.participants, public.items, public.rounds, public.votes, public.decision_notes
  to authenticated;

create policy "members read their rooms" on public.rooms
  for select to authenticated using (private.is_room_member(id));

create policy "members read participants" on public.participants
  for select to authenticated using (private.is_room_member(room_id));

create policy "members read items" on public.items
  for select to authenticated using (private.is_room_member(room_id));

create policy "members read rounds" on public.rounds
  for select to authenticated using (private.is_room_member(room_id));

create policy "own votes, or all votes of revealed rounds" on public.votes
  for select to authenticated using (
    exists (
      select 1 from public.participants p
      where p.id = votes.participant_id and p.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.rounds r
      where r.id = votes.round_id and r.status = 'revealed' and private.is_room_member(r.room_id)
    )
  );

create policy "members read decision notes" on public.decision_notes
  for select to authenticated using (
    exists (
      select 1 from public.items i
      where i.id = decision_notes.item_id and private.is_room_member(i.room_id)
    )
  );

-- Realtime: only members may receive `room:<id>` broadcasts or track presence there.
create policy "members receive room events" on realtime.messages
  for select to authenticated using (
    private.is_room_member(private.room_id_from_topic((select realtime.topic())))
  );

create policy "members track presence" on realtime.messages
  for insert to authenticated with check (
    realtime.messages.extension = 'presence'
    and private.is_room_member(private.room_id_from_topic((select realtime.topic())))
  );

-- ---------------------------------------------------------------------------
-- RPC: rooms and participants
-- ---------------------------------------------------------------------------

-- Creates a room with the caller as host. The host secret is returned once
-- and stored only as a hash; it lets the host reclaim the role from another device.
create function public.create_room(p_title text, p_display_name text)
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
  if (select count(*) from public.rooms where owner_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    perform private.fail('rate_limited');
  end if;

  loop
    begin
      insert into public.rooms (slug, title, owner_id, host_secret_hash)
      values (private.random_slug(), v_title, v_uid, private.hash_secret(v_secret))
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

-- What the join screen shows before you are a member: title, who is there, what is being estimated.
create function public.get_room_preview(p_slug text)
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

-- Joins a room, or returns the caller's existing participant (same browser = same identity).
create function public.join_room(p_slug text, p_display_name text, p_role text default 'voter')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_name text := private.clean_text(p_display_name, 32, 'invalid_display_name');
  v_room_id uuid;
  v_participant public.participants;
begin
  select id into v_room_id from public.rooms where slug = p_slug;
  if v_room_id is null then
    perform private.fail('room_not_found', 'P0002');
  end if;

  select * into v_participant from public.participants where room_id = v_room_id and user_id = v_uid;
  if v_participant.id is not null then
    if v_participant.display_name <> v_name then
      update public.participants set display_name = v_name, last_seen_at = now()
      where id = v_participant.id returning * into v_participant;
      perform private.emit(v_room_id, 'participant_updated', jsonb_build_object('participant_id', v_participant.id));
    end if;
    return jsonb_build_object('room_id', v_room_id, 'participant_id', v_participant.id, 'role', v_participant.role);
  end if;

  if p_role not in ('voter', 'observer') then
    perform private.fail('invalid_role', '22023');
  end if;
  if (select count(*) from public.participants where user_id = v_uid and joined_at > now() - interval '1 hour') >= 30 then
    perform private.fail('rate_limited');
  end if;

  insert into public.participants (room_id, user_id, display_name, role)
  values (v_room_id, v_uid, v_name, p_role)
  returning * into v_participant;

  perform private.emit(v_room_id, 'participant_joined', jsonb_build_object('participant_id', v_participant.id));
  return jsonb_build_object('room_id', v_room_id, 'participant_id', v_participant.id, 'role', v_participant.role);
end;
$$;

-- Takes over the host role with the secret shown when the room was created.
create function public.claim_host(p_slug text, p_host_secret text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_room public.rooms;
  v_me public.participants;
begin
  select * into v_room from public.rooms where slug = p_slug;
  if v_room.id is null then
    perform private.fail('room_not_found', 'P0002');
  end if;
  v_me := private.require_participant(v_room.id, p_open => false);
  if v_room.host_secret_hash <> private.hash_secret(coalesce(p_host_secret, '')) then
    perform private.fail('invalid_host_secret', '42501');
  end if;
  if v_me.role = 'host' then
    return;
  end if;

  update public.participants set role = 'voter' where room_id = v_room.id and role = 'host';
  update public.participants set role = 'host' where id = v_me.id;
  perform private.emit(v_room.id, 'participants_changed');
end;
$$;

-- Host: change anyone's role, or hand the host role over (the old host becomes a voter).
-- Anyone else: switch themselves between voter and observer.
create function public.set_participant_role(p_participant_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.participants;
  v_me public.participants;
begin
  select * into v_target from public.participants where id = p_participant_id;
  if v_target.id is null then
    perform private.fail('participant_not_found', 'P0002');
  end if;
  v_me := private.require_participant(v_target.room_id);

  if p_role not in ('host', 'voter', 'observer') then
    perform private.fail('invalid_role', '22023');
  end if;
  if v_target.role = p_role then
    return;
  end if;

  if p_role = 'host' then
    if v_me.role <> 'host' then
      perform private.fail('not_host', '42501');
    end if;
    update public.participants set role = 'voter' where id = v_me.id;
  elsif v_target.role = 'host' then
    -- The room always has a host: hand the role over instead.
    perform private.fail('host_required');
  elsif v_me.role <> 'host' and v_me.id <> v_target.id then
    perform private.fail('not_host', '42501');
  end if;

  update public.participants set role = p_role where id = v_target.id;

  -- Observers don't vote: drop their vote in an open round.
  if p_role = 'observer' then
    delete from public.votes v using public.rounds r
    where v.round_id = r.id and r.room_id = v_target.room_id and r.status = 'voting'
      and v.participant_id = v_target.id;
  end if;

  perform private.emit(v_target.room_id, 'participants_changed');
end;
$$;

-- Ends the session; the room stays readable (summary, export) until retention removes it.
create function public.close_room(p_room_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_participant(p_room_id, p_host => true);
  delete from public.rounds where room_id = p_room_id and status = 'voting';
  update public.items set status = 'pending' where room_id = p_room_id and status = 'estimating'
    and not exists (select 1 from public.rounds r where r.item_id = items.id);
  update public.rooms set status = 'closed' where id = p_room_id;
  perform private.emit(p_room_id, 'room_closed');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: items
-- ---------------------------------------------------------------------------

create function public.add_item(p_room_id uuid, p_title text, p_description text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_title text;
  v_description text;
  v_item_id uuid;
begin
  perform private.require_participant(p_room_id, p_host => true);
  v_title := private.clean_text(p_title, 200, 'invalid_title');
  v_description := private.clean_optional_text(p_description, 2000, 'invalid_description');

  if (select count(*) from public.items where room_id = p_room_id) >= 200 then
    perform private.fail('too_many_items');
  end if;

  insert into public.items (room_id, title, description, position)
  values (
    p_room_id, v_title, v_description,
    coalesce((select max(position) from public.items where room_id = p_room_id), 0) + 1
  )
  returning id into v_item_id;

  update public.rooms set current_item_id = v_item_id where id = p_room_id and current_item_id is null;

  perform private.emit(p_room_id, 'item_changed', jsonb_build_object('item_id', v_item_id));
  return v_item_id;
end;
$$;

create function public.update_item(p_item_id uuid, p_title text, p_description text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.items where id = p_item_id;
  if v_room_id is null then
    perform private.fail('item_not_found', 'P0002');
  end if;
  perform private.require_participant(v_room_id, p_host => true);

  update public.items
  set title = private.clean_text(p_title, 200, 'invalid_title'),
      description = private.clean_optional_text(p_description, 2000, 'invalid_description')
  where id = p_item_id;

  perform private.emit(v_room_id, 'item_changed', jsonb_build_object('item_id', p_item_id));
end;
$$;

-- p_item_ids must list every item of the room exactly once, in the new order.
create function public.reorder_items(p_room_id uuid, p_item_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_participant(p_room_id, p_host => true);

  if p_item_ids is null
     or cardinality(p_item_ids) <> (select count(*) from public.items where room_id = p_room_id)
     or cardinality(p_item_ids) <> (select count(distinct x) from unnest(p_item_ids) x)
     or exists (
       select 1 from unnest(p_item_ids) x
       where not exists (select 1 from public.items i where i.id = x and i.room_id = p_room_id)
     ) then
    perform private.fail('invalid_item_order', '22023');
  end if;

  update public.items i
  set position = o.ordinality
  from unnest(p_item_ids) with ordinality o(id, ordinality)
  where i.id = o.id;

  perform private.emit(p_room_id, 'items_reordered');
end;
$$;

create function public.set_current_item(p_item_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.items where id = p_item_id;
  if v_room_id is null then
    perform private.fail('item_not_found', 'P0002');
  end if;
  perform private.require_participant(v_room_id, p_host => true);

  if exists (select 1 from public.rounds where room_id = v_room_id and status = 'voting') then
    perform private.fail('round_in_progress');
  end if;

  update public.rooms set current_item_id = p_item_id where id = v_room_id;
  perform private.emit(v_room_id, 'current_item_changed', jsonb_build_object('item_id', p_item_id));
end;
$$;

-- Host confirms the estimate (a numeric card) with an optional note; moves on to the next pending item.
create function public.finalize_item(p_item_id uuid, p_estimate text, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.items;
  v_room public.rooms;
  v_me public.participants;
  v_note text;
begin
  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then
    perform private.fail('item_not_found', 'P0002');
  end if;
  v_me := private.require_participant(v_item.room_id, p_host => true);
  select * into v_room from public.rooms where id = v_item.room_id;

  if not (p_estimate = any (private.deck_cards(v_room.deck))) or not private.is_numeric_card(p_estimate) then
    perform private.fail('invalid_estimate', '22023');
  end if;
  if exists (select 1 from public.rounds where item_id = p_item_id and status = 'voting') then
    perform private.fail('round_in_progress');
  end if;
  v_note := private.clean_optional_text(p_note, 2000, 'invalid_note');

  update public.items
  set status = 'estimated', final_estimate = p_estimate, finalized_by = v_me.id, finalized_at = now()
  where id = p_item_id;

  if v_note is not null then
    insert into public.decision_notes (item_id, author_id, content) values (p_item_id, v_me.id, v_note);
  end if;

  if v_room.current_item_id = p_item_id then
    update public.rooms
    set current_item_id = coalesce(private.next_pending_item(v_room.id, v_item.position), p_item_id)
    where id = v_room.id;
  end if;

  perform private.emit(v_room.id, 'item_finalized', jsonb_build_object('item_id', p_item_id));
end;
$$;

-- Host skips an item; an open round on it is discarded.
create function public.skip_item(p_item_id uuid)
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

  delete from public.rounds where item_id = p_item_id and status = 'voting';
  update public.items set status = 'skipped' where id = p_item_id;

  update public.rooms
  set current_item_id = coalesce(private.next_pending_item(id, v_item.position), p_item_id)
  where id = v_item.room_id and current_item_id = p_item_id;

  perform private.emit(v_item.room_id, 'item_changed', jsonb_build_object('item_id', p_item_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: rounds and votes
-- ---------------------------------------------------------------------------

-- Opens a voting round for an item (round n+1 if it was voted on before — a re-vote)
-- and makes it the room's current item.
create function public.start_round(p_item_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.items;
  v_round_id uuid;
  v_number int;
begin
  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then
    perform private.fail('item_not_found', 'P0002');
  end if;
  perform private.require_participant(v_item.room_id, p_host => true);

  if v_item.status = 'estimated' then
    perform private.fail('item_already_estimated');
  end if;
  if exists (select 1 from public.rounds where room_id = v_item.room_id and status = 'voting') then
    perform private.fail('round_in_progress');
  end if;

  v_number := coalesce((select max(number) from public.rounds where item_id = p_item_id), 0) + 1;
  insert into public.rounds (item_id, room_id, number, status)
  values (p_item_id, v_item.room_id, v_number, 'voting')
  returning id into v_round_id;

  update public.items set status = 'estimating' where id = p_item_id;
  update public.rooms set current_item_id = p_item_id where id = v_item.room_id;

  perform private.emit(
    v_item.room_id, 'round_started',
    jsonb_build_object('round_id', v_round_id, 'item_id', p_item_id, 'number', v_number)
  );
  return v_round_id;
end;
$$;

-- Casts or changes the caller's vote while the round is open.
create function public.cast_vote(p_round_id uuid, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
  v_me public.participants;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if v_round.id is null then
    perform private.fail('round_not_found', 'P0002');
  end if;
  v_me := private.require_participant(v_round.room_id);

  if v_me.role = 'observer' then
    perform private.fail('observers_cannot_vote', '42501');
  end if;
  if v_round.status <> 'voting' then
    perform private.fail('round_not_voting');
  end if;
  if not (p_value = any (private.deck_cards((select deck from public.rooms where id = v_round.room_id)))) then
    perform private.fail('invalid_card', '22023');
  end if;

  insert into public.votes (round_id, participant_id, value)
  values (p_round_id, v_me.id, p_value)
  on conflict (round_id, participant_id) do update set value = excluded.value, updated_at = now();

  -- Only that someone voted — never the value.
  perform private.emit(
    v_round.room_id, 'vote_status_changed',
    jsonb_build_object('round_id', p_round_id, 'participant_id', v_me.id, 'has_voted', true)
  );
end;
$$;

create function public.clear_vote(p_round_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
  v_me public.participants;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if v_round.id is null then
    perform private.fail('round_not_found', 'P0002');
  end if;
  v_me := private.require_participant(v_round.room_id);
  if v_round.status <> 'voting' then
    perform private.fail('round_not_voting');
  end if;

  delete from public.votes where round_id = p_round_id and participant_id = v_me.id;
  if found then
    perform private.emit(
      v_round.room_id, 'vote_status_changed',
      jsonb_build_object('round_id', p_round_id, 'participant_id', v_me.id, 'has_voted', false)
    );
  end if;
end;
$$;

-- Host reveals the round (allowed with missing votes). Clients then refetch the snapshot.
create function public.reveal_round(p_round_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if v_round.id is null then
    perform private.fail('round_not_found', 'P0002');
  end if;
  perform private.require_participant(v_round.room_id, p_host => true);
  if v_round.status <> 'voting' then
    perform private.fail('round_not_voting');
  end if;

  update public.rounds set status = 'revealed', revealed_at = now() where id = p_round_id;
  perform private.emit(
    v_round.room_id, 'round_revealed',
    jsonb_build_object('round_id', p_round_id, 'item_id', v_round.item_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: snapshot
-- ---------------------------------------------------------------------------

-- Full room state for a member. Vote values are included only for revealed
-- rounds; for an open round you get who has voted plus your own vote.
create function public.get_room_state(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_room public.rooms;
  v_me public.participants;
begin
  select * into v_room from public.rooms where slug = p_slug;
  if v_room.id is null then
    perform private.fail('room_not_found', 'P0002');
  end if;
  v_me := private.require_participant(v_room.id, p_open => false);

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'slug', v_room.slug,
      'title', v_room.title,
      'status', v_room.status,
      'deck', v_room.deck,
      'current_item_id', v_room.current_item_id,
      'version', v_room.version,
      'created_at', v_room.created_at,
      'last_activity_at', v_room.last_activity_at
    ),
    'me', jsonb_build_object('participant_id', v_me.id, 'role', v_me.role),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'role', p.role, 'joined_at', p.joined_at
      ) order by p.joined_at)
      from public.participants p where p.room_id = v_room.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'description', i.description,
        'position', i.position,
        'status', i.status,
        'final_estimate', i.final_estimate,
        'finalized_at', i.finalized_at,
        'notes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', n.id, 'author_id', n.author_id, 'content', n.content, 'created_at', n.created_at
          ) order by n.created_at)
          from public.decision_notes n where n.item_id = i.id
        ), '[]'::jsonb)
      ) order by i.position)
      from public.items i where i.room_id = v_room.id
    ), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'item_id', r.item_id,
        'number', r.number,
        'status', r.status,
        'started_at', r.started_at,
        'revealed_at', r.revealed_at,
        'votes', coalesce((
          select jsonb_agg(
            case when r.status = 'revealed'
              then jsonb_build_object('participant_id', v.participant_id, 'value', v.value)
              else jsonb_build_object('participant_id', v.participant_id)
            end
            order by v.created_at)
          from public.votes v where v.round_id = r.id
        ), '[]'::jsonb),
        'my_vote', (select v.value from public.votes v where v.round_id = r.id and v.participant_id = v_me.id)
      ) order by r.started_at, r.number)
      from public.rounds r where r.room_id = v_room.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: RPCs are callable by signed-in (incl. anonymous) users only
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.room_id_from_topic(text) to authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'create_room(text, text)',
    'get_room_preview(text)',
    'join_room(text, text, text)',
    'claim_host(text, text)',
    'set_participant_role(uuid, text)',
    'close_room(uuid)',
    'add_item(uuid, text, text)',
    'update_item(uuid, text, text)',
    'reorder_items(uuid, uuid[])',
    'set_current_item(uuid)',
    'finalize_item(uuid, text, text)',
    'skip_item(uuid)',
    'start_round(uuid)',
    'cast_vote(uuid, text)',
    'clear_vote(uuid)',
    'reveal_round(uuid)',
    'get_room_state(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention: rooms are deleted 90 days after their last activity (cascade),
-- together with anonymous users who no longer belong to any room.
-- ---------------------------------------------------------------------------

create function private.purge_inactive_rooms(p_max_age interval default interval '90 days')
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_rooms integer;
begin
  delete from public.rooms where last_activity_at < now() - p_max_age;
  get diagnostics v_rooms = row_count;

  delete from auth.users u
  where u.is_anonymous
    and coalesce(u.last_sign_in_at, u.created_at) < now() - p_max_age
    and not exists (select 1 from public.participants p where p.user_id = u.id);

  return v_rooms;
end;
$$;

revoke all on function private.purge_inactive_rooms(interval) from public;

select cron.schedule('purge-inactive-rooms', '17 3 * * *', $$select private.purge_inactive_rooms()$$);

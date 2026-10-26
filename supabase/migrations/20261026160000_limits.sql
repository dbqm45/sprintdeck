-- Abuse limits before the public link (docs/PLAN.md, S3, section 3.5).
--
-- * One write budget per user: every change to a room (vote, item, round,
--   role, join) counts against 120 per minute. People never get near it; a
--   script flooding the room's realtime channel does.
-- * A room holds at most 50 people.
-- * Existing limits stay: 10 new rooms and 30 joins per user per hour,
--   200 items per room, Supabase Auth's anonymous sign-ins per IP.

create table private.rate_events (
  user_id uuid not null,
  action  text not null,
  at      timestamptz not null default now()
);
create index rate_events_lookup on private.rate_events (user_id, action, at);
revoke all on private.rate_events from public, anon, authenticated;

-- Records one use of `p_action` by the caller; fails with `rate_limited` once
-- the caller has used it `p_max` times within `p_window`.
create function private.throttle(p_action text, p_max int, p_window interval)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if (
    select count(*) from private.rate_events
    where user_id = v_uid and action = p_action and at > now() - p_window
  ) >= p_max then
    perform private.fail('rate_limited');
  end if;
  insert into private.rate_events (user_id, action) values (v_uid, p_action);
end;
$$;
revoke all on function private.throttle(text, int, interval) from public;

-- Every room change goes through here with p_open = true (reads pass false), so
-- this is where the write budget is charged.
create or replace function private.require_participant(p_room_id uuid, p_host boolean default false, p_open boolean default true)
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
  if p_open then
    perform private.throttle('write', 120, interval '1 minute');
  end if;
  return v_participant;
end;
$$;

-- join_room: the same write budget, and at most 50 people per room.
create or replace function public.join_room(p_slug text, p_display_name text, p_role text default 'voter')
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
  perform private.throttle('write', 120, interval '1 minute');

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
  if (select count(*) from public.participants where room_id = v_room_id) >= 50 then
    perform private.fail('room_full');
  end if;

  insert into public.participants (room_id, user_id, display_name, role)
  values (v_room_id, v_uid, v_name, p_role)
  returning * into v_participant;

  perform private.emit(v_room_id, 'participant_joined', jsonb_build_object('participant_id', v_participant.id));
  return jsonb_build_object('room_id', v_room_id, 'participant_id', v_participant.id, 'role', v_participant.role);
end;
$$;

-- The daily retention job also drops rate events older than a day.
create or replace function private.purge_inactive_rooms(p_max_age interval default interval '90 days')
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

  delete from private.rate_events where at < now() - interval '1 day';

  return v_rooms;
end;
$$;

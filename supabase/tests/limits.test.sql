-- Abuse limits: the per-user write budget and the room size cap.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, aud, role, is_anonymous)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'authenticated', 'authenticated', true
from generate_series(1, 51) n;

-- ---------------------------------------------------------------- write budget
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select set_config('test.room', public.create_room('Limits', 'Anna') ->> 'room_id', true);
select set_config('test.slug', (select slug from public.rooms where id = current_setting('test.room')::uuid), true);
select set_config('test.item', public.add_item(current_setting('test.room')::uuid, 'Spam target')::text, true);
select set_config('test.round', public.start_round(current_setting('test.item')::uuid)::text, true);

-- add_item and start_round used 2 of the 120 writes; 118 votes fit, the next one doesn't.
select lives_ok(
  format('select public.cast_vote(%L, %L) from generate_series(1, 118)', current_setting('test.round'), '5'),
  'a burst of 120 writes in a minute is allowed'
);
select throws_ok(
  format('select public.cast_vote(%L, %L)', current_setting('test.round'), '8'), 'P0001', 'rate_limited',
  'the 121st write within a minute is refused'
);
select lives_ok(
  format('select public.get_room_state(%L)', current_setting('test.slug')), 'reading the room is never limited'
);

reset role;
update private.rate_events set at = now() - interval '2 minutes';
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select lives_ok(
  format('select public.cast_vote(%L, %L)', current_setting('test.round'), '8'), 'the budget refills after a minute'
);

-- ---------------------------------------------------------------- room size
reset role;
insert into public.participants (room_id, user_id, display_name, role)
select current_setting('test.room')::uuid, ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'P' || n, 'voter'
from generate_series(2, 50) n;

select pg_temp.act_as('00000000-0000-0000-0000-000000000051');
select throws_ok(
  format('select public.join_room(%L, %L)', current_setting('test.slug'), 'Late'), 'P0001', 'room_full',
  'the 51st person cannot join'
);
select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select lives_ok(
  format('select public.join_room(%L, %L)', current_setting('test.slug'), 'P2'),
  'people already in a full room can still rejoin'
);

-- ---------------------------------------------------------------- retention
reset role;
update private.rate_events set at = now() - interval '2 days';
select private.purge_inactive_rooms();
select is((select count(*)::int from private.rate_events), 0, 'the daily job drops old rate events');

select * from finish();
rollback;

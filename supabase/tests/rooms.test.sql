-- Rooms backend: RPC state machine, permissions and hidden votes.
-- Run with `npm run db:test` (needs the local Supabase stack).
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- Users: Anna (host), Ben (voter), Cleo (observer), Mallory (not a member).
insert into auth.users (id, aud, role, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', true),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', true),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', true),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', true);

-- Switch the current user for the following statements.
create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
-- Values shared between steps (custom settings are readable by every role).
create function pg_temp.ctx(p_key text) returns text language sql as $$
  select current_setting('test.' || p_key);
$$;
grant execute on all functions in schema pg_temp to authenticated;

-- ---------------------------------------------------------------- schema
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.rooms'::regclass, 'public.participants'::regclass, 'public.items'::regclass,
                 'public.rounds'::regclass, 'public.votes'::regclass, 'public.decision_notes'::regclass)),
  'RLS is enabled on every room table'
);
select ok(
  not has_function_privilege('anon', 'public.create_room(text, text, text)', 'execute'),
  'anon (not signed in) cannot call RPCs'
);

-- ---------------------------------------------------------------- create & join
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_config('test.created', public.create_room('  Sprint 42 refinement ', 'Anna')::text, true);
select matches(pg_temp.ctx('created')::jsonb ->> 'slug', '^[0-9A-Za-z]{12}$', 'create_room returns a 12-character slug');
select ok(char_length(pg_temp.ctx('created')::jsonb ->> 'host_secret') >= 32, 'create_room returns the host secret once');
select set_config('test.slug', pg_temp.ctx('created')::jsonb ->> 'slug', true);
select set_config('test.room', pg_temp.ctx('created')::jsonb ->> 'room_id', true);
select is((select title from public.rooms), 'Sprint 42 refinement', 'title is trimmed; the host reads their room');
select is((select role from public.participants where display_name = 'Anna'), 'host', 'creator is the host');
select throws_ok($$ select public.create_room('Room', '') $$, '22023', 'invalid_display_name', 'empty names are rejected');
select throws_ok(
  $$ select public.create_room('Room', E'An\x07na') $$, '22023', 'invalid_display_name', 'control characters are rejected'
);
select throws_ok(
  $$ select host_secret_hash from public.rooms $$, '42501', null, 'the host secret hash is not readable'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select set_config('test.ben', (public.join_room(pg_temp.ctx('slug'), 'Ben') ->> 'participant_id'), true);
select is(
  public.join_room(pg_temp.ctx('slug'), 'Ben') ->> 'participant_id', pg_temp.ctx('ben'),
  'joining again returns the same participant'
);
select throws_ok(
  $$ select public.join_room('nope00000000', 'Ben') $$, 'P0002', 'room_not_found', 'unknown slug'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format('select public.join_room(%L, %L, %L)', pg_temp.ctx('slug'), 'Cleo', 'host'),
  '22023', 'invalid_role', 'nobody joins as host'
);
select is(
  public.join_room(pg_temp.ctx('slug'), 'Cleo', 'observer') ->> 'role', 'observer', 'joining as an observer'
);

-- ---------------------------------------------------------------- outsiders
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.rooms), 0, 'non-members see no rooms');
select is((select count(*)::int from public.participants), 0, 'non-members see no participants');
select throws_ok(
  format('select public.get_room_state(%L)', pg_temp.ctx('slug')), '42501', 'not_a_member',
  'non-members cannot read the room state'
);
select is(
  (public.get_room_preview(pg_temp.ctx('slug')) ->> 'participant_count')::int, 3,
  'the join screen preview is available with the link'
);
select is(public.get_room_preview('nope00000000'), null, 'preview of an unknown slug is null');

-- ---------------------------------------------------------------- items
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  format('select public.add_item(%L, %L)', pg_temp.ctx('room'), 'Hack'), '42501', 'not_host', 'voters cannot add items'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_config('test.item1', public.add_item(pg_temp.ctx('room')::uuid, 'Payment retries', ' Retry 3 times ')::text, true);
select set_config('test.item2', public.add_item(pg_temp.ctx('room')::uuid, 'Refund flow')::text, true);
select is(
  (select current_item_id::text from public.rooms), pg_temp.ctx('item1'), 'the first item becomes the current one'
);
select is((select description from public.items where title = 'Payment retries'), 'Retry 3 times', 'descriptions are trimmed');
select lives_ok(
  format('select public.reorder_items(%L, array[%L, %L]::uuid[])', pg_temp.ctx('room'), pg_temp.ctx('item2'), pg_temp.ctx('item1')),
  'host reorders items'
);
select is((select title from public.items order by position limit 1), 'Refund flow', 'new order is stored');
select throws_ok(
  format('select public.reorder_items(%L, array[%L]::uuid[])', pg_temp.ctx('room'), pg_temp.ctx('item1')),
  '22023', 'invalid_item_order', 'a partial order is rejected'
);
select throws_ok(
  format('select public.reorder_items(%L, null)', pg_temp.ctx('room')),
  '22023', 'invalid_item_order', 'a missing order is rejected'
);

-- ---------------------------------------------------------------- voting
select set_config('test.round1', public.start_round(pg_temp.ctx('item1')::uuid)::text, true);
select throws_ok(
  format('select public.start_round(%L)', pg_temp.ctx('item2')), 'P0001', 'round_in_progress',
  'only one open round per room'
);
select lives_ok(format('select public.cast_vote(%L, %L)', pg_temp.ctx('round1'), '5'), 'host votes');
select throws_ok(
  format('select public.cast_vote(%L, %L)', pg_temp.ctx('round1'), '7'), '22023', 'invalid_card', 'only deck cards'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(format('select public.cast_vote(%L, %L)', pg_temp.ctx('round1'), '13'), 'voter votes');
select lives_ok(format('select public.cast_vote(%L, %L)', pg_temp.ctx('round1'), '8'), 'voter changes their vote');
select throws_ok(
  format('insert into public.votes (round_id, participant_id, value) values (%L, %L, %L)',
         pg_temp.ctx('round1'), pg_temp.ctx('ben'), '1'),
  '42501', null, 'votes cannot be written directly'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format('select public.cast_vote(%L, %L)', pg_temp.ctx('round1'), '3'), '42501', 'observers_cannot_vote',
  'observers cannot vote'
);

-- Hidden votes: before reveal nobody sees anyone else's value, by any path.
select is((select count(*)::int from public.votes), 0, 'before reveal: an observer sees no votes');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select array_agg(value) from public.votes), array['5'], 'before reveal: the host sees only their own vote');
select set_config('test.state', public.get_room_state(pg_temp.ctx('slug'))::text, true);
select ok(
  not jsonb_path_exists(pg_temp.ctx('state')::jsonb, '$.rounds[*].votes[*].value'),
  'before reveal: the snapshot has no vote values'
);
select is(
  jsonb_array_length(pg_temp.ctx('state')::jsonb -> 'rounds' -> 0 -> 'votes'), 2,
  'before reveal: the snapshot shows who has voted'
);
select is(pg_temp.ctx('state')::jsonb -> 'rounds' -> 0 ->> 'my_vote', '5', 'the snapshot includes my own vote');
select throws_ok(
  format('select public.finalize_item(%L, %L)', pg_temp.ctx('item1'), '5'), 'P0001', 'round_in_progress',
  'an item cannot be finalized while voting'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  format('select public.reveal_round(%L)', pg_temp.ctx('round1')), '42501', 'not_host', 'only the host reveals'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(format('select public.reveal_round(%L)', pg_temp.ctx('round1')), 'host reveals');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is(
  (select array_agg(value order by value) from public.votes), array['5', '8'], 'after reveal: everyone sees the votes'
);
select ok(
  jsonb_path_exists(public.get_room_state(pg_temp.ctx('slug')), '$.rounds[0].votes[*].value'),
  'after reveal: the snapshot has the values'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  format('select public.cast_vote(%L, %L)', pg_temp.ctx('round1'), '3'), 'P0001', 'round_not_voting',
  'a revealed round is frozen'
);

-- ---------------------------------------------------------------- re-vote and finalize
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_config('test.round2', public.start_round(pg_temp.ctx('item1')::uuid)::text, true);
select is((select number from public.rounds where id = pg_temp.ctx('round2')::uuid), 2, 'a re-vote opens round 2');
select lives_ok(format('select public.reveal_round(%L)', pg_temp.ctx('round2')), 'round 2 revealed without votes');
select throws_ok(
  format('select public.finalize_item(%L, %L)', pg_temp.ctx('item1'), '?'), '22023', 'invalid_estimate',
  'the estimate must be a numeric card'
);
select lives_ok(
  format('select public.finalize_item(%L, %L, %L)', pg_temp.ctx('item1'), '5', 'Dunning emails need legal review'),
  'host confirms the estimate with a note'
);
select is(
  (select status || ':' || final_estimate from public.items where id = pg_temp.ctx('item1')::uuid), 'estimated:5',
  'the item is estimated'
);
select is(
  (select current_item_id::text from public.rooms), pg_temp.ctx('item2'), 'the room moves on to the next pending item'
);
select is((select count(*)::int from public.decision_notes), 1, 'the note is stored');

-- ---------------------------------------------------------------- roles
select lives_ok(
  format('select public.set_participant_role(%L, %L)', pg_temp.ctx('ben'), 'host'), 'host hands the role over'
);
select throws_ok(
  format('select public.add_item(%L, %L)', pg_temp.ctx('room'), 'Too late'), '42501', 'not_host',
  'the former host is a voter now'
);
select lives_ok(
  format('select public.claim_host(%L, %L)', pg_temp.ctx('slug'), pg_temp.ctx('created')::jsonb ->> 'host_secret'),
  'the host secret reclaims the role'
);
select is(
  (select display_name from public.participants where role = 'host'), 'Anna', 'exactly one host again'
);

-- ---------------------------------------------------------------- events and retention
reset role;
select ok((select version from public.rooms) > 10, 'every change bumps the room version');

update public.rooms set last_activity_at = now() - interval '91 days';
select is(private.purge_inactive_rooms(), 1, 'rooms inactive for 90 days are purged');
select is((select count(*)::int from public.participants), 0, 'their participants go with them');

select * from finish();
rollback;

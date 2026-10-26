-- Risk deck: rooms pick a deck; votes and estimates follow it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, aud, role, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select set_config('test.default', public.create_room('Default deck', 'Anna') ->> 'room_id', true);
select is(
  (select deck from public.rooms where id = current_setting('test.default')::uuid),
  'fibonacci', 'rooms use the Fibonacci deck by default'
);
select throws_ok(
  $$ select public.create_room('T-shirts', 'Anna', 'tshirt') $$, '22023', 'invalid_deck', 'unknown decks are rejected'
);

select set_config('test.created', public.create_room('Risk review', 'Anna', 'risk')::text, true);
select set_config('test.room', current_setting('test.created')::jsonb ->> 'room_id', true);
select is(
  (select deck from public.rooms where id = current_setting('test.room')::uuid), 'risk', 'a room can use the Risk deck'
);
select is(
  public.get_room_preview(current_setting('test.created')::jsonb ->> 'slug') ->> 'deck', 'risk',
  'the join screen preview names the deck'
);

select set_config(
  'test.item', public.add_item(current_setting('test.room')::uuid, 'Payment retries')::text, true
);
select set_config('test.round', public.start_round(current_setting('test.item')::uuid)::text, true);

select lives_ok(
  format('select public.cast_vote(%L, %L)', current_setting('test.round'), 'very_high'), 'Risk cards are accepted'
);
select lives_ok(format('select public.cast_vote(%L, %L)', current_setting('test.round'), '?'), '“?” is accepted');
select throws_ok(
  format('select public.cast_vote(%L, %L)', current_setting('test.round'), '5'), '22023', 'invalid_card',
  'Fibonacci cards are rejected in a Risk room'
);

select lives_ok(format('select public.reveal_round(%L)', current_setting('test.round')), 'reveal');
select throws_ok(
  format('select public.finalize_item(%L, %L)', current_setting('test.item'), 'break'), '22023', 'invalid_estimate',
  'the estimate cannot be a break'
);
select lives_ok(
  format('select public.finalize_item(%L, %L)', current_setting('test.item'), 'high'), 'a Risk level is the estimate'
);
select is(
  (select final_estimate from public.items where id = current_setting('test.item')::uuid), 'high', 'stored as such'
);

select * from finish();
rollback;

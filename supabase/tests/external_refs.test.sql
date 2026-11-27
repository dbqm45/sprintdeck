-- Items opened from the DI Decision agenda keep the pdi item they came from (dbqm45/pdi docs/plan-wyniki-sprintdecka.md).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, aud, role, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', false),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', true);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b1', 'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('test.created', public.create_room('Discuss with team', 'Ola', 'risk')::text, true);
select set_config('test.room', current_setting('test.created')::jsonb ->> 'room_id', true);
select set_config('test.slug', current_setting('test.created')::jsonb ->> 'slug', true);
select set_config('test.item', public.add_item(current_setting('test.room')::uuid, 'Gate B2 for CHG-1')::text, true);
select set_config('test.plain', public.add_item(current_setting('test.room')::uuid, 'Added in the room')::text, true);

select lives_ok($$ select public.set_item_ref(current_setting('test.item')::uuid, 'evt-1') $$, 'the host marks an item with its pdi item');
select is(
  public.get_item_refs(current_setting('test.slug')),
  jsonb_build_array(jsonb_build_object('item_id', current_setting('test.item')::uuid, 'external_ref', 'evt-1')),
  'the refs come back, only for marked items'
);
select throws_ok($$ select public.set_item_ref(current_setting('test.plain')::uuid, 'evt 1; drop') $$, '22023', 'invalid_external_ref', 'a ref is a short id');
select throws_ok($$ select public.set_item_ref(current_setting('test.item')::uuid, 'evt-2') $$, '22023', 'external_ref_set', 'a ref is set once');

-- Another person, not in the room, can neither read nor set refs.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);
select throws_ok($$ select public.get_item_refs(current_setting('test.slug')) $$, '42501', 'not_a_member', 'refs are for room members');
select throws_ok($$ select public.set_item_ref(current_setting('test.plain')::uuid, 'evt-3') $$, '42501', 'not_a_member', 'only the host sets a ref');
reset role;
select is((select count(*)::int from public.items where external_ref is not null), 1, 'one marked item; the refused calls changed nothing');

select * from finish();
rollback;

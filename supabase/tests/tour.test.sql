begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select * from no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated'
from generate_series(1, 2) n;
create function pg_temp.login(p_n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_n,
    'role', 'authenticated', 'aal', 'aal1')::text, true);
end $$;
grant execute on function pg_temp.login(int) to authenticated;
insert into organisations (name, slug) values ('Org A', 'org-a');
create temp table t (v uuid); insert into t select id from organisations where slug = 'org-a';
grant select on t to authenticated;
insert into memberships (org_id, user_id, tour_completed_at) select v, '00000000-0000-0000-0000-000000000001', null from t;

set local role authenticated;
select pg_temp.login(1);
select ok(tour_needed((select v from t)), 'a new member sees the tour');
select lives_ok($$ select finish_tour((select v from t)) $$, 'finishes it');
select ok(not tour_needed((select v from t)), 'and does not see it again');
select pg_temp.login(2);
select ok(not tour_needed((select v from t)), 'non-members never see it');
select throws_ok($$ select finish_tour((select v from t)) $$, '42501', 'not_allowed', 'and cannot mark it');
select * from finish();
rollback;

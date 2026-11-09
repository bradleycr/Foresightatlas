-- Atomic poll writes, callable over Supabase's HTTP API (PostgREST /rpc).
--
-- The API reaches the database over HTTP rather than holding a Postgres
-- connection per server instance, so a burst of phones can't exhaust the
-- pooler. Each function is one statement, so each stays atomic.

-- Cast a ballot: refuses unless the poll is live and inside its final minute,
-- reuses the row this phone already owns under any known key, and overwrites
-- it. Returns no row when voting is closed.
create or replace function poll_cast_ballot(
  p_poll_id text,
  p_voter_key text,
  p_kind text,
  p_person_id text,
  p_team_option_id text,
  p_first text,
  p_second text,
  p_third text,
  p_device_hint text,
  p_known_keys text[]
) returns setof poll_ballots
language sql
set search_path = public
as $$
  with open_poll as (
    select id from polls
     where id = p_poll_id and status = 'live' and (closes_at is null or closes_at > now())
  ),
  prior as (
    select voter_key from poll_ballots
     where poll_id = p_poll_id and voter_key = any(p_known_keys)
     order by updated_at desc
     limit 1
  )
  insert into poll_ballots (
    poll_id, voter_key, kind, person_id, team_option_id,
    first_option_id, second_option_id, third_option_id, device_hint)
  select p_poll_id, coalesce((select voter_key from prior), p_voter_key), p_kind, p_person_id,
         p_team_option_id, p_first, p_second, p_third, p_device_hint
   where exists (select 1 from open_poll)
  on conflict (poll_id, voter_key) do update set
    kind = excluded.kind,
    person_id = excluded.person_id,
    team_option_id = excluded.team_option_id,
    first_option_id = excluded.first_option_id,
    second_option_id = excluded.second_option_id,
    third_option_id = excluded.third_option_id,
    device_hint = excluded.device_hint,
    revisions = poll_ballots.revisions + 1,
    updated_at = now()
  returning *;
$$;

-- Live → closed once the final minute has run out, by the database's clock.
create or replace function poll_close_if_due(p_poll_id text)
returns setof polls
language sql
set search_path = public
as $$
  update polls set
    status = 'closed', closed_at = closes_at, updated_at = now(), version = version + 1
   where id = p_poll_id and status = 'live' and closes_at is not null and closes_at <= now()
  returning *;
$$;

revoke execute on function poll_cast_ballot(text, text, text, text, text, text, text, text, text, text[])
  from public, anon, authenticated;
revoke execute on function poll_close_if_due(text) from public, anon, authenticated;
grant execute on function poll_cast_ballot(text, text, text, text, text, text, text, text, text, text[])
  to service_role;
grant execute on function poll_close_if_due(text) to service_role;

notify pgrst, 'reload schema';

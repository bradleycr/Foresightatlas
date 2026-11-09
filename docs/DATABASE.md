# Atlas database (Postgres)

People, events, and directory auth stay in the Google Sheet. **Polls** live in
Postgres, because a sheet can't take a room of phones voting at once: it has a
per-minute quota, no atomic writes, and every server instance had its own stale
copy.

## Where it is

Supabase, provisioned through the Vercel Marketplace (`foresight-atlas`, free
plan, region `iad1` next to the Vercel functions). The integration sets these on
the Vercel project for every environment:

| Variable | Used for |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The API. Supabase's HTTP API, server-side only. |
| `POSTGRES_URL_NON_POOLING` | Migrations, the Sheet import, and the load test. |
| `POSTGRES_URL` | Self-hosting without Supabase (pooled socket). |

The API reaches the database over HTTP, not a Postgres socket. Serverless can
start more instances than Supabase's pooler accepts clients (200 on this plan);
a socket per instance filled it during the first production load test. Over
HTTP an instance holds nothing between requests. Atomic writes are SQL
functions (`db/migrations/002_poll_functions.sql`) called through `/rpc`.

`vercel env pull .env.local` brings them to a laptop. Local dev then uses the
same database as production, like the sheet did. Without them, local dev keeps
polls in `mock/database.local.json`.

The free plan pauses a database after a week without traffic. A daily Vercel
cron calls `GET /api/polls?ping=1` to keep it awake.

## Tables

`db/migrations/001_polls.sql`.

- **polls**: one row per poll. `options` is JSON. `version` goes up on every
  write, and an edit only lands if the version is still the one it read. Two
  hosts editing at once can't overwrite each other.
- **poll_ballots**: one row per phone per poll, keyed by `(poll_id, voter_key)`.
  If the phone submits again, its row is overwritten and `revisions` goes up.
  Resubmitting never adds a ballot. The insert only lands if the poll is live
  and its final minute hasn't run out, checked in the same statement.

Row level security is on with no policies. The public Supabase keys can't read
the tables; the API connects as the owner.

## How a phone is counted once

Voting is anonymous. A device id stands in for a person, and it is kept in two
places:

1. an HttpOnly cookie set by the API (`fa_poll_voter`)
2. `localStorage`, sent with each request

If either copy matches an earlier ballot, that ballot is updated. A phone reads
as new only if it lost both, for example a fresh private tab or a second
device. Only sign-in could catch that. `device_hint` (a hash of network and
browser) is stored so a host can look into a suspicious cluster afterwards. It
is never used to merge ballots, because a whole room shares one network.

Judges vote through private links. Each seat's ballot is keyed `judge:N`, so a
seat has exactly one ballot whichever device opens the link.

## Commands

```bash
pnpm db:migrate          # apply db/migrations/*.sql (idempotent)
pnpm polls:import        # dry run: Sheet Polls/PollVotes → Postgres
pnpm polls:import --write
pnpm polls:load-test     # 300 phones + projectors against the local API
pnpm polls:load-test --phones 300 --base https://atlas.foresight.org
```

The load test makes a throwaway live poll and deletes it afterwards. It passes
only if the ballot count equals the number of phones exactly. Some of its
phones resubmit, some after losing their cookie, and some after losing their
storage.

## Self-hosting

Any Postgres 14+ works. Leave the Supabase variables unset, set `POSTGRES_URL`
(and `POSTGRES_URL_NON_POOLING` if it's behind a pooler), then run
`pnpm db:migrate`. The API uses the same SQL functions over a socket.

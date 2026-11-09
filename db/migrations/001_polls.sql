-- Event polls live in Postgres, not the Sheet.
--
-- One row per poll, one row per ballot. The ballot key is (poll_id, voter_key),
-- so a phone that changes its mind overwrites its own row — the database can
-- never count the same phone twice, however often it submits.

create table if not exists polls (
  id                    text primary key,
  slug                  text not null unique,
  event_id              text not null default '',
  event_title           text not null default '',
  question              text not null,
  options               jsonb not null default '[]'::jsonb,
  status                text not null default 'draft'
                          check (status in ('draft', 'live', 'closed')),
  created_by_person_id  text not null default '',
  created_by_name       text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  closed_at             timestamptz,
  closes_at             timestamptz,
  -- Bumped on every write. Edits compare it so two hosts can't clobber a slate.
  version               integer not null default 1
);

create table if not exists poll_ballots (
  poll_id           text not null,
  voter_key         text not null,
  kind              text not null check (kind in ('room', 'guest', 'judge')),
  person_id         text not null default '',
  team_option_id    text not null default '',
  first_option_id   text not null,
  second_option_id  text not null,
  third_option_id   text not null,
  -- Hash of network + browser. Forensics only; never used to merge ballots.
  device_hint       text not null default '',
  -- How many times this phone submitted. 1 = voted once.
  revisions         integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (poll_id, voter_key),
  check (
    first_option_id <> second_option_id
    and first_option_id <> third_option_id
    and second_option_id <> third_option_id
  )
);

create index if not exists poll_ballots_by_poll on poll_ballots (poll_id, updated_at);

-- The API reaches these tables as the owner over a server-side connection.
-- Row level security with no policies keeps the public Supabase keys out.
alter table polls enable row level security;
alter table poll_ballots enable row level security;

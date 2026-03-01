-- Run this in your Supabase SQL editor (supabase.com -> your project -> SQL Editor)

create table snapshots (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null,
  machine_name text not null,
  snapshot_name text not null,
  timestamp timestamptz not null,
  data jsonb not null,
  created_at timestamptz default now()
);

-- Index for fast queries by machine
create index snapshots_machine_id_idx on snapshots(machine_id);
create index snapshots_timestamp_idx on snapshots(timestamp desc);

-- ============================================================
--  PYTHAS Leaderboard — Supabase schema
--  Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================

-- 1) Players / leaderboard table
create table if not exists public.players (
  user_id       bigint primary key,
  username      text,
  display_name  text,
  summit        integer default 0,
  best_time_ms  integer,
  updated_at    timestamptz default now()
);

-- 2) Indexes to keep the leaderboard queries fast
create index if not exists players_summit_idx
  on public.players (summit desc);

create index if not exists players_best_time_idx
  on public.players (best_time_ms asc)
  where best_time_ms is not null;

-- 3) Lock down direct API access.
--    The Cloudflare Worker talks to Supabase with the SERVICE ROLE key,
--    which bypasses RLS. Enabling RLS with NO policies means nobody can
--    read/write this table using the public (anon) key directly.
alter table public.players enable row level security;

-- 4) Atomic upsert used by the Worker (POST /api/roblox/player-stats)
--    - summit: stores the latest value sent
--    - best_time_ms: only updated when the new time is smaller, or when
--      there is no time recorded yet (null)
create or replace function public.upsert_player_stats(
  p_user_id      bigint,
  p_username     text,
  p_display_name text,
  p_summit       integer,
  p_best_time_ms integer
)
returns void
language sql
as $$
  insert into public.players (user_id, username, display_name, summit, best_time_ms, updated_at)
  values (p_user_id, p_username, p_display_name, coalesce(p_summit, 0), p_best_time_ms, now())
  on conflict (user_id) do update set
    username      = coalesce(excluded.username, public.players.username),
    display_name  = coalesce(excluded.display_name, public.players.display_name),
    summit        = coalesce(p_summit, public.players.summit),
    best_time_ms  = case
                      when p_best_time_ms is null then public.players.best_time_ms
                      when public.players.best_time_ms is null then p_best_time_ms
                      when p_best_time_ms < public.players.best_time_ms then p_best_time_ms
                      else public.players.best_time_ms
                    end,
    updated_at    = now();
$$;

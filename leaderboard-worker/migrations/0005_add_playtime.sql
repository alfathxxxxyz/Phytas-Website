-- ============================================================
--  PYTHAS Leaderboard — MIGRATION: playtime tracking
--  Tambah kolom `playtime_seconds` untuk menyimpan total waktu
--  bermain pemain (akumulatif) per map.
--
--  Jalankan di Supabase: SQL Editor -> New query -> paste -> Run.
--  Aman dijalankan berulang (idempotent).
-- ============================================================

-- 1) Tambah kolom playtime_seconds (default 0)
alter table public.players add column if not exists playtime_seconds integer default 0;
update public.players set playtime_seconds = 0 where playtime_seconds is null;
alter table public.players alter column playtime_seconds set default 0;
alter table public.players alter column playtime_seconds set not null;

-- 2) Update fungsi upsert_player_stats untuk menerima dan akumulasi playtime
create or replace function public.upsert_player_stats(
  p_user_id           bigint,
  p_username          text,
  p_display_name      text,
  p_summit            integer,
  p_best_time_ms      integer,
  p_map               text,
  p_playtime_seconds  integer default 0
)
returns void
language sql
as $$
  insert into public.players (user_id, map, username, display_name, summit, best_time_ms, playtime_seconds, updated_at)
  values (
    p_user_id,
    coalesce(nullif(p_map, ''), 'Mount Aztec'),
    p_username, p_display_name,
    coalesce(p_summit, 0), p_best_time_ms,
    coalesce(p_playtime_seconds, 0),
    now()
  )
  on conflict (user_id, map) do update set
    username          = coalesce(excluded.username, public.players.username),
    display_name      = coalesce(excluded.display_name, public.players.display_name),
    summit            = coalesce(p_summit, public.players.summit),
    best_time_ms      = case
                          when p_best_time_ms is null then public.players.best_time_ms
                          when public.players.best_time_ms is null then p_best_time_ms
                          when p_best_time_ms < public.players.best_time_ms then p_best_time_ms
                          else public.players.best_time_ms
                        end,
    playtime_seconds  = public.players.playtime_seconds + coalesce(p_playtime_seconds, 0),
    updated_at        = now();
$$;

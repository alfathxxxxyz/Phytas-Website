-- ============================================================
--  PYTHAS Leaderboard — MIGRATION: per-map leaderboards
--  Tambah kolom `map` supaya satu pemain bisa punya rekor terpisah
--  untuk Mount Aztec dan Mount Agora.
--
--  Jalankan di Supabase: SQL Editor -> New query -> paste -> Run.
--  Aman dijalankan berulang (idempotent).
--
--  Data lama (yang sudah ada) dianggap milik "Mount Aztec".
-- ============================================================

-- 1) Tambah kolom map (default Mount Aztec untuk data lama)
alter table public.players add column if not exists map text;
update public.players set map = 'Mount Aztec' where map is null;
alter table public.players alter column map set default 'Mount Aztec';
alter table public.players alter column map set not null;

-- 2) Hapus data dummy contoh (xRacer_Pro / SpeedDemon42 / NitroBlaze)
delete from public.players where user_id in (1, 2, 3);
delete from public.players where user_id < 0;

-- 3) Ganti primary key dari (user_id) menjadi (user_id, map)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'players_pkey' and conrelid = 'public.players'::regclass
  ) then
    -- kalau PK lama masih single-column, ganti ke composite
    if (
      select array_length(conkey, 1) from pg_constraint
      where conname = 'players_pkey' and conrelid = 'public.players'::regclass
    ) = 1 then
      alter table public.players drop constraint players_pkey;
      alter table public.players add constraint players_pkey primary key (user_id, map);
    end if;
  else
    alter table public.players add constraint players_pkey primary key (user_id, map);
  end if;
end $$;

-- 4) Index per-map biar query leaderboard tetap cepat
drop index if exists players_summit_idx;
drop index if exists players_best_time_idx;
create index if not exists players_map_summit_idx
  on public.players (map, summit desc);
create index if not exists players_map_time_idx
  on public.players (map, best_time_ms asc)
  where best_time_ms is not null;

-- 5) RPC upsert per-map (dipakai Worker saat game kirim data)
drop function if exists public.upsert_player_stats(bigint, text, text, integer, integer);

create or replace function public.upsert_player_stats(
  p_user_id      bigint,
  p_username     text,
  p_display_name text,
  p_summit       integer,
  p_best_time_ms integer,
  p_map          text
)
returns void
language sql
as $$
  insert into public.players (user_id, map, username, display_name, summit, best_time_ms, updated_at)
  values (
    p_user_id,
    coalesce(nullif(p_map, ''), 'Mount Aztec'),
    p_username, p_display_name,
    coalesce(p_summit, 0), p_best_time_ms, now()
  )
  on conflict (user_id, map) do update set
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

-- 6) RPC untuk menyimpan nama Roblox asli (semua map sekaligus, sekali request)
create or replace function public.upsert_player_names(p jsonb)
returns void
language plpgsql
as $$
begin
  update public.players pl
  set username = x.username,
      display_name = x.display_name
  from jsonb_to_recordset(p) as x(user_id bigint, username text, display_name text)
  where pl.user_id = x.user_id
    and (pl.username is distinct from x.username
         or pl.display_name is distinct from x.display_name);
end;
$$;

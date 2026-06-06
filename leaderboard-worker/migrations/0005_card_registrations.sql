-- ============================================================
--  PYTHAS — MIGRATION: card registration numbers
--  Tiap pemain dapat NOMOR URUT permanen saat PERTAMA KALI
--  generate Player Card. Idempotent: user yang sama selalu
--  dapat nomor yang sama. Diformat di Worker jadi "000-00-00001".
--
--  Jalankan di Supabase: SQL Editor -> New query -> paste -> Run.
--  Aman dijalankan berulang.
-- ============================================================

-- 1) Tabel registrasi card (nomor urut auto-increment per user)
create table if not exists public.card_registrations (
  user_id     bigint primary key,
  reg_number  bigint generated always as identity,
  created_at  timestamptz default now()
);

alter table public.card_registrations enable row level security;

-- 2) RPC get-or-create: kembalikan nomor urut pemain.
--    Kalau belum punya, assign nomor baru (atomic, aman dari race).
create or replace function public.get_or_create_card_reg(p_user_id bigint)
returns bigint
language plpgsql
as $$
declare
  v_num bigint;
begin
  -- Sudah punya nomor?
  select reg_number into v_num
  from public.card_registrations
  where user_id = p_user_id;

  if v_num is not null then
    return v_num;
  end if;

  -- Belum: assign baru. ON CONFLICT menjaga race (dua request bersamaan).
  insert into public.card_registrations (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing
  returning reg_number into v_num;

  -- Kalau insert kalah race (do nothing), ambil nomor yang sudah dibuat request lain.
  if v_num is null then
    select reg_number into v_num
    from public.card_registrations
    where user_id = p_user_id;
  end if;

  return v_num;
end;
$$;

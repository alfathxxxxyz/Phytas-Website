# ⚙️ Setup Supabase — Sistem Registrasi PYTHAS

Ada **3 langkah** yang harus kamu lakukan di dashboard Supabase supaya form registrasi
dan panel admin bisa jalan dengan AMAN. Cukup sekali setup.

> Versi ini sudah diperkuat (hardened): hanya email admin yang kamu daftarkan yang bisa
> melihat / menghapus data pendaftar — bahkan kalau ada orang yang berhasil bikin akun.

---

## Langkah 1 — Bikin tabel + keamanan (SQL)

1. Di dashboard Supabase, buka menu kiri **SQL Editor** → **New query**.
2. Copy SEMUA kode di bawah, tempel, lalu klik **Run**.
   (Aman dijalankan ulang kalau sebelumnya sudah pernah jalan.)

```sql
-- 1) Tabel pendaftaran event
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id text,
  event_title text,
  roblox_username text not null,
  discord_username text not null,
  device text,
  map text,
  notes text
);

-- 2) Daftar email admin yang boleh lihat data
create table if not exists public.admins (
  email text primary key,
  added_at timestamptz not null default now()
);

-- 3) Fungsi cek admin (aman: bypass RLS tabel admins secara terkontrol)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- 4) Aktifkan Row Level Security
alter table public.registrations enable row level security;
alter table public.admins enable row level security;
-- (tabel admins sengaja TANPA policy => tidak bisa dibaca/diubah lewat API publik)

-- 5) Siapa saja boleh MENDAFTAR (insert), tapi tidak bisa lihat data orang lain
drop policy if exists "anyone can register" on public.registrations;
create policy "anyone can register"
  on public.registrations
  for insert
  to anon, authenticated
  with check (true);

-- 6) Hanya admin di allowlist yang bisa MELIHAT
drop policy if exists "admins can read" on public.registrations;
drop policy if exists "only admins can read" on public.registrations;
create policy "only admins can read"
  on public.registrations
  for select
  to authenticated
  using ( public.is_admin() );

-- 7) Hanya admin di allowlist yang bisa MENGHAPUS
drop policy if exists "admins can delete" on public.registrations;
drop policy if exists "only admins can delete" on public.registrations;
create policy "only admins can delete"
  on public.registrations
  for delete
  to authenticated
  using ( public.is_admin() );
```

Kalau muncul "Success. No rows returned" berarti berhasil. ✅

---

## Langkah 2 — Matikan pendaftaran akun publik (PENTING)

Lapisan keamanan kedua: mencegah orang asing bikin akun sembarangan.

1. Buka **Authentication** → **Sign In / Providers** (atau **Providers** → **Email**).
2. Cari opsi **"Allow new users to sign up"** / **"Enable Sign Ups"**.
3. **MATIKAN (OFF)**.

---

## Langkah 3 — Bikin akun admin + daftarkan ke allowlist

**3a. Bikin akun login:**
1. Buka **Authentication** → **Users** → **Add user**.
2. Isi **email** + **password kuat** (campur huruf besar/kecil, angka, simbol).
3. Centang **"Auto Confirm User"** (kalau ada). Klik **Create user**.

**3b. Daftarkan email itu sebagai admin** (di **SQL Editor**, ganti dengan email kamu):

```sql
insert into public.admins (email) values ('email-admin-kamu@contoh.com')
on conflict (email) do nothing;
```

> **Kasih akses ke mod lain?** Ulangi 3a (bikin akun mereka) + 3b (masukkan email mereka).
> Mau cabut akses seseorang? Hapus dari allowlist:
> `delete from public.admins where email = 'email-mereka@contoh.com';`

---

## Cara pakai

- **Form registrasi:** otomatis muncul saat pengunjung klik tombol **REGISTER** di event.
- **Panel admin:** buka `https://<domain-kamu>/admin.html` → login pakai akun Langkah 3a.
  Bisa lihat semua pendaftar, filter, **Export CSV** (buka di Google Sheets/Excel),
  **Import CSV**, dan hapus data.

---

## Catatan keamanan

- **Project URL** & **publishable key** memang aman ditaruh di kode website (didesain publik).
  Yang melindungi data adalah RLS (Langkah 1) + allowlist admin (Langkah 3) + signup dimatikan (Langkah 2).
- **JANGAN PERNAH** taruh `service_role` / secret key di kode website.
- Pakai **password admin yang kuat** — panel admin ada di URL publik (`/admin.html`),
  yang melindungi cuma login-nya.
- Form registrasi terbuka untuk publik (memang harus). Kalau nanti kena spam,
  kabari aku — bisa kita pasang **Cloudflare Turnstile** (CAPTCHA tak terlihat, gratis).

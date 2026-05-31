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

---

## Langkah 4 (opsional, DISARANKAN) — Anti-spam: Cloudflare Turnstile

Form registrasi terbuka untuk publik, jadi rawan spam bot. Turnstile adalah CAPTCHA
gratis dari Cloudflare yang hampir tak terlihat. Verifikasinya dilakukan **di server
(Cloudflare Worker)**, bukan cuma di browser, jadi tidak bisa dilewati.

**4a. Bikin widget Turnstile:**
1. Buka **Cloudflare Dashboard** → **Turnstile** → **Add widget**.
2. Masukkan domain kamu (mis. `pythas.gg`). Pilih mode **Managed**.
3. Kamu akan dapat 2 kunci:
   - **Site Key** (publik) → tempel di `supabase-config.js`:
     ```js
     const TURNSTILE_SITE_KEY = '0x4AAAAAAA...'; // site key kamu
     ```
   - **Secret Key** (rahasia) → set di Worker (JANGAN ditaruh di website):
     ```bash
     cd leaderboard-worker
     npx wrangler secret put TURNSTILE_SECRET_KEY
     ```

**4b. Pastikan Worker aktif & alamatnya benar.**
Di `supabase-config.js`, `WORKER_URL` harus menunjuk ke Worker kamu
(mis. `https://pythas-leaderboard.<subdomain>.workers.dev`). Saat `WORKER_URL` diisi,
form registrasi otomatis dikirim lewat Worker (yang mengecek Turnstile dulu), bukan
langsung ke Supabase.

> Kalau `TURNSTILE_SITE_KEY` dikosongkan, captcha mati dan form jatuh ke mode lama
> (insert langsung ke Supabase yang tetap dilindungi RLS). Aman, tapi tanpa anti-bot.

---

## Langkah 5 (opsional, DISARANKAN) — Kunci `registrations` hanya lewat Worker

Setelah Turnstile aktif dan registrasi lewat Worker, kamu bisa **mematikan insert
langsung** dari browser supaya bot tidak bisa lewat jalur Supabase langsung. Jalankan
di **SQL Editor**:

```sql
-- Cabut izin insert publik: pendaftaran HARUS lewat Worker (service role bypass RLS)
drop policy if exists "anyone can register" on public.registrations;
```

> ⚠️ Lakukan ini **hanya** setelah memastikan `WORKER_URL` + Turnstile berjalan dan
> registrasi berhasil tersimpan. Kalau belum, biarkan policy `"anyone can register"`
> tetap ada supaya form mode-fallback masih bisa jalan.
>
> Mau balikin? Jalankan lagi blok policy nomor 5 di Langkah 1.

---

## Ringkasan lapisan keamanan

| Lapisan | Melindungi dari | Langkah |
|---------|-----------------|---------|
| RLS + allowlist admin | Orang lain baca/hapus data pendaftar | 1, 3 |
| Signup dimatikan | Orang asing bikin akun admin | 2 |
| Turnstile (server-side) | Bot spam massal | 4 |
| Insert dikunci ke Worker | Bypass form lewat API Supabase | 5 |
| `service_role` hanya di Worker | Kebocoran kunci paling berbahaya | — |
| CORS `ALLOWED_ORIGINS` di Worker | Situs lain pakai endpoint kamu | (lihat README worker) |

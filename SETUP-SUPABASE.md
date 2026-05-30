# ⚙️ Setup Supabase — Sistem Registrasi PYTHAS

Ada **3 langkah** yang harus kamu lakukan di dashboard Supabase supaya form registrasi
dan panel admin bisa jalan. Cukup sekali setup.

---

## Langkah 1 — Bikin tabel + keamanan (SQL)

1. Di dashboard Supabase, buka menu kiri **SQL Editor** → **New query**.
2. Copy SEMUA kode di bawah, tempel, lalu klik **Run**.

```sql
-- Tabel pendaftaran event
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

-- Aktifkan Row Level Security (keamanan per-baris)
alter table public.registrations enable row level security;

-- Siapa saja boleh MENDAFTAR (insert), tapi TIDAK bisa melihat data orang lain
create policy "anyone can register"
  on public.registrations
  for insert
  to anon, authenticated
  with check (true);

-- Hanya admin yang LOGIN yang bisa MELIHAT semua pendaftar
create policy "admins can read"
  on public.registrations
  for select
  to authenticated
  using (true);

-- Hanya admin yang LOGIN yang bisa MENGHAPUS
create policy "admins can delete"
  on public.registrations
  for delete
  to authenticated
  using (true);
```

Kalau muncul "Success. No rows returned" berarti berhasil. ✅

---

## Langkah 2 — Matikan pendaftaran akun publik (PENTING untuk keamanan)

Ini mencegah orang asing bikin akun lalu mengintip data pendaftar.

1. Buka **Authentication** → **Sign In / Providers** (atau **Providers** → **Email**).
2. Cari opsi **"Allow new users to sign up"** / **"Enable Sign Ups"**.
3. **MATIKAN (OFF)**.

Dengan ini, satu-satunya akun yang bisa login ke panel admin adalah akun yang kamu buat sendiri (Langkah 3).

---

## Langkah 3 — Bikin akun admin (buat login ke panel)

1. Buka **Authentication** → **Users** → **Add user** (atau "Invite").
2. Isi **email** + **password** yang kamu mau buat login admin.
3. Centang **"Auto Confirm User"** (kalau ada) supaya akun langsung aktif.
4. Klik **Create user**.

> **Mau kasih akses ke admin/mod lain?** Ulangi Langkah 3 dengan email mereka.
> Tiap orang punya login sendiri. Karena pendaftaran publik sudah dimatikan,
> hanya akun yang kamu buat di sini yang bisa masuk.

---

## Cara pakai

- **Form registrasi:** otomatis muncul saat pengunjung klik tombol **REGISTER** di event.
- **Panel admin:** buka `https://<domain-kamu>/admin.html` → login pakai akun Langkah 3.
  Di sana kamu bisa lihat semua pendaftar, filter, **Export CSV** (buka di Google Sheets/Excel),
  **Import CSV**, dan hapus data.

---

## Catatan keamanan

- **Project URL** & **publishable key** memang aman ditaruh di kode website (didesain publik).
  Yang melindungi data adalah RLS (Langkah 1) + signup dimatikan (Langkah 2).
- **JANGAN PERNAH** taruh `service_role` / secret key di kode website.

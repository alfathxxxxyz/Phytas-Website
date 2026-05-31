-- ============================================================
--  (OPSIONAL) Seed data leaderboard LAMA dari data/leaderboard.json
--
--  Catatan:
--   - Ini data lama (placeholder). Boleh dipakai sementara biar
--     leaderboard nggak kosong sebelum data asli dari game masuk.
--   - user_id pakai angka NEGATIF (-1..-10) supaya DIJAMIN tidak
--     menabrak data asli dari Roblox (yang selalu positif).
--   - summit = 0 (data lama nggak punya nilai summit), jadi mereka
--     hanya muncul bagus di tab SPEEDRUN. Di tab SUMMIT nilainya 0.
--   - best_time_ms = konversi dari "mm:ss.SS" ke milidetik.
--
--  Jalankan di Supabase: SQL Editor -> New query -> paste -> Run.
--  Mau hapus lagi nanti?  delete from public.players where user_id < 0;
-- ============================================================

insert into public.players (user_id, username, display_name, summit, best_time_ms) values
  (-1,  'xRacer_Pro',   'xRacer_Pro',   0, 83470),
  (-2,  'SpeedDemon42', 'SpeedDemon42', 0, 84120),
  (-3,  'NitroBlaze',   'NitroBlaze',   0, 85890),
  (-4,  'DriftKing99',  'DriftKing99',  0, 86330),
  (-5,  'TurboMax',     'TurboMax',     0, 88050),
  (-6,  'VelocityX',    'VelocityX',    0, 89410),
  (-7,  'ShadowRacer',  'ShadowRacer',  0, 90220),
  (-8,  'LimeRunner',   'LimeRunner',   0, 91580),
  (-9,  'AceDriver',    'AceDriver',    0, 92900),
  (-10, 'FlashPoint',   'FlashPoint',   0, 93150)
on conflict (user_id) do nothing;

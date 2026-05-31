--!strict
-- ============================================================
--  PYTHAS Leaderboard Sync
--  Letakkan Script ini di: ServerScriptService
--
--  Fungsinya: mengirim statistik pemain ke Cloudflare Worker,
--  yang lalu menyimpannya di Supabase untuk leaderboard website.
--
--  PENTING sebelum dipakai:
--   1) Studio -> Game Settings -> Security -> "Allow HTTP Requests" = ON
--   2) Ganti WORKER_URL dan SYNC_SECRET di bawah.
--   3) Panggil PythasLeaderboard.sync(...) dari logika game kamu
--      saat pemain summit / mencatat waktu (lihat contoh paling bawah).
-- ============================================================

local HttpService = game:GetService("HttpService")

-- ====== 1) CONFIG - GANTI DUA BARIS INI ======
local WORKER_URL  = "https://pythas-leaderboard.XXXX.workers.dev/api/roblox/player-stats"
local SYNC_SECRET = "PASTE_ROBLOX_SYNC_SECRET_DISINI"
-- =============================================

--[[
  sync(player, summitTotal, bestTimeMs, eventType)

  player      : objek Player
  summitTotal : TOTAL summit pemain saat ini (angka). -> disimpan sbg nilai terbaru
  bestTimeMs  : waktu lari yg baru saja dicatat dlm milidetik (angka), atau nil.
                -> server hanya menyimpan kalau lebih kecil dari rekor lama
  eventType   : "summit" atau "speedrun" (opsional, penanda saja)
]]
local function sync(player: Player, summitTotal: number?, bestTimeMs: number?, eventType: string?)
	local payload = {
		userId = player.UserId,
		username = player.Name,
		displayName = player.DisplayName,
		summit = summitTotal,
		bestTimeMs = bestTimeMs,
		eventType = eventType,
	}

	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = WORKER_URL,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["x-roblox-secret"] = SYNC_SECRET,
			},
			Body = HttpService:JSONEncode(payload),
		})
	end)

	if not ok then
		warn("[PYTHAS] sync error: " .. tostring(result))
		return
	end

	if not result.Success then
		warn(("[PYTHAS] sync gagal (%d): %s"):format(result.StatusCode, tostring(result.Body)))
	else
		print(("[PYTHAS] synced %s (summit=%s, time=%s)"):format(
			player.Name, tostring(summitTotal), tostring(bestTimeMs)))
	end
end

-- Ekspor supaya bisa dipanggil dari script lain:  _G.PythasLeaderboard.sync(...)
_G.PythasLeaderboard = { sync = sync }

-- ============================================================
--  CONTOH CARA MANGGIL (hapus/ubah sesuai logika game kamu)
-- ============================================================
--
-- Contoh A - saat pemain sampai puncak (summit):
--
--   local total = getSummitTotal(player)   -- ambil dari leaderstats/DataStore kamu
--   _G.PythasLeaderboard.sync(player, total, nil, "summit")
--
-- Contoh B - saat pemain selesai balapan & catat waktu:
--
--   local timeMs = math.floor(elapsedSeconds * 1000)
--   _G.PythasLeaderboard.sync(player, nil, timeMs, "speedrun")
--
-- Contoh C - kirim dua-duanya sekaligus:
--
--   _G.PythasLeaderboard.sync(player, total, timeMs, "speedrun")
-- ============================================================

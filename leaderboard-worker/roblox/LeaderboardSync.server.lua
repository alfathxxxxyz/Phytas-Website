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
--   2) Ganti WORKER_URL, SYNC_SECRET, dan MAP_NAME di bawah.
--      -> Di game Mount Aztec  : MAP_NAME = "aztec"
--      -> Di game Mount Agora  : MAP_NAME = "agora"
--   3) Panggil PythasLeaderboard.sync(...) dari logika game kamu
--      saat pemain summit / mencatat waktu (lihat contoh paling bawah).
-- ============================================================

local HttpService = game:GetService("HttpService")

-- ====== 1) CONFIG - GANTI TIGA BARIS INI ======
local WORKER_URL  = "https://pythas-leaderboard.XXXX.workers.dev/api/roblox/player-stats"
local SYNC_SECRET = "PASTE_ROBLOX_SYNC_SECRET_DISINI"
local MAP_NAME    = "aztec"  -- "aztec" untuk Mount Aztec, "agora" untuk Mount Agora
-- ==============================================

--[[
  sync(player, summitTotal, bestTimeMs, eventType)

  player      : objek Player
  summitTotal : TOTAL summit pemain saat ini (angka). -> disimpan sbg nilai terbaru
  bestTimeMs  : waktu lari yg baru saja dicatat dlm milidetik (angka), atau nil.
                -> server hanya menyimpan kalau lebih kecil dari rekor lama
  eventType   : "summit" atau "speedrun" (opsional, penanda saja)

  Catatan: map otomatis diambil dari MAP_NAME di atas, jadi cukup set sekali
  per game. Tiap game (Aztec / Agora) punya leaderboard terpisah di website.
]]
local function sync(player: Player, summitTotal: number?, bestTimeMs: number?, eventType: string?)
	local payload = {
		userId = player.UserId,
		username = player.Name,
		displayName = player.DisplayName,
		summit = summitTotal,
		bestTimeMs = bestTimeMs,
		eventType = eventType,
		map = MAP_NAME,
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
		print(("[PYTHAS] synced %s @ %s (summit=%s, time=%s)"):format(
			player.Name, MAP_NAME, tostring(summitTotal), tostring(bestTimeMs)))
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


-- ============================================================
--  INTEGRASI NYATA UNTUK MOUNT AGORA (TerlaSystems)
--  Letakkan pemanggilan ini DI DALAM script game yang sudah ada.
--  PENTING: pastikan script ini (LeaderboardSync) ada di
--  ServerScriptService dan sudah jalan sebelum dipanggil.
-- ============================================================
--
-- (1) SUMMIT
--     File : ServerScriptService.TerlaSystems.Checkpoints.CheckpointService
--     Fungsi: awardSummit(player, finishIndex)
--     Taruh SETELAH SaveSummitData sukses:
--
--       if ok and result then
--           PendingSummit[uid] = nil
--           ProfileManager.TriggerGlobalRefresh("summit")
--
--           if _G.PythasLeaderboard and _G.PythasLeaderboard.sync then
--               task.spawn(function()
--                   _G.PythasLeaderboard.sync(player, newValue, nil, "summit")
--               end)
--           end
--
--           return
--       end
--
--     -> "newValue" = TOTAL summit pemain terbaru.
--
-- (2) SPEEDRUN
--     File : ServerScriptService.TerlaSystems.SpeedRun.SpeedRunService
--     Fungsi: finishSpeedRun(player)
--     Taruh SETELAH SaveTimeData sukses:
--
--       if saveOk then
--           local bestTimeMs = ProfileManager.GetBestTime(player)
--
--           if _G.PythasLeaderboard and _G.PythasLeaderboard.sync then
--               task.spawn(function()
--                   _G.PythasLeaderboard.sync(player, nil, bestTimeMs, "speedrun")
--               end)
--           end
--       end
--
--     -> "bestTimeMs" = waktu terbaik pemain dalam milidetik.
--
--  Catatan:
--   - task.spawn dipakai supaya request HTTP tidak nge-block gameplay. (bagus!)
--   - MAP_NAME di config atas yang menentukan map ("agora" / "aztec"),
--     jadi pemanggilan di atas TIDAK perlu menyebut map.
-- ============================================================

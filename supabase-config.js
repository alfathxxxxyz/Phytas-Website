// ============================================================
//  SUPABASE CONFIG
//  - The publishable key is SAFE to expose in the browser.
//    Data is protected by Row Level Security (RLS) policies
//    configured in the Supabase dashboard (see SETUP-SUPABASE.md).
//  - NEVER put the `service_role` / secret key here.
// ============================================================

const SUPABASE_URL = 'https://bwflcobcbtwtorucmsbr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_APGfpDH22piJVGpdz4WkQw_Vh2EITwO';

// ============================================================
//  PUBLIC SITE CONFIG (safe to expose in the browser)
//  - WORKER_URL: the Cloudflare Worker that handles registration + leaderboard.
//    When set, event registrations are submitted through the Worker, which
//    verifies a Cloudflare Turnstile token server-side before writing to the DB.
//  - TURNSTILE_SITE_KEY: Cloudflare Turnstile *site* key (public). The matching
//    *secret* key lives ONLY in the Worker (never in the browser).
//  Leave TURNSTILE_SITE_KEY empty to disable the captcha (the form then falls
//  back to a direct, RLS-protected Supabase insert).
// ============================================================
const WORKER_URL = 'https://pythas-leaderboard.alfathpr18.workers.dev';
const TURNSTILE_SITE_KEY = ''; // e.g. '0x4AAAAAAA...'  (paste your Turnstile site key)
window.PYTHAS_CONFIG = { WORKER_URL, TURNSTILE_SITE_KEY };

// `supabase` global is provided by the UMD bundle loaded in the HTML <head>:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

if (!supabaseClient) {
    console.warn('[supabase-config] Supabase client could not be initialized. Is the supabase-js script loaded before this file?');
}

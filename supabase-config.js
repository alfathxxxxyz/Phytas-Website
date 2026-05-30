// ============================================================
//  SUPABASE CONFIG
//  - The publishable key is SAFE to expose in the browser.
//    Data is protected by Row Level Security (RLS) policies
//    configured in the Supabase dashboard (see SETUP-SUPABASE.md).
//  - NEVER put the `service_role` / secret key here.
// ============================================================

const SUPABASE_URL = 'https://bwflcobcbtwtorucmsbr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_APGfpDH22piJVGpdz4WkQw_Vh2EITwO';

// `supabase` global is provided by the UMD bundle loaded in the HTML <head>:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

if (!supabaseClient) {
    console.warn('[supabase-config] Supabase client could not be initialized. Is the supabase-js script loaded before this file?');
}

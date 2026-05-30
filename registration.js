// ============================================================
//  EVENT REGISTRATION FORM
//  Opens an on-site modal, submits to the Supabase `registrations`
//  table. Exposes window.openRegModal(eventId, eventTitle).
// ============================================================
(function setupRegistration() {
    let currentEvent = { id: '', title: '' };
    let isSubmitting = false;
    const REG_COOLDOWN_MS = 60000; // 1 registration per minute (client-side anti-spam)
    const REG_COOLDOWN_KEY = 'pythas_last_registration';

    function showMsg(text, type) {
        const msg = document.getElementById('regMessage');
        if (!msg) return;
        msg.textContent = text;
        msg.className = 'reg-message' + (type ? ' ' + type : '');
    }

    function openRegModal(eventId, eventTitle) {
        const overlay = document.getElementById('regModalOverlay');
        if (!overlay) return;

        currentEvent = {
            id: eventId || '',
            title: eventTitle || 'General Registration'
        };

        const nameEl = document.getElementById('regEventName');
        if (nameEl) nameEl.textContent = currentEvent.title;

        const form = document.getElementById('regForm');
        if (form) form.reset();
        showMsg('', '');

        const submit = document.getElementById('regSubmit');
        if (submit) {
            submit.disabled = false;
            submit.textContent = 'SUBMIT REGISTRATION';
        }

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const first = document.getElementById('regRoblox');
        if (first) setTimeout(() => first.focus(), 60);
    }
    // Expose globally so event buttons can trigger it
    window.openRegModal = openRegModal;

    function closeRegModal() {
        const overlay = document.getElementById('regModalOverlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    document.addEventListener('DOMContentLoaded', () => {
        const overlay = document.getElementById('regModalOverlay');
        const closeBtn = document.getElementById('regModalClose');
        const form = document.getElementById('regForm');

        if (closeBtn) closeBtn.addEventListener('click', closeRegModal);
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeRegModal();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeRegModal();
        });

        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Prevent double-submit while a request is already in flight
            if (isSubmitting) return;

            // Honeypot: real users never fill this hidden field. Bots do.
            const hp = document.getElementById('regWebsite');
            if (hp && hp.value) { closeRegModal(); return; }

            const roblox = document.getElementById('regRoblox').value.trim();
            const discord = document.getElementById('regDiscord').value.trim();
            const device = document.getElementById('regDevice').value;
            const map = document.getElementById('regMap').value;
            const notes = document.getElementById('regNotes').value.trim();

            if (!roblox || !discord || !device) {
                showMsg('Please fill in all required fields marked with *.', 'error');
                return;
            }

            // Client-side rate limit: max 1 registration per minute (anti-spam / double-click)
            const last = parseInt(localStorage.getItem(REG_COOLDOWN_KEY) || '0', 10);
            const elapsed = Date.now() - last;
            if (last && elapsed < REG_COOLDOWN_MS) {
                const wait = Math.ceil((REG_COOLDOWN_MS - elapsed) / 1000);
                showMsg('You just registered. Please wait ' + wait + 's before submitting again.', 'error');
                return;
            }

            if (!supabaseClient) {
                showMsg('Registration is not available right now. Please try again later.', 'error');
                return;
            }

            const submit = document.getElementById('regSubmit');
            isSubmitting = true;
            submit.disabled = true;
            submit.textContent = 'SUBMITTING…';

            const { error } = await supabaseClient.from('registrations').insert({
                event_id: currentEvent.id || null,
                event_title: currentEvent.title || null,
                roblox_username: roblox,
                discord_username: discord,
                device: device,
                map: map || null,
                notes: notes || null
            });

            if (error) {
                console.error('[registration] insert error:', error);
                showMsg('Something went wrong. Please try again in a moment.', 'error');
                submit.disabled = false;
                submit.textContent = 'SUBMIT REGISTRATION';
                isSubmitting = false;
                return;
            }

            // Record successful submission time so the cooldown kicks in
            localStorage.setItem(REG_COOLDOWN_KEY, String(Date.now()));
            isSubmitting = false;

            showMsg('Registration successful! See you on the track. 🏁', 'success');
            submit.textContent = 'REGISTERED ✓';
            setTimeout(closeRegModal, 1900);
        });
    });
})();

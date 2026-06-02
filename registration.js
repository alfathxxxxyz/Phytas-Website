// ============================================================
//  EVENT REGISTRATION FORM
//  Opens an on-site modal, submits to the Supabase `registrations`
//  table. Exposes window.openRegModal(eventId, eventTitle).
// ============================================================
(function setupRegistration() {
    let currentEvent = { id: '', title: '', registrationFields: [] };
    let isSubmitting = false;
    const REG_COOLDOWN_MS = 60000; // max 1 registration per minute, PER EVENT (anti-spam)
    const REG_COOLDOWN_KEY = 'pythas_reg_cooldowns';

    // Public site config (set in supabase-config.js). Safe to read in the browser.
    const CONFIG = (window.PYTHAS_CONFIG || {});
    const WORKER_URL = (CONFIG.WORKER_URL || '').replace(/\/$/, '');
    const TURNSTILE_SITE_KEY = CONFIG.TURNSTILE_SITE_KEY || '';
    const USE_WORKER = !!WORKER_URL;          // route through Worker when configured
    const USE_TURNSTILE = !!TURNSTILE_SITE_KEY; // show captcha when a site key is set

    let turnstileWidgetId = null;
    let turnstileLoading = false;

    // Lazily inject the Cloudflare Turnstile script (only if a site key is set).
    function loadTurnstileScript() {
        if (!USE_TURNSTILE || turnstileLoading) return;
        if (window.turnstile) return;
        turnstileLoading = true;
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
    }

    // Render (or reset) the Turnstile widget inside the modal.
    function renderTurnstile() {
        if (!USE_TURNSTILE) return;
        const el = document.getElementById('regTurnstile');
        if (!el) return;
        if (!window.turnstile) {
            // Script not ready yet; try again shortly.
            setTimeout(renderTurnstile, 250);
            return;
        }
        if (turnstileWidgetId !== null) {
            try { window.turnstile.reset(turnstileWidgetId); } catch (e) {}
            return;
        }
        try {
            turnstileWidgetId = window.turnstile.render(el, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: 'dark',
                action: 'register',
            });
        } catch (e) {
            console.warn('[registration] Turnstile render failed:', e);
        }
    }

    function getTurnstileToken() {
        if (!USE_TURNSTILE) return '';
        try {
            return (window.turnstile && turnstileWidgetId !== null)
                ? (window.turnstile.getResponse(turnstileWidgetId) || '')
                : '';
        } catch (e) {
            return '';
        }
    }

    // Stable key identifying the current event
    function eventKey() {
        return currentEvent.id || currentEvent.title || 'general';
    }

    // Read the { eventKey: timestamp } cooldown map from localStorage
    function getCooldowns() {
        try {
            const raw = localStorage.getItem(REG_COOLDOWN_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    // Save the cooldown for an event, pruning expired entries to stay tidy
    function setCooldown(key) {
        const now = Date.now();
        const map = getCooldowns();
        Object.keys(map).forEach(k => {
            if (now - map[k] > REG_COOLDOWN_MS) delete map[k];
        });
        map[key] = now;
        try { localStorage.setItem(REG_COOLDOWN_KEY, JSON.stringify(map)); } catch (e) {}
    }

    function showMsg(text, type) {
        const msg = document.getElementById('regMessage');
        if (!msg) return;
        msg.textContent = text;
        msg.className = 'reg-message' + (type ? ' ' + type : '');
    }

    const DEFAULT_FIELDS = [
        { key: 'roblox_username', label: 'Roblox Username', type: 'text', required: true, placeholder: 'e.g. xRacer_Pro' },
        { key: 'discord_username', label: 'Discord Username', type: 'text', required: true, placeholder: 'e.g. @username' },
        { key: 'device', label: 'Device', type: 'select', required: true, options: ['PC', 'Mobile', 'Mixed'] },
        { key: 'map', label: 'Preferred Map', type: 'select', required: false, options: ['Mount Agora', 'Mount Aztec'], placeholder: 'No preference' },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false, placeholder: 'Anything we should know?' }
    ];

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
        }[c]));
    }

    function fieldId(key) {
        return 'regField_' + String(key || '').replace(/[^a-z0-9_-]/gi, '_');
    }

    function renderField(field) {
        const id = fieldId(field.key);
        const required = field.required ? ' required' : '';
        const req = field.required ? ' <span class="req">*</span>' : '';
        const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '';
        const help = field.helpText ? `<small>${escapeHtml(field.helpText)}</small>` : '';
        const label = `<label for="${id}">${escapeHtml(field.label)}${req}</label>`;

        if (field.type === 'textarea') {
            return `<div class="reg-field">${label}<textarea id="${id}" name="${escapeHtml(field.key)}" rows="3" maxlength="500"${required}${placeholder}></textarea>${help}</div>`;
        }

        if (field.type === 'select') {
            const empty = `<option value="">${escapeHtml(field.placeholder || 'Select...')}</option>`;
            const options = (field.options || []).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('');
            return `<div class="reg-field">${label}<select id="${id}" name="${escapeHtml(field.key)}"${required}>${empty}${options}</select>${help}</div>`;
        }

        if (field.type === 'checkbox') {
            return `<div class="reg-field"><label><input type="checkbox" id="${id}" name="${escapeHtml(field.key)}"${required}> ${escapeHtml(field.label)}${req}</label>${help}</div>`;
        }

        const type = ['number', 'date', 'url'].includes(field.type) ? field.type : 'text';
        return `<div class="reg-field">${label}<input type="${type}" id="${id}" name="${escapeHtml(field.key)}" maxlength="120" autocomplete="off"${required}${placeholder}>${help}</div>`;
    }

    function renderRegistrationFields() {
        const container = document.getElementById('regDynamicFields');
        if (!container) return;
        const fields = currentEvent.registrationFields && currentEvent.registrationFields.length
            ? currentEvent.registrationFields
            : DEFAULT_FIELDS;
        container.innerHTML = fields.map(renderField).join('');
    }

    function collectRegistrationAnswers() {
        const fields = currentEvent.registrationFields && currentEvent.registrationFields.length
            ? currentEvent.registrationFields
            : DEFAULT_FIELDS;
        const answers = {};
        const missing = [];

        fields.forEach(field => {
            const el = document.getElementById(fieldId(field.key));
            if (!el) return;
            const value = field.type === 'checkbox' ? el.checked : String(el.value || '').trim();
            answers[field.key] = value;
            if (field.required && (field.type === 'checkbox' ? !value : !String(value).trim())) {
                missing.push(field.label);
            }
        });

        return { fields, answers, missing };
    }

    function openRegModal(eventId, eventTitle, eventData) {
        const overlay = document.getElementById('regModalOverlay');
        if (!overlay) return;

        currentEvent = {
            id: eventId || '',
            title: eventTitle || 'General Registration',
            registrationFields: (eventData && eventData.registrationFields) || []
        };

        const nameEl = document.getElementById('regEventName');
        if (nameEl) nameEl.textContent = currentEvent.title;

        const form = document.getElementById('regForm');
        if (form) form.reset();
        renderRegistrationFields();
        showMsg('', '');

        // Prepare the captcha (no-op when Turnstile isn't configured)
        loadTurnstileScript();
        renderTurnstile();

        const submit = document.getElementById('regSubmit');
        if (submit) {
            submit.disabled = false;
            submit.textContent = 'SUBMIT REGISTRATION';
        }

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const first = document.querySelector('#regDynamicFields input, #regDynamicFields select, #regDynamicFields textarea');
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

            const collected = collectRegistrationAnswers();

            if (collected.missing.length > 0) {
                showMsg('Please fill in all required fields marked with *.', 'error');
                return;
            }

            // Client-side rate limit: max 1 registration per minute PER EVENT (anti-spam / double-click)
            const last = getCooldowns()[eventKey()] || 0;
            const elapsed = Date.now() - last;
            if (last && elapsed < REG_COOLDOWN_MS) {
                const wait = Math.ceil((REG_COOLDOWN_MS - elapsed) / 1000);
                showMsg('You just registered for this event. Please wait ' + wait + 's before submitting again.', 'error');
                return;
            }

            // If a captcha is configured, make sure it's been solved first.
            const turnstileToken = getTurnstileToken();
            if (USE_TURNSTILE && !turnstileToken) {
                showMsg('Please complete the verification challenge before submitting.', 'error');
                return;
            }

            // We need *some* backend: either the Worker or a direct Supabase client.
            if (!USE_WORKER && !supabaseClient) {
                showMsg('Registration is not available right now. Please try again later.', 'error');
                return;
            }

            const submit = document.getElementById('regSubmit');
            isSubmitting = true;
            submit.disabled = true;
            submit.textContent = 'SUBMITTING…';

            const payload = {
                event_id: currentEvent.id || null,
                event_title: currentEvent.title || null,
                roblox_username: collected.answers.roblox_username || collected.answers.roblox || null,
                discord_username: collected.answers.discord_username || collected.answers.discord || null,
                device: collected.answers.device || null,
                map: collected.answers.map || null,
                notes: collected.answers.notes || null,
                answers: collected.answers
            };

            let failed = false;
            try {
                if (USE_WORKER) {
                    // Preferred path: submit through the Worker, which verifies the
                    // Turnstile token server-side and inserts with the service role.
                    const res = await fetch(WORKER_URL + '/api/register', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            ...payload,
                            website: (hp && hp.value) || '', // honeypot, re-checked server-side
                            turnstileToken: turnstileToken
                        })
                    });
                    if (!res.ok) {
                        let msg = 'Something went wrong. Please try again in a moment.';
                        try {
                            const data = await res.json();
                            if (res.status === 429) msg = 'Too many attempts. Please wait a bit and try again.';
                            else if (res.status === 403) msg = 'Verification failed. Please complete the challenge again.';
                            else if (data && data.error) msg = data.error;
                        } catch (e) {}
                        console.error('[registration] worker error:', res.status);
                        showMsg(msg, 'error');
                        failed = true;
                    }
                } else {
                    // Fallback path: direct, RLS-protected Supabase insert.
                    const { error } = await supabaseClient.from('registrations').insert(payload);
                    if (error) {
                        console.error('[registration] insert error:', error);
                        showMsg('Something went wrong. Please try again in a moment.', 'error');
                        failed = true;
                    }
                }
            } catch (err) {
                console.error('[registration] network error:', err);
                showMsg('Network error. Please check your connection and try again.', 'error');
                failed = true;
            }

            if (failed) {
                submit.disabled = false;
                submit.textContent = 'SUBMIT REGISTRATION';
                isSubmitting = false;
                if (USE_TURNSTILE && window.turnstile && turnstileWidgetId !== null) {
                    try { window.turnstile.reset(turnstileWidgetId); } catch (e) {}
                }
                return;
            }

            // Record successful submission time for THIS event so the cooldown kicks in
            setCooldown(eventKey());
            isSubmitting = false;

            showMsg('Registration successful! See you on the track. 🏁', 'success');
            submit.textContent = 'REGISTERED ✓';
            setTimeout(closeRegModal, 1900);
        });
    });
})();

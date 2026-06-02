// ============================================================
//  PYTHAS ADMIN — Event Registrations
//  Login via Supabase Auth. Data access protected by RLS:
//  only authenticated users can SELECT / DELETE.
// ============================================================
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    const loginView = $('loginView');
    const dashView = $('dashView');
    const loginForm = $('loginForm');
    const loginMsg = $('loginMsg');
    const loginBtn = $('loginBtn');
    const logoutBtn = $('logoutBtn');
    const userEmailEl = $('userEmail');

    const tableBody = $('regTableBody');
    const countEl = $('regCount');
    const eventFilter = $('eventFilter');
    const searchInput = $('searchInput');
    const refreshBtn = $('refreshBtn');
    const exportBtn = $('exportBtn');
    const importInput = $('importInput');
    const adminRoleEl = $('adminRole');
    const tabButtons = document.querySelectorAll('[data-tab]');
    const registrationsTab = $('registrationsTab');
    const eventsTab = $('eventsTab');
    const newEventBtn = $('newEventBtn');
    const refreshEventsBtn = $('refreshEventsBtn');
    const adminEventList = $('adminEventList');
    const eventForm = $('eventForm');
    const eventMsg = $('eventMsg');
    const saveEventBtn = $('saveEventBtn');
    const deleteEventBtn = $('deleteEventBtn');
    const usersTab = $('usersTab');
    const usersTabBtn = $('usersTabBtn');
    const rolesTableBody = $('rolesTableBody');
    const roleEmail = $('roleEmail');
    const roleSelect = $('roleSelect');
    const saveRoleBtn = $('saveRoleBtn');
    const refreshRolesBtn = $('refreshRolesBtn');
    const roleMsg = $('roleMsg');

    let allRows = [];
    let allEvents = [];
    let allRoles = [];
    let adminRole = 'staff';
    let canEditEvents = false;
    let canManageRoles = false;

    if (!supabaseClient) {
        document.body.innerHTML =
            '<div style="padding:48px;font-family:sans-serif;color:#fff">' +
            '<h2>Supabase not configured</h2>' +
            '<p>Check that <code>supabase-config.js</code> has the correct URL and key, ' +
            'and that the supabase-js script loaded.</p></div>';
        return;
    }

    // ---------- Auth ----------
    async function init() {
        const { data } = await supabaseClient.auth.getSession();
        if (data && data.session) {
            showDashboard(data.session);
        } else {
            showLogin();
        }
    }

    function showLogin() {
        loginView.classList.remove('hidden');
        dashView.classList.add('hidden');
    }

    async function showDashboard(session) {
        loginView.classList.add('hidden');
        dashView.classList.remove('hidden');
        if (userEmailEl && session && session.user) {
            userEmailEl.textContent = session.user.email || '';
        }
        await loadAdminRole();
        applyRolePermissions();
        await loadRows();
        await loadEvents();
        if (canManageRoles) await loadRoles();
    }

    async function loadAdminRole() {
        adminRole = 'staff';
        try {
            const { data, error } = await supabaseClient.rpc('admin_role');
            if (!error && data) adminRole = data;
        } catch (e) {}
        canEditEvents = adminRole === 'owner' || adminRole === 'admin';
        canManageRoles = adminRole === 'owner';
        if (adminRoleEl) adminRoleEl.textContent = adminRole;
    }

    function applyRolePermissions() {
        if (usersTabBtn) usersTabBtn.classList.toggle('hidden', !canManageRoles);
        [newEventBtn, saveEventBtn, deleteEventBtn, $('eventImageUpload')].forEach(el => {
            if (el) el.disabled = !canEditEvents;
        });
        [roleEmail, roleSelect, saveRoleBtn, refreshRolesBtn].forEach(el => {
            if (el) el.disabled = !canManageRoles;
        });
        if (eventForm) {
            eventForm.querySelectorAll('input, select, textarea').forEach(el => {
                if (el.id !== 'eventImageUpload') el.disabled = !canEditEvents;
            });
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginMsg.textContent = '';
        loginMsg.className = 'msg';
        loginBtn.disabled = true;
        loginBtn.textContent = 'LOGGING IN…';

        const email = $('email').value.trim();
        const password = $('password').value;

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        loginBtn.disabled = false;
        loginBtn.textContent = 'LOG IN';

        if (error) {
            loginMsg.textContent = 'Login failed: ' + error.message;
            loginMsg.className = 'msg error';
            return;
        }
        showDashboard(data.session);
    });

    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        $('password').value = '';
        showLogin();
    });

    // ---------- Data ----------
    async function loadRows() {
        tableBody.innerHTML = '<tr><td colspan="8" class="loading">Loading…</td></tr>';
        const { data, error } = await supabaseClient
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            tableBody.innerHTML =
                '<tr><td colspan="8" class="empty">Error loading data: ' + escapeHtml(error.message) + '</td></tr>';
            return;
        }
        allRows = data || [];
        populateEventFilter();
        renderRows();
    }

    function populateEventFilter() {
        const events = [...new Set(allRows.map(r => r.event_title).filter(Boolean))];
        const current = eventFilter.value;
        eventFilter.innerHTML =
            '<option value="">All events</option>' +
            events.map(ev => `<option value="${escapeAttr(ev)}">${escapeHtml(ev)}</option>`).join('');
        if (events.indexOf(current) !== -1) eventFilter.value = current;
    }

    function getFiltered() {
        const ev = eventFilter.value;
        const q = (searchInput.value || '').toLowerCase().trim();
        return allRows.filter(r => {
            if (ev && r.event_title !== ev) return false;
            if (q) {
                const hay = [r.roblox_username, r.discord_username, r.device, r.map, r.notes, r.event_title]
                    .join(' ').toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
    }

    function renderRows() {
        const rows = getFiltered();
        countEl.textContent = rows.length;
        if (rows.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="empty">No registrations yet.</td></tr>';
            return;
        }
        tableBody.innerHTML = rows.map(r => `
            <tr>
                <td class="nowrap">${escapeHtml(formatDate(r.created_at))}</td>
                <td>${escapeHtml(r.event_title || '')}</td>
                <td>${escapeHtml(r.roblox_username || '')}</td>
                <td>${escapeHtml(r.discord_username || '')}</td>
                <td>${escapeHtml(r.device || '')}</td>
                <td>${escapeHtml(r.map || '')}</td>
                <td>${escapeHtml(r.notes || '')}</td>
                <td><button class="btn btn-danger" data-id="${escapeAttr(r.id)}">Delete</button></td>
            </tr>
        `).join('');
        tableBody.querySelectorAll('.btn-danger').forEach(b => b.addEventListener('click', onDelete));
    }

    async function onDelete(e) {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Delete this registration permanently?')) return;
        const { error } = await supabaseClient.from('registrations').delete().eq('id', id);
        if (error) { alert('Delete failed: ' + error.message); return; }
        allRows = allRows.filter(r => String(r.id) !== String(id));
        renderRows();
    }

    eventFilter.addEventListener('change', renderRows);
    searchInput.addEventListener('input', renderRows);
    refreshBtn.addEventListener('click', loadRows);
    exportBtn.addEventListener('click', exportCsv);
    importInput.addEventListener('change', importCsv);
    if (refreshEventsBtn) refreshEventsBtn.addEventListener('click', loadEvents);
    if (newEventBtn) newEventBtn.addEventListener('click', () => fillEventForm(null));
    if (eventForm) eventForm.addEventListener('submit', saveEvent);
    if (deleteEventBtn) deleteEventBtn.addEventListener('click', deleteEvent);
    const imageUpload = $('eventImageUpload');
    if (imageUpload) imageUpload.addEventListener('change', uploadEventImage);
    tabButtons.forEach(btn => btn.addEventListener('click', () => setTab(btn.getAttribute('data-tab'))));
    if (saveRoleBtn) saveRoleBtn.addEventListener('click', saveRole);
    if (refreshRolesBtn) refreshRolesBtn.addEventListener('click', loadRoles);

    function setTab(tab) {
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tab));
        if (registrationsTab) registrationsTab.classList.toggle('hidden', tab !== 'registrations');
        if (eventsTab) eventsTab.classList.toggle('hidden', tab !== 'events');
        if (usersTab) usersTab.classList.toggle('hidden', tab !== 'users' || !canManageRoles);
        if (tab === 'users' && canManageRoles) loadRoles();
    }

    async function loadEvents() {
        if (!adminEventList) return;
        adminEventList.innerHTML = '<div class="hint">Loading events...</div>';
        const { data, error } = await supabaseClient
            .from('events')
            .select('*, event_registration_fields(*)')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            adminEventList.innerHTML = '<div class="hint">Error loading events: ' + escapeHtml(error.message) + '</div>';
            return;
        }
        allEvents = data || [];
        renderEventList();
        if (!($('eventId') && $('eventId').value) && allEvents[0]) fillEventForm(allEvents[0]);
        applyRolePermissions();
    }

    function renderEventList() {
        if (!adminEventList) return;
        if (!allEvents.length) {
            adminEventList.innerHTML = '<div class="hint">No events yet.</div>';
            return;
        }
        const selected = $('eventId') ? $('eventId').value : '';
        adminEventList.innerHTML = allEvents.map(ev => `
            <button type="button" data-event-id="${escapeAttr(ev.id)}" class="${String(ev.id) === selected ? 'active' : ''}">
                <strong>${escapeHtml(ev.title || 'Untitled')}</strong><br>
                <span class="hint">${escapeHtml(ev.status || '')} · ${escapeHtml(ev.game || '')}</span>
            </button>
        `).join('');
        adminEventList.querySelectorAll('[data-event-id]').forEach(btn => {
            btn.addEventListener('click', () => fillEventForm(allEvents.find(ev => String(ev.id) === btn.getAttribute('data-event-id'))));
        });
    }

    function fillEventForm(ev) {
        if (!eventForm) return;
        eventMsg.textContent = '';
        const fields = ev ? (ev.event_registration_fields || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : [];
        $('eventId').value = ev ? ev.id : '';
        $('eventTitle').value = ev ? (ev.title || '') : '';
        $('eventGame').value = ev ? (ev.game || 'Mount Agora') : 'Mount Agora';
        $('eventStatus').value = ev ? (ev.status || 'upcoming') : 'upcoming';
        $('eventDate').value = ev ? (ev.date || '') : '';
        $('eventStartDate').value = ev ? (ev.start_date || '') : '';
        $('eventEndDate').value = ev ? (ev.end_date || '') : '';
        $('eventTime').value = ev ? (ev.time || '') : '';
        $('eventTimezone').value = ev ? (ev.timezone || 'WIB') : 'WIB';
        $('eventType').value = ev ? (ev.type || '') : '';
        $('eventPrize').value = ev ? (ev.prize || '') : '';
        $('eventCaster').value = ev ? (ev.caster || '') : '';
        $('eventSortOrder').value = ev ? (ev.sort_order || 0) : 0;
        $('eventDescription').value = ev ? (ev.description || '') : '';
        $('eventBroadcastText').value = ev ? (ev.broadcast_text || '') : '';
        $('eventImage').value = ev ? (ev.image || '') : '';
        $('eventRegistrationLink').value = ev ? (ev.registration_link || '') : '';
        $('eventRules').value = ev && Array.isArray(ev.rules) ? ev.rules.join('\n') : '';
        $('eventSessions').value = ev ? JSON.stringify(ev.sessions || [], null, 2) : '[]';
        $('eventTags').value = ev && Array.isArray(ev.tags) ? ev.tags.join(', ') : '';
        $('eventFields').value = JSON.stringify(fields.map(f => ({
            key: f.field_key,
            label: f.label,
            type: f.type,
            required: f.required,
            options: f.options || [],
            placeholder: f.placeholder || '',
            helpText: f.help_text || ''
        })), null, 2);
        $('eventPublished').checked = ev ? !!ev.published : true;
        $('eventRegistrationEnabled').checked = ev ? !!ev.registration_enabled : true;
        renderEventList();
        applyRolePermissions();
    }

    function parseJsonField(id, fallback) {
        const raw = ($(id).value || '').trim();
        if (!raw) return fallback;
        return JSON.parse(raw);
    }

    function eventPayload() {
        return {
            title: $('eventTitle').value.trim(),
            game: $('eventGame').value.trim() || 'Mount Agora',
            status: $('eventStatus').value,
            date: $('eventDate').value || null,
            start_date: $('eventStartDate').value || null,
            end_date: $('eventEndDate').value || null,
            time: $('eventTime').value || null,
            timezone: $('eventTimezone').value.trim() || null,
            type: $('eventType').value.trim() || null,
            image: $('eventImage').value.trim() || null,
            description: $('eventDescription').value.trim() || null,
            broadcast_text: $('eventBroadcastText').value.trim() || null,
            rules: $('eventRules').value.split('\n').map(s => s.trim()).filter(Boolean),
            sessions: parseJsonField('eventSessions', []),
            prize: $('eventPrize').value.trim() || null,
            caster: $('eventCaster').value.trim() || null,
            registration_enabled: $('eventRegistrationEnabled').checked,
            registration_link: $('eventRegistrationLink').value.trim() || null,
            tags: $('eventTags').value.split(',').map(s => s.trim()).filter(Boolean),
            published: $('eventPublished').checked,
            sort_order: Number($('eventSortOrder').value || 0)
        };
    }

    function fieldPayload(eventId, field, index) {
        return {
            event_id: eventId,
            sort_order: index,
            field_key: field.key,
            label: field.label,
            type: field.type || 'text',
            required: !!field.required,
            options: Array.isArray(field.options) ? field.options : [],
            placeholder: field.placeholder || null,
            help_text: field.helpText || field.help_text || null
        };
    }

    async function saveEvent(e) {
        e.preventDefault();
        if (!canEditEvents) return;
        eventMsg.textContent = 'Saving...';
        eventMsg.className = 'msg';
        try {
            const payload = eventPayload();
            if (!payload.title) throw new Error('Title is required.');
            const regFields = parseJsonField('eventFields', []);
            if (!Array.isArray(regFields)) throw new Error('Registration Fields JSON must be an array.');
            const id = $('eventId').value;
            const result = id
                ? await supabaseClient.from('events').update(payload).eq('id', id).select('id').single()
                : await supabaseClient.from('events').insert(payload).select('id').single();
            if (result.error) throw result.error;
            const eventId = result.data.id;
            await supabaseClient.from('event_registration_fields').delete().eq('event_id', eventId);
            if (regFields.length) {
                const { error } = await supabaseClient
                    .from('event_registration_fields')
                    .insert(regFields.map((field, index) => fieldPayload(eventId, field, index)));
                if (error) throw error;
            }
            eventMsg.textContent = 'Saved.';
            eventMsg.className = 'msg success';
            await loadEvents();
            fillEventForm(allEvents.find(ev => String(ev.id) === String(eventId)));
        } catch (err) {
            eventMsg.textContent = 'Save failed: ' + (err.message || err);
            eventMsg.className = 'msg error';
        }
    }

    async function deleteEvent() {
        if (!canEditEvents) return;
        const id = $('eventId').value;
        if (!id || !confirm('Delete this event? Registrations stay stored, but event config will be removed.')) return;
        const { error } = await supabaseClient.from('events').delete().eq('id', id);
        if (error) { alert('Delete failed: ' + error.message); return; }
        fillEventForm(null);
        await loadEvents();
    }

    async function uploadEventImage(e) {
        if (!canEditEvents) return;
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        eventMsg.textContent = 'Uploading image...';
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabaseClient.storage.from('event-images').upload(name, file, { upsert: false });
        if (error) {
            eventMsg.textContent = 'Upload failed: ' + error.message;
            eventMsg.className = 'msg error';
            return;
        }
        const { data } = supabaseClient.storage.from('event-images').getPublicUrl(name);
        $('eventImage').value = data.publicUrl;
        eventMsg.textContent = 'Image uploaded.';
        eventMsg.className = 'msg success';
    }

    async function loadRoles() {
        if (!canManageRoles || !rolesTableBody) return;
        rolesTableBody.innerHTML = '<tr><td colspan="4" class="loading">Loading...</td></tr>';
        const { data, error } = await supabaseClient
            .from('admins')
            .select('email, role, added_at')
            .order('added_at', { ascending: false });
        if (error) {
            rolesTableBody.innerHTML = '<tr><td colspan="4" class="empty">Error loading roles: ' + escapeHtml(error.message) + '</td></tr>';
            return;
        }
        allRoles = data || [];
        renderRoles();
    }

    function renderRoles() {
        if (!rolesTableBody) return;
        if (!allRoles.length) {
            rolesTableBody.innerHTML = '<tr><td colspan="4" class="empty">No admin users yet.</td></tr>';
            return;
        }
        rolesTableBody.innerHTML = allRoles.map(row => `
            <tr>
                <td>${escapeHtml(row.email)}</td>
                <td><span class="count-pill">${escapeHtml(row.role || 'staff')}</span></td>
                <td>${escapeHtml(formatDate(row.added_at))}</td>
                <td>
                    <button class="btn btn-ghost" data-role-edit="${escapeAttr(row.email)}">Edit</button>
                    <button class="btn btn-danger" data-role-delete="${escapeAttr(row.email)}">Remove</button>
                </td>
            </tr>
        `).join('');
        rolesTableBody.querySelectorAll('[data-role-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const email = btn.getAttribute('data-role-edit');
                const row = allRoles.find(r => r.email === email);
                if (!row) return;
                roleEmail.value = row.email;
                roleSelect.value = row.role || 'staff';
                roleEmail.focus();
            });
        });
        rolesTableBody.querySelectorAll('[data-role-delete]').forEach(btn => {
            btn.addEventListener('click', () => deleteRole(btn.getAttribute('data-role-delete')));
        });
    }

    async function saveRole() {
        if (!canManageRoles) return;
        const email = (roleEmail.value || '').trim().toLowerCase();
        const role = roleSelect.value;
        roleMsg.textContent = '';
        roleMsg.className = 'msg';
        if (!email || !email.includes('@')) {
            roleMsg.textContent = 'Enter a valid email.';
            roleMsg.className = 'msg error';
            return;
        }
        const { error } = await supabaseClient
            .from('admins')
            .upsert({ email, role }, { onConflict: 'email' });
        if (error) {
            roleMsg.textContent = 'Save failed: ' + error.message;
            roleMsg.className = 'msg error';
            return;
        }
        roleMsg.textContent = 'Role saved.';
        roleMsg.className = 'msg success';
        roleEmail.value = '';
        roleSelect.value = 'staff';
        await loadRoles();
    }

    async function deleteRole(email) {
        if (!canManageRoles || !email) return;
        if (!confirm('Remove admin access for ' + email + '?')) return;
        const { error } = await supabaseClient.from('admins').delete().eq('email', email);
        if (error) {
            alert('Remove failed: ' + error.message);
            return;
        }
        await loadRoles();
    }

    // ---------- CSV export ----------
    function csvHeaders(rows) {
        const answerKeys = new Set();
        rows.forEach(r => {
            if (r.answers && typeof r.answers === 'object') {
                Object.keys(r.answers).forEach(k => answerKeys.add('answer_' + k));
            }
        });
        return ['created_at', 'event_title', 'event_id', 'roblox_username', 'discord_username', 'device', 'map', 'notes', ...answerKeys];
    }

    function exportCsv() {
        const rows = getFiltered();
        const headers = csvHeaders(rows);
        const lines = [headers.join(',')];
        rows.forEach(r => lines.push(headers.map(h => {
            if (h.startsWith('answer_')) {
                const key = h.slice(7);
                return csvCell(r.answers && r.answers[key]);
            }
            return csvCell(r[h]);
        }).join(',')));
        const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pythas-registrations-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function csvCell(val) {
        if (val == null) return '';
        const s = String(val);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    // ---------- CSV import ----------
    async function importCsv(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        let text = '';
        try { text = await file.text(); } catch (err) { alert('Could not read file.'); return; }

        const records = parseCsv(text);
        if (records.length === 0) { alert('CSV is empty or not recognized.'); importInput.value = ''; return; }
        if (!confirm('Import ' + records.length + ' row(s) into the database?')) { importInput.value = ''; return; }

        const toInsert = records.map(r => ({
            event_id: r.event_id || null,
            event_title: r.event_title || null,
            roblox_username: r.roblox_username || '',
            discord_username: r.discord_username || '',
            device: r.device || null,
            map: r.map || null,
            notes: r.notes || null
        })).filter(r => r.roblox_username || r.discord_username);

        if (toInsert.length === 0) { alert('No valid rows found (need roblox_username or discord_username).'); importInput.value = ''; return; }

        const { error } = await supabaseClient.from('registrations').insert(toInsert);
        importInput.value = '';
        if (error) { alert('Import failed: ' + error.message); return; }
        alert('Imported ' + toInsert.length + ' row(s).');
        loadRows();
    }

    // Minimal RFC-4180-ish CSV parser -> array of objects keyed by header
    function parseCsv(text) {
        text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const rows = [];
        let field = '', row = [], inQuotes = false, i = 0;
        while (i < text.length) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                    inQuotes = false; i++; continue;
                }
                field += c; i++; continue;
            }
            if (c === '"') { inQuotes = true; i++; continue; }
            if (c === ',') { row.push(field); field = ''; i++; continue; }
            if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
            field += c; i++;
        }
        if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
        if (rows.length < 2) return [];
        const headers = rows[0].map(h => h.trim());
        return rows.slice(1)
            .filter(r => r.some(c => c.trim() !== ''))
            .map(r => {
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = (r[idx] || '').trim(); });
                return obj;
            });
    }

    // ---------- helpers ----------
    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleString('en-GB', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
        }[c]));
    }
    function escapeAttr(s) { return escapeHtml(s); }

    init();
})();

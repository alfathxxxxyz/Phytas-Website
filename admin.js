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

    let allRows = [];

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
        await loadRows();
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

    // ---------- CSV export ----------
    const CSV_HEADERS = ['created_at', 'event_title', 'event_id', 'roblox_username', 'discord_username', 'device', 'map', 'notes'];

    function exportCsv() {
        const rows = getFiltered();
        const lines = [CSV_HEADERS.join(',')];
        rows.forEach(r => lines.push(CSV_HEADERS.map(h => csvCell(r[h])).join(',')));
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

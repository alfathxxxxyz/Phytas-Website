// ============================================================
//  PYTHAS Player Card — custom background card logic
//
//  All overlay coordinates are in the 720 x 900 design space.
//  Tweak positions/sizes/colors in the CONFIG block below — every
//  element reads from here, so adjusting layout is one place only.
// ============================================================

(function () {
  'use strict';

  // ---- Design canvas size (matches images/image 1.png) ----
  const CANVAS = { w: 720, h: 900 };

  // ---- Text elements ----
  // x,y in px (design space). align: left | center | right.
  // For align:center the x is the CENTER point. y is the TOP of the text.
  // font: 'oswald' (headings/stats) | 'inter' (body/small). Edit freely here.
  const TEXT = {
    // Header
    title:        { x: 318, y: 55,  size: 26, color: '#AAFF00', align: 'left',   font: 'oswald', weight: 700, text: 'PLAYER PROFILE' },
    displayName:  { x: 318, y: 103, size: 58, color: '#FFFFFF', align: 'left',   font: 'oswald', weight: 700 },
    username:     { x: 318, y: 185, size: 28, color: '#9FA3AA', align: 'left',   font: 'inter',  weight: 500 },
    robloxId:     { x: 340, y: 252, size: 16, color: '#C8C8C8', align: 'left',   font: 'inter',  weight: 400 },

    // Stat boxes (label + value)  [summit values bumped to 1.3x: 24 -> 31]
    lblAgoraSummit: { x: 145, y: 342, size: 17, color: '#FFFFFF', align: 'center', font: 'oswald', weight: 500, text: 'AGORA SUMMIT' },
    summitAgora:    { x: 145, y: 405, size: 31, color: '#AAFF00', align: 'center', font: 'oswald', weight: 700 },
    lblAztecSummit: { x: 375, y: 342, size: 17, color: '#FFFFFF', align: 'center', font: 'oswald', weight: 500, text: 'AZTEC SUMMIT' },
    summitAztec:    { x: 375, y: 405, size: 31, color: '#AAFF00', align: 'center', font: 'oswald', weight: 700 },
    lblScore:       { x: 585, y: 342, size: 17, color: '#FFFFFF', align: 'center', font: 'oswald', weight: 500, text: 'SCORE' },
    grade:          { x: 585, y: 380, size: 64, color: '#AAFF00', align: 'center', font: 'oswald', weight: 700 },

    // Best time section  [font: Ethnocentric; uniform label->value gap = 46px]
    btTitle:      { x: 72,  y: 527, size: 22, color: '#AAFF00', align: 'left', font: 'ethno', weight: 700, text: 'BEST TIME' },
    lblAgora:     { x: 72,  y: 570, size: 22, color: '#FFFFFF', align: 'left', font: 'ethno', weight: 500, text: 'AGORA' },
    timeAgora:    { x: 72,  y: 616, size: 25, color: '#AAFF00', align: 'left', font: 'ethno', weight: 700 },
    lblAztec:     { x: 312, y: 570, size: 22, color: '#FFFFFF', align: 'left', font: 'ethno', weight: 500, text: 'AZTEC' },
    timeAztec:    { x: 312, y: 616, size: 25, color: '#AAFF00', align: 'left', font: 'ethno', weight: 700 },
    lblPoseidon:  { x: 72,  y: 681, size: 22, color: '#FFFFFF', align: 'left', font: 'ethno', weight: 500, text: 'POSEIDON' },
    timePoseidon: { x: 72,  y: 727, size: 25, color: '#AAFF00', align: 'left', font: 'ethno', weight: 700 },
    lblOverall:   { x: 312, y: 681, size: 22, color: '#FFFFFF', align: 'left', font: 'ethno', weight: 500, text: 'OVERALL BEST' },
    timeOverall:  { x: 312, y: 727, size: 25, color: '#AAFF00', align: 'left', font: 'ethno', weight: 700 },

    // Footer  [reg ID: match top Roblox ID style (Inter 400), size 1.2x = 19]
    regId:        { x: 585, y: 842, size: 19, color: '#FFFFFF', align: 'center', font: 'inter', weight: 400 },
  };

  // ---- Avatar (circular mask matching the green ring in the background) ----
  const AVATAR = { x: 58, y: 58, w: 230, h: 230, imgScale: 1.0, objectPosition: 'center 45%' };

  // ---- Image elements (x,y = top-left; w,h = size) ----
  const IMAGES = {
    logo: { x: 75,  y: 828, w: 180, h: 48 },
    qr:   { x: 549, y: 656, w: 102, h: 102 },
  };

  // ---- DOM refs ----
  const searchSection = document.getElementById('searchSection');
  const resultSection = document.getElementById('resultSection');
  const searchForm = document.getElementById('searchForm');
  const playerInput = document.getElementById('playerInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchError = document.getElementById('searchError');
  const cardStage = document.getElementById('cardStage');
  const pcard = document.getElementById('pcard');
  const btnSave = document.getElementById('btnSave');
  const btnShare = document.getElementById('btnShare');
  const btnNew = document.getElementById('btnNew');

  let currentProfile = null;
  const els = {}; // created overlay elements by key

  // ---- Init ----
  function init() {
    buildOverlay();
    searchForm.addEventListener('submit', handleSearch);
    btnSave.addEventListener('click', handleSave);
    btnShare.addEventListener('click', handleShare);
    btnNew.addEventListener('click', handleNewSearch);
    window.addEventListener('resize', applyScale);

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || params.get('userId');
    const username = params.get('username') || params.get('user');
    if (id || username) {
      playerInput.value = id || username;
      searchForm.dispatchEvent(new Event('submit'));
    }
  }

  // ---- Build overlay elements from CONFIG ----
  function buildOverlay() {
    // Text
    Object.entries(TEXT).forEach(([key, cfg]) => {
      const el = document.createElement('div');
      el.className = 'el';
      el.style.fontSize = cfg.size + 'px';
      el.style.color = cfg.color;
      el.style.fontWeight = cfg.weight || 600;
      el.style.fontFamily = fontFamily(cfg.font);
      el.style.top = cfg.y + 'px';
      if (cfg.align === 'center') {
        el.style.left = cfg.x + 'px';
        el.style.transform = 'translateX(-50%)';
        el.style.textAlign = 'center';
      } else if (cfg.align === 'right') {
        el.style.left = cfg.x + 'px';
        el.style.transform = 'translateX(-100%)';
        el.style.textAlign = 'right';
      } else {
        el.style.left = cfg.x + 'px';
      }
      if (cfg.text != null) el.textContent = cfg.text;
      pcard.appendChild(el);
      els[key] = el;
    });

    // Avatar — circular mask matching the green ring in the background.
    // The ring itself is part of the background; the avatar just sits inside it.
    const mask = document.createElement('div');
    mask.style.position = 'absolute';
    mask.style.left = AVATAR.x + 'px';
    mask.style.top = AVATAR.y + 'px';
    mask.style.width = AVATAR.w + 'px';
    mask.style.height = AVATAR.h + 'px';
    mask.style.borderRadius = '50%';
    mask.style.overflow = 'hidden';
    mask.style.zIndex = '2';

    const avatar = document.createElement('img');
    avatar.id = 'cardAvatar';
    avatar.crossOrigin = 'anonymous';
    avatar.style.width = '100%';
    avatar.style.height = '100%';
    avatar.style.objectFit = 'cover';
    avatar.style.objectPosition = AVATAR.objectPosition || 'center';
    if (AVATAR.imgScale && AVATAR.imgScale !== 1) {
      avatar.style.transform = 'scale(' + AVATAR.imgScale + ')';
    }
    mask.appendChild(avatar);
    pcard.appendChild(mask);
    els.avatar = avatar;

    // Logo
    const logo = document.createElement('img');
    logo.className = 'el-img';
    logo.src = 'images/Pythas-Logo.png';
    logo.crossOrigin = 'anonymous';
    logo.style.objectFit = 'contain';
    logo.style.zIndex = '3';
    setBox(logo, IMAGES.logo);
    pcard.appendChild(logo);
    els.logo = logo;

    // QR canvas
    const qr = document.createElement('canvas');
    qr.className = 'el-img';
    qr.id = 'cardQr';
    qr.width = IMAGES.qr.w;
    qr.height = IMAGES.qr.h;
    qr.style.zIndex = '3';
    setBox(qr, IMAGES.qr);
    pcard.appendChild(qr);
    els.qr = qr;
  }

  function setBox(el, box) {
    el.style.left = box.x + 'px';
    el.style.top = box.y + 'px';
    el.style.width = box.w + 'px';
    el.style.height = box.h + 'px';
  }

  // ---- Search ----
  async function handleSearch(e) {
    e.preventDefault();
    const value = playerInput.value.trim();
    if (!value) return;

    showLoading(true);
    hideError();

    try {
      const isNumeric = /^\d+$/.test(value);
      const q = isNumeric ? `userId=${value}` : `username=${encodeURIComponent(value)}`;
      const res = await fetch(`/api/roblox-profile?${q}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to fetch profile');

      currentProfile = data;
      renderCard(data);
      showCard();
      updateURL(data.user.id);
    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      showLoading(false);
    }
  }

  // ---- Render ----
  function renderCard(profile) {
    const { user, avatar, phytas, cardReg } = profile;

    els.displayName.textContent = user.displayName || user.name;
    els.username.textContent = '@' + user.name;
    els.robloxId.textContent = String(user.id);
    els.regId.textContent = cardReg && cardReg.formatted ? cardReg.formatted : '—';

    // Grade
    els.grade.textContent = (phytas && phytas.grade) ? phytas.grade : '–';

    // Summit
    els.summitAgora.textContent = summitVal(phytas && phytas.agora && phytas.agora.summit);
    els.summitAztec.textContent = summitVal(phytas && phytas.aztec && phytas.aztec.summit);

    // Best times
    els.timeAgora.textContent    = timeVal(phytas && phytas.agora && phytas.agora.speedrun);
    els.timeAztec.textContent    = timeVal(phytas && phytas.aztec && phytas.aztec.speedrun);
    els.timePoseidon.textContent = timeVal(phytas && phytas.poseidon && phytas.poseidon.speedrun);
    els.timeOverall.textContent  = phytas && phytas.overallBest ? fmtTime(phytas.overallBest) : '--';

    // Avatar
    els.avatar.src = avatar.headshot || avatar.bust || avatar.fullBody || '';

    // QR -> directs to this card page
    generateQR(user.id);

    applyScale();
  }

  function summitVal(s) {
    if (!s || !s.score) return '--';
    return formatNumber(s.score);
  }
  function timeVal(s) {
    if (!s || !s.time_ms) return '--';
    return fmtTime(s.time_ms);
  }

  // ---- QR ----
  function generateQR(userId) {
    const url = `${window.location.origin}/card.html?id=${userId}`;
    const canvas = els.qr;
    if (typeof qrcode === 'undefined') { canvas.style.display = 'none'; return; }

    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();

    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const count = qr.getModuleCount();
    const cell = size / count;

    // White background for reliable scanning, dark modules.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, canvas.height);
    ctx.fillStyle = '#0a0c10';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
      }
    }
  }

  // ---- Save as PNG ----
  async function handleSave() {
    btnSave.disabled = true;
    const prevTransform = pcard.style.transform;
    try {
      pcard.style.transform = 'none'; // capture at full 720x900
      const canvas = await html2canvas(pcard, {
        backgroundColor: null, scale: 2, useCORS: true, allowTaint: false, logging: false,
        width: CANVAS.w, height: CANVAS.h,
      });
      const link = document.createElement('a');
      const name = currentProfile ? currentProfile.user.name : 'card';
      link.download = `pythas-card-${name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Failed to save image. Try again.');
    } finally {
      pcard.style.transform = prevTransform;
      applyScale();
      btnSave.disabled = false;
    }
  }

  // ---- Share ----
  function handleShare() {
    if (!currentProfile) return;
    const url = `${window.location.origin}/card.html?id=${currentProfile.user.id}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied to clipboard!'))
      .catch(() => prompt('Copy this link:', url));
  }

  function handleNewSearch() {
    resultSection.hidden = true;
    searchSection.style.display = '';
    playerInput.value = '';
    playerInput.focus();
    currentProfile = null;
    history.replaceState(null, '', window.location.pathname);
  }

  // ---- Responsive scale ----
  function applyScale() {
    const avail = cardStage.clientWidth;
    const scale = Math.min(1, avail / CANVAS.w);
    pcard.style.transform = `scale(${scale})`;
    cardStage.style.height = (CANVAS.h * scale) + 'px';
  }

  // ---- UI helpers ----
  function showCard() {
    searchSection.style.display = 'none';
    resultSection.hidden = false;
    applyScale();
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function showLoading(show) {
    searchBtn.querySelector('.btn-text').hidden = show;
    searchBtn.querySelector('.btn-loading').hidden = !show;
    searchBtn.disabled = show;
    playerInput.disabled = show;
  }
  function showError(msg) { searchError.textContent = msg; searchError.hidden = false; }
  function hideError() { searchError.hidden = true; }
  function updateURL(userId) {
    const url = new URL(window.location);
    url.searchParams.set('id', userId);
    history.replaceState(null, '', url.toString());
  }
  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 300); }, 2500);
  }

  // ---- Formatting ----
  function formatNumber(num) { return Number(num).toLocaleString('en-US'); }

  // Map a font key to a CSS font-family stack.
  function fontFamily(key) {
    if (key === 'inter') return "'Inter', sans-serif";
    if (key === 'ethno') return "'Ethnocentric', 'Orbitron', 'Oswald', sans-serif";
    return "'Oswald', sans-serif";
  }

  // mm:ss.cc (centiseconds)
  function fmtTime(ms) {
    if (!ms || ms <= 0) return '--';
    const totalCs = Math.round(ms / 10);
    const cs = totalCs % 100;
    const totalS = Math.floor(totalCs / 100);
    const s = totalS % 60;
    const m = Math.floor(totalS / 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  init();
})();

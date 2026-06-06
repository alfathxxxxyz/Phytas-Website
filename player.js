// ============================================================
//  PYTHAS Player Card — Frontend Logic
// ============================================================

(function () {
  'use strict';

  // ---- DOM references ----
  const searchSection = document.getElementById('searchSection');
  const cardSection = document.getElementById('cardSection');
  const searchForm = document.getElementById('searchForm');
  const playerInput = document.getElementById('playerInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchError = document.getElementById('searchError');
  const playerCard = document.getElementById('playerCard');

  // Card elements
  const cardAvatar = document.getElementById('cardAvatar');
  const cardDisplayName = document.getElementById('cardDisplayName');
  const cardUsername = document.getElementById('cardUsername');
  const cardAgeBadge = document.getElementById('cardAgeBadge');
  const cardAgeText = document.getElementById('cardAgeText');
  const ageDays = document.getElementById('ageDays');
  const ageSince = document.getElementById('ageSince');
  const cardFriends = document.getElementById('cardFriends');
  const cardFollowers = document.getElementById('cardFollowers');
  const cardFollowing = document.getElementById('cardFollowing');
  const cardBadges = document.getElementById('cardBadges');
  const cardBio = document.getElementById('cardBio');
  const cardBioText = document.getElementById('cardBioText');
  const cardPhytas = document.getElementById('cardPhytas');
  const phytasStatsGrid = document.getElementById('phytasStatsGrid');
  const cardPhytasCta = document.getElementById('cardPhytasCta');
  const cardGroups = document.getElementById('cardGroups');
  const groupsList = document.getElementById('groupsList');
  const qrCanvas = document.getElementById('qrCanvas');
  const cardDate = document.getElementById('cardDate');

  // Actions
  const btnSave = document.getElementById('btnSave');
  const btnCopy = document.getElementById('btnCopy');
  const btnShare = document.getElementById('btnShare');
  const btnNew = document.getElementById('btnNew');
  const themeSelector = document.getElementById('themeSelector');

  // State
  let currentProfile = null;

  // ---- Init ----
  function init() {
    searchForm.addEventListener('submit', handleSearch);
    btnSave.addEventListener('click', handleSave);
    btnCopy.addEventListener('click', handleCopy);
    btnShare.addEventListener('click', handleShare);
    btnNew.addEventListener('click', handleNewSearch);
    themeSelector.addEventListener('click', handleThemeClick);

    // Check URL for pre-filled user
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('id') || params.get('userId');
    const username = params.get('username') || params.get('user');
    if (userId || username) {
      playerInput.value = userId || username;
      searchForm.dispatchEvent(new Event('submit'));
    }
  }

  // ---- Search Handler ----
  async function handleSearch(e) {
    e.preventDefault();
    const value = playerInput.value.trim();
    if (!value) return;

    showLoading(true);
    hideError();

    try {
      const isNumeric = /^\d+$/.test(value);
      const queryParam = isNumeric ? `userId=${value}` : `username=${encodeURIComponent(value)}`;
      const res = await fetch(`/api/roblox-profile?${queryParam}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch profile');
      }

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

  // ---- Render Card ----
  function renderCard(profile) {
    const { user, accountAge, avatar, social, groups, phytas, badges } = profile;

    // Avatar
    cardAvatar.src = avatar.headshot || avatar.bust || avatar.fullBody || '';
    cardAvatar.alt = `${user.displayName} avatar`;

    // Identity
    cardDisplayName.textContent = user.displayName;
    cardUsername.textContent = `@${user.name}`;

    // Account Age Badge
    cardAgeText.textContent = `${accountAge.tier} \u2022 ${accountAge.years}${accountAge.years === 1 ? ' year' : ' years'}`;

    // Age Calculator
    ageDays.textContent = formatNumber(accountAge.days);
    const created = new Date(accountAge.createdDate);
    ageSince.textContent = `Since ${created.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    // Social Stats
    cardFriends.textContent = formatCompact(social.friends);
    cardFollowers.textContent = formatCompact(social.followers);
    cardFollowing.textContent = formatCompact(social.following);

    // Badges
    renderBadges(badges);

    // Bio
    if (user.description && user.description.trim()) {
      cardBioText.textContent = user.description.slice(0, 150) + (user.description.length > 150 ? '...' : '');
      cardBio.hidden = false;
    } else {
      cardBio.hidden = true;
    }

    // Phytas Stats
    if (phytas && phytas.hasData) {
      renderPhytasStats(phytas);
      cardPhytas.hidden = false;
      cardPhytasCta.hidden = true;
    } else {
      cardPhytas.hidden = true;
      cardPhytasCta.hidden = false;
    }

    // Groups
    if (groups && groups.length > 0) {
      renderGroups(groups);
      cardGroups.hidden = false;
    } else {
      cardGroups.hidden = true;
    }

    // QR Code
    generateQR(user.id);

    // Footer date
    cardDate.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ---- Render Badges ----
  function renderBadges(badges) {
    cardBadges.innerHTML = '';
    badges.forEach(badge => {
      const el = document.createElement('div');
      el.className = 'badge-item';
      el.title = badge.description;
      el.innerHTML = `<span class="badge-icon">${badge.icon}</span><span class="badge-label">${badge.label}</span>`;
      cardBadges.appendChild(el);
    });
  }

  // ---- Render Phytas Stats ----
  function renderPhytasStats(phytas) {
    phytasStatsGrid.innerHTML = '';

    const stats = [];

    if (phytas.aztec) {
      if (phytas.aztec.summit) {
        stats.push({ label: 'Summit (Aztec)', value: formatNumber(phytas.aztec.summit.score), sub: `Rank #${phytas.aztec.summit.rank}` });
      }
      if (phytas.aztec.speedrun) {
        stats.push({ label: 'Speedrun (Aztec)', value: formatTime(phytas.aztec.speedrun.time_ms), sub: `Rank #${phytas.aztec.speedrun.rank}` });
      }
      if (phytas.aztec.playtime_seconds > 0) {
        stats.push({ label: 'Playtime (Aztec)', value: formatPlaytime(phytas.aztec.playtime_seconds), sub: 'Total time played' });
      }
    }

    if (phytas.agora) {
      if (phytas.agora.summit) {
        stats.push({ label: 'Summit (Agora)', value: formatNumber(phytas.agora.summit.score), sub: `Rank #${phytas.agora.summit.rank}` });
      }
      if (phytas.agora.speedrun) {
        stats.push({ label: 'Speedrun (Agora)', value: formatTime(phytas.agora.speedrun.time_ms), sub: `Rank #${phytas.agora.speedrun.rank}` });
      }
      if (phytas.agora.playtime_seconds > 0) {
        stats.push({ label: 'Playtime (Agora)', value: formatPlaytime(phytas.agora.playtime_seconds), sub: 'Total time played' });
      }
    }

    stats.forEach(stat => {
      const el = document.createElement('div');
      el.className = 'phytas-stat';
      el.innerHTML = `
        <div class="phytas-stat-value">${stat.value}</div>
        <div class="phytas-stat-label">${stat.label}</div>
        <div class="phytas-stat-sub">${stat.sub}</div>
      `;
      phytasStatsGrid.appendChild(el);
    });
  }

  // ---- Render Groups ----
  function renderGroups(groups) {
    groupsList.innerHTML = '';
    groups.forEach(group => {
      const el = document.createElement('div');
      el.className = 'group-item';
      el.innerHTML = `<span class="group-name">${escapeHtml(group.name)}</span><span class="group-role">${escapeHtml(group.role || 'Member')}</span>`;
      groupsList.appendChild(el);
    });
  }

  // ---- QR Code Generation ----
  function generateQR(userId) {
    const url = `https://www.roblox.com/users/${userId}/profile`;

    if (typeof qrcode === 'undefined') {
      // Library not loaded, skip
      qrCanvas.style.display = 'none';
      return;
    }

    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();

    const ctx = qrCanvas.getContext('2d');
    const size = qrCanvas.width;
    const cellSize = size / qr.getModuleCount();

    ctx.clearRect(0, 0, size, size);

    // Get computed theme colors for QR
    const cardEl = document.getElementById('playerCard');
    const styles = getComputedStyle(cardEl);
    const fg = styles.getPropertyValue('--qr-fg').trim() || '#ffffff';
    const bg = styles.getPropertyValue('--qr-bg').trim() || 'transparent';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = fg;
    for (let row = 0; row < qr.getModuleCount(); row++) {
      for (let col = 0; col < qr.getModuleCount(); col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }
  }

  // ---- Theme Handling ----
  function handleThemeClick(e) {
    const btn = e.target.closest('.theme-btn');
    if (!btn) return;

    const theme = btn.dataset.theme;
    playerCard.setAttribute('data-theme', theme);

    // Update active state
    themeSelector.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Re-generate QR with new theme colors
    if (currentProfile) {
      setTimeout(() => generateQR(currentProfile.user.id), 50);
    }
  }

  // ---- Save as PNG ----
  async function handleSave() {
    btnSave.disabled = true;
    try {
      const canvas = await html2canvas(playerCard, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `pythas-card-${currentProfile.user.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save image. Please try again.');
    } finally {
      btnSave.disabled = false;
    }
  }

  // ---- Copy Image to Clipboard ----
  async function handleCopy() {
    btnCopy.disabled = true;
    try {
      const canvas = await html2canvas(playerCard, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('Image copied to clipboard!');
        } catch {
          // Fallback: download
          showToast('Clipboard not supported, downloading instead...');
          handleSave();
        }
      }, 'image/png');
    } catch (err) {
      console.error('Copy failed:', err);
      showToast('Failed to copy. Try saving instead.');
    } finally {
      btnCopy.disabled = false;
    }
  }

  // ---- Share Link ----
  function handleShare() {
    if (!currentProfile) return;
    const url = `${window.location.origin}/player.html?id=${currentProfile.user.id}`;

    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
    }).catch(() => {
      // Fallback
      prompt('Copy this link:', url);
    });
  }

  // ---- New Search ----
  function handleNewSearch() {
    cardSection.hidden = true;
    searchSection.style.display = '';
    playerInput.value = '';
    playerInput.focus();
    currentProfile = null;
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
  }

  // ---- UI Helpers ----
  function showCard() {
    searchSection.style.display = 'none';
    cardSection.hidden = false;
    cardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showLoading(show) {
    const btnText = searchBtn.querySelector('.btn-text');
    const btnLoading = searchBtn.querySelector('.btn-loading');
    btnText.hidden = show;
    btnLoading.hidden = !show;
    searchBtn.disabled = show;
    playerInput.disabled = show;
  }

  function showError(msg) {
    searchError.textContent = msg;
    searchError.hidden = false;
  }

  function hideError() {
    searchError.hidden = true;
  }

  function updateURL(userId) {
    const url = new URL(window.location);
    url.searchParams.set('id', userId);
    history.replaceState(null, '', url.toString());
  }

  function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ---- Formatting Utilities ----
  function formatNumber(num) {
    return Number(num).toLocaleString('en-US');
  }

  function formatCompact(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(num);
  }

  function formatTime(ms) {
    if (!ms) return '--';
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);
    return `${String(minutes).padStart(2, '0')}:${seconds.padStart(5, '0')}`;
  }

  function formatPlaytime(seconds) {
    if (!seconds || seconds <= 0) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Start ----
  init();
})();

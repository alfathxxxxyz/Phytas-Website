/* ========================================
   PYTHAS COLLECTIVE - TAB-BASED NAVIGATION
   ======================================== */


// ========== ROBLOX LIVE DATA CONFIG ==========
// Map of member display name -> Roblox User ID
// Avatars auto-update when members change them on Roblox.
const ROBLOX_USERS = {
    'MaschPyth':  9096966065,
    'AerionPyth': 9288648967,
    'C1eelPyth':  9572496148,
    'AveyyPyth':  9155450474,
    'VinnyPyth':  9124999411,
    'AsbiiPyth':  8877318735,
    'DellPyth':   8902740169
};

// Map of game name (matches H3 in .game-card) -> Roblox Place ID
const ROBLOX_GAMES = {
    'MOUNT AGORA': 124216358732636,
    'MOUNT AZTEC': 79000051805057
};

// Fetch Roblox avatar headshots in one batch from the official thumbnails API.
// API supports CORS; returns JSON with imageUrl pointing to tr.rbxcdn.com.
async function loadRobloxAvatars() {
    const userIds = Object.values(ROBLOX_USERS);
    if (userIds.length === 0) return;
    try {
        const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds.join(',')}&size=420x420&format=Png&isCircular=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Roblox thumbnails API ' + res.status);
        const json = await res.json();
        const byId = {};
        (json.data || []).forEach(item => {
            if (item.state === 'Completed' && item.imageUrl) {
                byId[item.targetId] = item.imageUrl;
            }
        });
        document.querySelectorAll('.member-card').forEach(card => {
            const nameEl = card.querySelector('.member-info h4');
            const avatarDiv = card.querySelector('.member-avatar');
            if (!nameEl || !avatarDiv) return;
            const name = nameEl.textContent.trim();
            const userId = ROBLOX_USERS[name];
            const imgUrl = userId && byId[userId];
            if (!imgUrl) return;
            avatarDiv.style.backgroundImage = `url("${imgUrl}")`;
            avatarDiv.style.backgroundSize = 'cover';
            avatarDiv.style.backgroundPosition = 'center';
            avatarDiv.setAttribute('role', 'img');
            avatarDiv.setAttribute('aria-label', `${name} Roblox avatar`);
            avatarDiv.setAttribute('data-roblox-id', String(userId));
        });
    } catch (err) {
        console.warn('[Roblox avatars] failed to load:', err);
    }
}

// Fetch Roblox game icons by placeId from official thumbnails API.
async function loadRobloxGameIcons() {
    const placeIds = Object.values(ROBLOX_GAMES);
    if (placeIds.length === 0) return;
    try {
        const url = `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeIds.join(',')}&size=512x512&format=Png&isCircular=false&returnPolicy=PlaceHolder`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Roblox game icons API ' + res.status);
        const json = await res.json();
        const byPlaceId = {};
        (json.data || []).forEach(item => {
            if (item.state === 'Completed' && item.imageUrl) {
                byPlaceId[item.targetId] = item.imageUrl;
            }
        });
        document.querySelectorAll('.game-card').forEach(card => {
            const titleEl = card.querySelector('.game-info h3');
            const thumbEl = card.querySelector('.game-thumbnail');
            const placeholderEl = card.querySelector('.game-thumb-placeholder');
            if (!titleEl || !thumbEl) return;
            const title = titleEl.textContent.trim().toUpperCase();
            const placeId = ROBLOX_GAMES[title];
            const imgUrl = placeId && byPlaceId[placeId];
            if (!imgUrl) return;
            thumbEl.style.backgroundImage = `url("${imgUrl}")`;
            thumbEl.style.backgroundSize = 'cover';
            thumbEl.style.backgroundPosition = 'center';
            // Hide the emoji placeholder once the real icon is loaded
            if (placeholderEl) placeholderEl.style.display = 'none';
            thumbEl.setAttribute('data-place-id', String(placeId));
        });
    } catch (err) {
        console.warn('[Roblox game icons] failed to load:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadRobloxAvatars();
    loadRobloxGameIcons();
});



// ========== TAB-BASED SECTION SWITCHING ==========
const sections = document.querySelectorAll('.section-page');
const navItems = document.querySelectorAll('.nav-links a');
const navbar = document.getElementById('navbar');
let currentSection = document.querySelector('.section-page.section-active');
let isTransitioning = false;

// Map of nav href to section IDs (handle "contact" which is footer, not a section-page)
function showSection(targetId, skipAnimation) {
    if (isTransitioning) return;

    // "contact" target means scroll to footer (it's always visible)
    if (targetId === 'contact') {
        // Hide all sections content, show a minimal state or just scroll to footer
        // Actually for contact, we'll hide all section-pages and let footer show
        if (currentSection) {
            isTransitioning = true;
            currentSection.classList.add('section-fade-out');
            currentSection.classList.remove('section-active');
            setTimeout(() => {
                currentSection.classList.remove('section-fade-out');
                currentSection.style.display = 'none';
                currentSection = null;
                isTransitioning = false;
                window.scrollTo({ top: 0, behavior: 'instant' });
            }, skipAnimation ? 0 : 300);
        }
        updateActiveNav(targetId);
        return;
    }

    const targetSection = document.getElementById(targetId);
    if (!targetSection || targetSection === currentSection) return;

    isTransitioning = true;

    // Fade out current section
    if (currentSection) {
        currentSection.classList.add('section-fade-out');
        currentSection.classList.remove('section-active');

        setTimeout(() => {
            currentSection.classList.remove('section-fade-out');
            currentSection.style.display = 'none';

            // Fade in new section
            targetSection.style.display = 'block';
            // Force reflow
            void targetSection.offsetHeight;
            targetSection.classList.add('section-active');
            currentSection = targetSection;
            isTransitioning = false;

            // Trigger counter animations if stats section
            if (targetId === 'stats') {
                triggerCounterAnimations();
            }

            // Trigger fade-in animations for elements in the new section
            triggerFadeInAnimations(targetSection);

            // Scroll to top of page
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, skipAnimation ? 0 : 300);
    } else {
        // No current section (e.g., coming from contact view)
        targetSection.style.display = 'block';
        void targetSection.offsetHeight;
        targetSection.classList.add('section-active');
        currentSection = targetSection;
        isTransitioning = false;

        if (targetId === 'stats') {
            triggerCounterAnimations();
        }
        triggerFadeInAnimations(targetSection);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    updateActiveNav(targetId);
}

function updateActiveNav(targetId) {
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === targetId) {
            item.classList.add('active');
        }
    });
}

// Nav link click handler
navItems.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-section');
        if (targetId) {
            showSection(targetId);
            history.pushState({ section: targetId }, '', '#' + targetId);
        }
    });
    // Keyboard support: Enter/Space triggers section switch
    link.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const targetId = link.getAttribute('data-section');
            if (targetId) {
                showSection(targetId);
                history.pushState({ section: targetId }, '', '#' + targetId);
            }
        }
    });
});

// Handle browser back/forward navigation
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.section) {
        showSection(e.state.section, false);
    } else {
        const hash = window.location.hash.substring(1);
        showSection(hash || 'hero', false);
    }
});

// Also handle hero buttons that link to sections
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href !== '#' && !this.hasAttribute('data-section')) {
            // Don't switch section if the link is inside event modal or event cards
            if (this.closest('.event-modal') || this.closest('[data-event-id]')) return;
            e.preventDefault();
            const targetId = href.substring(1);
            showSection(targetId);
        }
    });
});

// Footer nav links
document.querySelectorAll('.footer-col a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        if (href && href !== '#') {
            const targetId = href.substring(1);
            showSection(targetId);
        }
    });
});

// Initialize: show hero section by default on page load, or hash section
document.addEventListener('DOMContentLoaded', () => {
    sections.forEach(section => {
        if (!section.classList.contains('section-active')) {
            section.style.display = 'none';
        }
    });

    // Load section from URL hash if present
    const hash = window.location.hash.substring(1);
    if (hash && hash !== 'hero') {
        showSection(hash, true);
    }
    // Replace initial state so popstate works correctly
    history.replaceState({ section: hash || 'hero' }, '', window.location.href);
});


// ========== MOBILE HAMBURGER TOGGLE ==========
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
    hamburger.classList.toggle('active');
    const isOpen = navLinks.classList.contains('mobile-open');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});

// Close mobile nav on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        hamburger.classList.remove('active');
    });
});


// ========== ANIMATED COUNTER FOR STATS ==========
const statNumbers = document.querySelectorAll('.stat-number');
let countersAnimated = false;

function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'));
    const duration = 2000;
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(target * eased).toLocaleString();
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = target.toLocaleString();
        }
    }
    requestAnimationFrame(update);
}

function triggerCounterAnimations() {
    if (!countersAnimated) {
        statNumbers.forEach(el => animateCounter(el));
        countersAnimated = true;
    }
}


// ========== FADE-IN ANIMATIONS FOR SECTION CONTENT ==========
function triggerFadeInAnimations(section) {
    const fadeElements = section.querySelectorAll('.fade-in:not(.visible)');
    fadeElements.forEach((el, index) => {
        setTimeout(() => {
            el.classList.add('visible');
        }, index * 80);
    });
}

// Apply fade-in class to elements
document.querySelectorAll('.section-header, .stat-card, .announcement-card, .game-card, .event-featured, .event-card, .hof-card, .member-card, .spotlight-card, .masonry-item, .product-card, .partner-card').forEach(el => {
    el.classList.add('fade-in');
});

// Trigger fade-in for the initial active section (hero)
setTimeout(() => {
    const heroSection = document.getElementById('hero');
    if (heroSection) {
        triggerFadeInAnimations(heroSection);
    }
}, 100);


// ========== STAGGERED ANIMATION DELAYS ==========
document.querySelectorAll('.stats-grid .stat-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.1}s`;
});

document.querySelectorAll('.hof-grid .hof-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.1}s`;
});

document.querySelectorAll('.masonry-grid .masonry-item').forEach((item, i) => {
    item.style.transitionDelay = `${i * 0.05}s`;
});


// ========== TILT EFFECT ON CARDS ==========
document.querySelectorAll('.game-card, .hof-card, .product-card, .stat-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});


// ========== MAGNETIC EFFECT ON BUTTONS ==========
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px) translateY(-2px)`;
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
    });
});


// ========== TEXT SCRAMBLE EFFECT ==========
class TextScramble {
    constructor(el) {
        this.el = el;
        this.chars = '!<>-_\\/[]{}#$%^&*+=~';
        this.originalText = el.textContent;
    }
    scramble() {
        const length = this.originalText.length;
        let iterations = 0;
        const interval = setInterval(() => {
            this.el.textContent = this.originalText.split('').map((char, idx) => {
                if (idx < iterations) return this.originalText[idx];
                return this.chars[Math.floor(Math.random() * this.chars.length)];
            }).join('');
            iterations += 1;
            if (iterations > length) {
                clearInterval(interval);
                this.el.textContent = this.originalText;
            }
        }, 30);
    }
}

document.querySelectorAll('.hof-card h4, .member-info h4, .spotlight-card h5').forEach(el => {
    const scrambler = new TextScramble(el);
    el.parentElement.closest('[class*="card"]')?.addEventListener('mouseenter', () => {
        scrambler.scramble();
    });
});


// ========== RIPPLE EFFECT ON BUTTONS ==========
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255,255,255,0.4);
            width: 100px;
            height: 100px;
            left: ${e.clientX - rect.left - 50}px;
            top: ${e.clientY - rect.top - 50}px;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
});

// Add ripple keyframe
const style = document.createElement('style');
style.textContent = `@keyframes ripple { to { transform: scale(4); opacity: 0; } }`;
document.head.appendChild(style);


// ========== TYPING EFFECT FOR HERO TAGLINE ==========
const tagline = document.querySelector('.hero-tagline');
if (tagline) {
    const text = tagline.textContent;
    tagline.textContent = '';
    tagline.style.borderRight = '2px solid #AAFF00';
    let i = 0;
    function typeWriter() {
        if (i < text.length) {
            tagline.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 40);
        } else {
            setTimeout(() => { tagline.style.borderRight = 'none'; }, 1500);
        }
    }
    setTimeout(typeWriter, 800);
}



// 3D Model is now handled by hero3d.js (Three.js)




// ========== THEME TOGGLE (DARK / LIGHT MODE) ==========
(function setupThemeToggle() {
    const STORAGE_KEY = 'pythas-theme';
    const root = document.documentElement;

    // Apply saved theme on load (run before DOMContentLoaded for no FOUC)
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') {
        root.setAttribute('data-theme', 'light');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;

        toggle.addEventListener('click', () => {
            const isLight = root.getAttribute('data-theme') === 'light';

            // Trigger subtle glitch animation
            document.body.classList.add('theme-glitching');

            // Swap theme mid-glitch so the color flip feels like part of the static
            setTimeout(() => {
                if (isLight) {
                    root.removeAttribute('data-theme');
                    localStorage.setItem(STORAGE_KEY, 'dark');
                    toggle.setAttribute('aria-label', 'Switch to light mode');
                } else {
                    root.setAttribute('data-theme', 'light');
                    localStorage.setItem(STORAGE_KEY, 'light');
                    toggle.setAttribute('aria-label', 'Switch to dark mode');
                }
            }, 80);

            // End glitch
            setTimeout(() => {
                document.body.classList.remove('theme-glitching');
            }, 300);
        });
    });
})();



/* ========================================
   DATA-DRIVEN CONTENT — JSON LOADING & RENDERING
   ======================================== */

// ========== UTILITY: Load JSON with graceful fallback ==========
async function loadJSON(path) {
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${path}`);
        return await res.json();
    } catch (err) {
        console.warn(`[loadJSON] Failed to load ${path}:`, err);
        return null;
    }
}

// ========== FORMAT HELPERS ==========
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime12(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function getStatusLabel(status) {
    const map = {
        'live': 'LIVE',
        'upcoming': 'UPCOMING',
        'finished': 'FINISHED',
        'coming-soon': 'COMING SOON'
    };
    return map[status] || status.toUpperCase();
}


// ========== EVENTS: Render from JSON ==========
let eventsData = [];
let eventGames = [];
let currentGameFilter = null;

async function renderEvents() {
    const container = document.getElementById('eventsLayout');
    const fallback = document.getElementById('eventsFallback');
    if (!container) return;

    const data = await loadJSON('data/events.json');
    if (!data || data.length === 0) {
        // Keep fallback visible
        if (fallback) fallback.style.display = '';
        return;
    }

    eventsData = data;
    // Hide fallback, show dynamic content
    if (fallback) fallback.style.display = 'none';

    // Available games, in the order they first appear in the data
    eventGames = [...new Set(data.map(e => e.game))];

    // Default to the first game; keep current selection if it's still valid
    if (!currentGameFilter || !eventGames.includes(currentGameFilter)) {
        currentGameFilter = eventGames[0];
    }

    renderEventsLayout();
}

// Build the game filter row + featured/upcoming events for the active game.
function renderEventsLayout() {
    const container = document.getElementById('eventsLayout');
    if (!container) return;

    // Only events for the currently selected game
    const gameEvents = eventsData.filter(e => e.game === currentGameFilter);

    // Sort: live first, then upcoming by date, then finished
    const statusOrder = { 'live': 0, 'upcoming': 1, 'coming-soon': 2, 'finished': 3 };
    const sorted = [...gameEvents].sort((a, b) => {
        const sa = statusOrder[a.status] ?? 9;
        const sb = statusOrder[b.status] ?? 9;
        if (sa !== sb) return sa - sb;
        return new Date(a.date) - new Date(b.date);
    });

    let html = '';

    // ---- Game filter row (clickable) ----
    html += `<div class="events-game-filter">`;
    eventGames.forEach(m => {
        const isActive = m === currentGameFilter;
        html += `<div class="game-filter-card${isActive ? ' active' : ''}" data-game="${m}" role="button" tabindex="0" aria-pressed="${isActive}">${m.toUpperCase()}</div>`;
    });
    html += `<div class="game-filter-card game-filter-card--upcoming" aria-disabled="true">???</div>`;
    html += `</div>`;

    if (sorted.length === 0) {
        // No events scheduled for this game yet
        html += `
            <div class="events-empty">
                <div class="events-empty-icon">&#9670;</div>
                <h3>NO EVENTS YET</h3>
                <p>There are no events scheduled for ${currentGameFilter} right now. Check back soon!</p>
            </div>
        `;
        container.innerHTML = html;
        attachGameFilterHandlers();
        return;
    }

    // ---- Featured event (left column) ----
    const featured = sorted[0];
    const upcoming = sorted.slice(1);

    html += `
        <div class="event-featured clickable" data-event-id="${featured.id}">
            <div class="event-featured-badge">${featured.status === 'live' ? 'LIVE NOW' : 'NEXT EVENT'}</div>
            <div class="event-featured-content">
                <h3>${featured.title}</h3>
                <p>${featured.description}</p>
                <div class="event-meta">
                    <div class="meta-item"><span class="meta-label">DATE</span><span class="meta-value">${formatDate(featured.date)}</span></div>
                    <div class="meta-item"><span class="meta-label">TIME</span><span class="meta-value">${formatTime12(featured.time)} ${featured.timezone}</span></div>
                    <div class="meta-item"><span class="meta-label">PRIZE</span><span class="meta-value">${featured.prize}</span></div>
                    <div class="meta-item"><span class="meta-label">TYPE</span><span class="meta-value">${featured.type}</span></div>
                </div>
                ${featured.status === 'finished'
                    ? `<span class="btn btn-outline disabled">REGISTRATION CLOSED</span>`
                    : `<button type="button" class="btn btn-primary js-register-btn">REGISTER NOW</button>`
                }
            </div>
        </div>
    `;

    // ---- Upcoming event cards (right column) ----
    html += '<div class="events-upcoming">';
    if (upcoming.length === 0) {
        html += `<div class="events-upcoming-empty">More ${currentGameFilter} events coming soon.</div>`;
    } else {
        upcoming.forEach(evt => {
            const statusClass = evt.status === 'live' ? 'live' : evt.status === 'finished' ? 'closed' : 'upcoming';
            const btnText = evt.status === 'finished' ? 'ENDED' : 'VIEW DETAILS';
            const btnDisabled = evt.status === 'finished' ? ' disabled' : '';
            html += `
                <div class="event-card clickable" data-event-id="${evt.id}">
                    <div class="event-status ${statusClass}">${getStatusLabel(evt.status)}</div>
                    <h4>${evt.title}</h4>
                    <div class="event-details">
                        <span>${formatDate(evt.date)} &bull; ${formatTime12(evt.time)} ${evt.timezone}</span>
                        <span>Prize: ${evt.prize}</span>
                    </div>
                    <span class="btn btn-outline btn-sm${btnDisabled}">${btnText}</span>
                </div>
            `;
        });
    }
    html += '</div>';

    container.innerHTML = html;

    attachGameFilterHandlers();
    attachEventCardHandlers();

    // Re-apply fade-in classes
    container.querySelectorAll('.event-featured, .event-card').forEach(el => {
        el.classList.add('fade-in', 'visible');
    });
}

// Wire up the game filter cards so each game shows its own events.
function attachGameFilterHandlers() {
    const container = document.getElementById('eventsLayout');
    if (!container) return;
    container.querySelectorAll('.game-filter-card[data-game]').forEach(card => {
        const selectGame = () => {
            const game = card.getAttribute('data-game');
            if (!game || game === currentGameFilter) return;
            currentGameFilter = game;
            renderEventsLayout();
        };
        card.addEventListener('click', selectGame);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectGame();
            }
        });
    });
}

// Wire up event cards to open the detail modal.
function attachEventCardHandlers() {
    const container = document.getElementById('eventsLayout');
    if (!container) return;
    container.querySelectorAll('[data-event-id]').forEach(card => {
        card.addEventListener('click', (e) => {
            // Register button -> open the on-site registration form
            const regBtn = e.target.closest('.js-register-btn');
            if (regBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = card.getAttribute('data-event-id');
                const ev = eventsData.find(x => x.id === id);
                if (ev && window.openRegModal) window.openRegModal(ev.id, ev.title);
                return;
            }
            // Don't open modal if clicking a real external link
            const anchor = e.target.closest('a');
            if (anchor && anchor.getAttribute('href') && anchor.getAttribute('href') !== '#') return;
            // Prevent the click from bubbling to section-switcher
            e.preventDefault();
            e.stopPropagation();
            const id = card.getAttribute('data-event-id');
            const event = eventsData.find(ev => ev.id === id);
            if (event) renderEventModal(event);
        });
    });
}


// ========== EVENT MODAL: Render & Controls ==========
function renderEventModal(event) {
    const overlay = document.getElementById('eventModalOverlay');
    const body = document.getElementById('eventModalBody');
    if (!overlay || !body) return;

    const statusClass = event.status === 'live' ? 'live'
        : event.status === 'finished' ? 'finished'
        : event.status === 'coming-soon' ? 'coming-soon'
        : 'upcoming';

    let html = `
        <h2 id="eventModalTitle">${event.title}</h2>
        <div class="modal-game">${event.game} &bull; ${event.type}</div>
        <div class="modal-status-badge ${statusClass}">${getStatusLabel(event.status)}</div>
        <div class="modal-meta-grid">
            <div class="modal-meta-item"><span class="label">DATE</span><span class="value">${formatDate(event.date)}</span></div>
            <div class="modal-meta-item"><span class="label">TIME</span><span class="value">${formatTime12(event.time)} ${event.timezone}</span></div>
            <div class="modal-meta-item"><span class="label">PRIZE</span><span class="value">${event.prize}</span></div>
            <div class="modal-meta-item"><span class="label">CASTER</span><span class="value">${event.caster || 'TBA'}</span></div>
        </div>
        <p class="modal-description">${event.description}</p>
    `;

    // Rules
    if (event.rules && event.rules.length > 0) {
        html += `<div class="modal-section-title">RULES</div><ul class="modal-rules">`;
        event.rules.forEach(rule => {
            html += `<li>${rule}</li>`;
        });
        html += `</ul>`;
    }

    // Sessions
    if (event.sessions && event.sessions.length > 0) {
        html += `<div class="modal-section-title">SESSIONS</div><div class="modal-sessions">`;
        event.sessions.forEach(s => {
            html += `
                <div class="modal-session-item">
                    <span class="session-name">${s.name}</span>
                    <span class="session-info">${s.time} &bull; ${s.slots} slots</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Tags
    if (event.tags && event.tags.length > 0) {
        html += `<div class="modal-tags">`;
        event.tags.forEach(tag => {
            html += `<span class="modal-tag">#${tag}</span>`;
        });
        html += `</div>`;
    }

    // CTA
    html += `<div class="modal-cta">`;
    if (event.status === 'finished') {
        html += `<span class="btn btn-outline disabled">EVENT ENDED</span>`;
    } else if (event.status === 'coming-soon') {
        html += `<span class="btn btn-outline disabled">COMING SOON</span>`;
    } else {
        html += `<button type="button" class="btn btn-primary js-modal-register">REGISTER NOW</button>`;
    }
    html += `</div>`;

    body.innerHTML = html;

    // Wire the modal's register button to open the on-site registration form
    const modalRegBtn = body.querySelector('.js-modal-register');
    if (modalRegBtn) {
        modalRegBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeEventModal();
            if (window.openRegModal) window.openRegModal(event.id, event.title);
        });
    }

    // Show modal
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeEventModal() {
    const overlay = document.getElementById('eventModalOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

// Modal close handlers
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('eventModalOverlay');
    const closeBtn = document.getElementById('eventModalClose');

    if (closeBtn) closeBtn.addEventListener('click', closeEventModal);

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            // Close if clicking outside the modal content
            if (e.target === overlay) closeEventModal();
        });
    }

    // Close with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeEventModal();
    });
});


// ========== LEADERBOARD: Render from JSON ==========
let leaderboardData = [];
let lbCurrentFilter = 'all';
let lbCurrentSort = 'rank';

async function renderLeaderboard() {
    const data = await loadJSON('data/leaderboard.json');
    if (!data || data.length === 0) {
        showLeaderboardEmpty(true);
        return;
    }
    leaderboardData = data;
    applyLeaderboardView();
}

function applyLeaderboardView() {
    let filtered = [...leaderboardData];

    // Apply filter
    if (lbCurrentFilter !== 'all') {
        filtered = filtered.filter(item => {
            return item.category === lbCurrentFilter || item.map === lbCurrentFilter;
        });
    }

    // Apply sort
    if (lbCurrentSort === 'time') {
        filtered.sort((a, b) => a.time.localeCompare(b.time));
    } else if (lbCurrentSort === 'date') {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
        filtered.sort((a, b) => a.rank - b.rank);
    }

    if (filtered.length === 0) {
        showLeaderboardEmpty(true);
        document.getElementById('lbPodium').innerHTML = '';
        document.getElementById('lbTableWrapper').innerHTML = '';
        return;
    }

    showLeaderboardEmpty(false);
    renderPodium(filtered.slice(0, 3));
    renderLeaderboardTable(filtered.slice(3));
}

function renderPodium(top3) {
    const podium = document.getElementById('lbPodium');
    if (!podium) return;

    if (top3.length === 0) { podium.innerHTML = ''; return; }

    // Reorder for visual: [2nd, 1st, 3rd]
    const ordered = [];
    if (top3[1]) ordered.push({ ...top3[1], displayRank: 2 });
    if (top3[0]) ordered.push({ ...top3[0], displayRank: 1 });
    if (top3[2]) ordered.push({ ...top3[2], displayRank: 3 });

    let html = '';
    ordered.forEach(p => {
        const rankClass = `rank-${p.displayRank}`;
        html += `
            <div class="lb-podium-card ${rankClass}">
                <div class="lb-podium-rank">#${p.displayRank}</div>
                <div class="lb-podium-avatar">&#127942;</div>
                <div class="lb-podium-name">${p.playerName}</div>
                <div class="lb-podium-time">${p.time}</div>
                <div class="lb-podium-details">${p.map} &bull; ${p.device}<br>${p.eventName}</div>
                ${p.badge ? `<span class="lb-podium-badge">${p.badge}</span>` : ''}
            </div>
        `;
    });

    podium.innerHTML = html;
}

function renderLeaderboardTable(rows) {
    const wrapper = document.getElementById('lbTableWrapper');
    if (!wrapper) return;

    if (rows.length === 0) { wrapper.innerHTML = ''; return; }

    let html = `
        <table class="lb-table">
            <thead>
                <tr>
                    <th>RANK</th>
                    <th>PLAYER</th>
                    <th>TIME</th>
                    <th>MAP</th>
                    <th>EVENT</th>
                    <th>DEVICE</th>
                    <th>DATE</th>
                    <th>BADGE</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(row => {
        html += `
            <tr>
                <td class="td-rank">#${row.rank}</td>
                <td class="td-player">${row.playerName}</td>
                <td class="td-time">${row.time}</td>
                <td>${row.map}</td>
                <td>${row.eventName}</td>
                <td>${row.device}</td>
                <td>${formatDate(row.date)}</td>
                <td>${row.badge ? `<span class="td-badge">${row.badge}</span>` : '—'}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;
}

function showLeaderboardEmpty(show) {
    const empty = document.getElementById('lbEmpty');
    const podium = document.getElementById('lbPodium');
    const table = document.getElementById('lbTableWrapper');
    if (empty) empty.style.display = show ? 'block' : 'none';
    if (show) {
        if (podium) podium.style.display = 'none';
        if (table) table.style.display = 'none';
    } else {
        if (podium) podium.style.display = '';
        if (table) table.style.display = '';
    }
}

// Leaderboard filter & sort event handlers
document.addEventListener('DOMContentLoaded', () => {
    const filtersContainer = document.getElementById('leaderboardFilters');
    const sortSelect = document.getElementById('lbSortSelect');

    if (filtersContainer) {
        filtersContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.lb-filter');
            if (!btn) return;
            filtersContainer.querySelectorAll('.lb-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            lbCurrentFilter = btn.getAttribute('data-filter');
            applyLeaderboardView();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            lbCurrentSort = sortSelect.value;
            applyLeaderboardView();
        });
    }
});


// ========== MEDIA KIT: Render from JSON ==========
async function renderMediaKit() {
    const data = await loadJSON('data/mediaKit.json');
    if (!data) return;

    renderMkIntro(data);
    renderMkStrengths(data);
    renderMkPackages(data);
    renderMkAssets(data);
    renderMkCta(data);
}

function renderMkIntro(data) {
    const el = document.getElementById('mkIntro');
    if (!el) return;

    const audience = data.audience || {};
    el.innerHTML = `
        <h3>ABOUT <span class="accent-text">${data.communityName || 'PYTHAS'}</span></h3>
        <p>${data.shortDescription || ''}</p>
        <div class="mk-stats-row">
            <div class="mk-stat"><div class="mk-stat-value">${audience.discordMembers || '—'}</div><div class="mk-stat-label">DISCORD</div></div>
            <div class="mk-stat"><div class="mk-stat-value">${audience.robloxGroupMembers || '—'}</div><div class="mk-stat-label">ROBLOX GROUP</div></div>
            <div class="mk-stat"><div class="mk-stat-value">${audience.totalEventsHosted || '—'}</div><div class="mk-stat-label">EVENTS HOSTED</div></div>
            <div class="mk-stat"><div class="mk-stat-value">${audience.averageEventParticipants || '—'}</div><div class="mk-stat-label">AVG PARTICIPANTS</div></div>
        </div>
    `;
}

function renderMkStrengths(data) {
    const el = document.getElementById('mkStrengths');
    if (!el || !data.strengths || data.strengths.length === 0) return;

    let html = `<h3>WHY <span class="accent-text">PARTNER</span> WITH US</h3><div class="mk-strengths-grid">`;
    data.strengths.forEach(str => {
        html += `
            <div class="mk-strength-item">
                <span class="mk-strength-icon">&#9889;</span>
                <span class="mk-strength-text">${str}</span>
            </div>
        `;
    });
    html += '</div>';
    el.innerHTML = html;
}

function renderMkPackages(data) {
    const el = document.getElementById('mkPackages');
    if (!el || !data.sponsorPackages || data.sponsorPackages.length === 0) return;

    let html = `<h3>SPONSOR <span class="accent-text">PACKAGES</span></h3><div class="mk-packages-grid">`;
    data.sponsorPackages.forEach(pkg => {
        const tierClass = pkg.name.toLowerCase();
        html += `
            <div class="mk-package-card ${tierClass}">
                <div class="mk-package-name">${pkg.name}</div>
                <div class="mk-package-price">${pkg.price}</div>
                <ul class="mk-package-benefits">
                    ${pkg.benefits.map(b => `<li>${b}</li>`).join('')}
                </ul>
            </div>
        `;
    });
    html += '</div>';
    el.innerHTML = html;
}

function renderMkAssets(data) {
    const el = document.getElementById('mkAssets');
    if (!el) return;

    let html = `<h3>BRAND <span class="accent-text">ASSETS</span></h3>`;

    // Asset cards
    if (data.brandAssets && data.brandAssets.length > 0) {
        html += '<div class="mk-assets-grid">';
        const icons = { 'Logo': '&#127912;', 'Template': '&#128196;', 'Banner': '&#127988;', 'Guidelines': '&#127912;' };
        data.brandAssets.forEach(asset => {
            const icon = icons[asset.type] || '&#128193;';
            html += `
                <div class="mk-asset-card">
                    <div class="mk-asset-icon">${icon}</div>
                    <h5>${asset.name}</h5>
                    <span>${asset.format}</span>
                </div>
            `;
        });
        html += '</div>';
    }

    // Color Palette
    if (data.colorPalette && data.colorPalette.length > 0) {
        html += '<div class="mk-palette">';
        data.colorPalette.forEach(c => {
            html += `
                <div class="mk-palette-swatch">
                    <div class="mk-swatch-color" style="background:${c.hex};"></div>
                    <span class="mk-swatch-label">${c.name}</span>
                </div>
            `;
        });
        html += '</div>';
    }

    el.innerHTML = html;
}

function renderMkCta(data) {
    const el = document.getElementById('mkCta');
    if (!el) return;

    const email = data.contactEmail || '';
    const discord = (data.socialLinks && data.socialLinks.discord) || '#';

    el.innerHTML = `
        <h3>INTERESTED IN <span class="accent-text">PARTNERING?</span></h3>
        <p>We'd love to collaborate. Reach out to discuss a package that fits your brand.</p>
        <div class="mk-cta-buttons">
            <a href="mailto:${email}" class="btn btn-primary">CONTACT FOR PARTNERSHIP</a>
            <a href="${discord}" target="_blank" rel="noopener" class="btn btn-outline">JOIN DISCORD</a>
        </div>
    `;
}


// ========== PARTNERS: Render from JSON ==========
async function renderPartners() {
    const data = await loadJSON('data/partners.json');
    const grid = document.getElementById('partnersGrid');
    if (!data || data.length === 0 || !grid) return;

    let html = '';
    data.forEach(partner => {
        const packageBadge = partner.package ? `<div class="partner-package-badge">${partner.package}</div>` : '';
        html += `
            <div class="partner-card">
                ${packageBadge}
                <div class="partner-logo">${partner.name}</div>
                <span>${partner.type}</span>
            </div>
        `;
    });
    grid.innerHTML = html;
}


// ========== INITIALIZE ALL DATA-DRIVEN CONTENT ==========
document.addEventListener('DOMContentLoaded', () => {
    // Load all JSON-driven sections
    renderEvents();
    renderLeaderboard();
    renderMediaKit();
    renderPartners();
});

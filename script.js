/* ========================================
   PYTHAS COLLECTIVE - TAB-BASED NAVIGATION
   ======================================== */


// ========== ROBLOX LIVE DATA CONFIG ==========
// Map of member display name -> Roblox User ID
// Names and avatars auto-update when members change them on Roblox.
const ROBLOX_USERS = {
    'MaschPyth':  9096966065,
    'AerionPyth': 9288648967,
    'C1eelPyth':  9572496148,
    'AveyyPyth':  9155450474,
    'VinnyPyth':  9124999411,
    'AsbiiPyth':  8877318735,
    'DellPyth':   8902740169
};

const ROBLOX_SPONSORS = {
    'LunaDelRey': 9189111615
};

// Map of game name (matches H3 in .game-card) -> Roblox Place ID
const ROBLOX_GAMES = {
    'MOUNT AGORA': 124216358732636,
    'MOUNT AZTEC': 79000051805057
};

// Fetch Roblox avatar headshots in one batch from the official thumbnails API.
// API supports CORS; returns JSON with imageUrl pointing to tr.rbxcdn.com.
// Base URL of the Cloudflare Worker that proxies Roblox + serves leaderboard data
const WORKER_API = 'https://pythas-leaderboard.alfathpr18.workers.dev';

function robloxUserIdFromUrl(url) {
    const match = String(url || '').match(/roblox\.com\/users\/(\d+)/i);
    return match ? Number(match[1]) : null;
}

async function loadRobloxProfiles() {
    const profileTargets = [];

    document.querySelectorAll('.member-card').forEach(card => {
        const nameEl = card.querySelector('.member-info h4');
        const avatarEl = card.querySelector('.member-avatar');
        if (!nameEl || !avatarEl) return;
        const userId = ROBLOX_USERS[nameEl.textContent.trim()] || Number(card.getAttribute('data-roblox-id'));
        if (!userId) return;
        profileTargets.push({ userId, nameEl, avatarEl });
    });

    document.querySelectorAll('.spotlight-card').forEach(card => {
        const nameEl = card.querySelector('h5');
        const avatarEl = card.querySelector('.spotlight-avatar');
        if (!nameEl || !avatarEl) return;
        const userId = ROBLOX_SPONSORS[nameEl.textContent.trim()] || Number(card.getAttribute('data-roblox-id'));
        if (!userId) return;
        profileTargets.push({ userId, nameEl, avatarEl });
    });

    document.querySelectorAll('.member-wall-grid a[href*="roblox.com/users/"]').forEach(link => {
        const userId = robloxUserIdFromUrl(link.href);
        if (!userId) return;
        profileTargets.push({ userId, nameEl: link, avatarEl: null });
    });

    const userIds = [...new Set(profileTargets.map(target => target.userId).filter(Boolean))];
    if (userIds.length === 0) return;

    try {
        const [usersRes, avatarsRes] = await Promise.all([
            fetch(`${WORKER_API}/api/roblox/users?userIds=${userIds.join(',')}`),
            fetch(`${WORKER_API}/api/roblox/avatars?userIds=${userIds.join(',')}&size=420x420`)
        ]);
        if (!usersRes.ok) throw new Error('users proxy ' + usersRes.status);
        if (!avatarsRes.ok) throw new Error('avatars proxy ' + avatarsRes.status);

        const usersJson = await usersRes.json();
        const avatarsJson = await avatarsRes.json();
        const usersById = {};
        const avatarsById = {};

        (usersJson.data || []).forEach(user => {
            if (user && user.id) usersById[user.id] = user;
        });
        (avatarsJson.data || []).forEach(item => {
            if (item.state === 'Completed' && item.imageUrl) {
                avatarsById[item.targetId] = item.imageUrl;
            }
        });

        profileTargets.forEach(target => {
            const user = usersById[target.userId];
            const imgUrl = avatarsById[target.userId];
            const displayName = user && (user.displayName || user.name);
            if (displayName) {
                target.nameEl.textContent = displayName;
            }

            if (target.nameEl.tagName === 'A' && user && user.name) {
                target.nameEl.title = `@${user.name}`;
            }

            if (!target.avatarEl || !imgUrl) return;
            const imgEl = target.avatarEl.querySelector('img');
            if (imgEl) {
                imgEl.src = imgUrl;
                imgEl.alt = `${displayName || user?.name || 'Roblox user'} avatar`;
            } else {
                target.avatarEl.style.backgroundImage = `url("${imgUrl}")`;
                target.avatarEl.style.backgroundSize = 'cover';
                target.avatarEl.style.backgroundPosition = 'center';
                target.avatarEl.setAttribute('role', 'img');
                target.avatarEl.setAttribute('aria-label', `${displayName || user?.name || 'Roblox user'} avatar`);
            }
            target.avatarEl.setAttribute('data-roblox-id', String(target.userId));
        });
    } catch (err) {
        console.warn('[Roblox profiles] failed to load:', err);
    }
}

// Fetch Roblox game icons by placeId from official thumbnails API.
async function loadRobloxGameIcons() {
    const placeIds = Object.values(ROBLOX_GAMES);
    if (placeIds.length === 0) return;
    try {
        const url = `${WORKER_API}/api/roblox/game-icons?placeIds=${placeIds.join(',')}&size=512x512`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('game-icons proxy ' + res.status);
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
    loadRobloxProfiles();
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
let discordStatsPromise = null;
let robloxCommunityStatsPromise = null;

function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 2000;
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = `${Math.floor(target * eased).toLocaleString()}${suffix}`;
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = `${target.toLocaleString()}${suffix}`;
        }
    }
    requestAnimationFrame(update);
}

function setStatValue(el, value) {
    if (!el || !Number.isFinite(value)) return;
    el.setAttribute('data-target', String(value));
    if (countersAnimated) {
        animateCounter(el);
    }
}

async function loadDiscordStats() {
    if (!discordStatsPromise) {
        discordStatsPromise = fetch('/api/discord-stats').then(res => {
            if (!res.ok) throw new Error(`Discord stats ${res.status}`);
            return res.json();
        });
    }

    return discordStatsPromise;
}

async function loadRobloxCommunityStats() {
    if (!robloxCommunityStatsPromise) {
        robloxCommunityStatsPromise = fetch('/api/roblox-community-stats').then(res => {
            if (!res.ok) throw new Error(`Roblox community stats ${res.status}`);
            return res.json();
        });
    }

    return robloxCommunityStatsPromise;
}

async function initDiscordMemberStat() {
    const discordStat = document.querySelector('[data-stat-key="discord-members"]');
    if (!discordStat) return;

    try {
        const data = await loadDiscordStats();
        setStatValue(discordStat, Number(data.memberCount));
    } catch (error) {
        console.warn('Discord member stat fallback:', error);
    }
}

async function initCommunityMemberStat() {
    const communityStat = document.querySelector('[data-stat-key="community-members"]');
    if (!communityStat) return;

    try {
        const data = await loadRobloxCommunityStats();
        setStatValue(communityStat, Number(data.memberCount));
    } catch (error) {
        console.warn('Community member stat fallback:', error);
    }
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

function normalizeEvent(raw) {
    const fields = raw.event_registration_fields || raw.registrationFields || [];
    const results = Array.isArray(raw.results) ? raw.results : [];
    return {
        id: String(raw.id || ''),
        title: raw.title || '',
        game: raw.game || 'Mount Agora',
        date: raw.date || '',
        startDate: raw.startDate || raw.start_date || raw.date || '',
        endDate: raw.endDate || raw.end_date || raw.startDate || raw.start_date || raw.date || '',
        time: raw.time || '',
        timezone: raw.timezone || '',
        status: raw.status || 'upcoming',
        type: raw.type || '',
        image: raw.image || '',
        description: raw.description || '',
        broadcastText: raw.broadcastText || raw.broadcast_text || '',
        rules: Array.isArray(raw.rules) ? raw.rules : [],
        sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
        prize: raw.prize || '',
        caster: raw.caster || '',
        registrationEnabled: raw.registrationEnabled ?? raw.registration_enabled ?? true,
        registrationLink: raw.registrationLink || raw.registration_link || '',
        results: results.map((result, index) => ({
            raceName: result.raceName || result.race_name || `Race ${index + 1}`,
            mode: result.mode === 'cards' ? 'cards' : 'podium',
            winners: (Array.isArray(result.winners) ? result.winners : [])
                .map((winner, winnerIndex) => ({
                    rank: Number(winner.rank || winnerIndex + 1),
                    username: winner.username || winner.robloxUsername || winner.roblox_username || '',
                    displayName: winner.displayName || winner.display_name || '',
                    avatarUrl: winner.avatarUrl || winner.avatar_url || ''
                }))
                .filter(winner => winner.username || winner.displayName || winner.avatarUrl)
        })).filter(result => result.raceName && result.winners.length),
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        published: raw.published ?? true,
        sortOrder: raw.sortOrder ?? raw.sort_order ?? 0,
        registrationFields: fields
            .map(field => ({
                id: field.id || '',
                key: field.key || field.field_key || '',
                label: field.label || '',
                type: field.type || 'text',
                required: !!field.required,
                options: Array.isArray(field.options) ? field.options : [],
                placeholder: field.placeholder || '',
                helpText: field.helpText || field.help_text || '',
                sortOrder: field.sortOrder ?? field.sort_order ?? 0
            }))
            .filter(field => field.key && field.label)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    };
}

async function loadEventsData() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('events')
                .select('*, event_registration_fields(*)')
                .eq('published', true)
                .order('sort_order', { ascending: true })
                .order('start_date', { ascending: true, nullsFirst: false });
            if (error) throw error;
            if (data && data.length > 0) return data.map(normalizeEvent);
        } catch (error) {
            console.warn('[events] Supabase fallback to JSON:', error.message || error);
        }
    }

    const data = await loadJSON('data/events.json');
    return Array.isArray(data) ? data.map(normalizeEvent) : null;
}


// ========== EVENTS: Render from Supabase/JSON ==========
let eventsData = [];
let eventGames = [];
let currentGameFilter = null;

function applyEventImageRatios(root = document) {
    root.querySelectorAll('.event-featured-image img, .event-card-image img, .modal-image img').forEach(img => {
        const fitToImage = () => {
            if (!img.naturalWidth || !img.naturalHeight) return;
            img.parentElement.style.setProperty('--event-image-ratio', `${img.naturalWidth} / ${img.naturalHeight}`);
        };

        if (img.complete) {
            fitToImage();
        } else {
            img.addEventListener('load', fitToImage, { once: true });
        }
    });
}

async function renderEvents() {
    const container = document.getElementById('eventsLayout');
    const fallback = document.getElementById('eventsFallback');
    if (!container) return;

    const data = await loadEventsData();
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

function formatHeroEventDate(startDate, endDate) {
    if (!startDate) return 'DATE TBA';

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const parseDateKey = (dateKey) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        return { year, month, day };
    };
    const formatPart = (dateKey, includeYear = true) => {
        const date = parseDateKey(dateKey);
        return `${date.day} ${monthNames[date.month - 1]}${includeYear ? ` ${date.year}` : ''}`;
    };

    if (!endDate || startDate === endDate) {
        return formatPart(startDate);
    }

    const start = parseDateKey(startDate);
    const end = parseDateKey(endDate);
    if (start.year === end.year && start.month === end.month) {
        return `${start.day}-${end.day} ${monthNames[start.month - 1]} ${start.year}`;
    }

    return `${formatPart(startDate, start.year !== end.year)} - ${formatPart(endDate)}`;
}

function renderHeroOngoingEvent(event) {
    const panel = document.getElementById('heroOngoingEvent');
    if (!panel) return;

    if (sessionStorage.getItem('pythasHeroEventDismissed') === '1' || !event) {
        panel.hidden = true;
        panel.innerHTML = '';
        return;
    }

    const label = event.status === 'live' ? 'ONGOING EVENT' : 'NEXT EVENT';
    panel.innerHTML = `
        <button type="button" class="hero-event-close" aria-label="Close event notice">&times;</button>
        <span class="hero-event-kicker">${label}</span>
        <h2 class="hero-event-title">${event.title || 'EVENT'}</h2>
        <p class="hero-event-date">${formatHeroEventDate(event.startDate || event.date, event.endDate)}</p>
    `;
    const closeBtn = panel.querySelector('.hero-event-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sessionStorage.setItem('pythasHeroEventDismissed', '1');
            panel.hidden = true;
            panel.innerHTML = '';
        });
    }
    panel.hidden = false;
}

function pickNextHeroEvent(events) {
    if (!Array.isArray(events) || events.length === 0) return null;
    const candidates = events.filter(event => event && event.status !== 'finished');
    if (candidates.length === 0) return null;

    const withDates = candidates
        .filter(event => event.startDate || event.date)
        .sort((a, b) => new Date(a.startDate || a.date) - new Date(b.startDate || b.date));

    return withDates[0] || candidates[0];
}

async function initHeroOngoingEvent() {
    try {
        const res = await fetch('/api/ongoing-events');
        if (!res.ok) throw new Error(`Ongoing events ${res.status}`);

        const data = await res.json();
        const ongoing = (data.events || [])[0];
        if (ongoing) {
            renderHeroOngoingEvent(ongoing);
            return;
        }

        const events = await loadEventsData();
        renderHeroOngoingEvent(pickNextHeroEvent(events));
    } catch (error) {
        console.warn('Ongoing event fallback:', error);
        try {
            const events = await loadEventsData();
            renderHeroOngoingEvent(pickNextHeroEvent(events));
        } catch (_) {
            renderHeroOngoingEvent(null);
        }
    }
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

    const featuredImg = featured.image
        ? `<div class="event-featured-image"><img src="${featured.image}" alt="${featured.title}" loading="lazy"></div>`
        : '';
    html += `
        <div class="event-featured clickable" data-event-id="${featured.id}">
            ${featuredImg}
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
                    : featured.registrationEnabled
                        ? `<button type="button" class="btn btn-primary js-register-btn">REGISTER NOW</button>`
                        : `<button type="button" class="btn btn-outline js-details-btn">DETAILS</button>`
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
            const btnText = evt.status === 'finished' ? 'ENDED' : evt.registrationEnabled ? 'VIEW DETAILS' : 'DETAILS';
            const btnDisabled = evt.status === 'finished' ? ' disabled' : '';
            const cardImg = evt.image
                ? `<div class="event-card-image"><img src="${evt.image}" alt="${evt.title}" loading="lazy"></div>`
                : '';
            html += `
                <div class="event-card clickable${evt.image ? ' has-image' : ''}" data-event-id="${evt.id}">
                    ${cardImg}
                    <div class="event-card-body">
                        <div class="event-status ${statusClass}">${getStatusLabel(evt.status)}</div>
                        <h4>${evt.title}</h4>
                        <div class="event-details">
                            <span>${formatDate(evt.date)} &bull; ${formatTime12(evt.time)} ${evt.timezone}</span>
                            <span>Prize: ${evt.prize}</span>
                        </div>
                        <span class="btn btn-outline btn-sm${btnDisabled}">${btnText}</span>
                    </div>
                </div>
            `;
        });
    }
    html += '</div>';

    container.innerHTML = html;

    attachGameFilterHandlers();
    attachEventCardHandlers();
    applyEventImageRatios(container);

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
                if (ev && window.openRegModal) window.openRegModal(ev.id, ev.title, ev);
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
function winnerName(winner) {
    return winner.displayName || winner.username || 'Winner';
}

function winnerAvatar(winner) {
    const name = winnerName(winner);
    if (winner.avatarUrl) {
        return `<img src="${escapeHtmlLb(winner.avatarUrl)}" alt="${escapeHtmlLb(name)} avatar" loading="lazy">`;
    }
    return `<span>${escapeHtmlLb(name.slice(0, 2).toUpperCase())}</span>`;
}

function renderEventResults(results) {
    if (!Array.isArray(results) || results.length === 0) return '';

    let html = '<div class="modal-section-title">RESULTS</div><div class="modal-results">';
    results.forEach(result => {
        const winners = [...result.winners].sort((a, b) => (a.rank || 99) - (b.rank || 99));
        html += `
            <section class="modal-result-race">
                <div class="modal-result-head">
                    <h3>${escapeHtmlLb(result.raceName)}</h3>
                    <span>${result.mode === 'cards' ? 'WINNERS' : 'PODIUM'}</span>
                </div>
        `;

        if (result.mode === 'cards') {
            html += '<div class="modal-winner-cards">';
            winners.forEach(winner => {
                html += `
                    <article class="modal-winner-card">
                        <div class="modal-winner-avatar">${winnerAvatar(winner)}</div>
                        <div>
                            <strong>${escapeHtmlLb(winnerName(winner))}</strong>
                            ${winner.username ? `<span>@${escapeHtmlLb(winner.username)}</span>` : ''}
                        </div>
                    </article>
                `;
            });
            html += '</div>';
        } else {
            const ordered = [];
            const second = winners.find(w => Number(w.rank) === 2);
            const first = winners.find(w => Number(w.rank) === 1) || winners[0];
            const third = winners.find(w => Number(w.rank) === 3);
            if (second) ordered.push(second);
            if (first) ordered.push(first);
            if (third) ordered.push(third);
            winners.forEach(winner => {
                if (!ordered.includes(winner)) ordered.push(winner);
            });

            html += '<div class="modal-result-podium">';
            ordered.forEach(winner => {
                const rank = Number(winner.rank || 1);
                html += `
                    <article class="modal-podium-card rank-${rank}">
                        <div class="modal-podium-rank">#${rank}</div>
                        <div class="modal-winner-avatar">${winnerAvatar(winner)}</div>
                        <strong>${escapeHtmlLb(winnerName(winner))}</strong>
                        ${winner.username ? `<span>@${escapeHtmlLb(winner.username)}</span>` : ''}
                    </article>
                `;
            });
            html += '</div>';
        }

        html += '</section>';
    });
    html += '</div>';
    return html;
}

function renderEventModal(event) {
    const overlay = document.getElementById('eventModalOverlay');
    const body = document.getElementById('eventModalBody');
    if (!overlay || !body) return;

    const statusClass = event.status === 'live' ? 'live'
        : event.status === 'finished' ? 'finished'
        : event.status === 'coming-soon' ? 'coming-soon'
        : 'upcoming';
    const metaItems = [
        ['DATE', formatDate(event.date || event.startDate)],
        ['TIME', [formatTime12(event.time), event.timezone].filter(Boolean).join(' ')],
        ['PRIZE', event.prize],
        ['CASTER', event.caster]
    ].filter(item => item[1]);

    let html = `
        ${event.image ? `<div class="modal-image"><img src="${event.image}" alt="${event.title}" loading="lazy"></div>` : ''}
        <h2 id="eventModalTitle">${event.title}</h2>
        <div class="modal-game">${[event.game, event.type].filter(Boolean).join(' &bull; ')}</div>
        <div class="modal-status-badge ${statusClass}">${getStatusLabel(event.status)}</div>
        ${metaItems.length ? `<div class="modal-meta-grid">
            ${metaItems.map(([label, value]) => `<div class="modal-meta-item"><span class="label">${label}</span><span class="value">${value}</span></div>`).join('')}
        </div>` : ''}
        ${event.description ? `<p class="modal-description">${event.description}</p>` : ''}
    `;

    if (event.broadcastText) {
        html += `<div class="modal-section-title">BROADCAST</div><p class="modal-description">${event.broadcastText}</p>`;
    }

    if (event.status === 'finished' && event.results && event.results.length > 0) {
        html += renderEventResults(event.results);
    }

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
    } else if (event.registrationEnabled) {
        html += `<button type="button" class="btn btn-primary js-modal-register">REGISTER NOW</button>`;
    } else {
        html += `<span class="btn btn-outline disabled">DETAILS ONLY</span>`;
    }
    html += `</div>`;

    body.innerHTML = html;
    applyEventImageRatios(body);

    // Wire the modal's register button to open the on-site registration form
    const modalRegBtn = body.querySelector('.js-modal-register');
    if (modalRegBtn) {
        modalRegBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeEventModal();
            if (window.openRegModal) window.openRegModal(event.id, event.title, event);
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


// ========== LEADERBOARD: Live from Cloudflare Worker ==========
const LEADERBOARD_API = WORKER_API;

let lbBoard = 'summit';          // 'summit' | 'speedrun'
let lbMap = 'aztec';             // 'aztec' | 'agora'
let lbCache = {};                // { "<map>:<board>": [...] }
let lbNameCache = {};            // { user_id: { username, displayName } } resolved from Roblox

function lbCacheKey(map, board) { return map + ':' + board; }

// Format milliseconds -> M:SS.mmm  (e.g. 83470 -> 1:23.470)
function formatRaceTime(ms) {
    if (ms == null || isNaN(ms)) return '—';
    const totalMs = Math.max(0, Math.round(ms));
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// A stored name is a placeholder if it's missing or looks like "User_123456".
function isPlaceholderName(name) {
    return !name || /^user[_ ]?\d+$/i.test(name);
}

function lbPlayerName(p) {
    // Prefer a freshly-resolved Roblox name if we have one
    const resolved = lbNameCache[p.user_id];
    if (resolved && resolved.displayName) return resolved.displayName;
    if (resolved && resolved.username) return resolved.username;
    if (!isPlaceholderName(p.display_name)) return p.display_name;
    if (!isPlaceholderName(p.username)) return p.username;
    return 'User ' + p.user_id;
}

async function renderLeaderboard() {
    await loadLeaderboardBoard(lbBoard);
}

async function loadLeaderboardBoard(board) {
    const statusEl = document.getElementById('lbStatus');
    if (statusEl) statusEl.textContent = 'Loading live data…';

    const key = lbCacheKey(lbMap, board);

    // Serve from cache instantly if we already have it
    if (lbCache[key]) {
        applyLeaderboardData(lbCache[key]);
        if (statusEl) statusEl.textContent = '';
        return;
    }

    try {
        const url = `${LEADERBOARD_API}/api/leaderboard/${board}?map=${encodeURIComponent(lbMap)}`;
        console.log('[leaderboard] fetching', url);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
        const json = await res.json();
        console.log('[leaderboard] response', json);
        const players = (json && json.players) || [];
        lbCache[key] = players;
        applyLeaderboardData(players);
        if (statusEl) statusEl.textContent = '';
    } catch (err) {
        console.error('[leaderboard] failed to load:', err);
        if (statusEl) statusEl.textContent = '';
        // Surface the real reason on-screen so issues are easy to diagnose
        showLeaderboardEmpty(true, 'Could not load leaderboard: ' + (err && err.message ? err.message : err));
    }
}

function applyLeaderboardData(players) {
    if (!players || players.length === 0) {
        showLeaderboardEmpty(true);
        const podium = document.getElementById('lbPodium');
        const table = document.getElementById('lbTableWrapper');
        if (podium) podium.innerHTML = '';
        if (table) table.innerHTML = '';
        return;
    }
    showLeaderboardEmpty(false);
    // Assign display ranks based on the order returned by the API
    const ranked = players.map((p, i) => ({ ...p, rank: i + 1 }));
    renderPodium(ranked.slice(0, 3));
    renderLeaderboardTable(ranked.slice(3));
    loadLeaderboardAvatars(ranked);
    resolveLeaderboardNames(ranked);
}

// Look up real Roblox usernames for rows that still have placeholder names,
// then re-render so the real names replace "User_xxxx".
async function resolveLeaderboardNames(players) {
    const needIds = players
        .filter(p => p.user_id > 0 && !lbNameCache[p.user_id] && isPlaceholderName(p.display_name) && isPlaceholderName(p.username))
        .map(p => p.user_id);
    if (needIds.length === 0) return;
    try {
        const url = `${WORKER_API}/api/roblox/users?userIds=${needIds.join(',')}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        let changed = false;
        (json.data || []).forEach(u => {
            if (u && u.id) {
                lbNameCache[u.id] = { username: u.name, displayName: u.displayName || u.name };
                changed = true;
            }
        });
        // Re-render the current board with resolved names (avatars already loading)
        const key = lbCacheKey(lbMap, lbBoard);
        if (changed && lbCache[key]) {
            const ranked = lbCache[key].map((p, i) => ({ ...p, rank: i + 1 }));
            renderPodium(ranked.slice(0, 3));
            renderLeaderboardTable(ranked.slice(3));
            loadLeaderboardAvatars(ranked);
        }
    } catch (err) {
        console.warn('[leaderboard] name resolve failed:', err);
    }
}

function lbValueLabel(p) {
    // Summit board shows summit count; speedrun shows best time
    return lbBoard === 'speedrun' ? formatRaceTime(p.best_time_ms) : `${p.summit ?? 0}`;
}

function lbValueCaption() {
    return lbBoard === 'speedrun' ? 'Best Time' : 'Summits';
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
        const name = lbPlayerName(p);
        html += `
            <div class="lb-podium-card rank-${p.displayRank}">
                <div class="lb-podium-rank">#${p.displayRank}</div>
                <div class="lb-podium-avatar" data-uid="${p.user_id}">&#127942;</div>
                <div class="lb-podium-name">${escapeHtmlLb(name)}</div>
                <div class="lb-podium-time">${escapeHtmlLb(lbValueLabel(p))}</div>
                <div class="lb-podium-details">${lbValueCaption()}</div>
            </div>
        `;
    });
    podium.innerHTML = html;
}

function renderLeaderboardTable(rows) {
    const wrapper = document.getElementById('lbTableWrapper');
    if (!wrapper) return;
    if (rows.length === 0) { wrapper.innerHTML = ''; return; }

    const valueHead = lbBoard === 'speedrun' ? 'BEST TIME' : 'SUMMITS';
    let html = `
        <table class="lb-table">
            <thead>
                <tr>
                    <th>RANK</th>
                    <th>PLAYER</th>
                    <th>${valueHead}</th>
                </tr>
            </thead>
            <tbody>
    `;
    rows.forEach(row => {
        const name = lbPlayerName(row);
        html += `
            <tr>
                <td class="td-rank">#${row.rank}</td>
                <td class="td-player">
                    <span class="lb-row-avatar" data-uid="${row.user_id}"></span>
                    ${escapeHtmlLb(name)}
                </td>
                <td class="td-time">${escapeHtmlLb(lbValueLabel(row))}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    wrapper.innerHTML = html;
}

// Pull Roblox avatars for everyone shown, in one batch
async function loadLeaderboardAvatars(players) {
    // Only real Roblox accounts have positive IDs. Legacy/seed rows use
    // negative IDs, so we skip them to avoid breaking the avatar batch call.
    const ids = players.map(p => p.user_id).filter(id => id && id > 0);
    if (ids.length === 0) return;
    try {
        const url = `${WORKER_API}/api/roblox/avatars?userIds=${ids.join(',')}&size=150x150`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const byId = {};
        (json.data || []).forEach(item => {
            if (item.state === 'Completed' && item.imageUrl) byId[item.targetId] = item.imageUrl;
        });
        document.querySelectorAll('.lb-podium-avatar[data-uid], .lb-row-avatar[data-uid]').forEach(el => {
            const uid = Number(el.getAttribute('data-uid'));
            const img = byId[uid];
            if (!img) return;
            el.style.backgroundImage = `url("${img}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            if (el.classList.contains('lb-podium-avatar')) el.innerHTML = '';
        });
    } catch (err) {
        console.warn('[leaderboard avatars] failed:', err);
    }
}

function showLeaderboardEmpty(show, message) {
    const empty = document.getElementById('lbEmpty');
    const podium = document.getElementById('lbPodium');
    const table = document.getElementById('lbTableWrapper');
    if (empty) {
        empty.style.display = show ? 'block' : 'none';
        if (show && message) {
            const p = empty.querySelector('p');
            if (p) p.textContent = message;
        }
    }
    if (podium) podium.style.display = show ? 'none' : '';
    if (table) table.style.display = show ? 'none' : '';
}

function escapeHtmlLb(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[c]));
}

// Leaderboard tab switching
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.getElementById('leaderboardTabs');
    if (tabs) {
        tabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.lb-filter');
            if (!btn) return;
            const board = btn.getAttribute('data-board');
            if (!board || board === lbBoard) return;
            tabs.querySelectorAll('.lb-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            lbBoard = board;
            loadLeaderboardBoard(board);
        });
    }

    const maps = document.getElementById('leaderboardMaps');
    if (maps) {
        maps.addEventListener('click', (e) => {
            const btn = e.target.closest('.lb-map');
            if (!btn) return;
            const map = btn.getAttribute('data-map');
            if (!map || map === lbMap) return;
            maps.querySelectorAll('.lb-map').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            lbMap = map;
            loadLeaderboardBoard(lbBoard);
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
            <div class="mk-stat"><div class="mk-stat-value" data-stat-key="media-kit-discord-members">${audience.discordMembers || '—'}</div><div class="mk-stat-label">DISCORD</div></div>
            <div class="mk-stat"><div class="mk-stat-value" data-stat-key="media-kit-community-members">${audience.robloxGroupMembers || '—'}</div><div class="mk-stat-label">COMMUNITY MEMBERS</div></div>
            <div class="mk-stat"><div class="mk-stat-value">${audience.totalEventsHosted || '—'}</div><div class="mk-stat-label">EVENTS HOSTED</div></div>
            <div class="mk-stat"><div class="mk-stat-value">${audience.averageEventParticipants || '—'}</div><div class="mk-stat-label">AVG PLAYERS</div></div>
        </div>
    `;
    syncMediaKitDiscordStat(el);
    syncMediaKitCommunityStat(el);
}

async function syncMediaKitDiscordStat(root = document) {
    const discordStat = root.querySelector('[data-stat-key="media-kit-discord-members"]');
    if (!discordStat) return;

    try {
        const data = await loadDiscordStats();
        const memberCount = Number(data.memberCount);
        if (!Number.isFinite(memberCount)) return;
        discordStat.textContent = memberCount.toLocaleString();
    } catch (error) {
        console.warn('Media kit Discord stat fallback:', error);
    }
}

async function syncMediaKitCommunityStat(root = document) {
    const communityStat = root.querySelector('[data-stat-key="media-kit-community-members"]');
    if (!communityStat) return;

    try {
        const data = await loadRobloxCommunityStats();
        const memberCount = Number(data.memberCount);
        if (!Number.isFinite(memberCount)) return;
        communityStat.textContent = memberCount.toLocaleString();
    } catch (error) {
        console.warn('Media kit community stat fallback:', error);
    }
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
    // Sponsor packages archived — intentionally hidden
    const el = document.getElementById('mkPackages');
    if (el) el.innerHTML = '';
}

function renderMkAssets(data) {
    const el = document.getElementById('mkAssets');
    if (!el) return;

    el.innerHTML = `
        <h3>BRAND <span class="accent-text">ASSETS</span></h3>
        <div class="mk-assets-banner">
            <img src="images/brand-assets.png" alt="PYTHAS Brand Assets" loading="lazy">
        </div>
    `;
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
    initDiscordMemberStat();
    initCommunityMemberStat();
    initHeroOngoingEvent();
    renderEvents();
    renderLeaderboard();
    renderMediaKit();
    renderPartners();
});

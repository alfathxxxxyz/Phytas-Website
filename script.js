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



// 3D Cube - drag to rotate with velocity/momentum
const cube3d = document.getElementById('cube3d');
const scene3d = document.getElementById('hero3d');

if (cube3d && scene3d) {
    let rotX = -15, rotY = 25;
    let velX = 0, velY = 0.3; // initial slow auto-spin
    let isDragging = false;
    let lastMouseX = 0, lastMouseY = 0;
    const friction = 0.97; // momentum decay

    // Animation loop - always running
    function animateCube() {
        if (!isDragging) {
            rotX += velX;
            rotY += velY;
            velX *= friction;
            velY *= friction;

            // Keep a minimum slow spin if velocity is too low
            if (Math.abs(velY) < 0.05 && Math.abs(velX) < 0.05) {
                velY = 0.15;
            }
        }
        cube3d.style.animation = 'none';
        cube3d.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        requestAnimationFrame(animateCube);
    }
    animateCube();

    // Mouse down = start drag
    scene3d.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        velX = 0;
        velY = 0;
        scene3d.style.cursor = 'grabbing';
    });

    // Mouse move = rotate cube while dragging
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        rotY += dx * 0.5;
        rotX -= dy * 0.3;
        velY = dx * 0.3;
        velX = -dy * 0.2;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    // Mouse up = release with velocity
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            scene3d.style.cursor = 'grab';
        }
    });

    // Touch support
    scene3d.addEventListener('touchstart', (e) => {
        isDragging = true;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
        velX = 0;
        velY = 0;
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - lastMouseX;
        const dy = e.touches[0].clientY - lastMouseY;
        rotY += dx * 0.5;
        rotX -= dy * 0.3;
        velY = dx * 0.3;
        velX = -dy * 0.2;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });
}

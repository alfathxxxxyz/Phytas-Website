/* ========================================
   PHYTAS COMMUNITY - TAB-BASED NAVIGATION
   ======================================== */

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



// ========== SECTION PROGRESS INDICATOR ==========
const navProgress = document.getElementById('navProgress');
const allNavSections = ['hero', 'stats', 'announcements', 'games', 'events', 'halloffame', 'community', 'moments', 'shop', 'partners', 'contact'];

function updateProgressBar(sectionId) {
    if (!navProgress) return;
    const idx = allNavSections.indexOf(sectionId);
    if (idx === -1) return;
    const progress = ((idx + 1) / allNavSections.length) * 100;
    navProgress.style.width = progress + '%';
}

// Hook into showSection to update progress
const originalShowSection = showSection;
showSection = function(targetId, skipAnimation) {
    originalShowSection(targetId, skipAnimation);
    updateProgressBar(targetId);
};

// Initialize progress for current section
updateProgressBar('hero');


// ========== ARCADE PARTICLE EFFECTS ==========
(function() {
    const canvas = document.createElement('canvas');
    canvas.id = 'arcadeParticles';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;opacity:0.3;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const maxParticles = 35;

    for (let i = 0; i < maxParticles; i++) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 2 + 0.5,
            speedX: (Math.random() - 0.5) * 0.3,
            speedY: (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.5 + 0.2,
            color: Math.random() > 0.7 ? '#FF0080' : '#AAFF00'
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;

            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            ctx.beginPath();
            ctx.rect(p.x, p.y, p.size, p.size);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.fill();
        });

        // Draw faint connecting lines between close particles
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = particles[i].color;
                    ctx.globalAlpha = 0.08 * (1 - dist / 120);
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        ctx.globalAlpha = 1;
        requestAnimationFrame(animate);
    }
    animate();
})();

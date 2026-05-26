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
        }
    });
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

// Initialize: show hero section by default on page load
document.addEventListener('DOMContentLoaded', () => {
    sections.forEach(section => {
        if (!section.classList.contains('section-active')) {
            section.style.display = 'none';
        }
    });
});


// ========== MOBILE HAMBURGER TOGGLE ==========
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
    hamburger.classList.toggle('active');
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



// 3D Cube interactive with cursor
const cube3d = document.getElementById('cube3d');
const scene3d = document.getElementById('hero3d');

if (cube3d && scene3d) {
    let rotX = -15, rotY = 25;
    let autoRotate = true;
    let autoRotateId = null;

    // Auto rotate slowly
    function startAutoRotate() {
        autoRotate = true;
        autoRotateId = setInterval(() => {
            if (autoRotate) {
                rotY += 0.3;
                cube3d.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
            }
        }, 30);
    }

    startAutoRotate();

    // Mouse move on scene = control cube rotation
    scene3d.addEventListener('mousemove', (e) => {
        autoRotate = false;
        const rect = scene3d.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        rotY = x * 0.4;
        rotX = -y * 0.3;
        cube3d.style.animation = 'none';
        cube3d.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });

    // Mouse leave = resume auto rotate
    scene3d.addEventListener('mouseleave', () => {
        autoRotate = true;
        cube3d.style.animation = '';
    });
}

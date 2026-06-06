import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ========== THREE.JS HERO 3D — PYTHAS LOGO FLAT PLANE ==========
// Loads the logo PNG onto a flat plane and rotates it in 3D space.

function initHero3D() {
    const canvas = document.getElementById('hero3dCanvas');
    const container = document.getElementById('hero3d');

    if (!canvas || !container) {
        console.error('[Hero3D] Canvas or container not found');
        return;
    }

    const containerWidth = container.clientWidth || 350;
    const containerHeight = container.clientHeight || 350;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.01, 1000);
    camera.position.set(0, 0, 6);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.0);
    frontLight.position.set(0, 0, 5);
    scene.add(frontLight);

    // Orbit Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.5;
    controls.target.set(0, 0, 0);

    // Load logo texture
    const textureLoader = new THREE.TextureLoader();
    const logoPath = new URL('images/7bb28f56-fd57-488b-b9a1-768a7e414531', window.location.href).href;

    textureLoader.load(
        logoPath,
        (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;

            // Get aspect ratio from loaded image
            const imgWidth = texture.image.width;
            const imgHeight = texture.image.height;
            const aspect = imgWidth / imgHeight;

            // Create plane with correct aspect ratio
            const planeHeight = 4.0;
            const planeWidth = planeHeight * aspect;
            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

            // Material with transparency
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                alphaTest: 0.1
            });

            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
        },
        undefined,
        (error) => {
            console.error('[Hero3D] Failed to load logo texture:', error);
        }
    );

    // Animation loop with floating
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        // Subtle floating
        scene.children.forEach(child => {
            if (child.isMesh) {
                child.position.y = Math.sin(time) * 0.1;
            }
        });

        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    function onResize() {
        const w = container.clientWidth || 350;
        const h = container.clientHeight || 350;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);
    new ResizeObserver(onResize).observe(container);
}

// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
} else {
    initHero3D();
}

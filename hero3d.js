import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ========== THREE.JS HERO 3D MODEL ==========
function initHero3D() {
    const canvas = document.getElementById('hero3dCanvas');
    const container = document.getElementById('hero3d');

    if (!canvas || !container) return;

    // Make sure container has actual dimensions
    const containerWidth = container.clientWidth || 300;
    const containerHeight = container.clientHeight || 300;

    // Scene
    const scene = new THREE.Scene();

    // Camera - closer to catch small models
    const camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.01, 1000);
    camera.position.set(0, 0, 3);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;

    // Lighting - strong neon/dark theme friendly
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xAAFF00, 2.0); // accent green
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7B2FFF, 1.2); // purple fill
    fillLight.position.set(-3, 1, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xFF00AA, 1.0); // magenta rim
    rimLight.position.set(0, -2, -3);
    scene.add(rimLight);

    // Extra point light for glow effect
    const pointLight = new THREE.PointLight(0xAAFF00, 1.5, 10);
    pointLight.position.set(0, 2, 2);
    scene.add(pointLight);

    // Orbit Controls (drag to rotate)
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    // Load GLB model
    const loader = new GLTFLoader();

    loader.load(
        'models/untitled.glb',
        (gltf) => {
            const model = gltf.scene;

            // Center and scale the model to fit the viewport
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            // Scale model to fit nicely (fill ~2 units)
            const scale = 2.0 / maxDim;
            model.scale.setScalar(scale);

            // Re-center after scaling
            const scaledBox = new THREE.Box3().setFromObject(model);
            const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
            model.position.sub(scaledCenter);

            // If model has no materials, add a default neon material
            model.traverse((child) => {
                if (child.isMesh) {
                    if (!child.material || (child.material.color && child.material.color.getHex() === 0xffffff && !child.material.map)) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x222222,
                            metalness: 0.7,
                            roughness: 0.3,
                            emissive: 0xAAFF00,
                            emissiveIntensity: 0.1
                        });
                    }
                    // Enable shadows and ensure visibility
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(model);

            // Adjust camera distance based on model size
            const distance = maxDim * 2.5;
            camera.position.set(0, 0, Math.max(distance, 3));
            controls.update();

            console.log('[Hero3D] Model loaded successfully. Size:', size);
        },
        (progress) => {
            if (progress.total > 0) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                console.log(`[Hero3D] Loading: ${pct}%`);
            }
        },
        (error) => {
            console.error('[Hero3D] Failed to load model:', error);
        }
    );

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    function onResize() {
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 300;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    window.addEventListener('resize', onResize);

    // Watch for container visibility changes (tab switching)
    const observer = new ResizeObserver(() => {
        onResize();
    });
    observer.observe(container);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
} else {
    initHero3D();
}

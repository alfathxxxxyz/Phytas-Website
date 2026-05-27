import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ========== THREE.JS HERO 3D MODEL ==========
function initHero3D() {
    const canvas = document.getElementById('hero3dCanvas');
    const container = document.getElementById('hero3d');

    if (!canvas || !container) return;

    const containerWidth = container.clientWidth || 350;
    const containerHeight = container.clientHeight || 350;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.01, 1000);
    camera.position.set(0, 1, 8);

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

    // Lighting - strong neon
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xAAFF00, 2.5);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7B2FFF, 1.5);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xFF00AA, 1.5);
    rimLight.position.set(0, -3, -4);
    scene.add(rimLight);

    const pointLight = new THREE.PointLight(0xFFFFFF, 2, 20);
    pointLight.position.set(0, 3, 5);
    scene.add(pointLight);

    // Orbit Controls
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

            // Remove the shadow plane (first node "plain light background shadow plane")
            const toRemove = [];
            model.traverse((child) => {
                if (child.name && child.name.toLowerCase().includes('shadow plane')) {
                    toRemove.push(child);
                }
                if (child.name && child.name.toLowerCase().includes('background')) {
                    toRemove.push(child);
                }
            });
            toRemove.forEach(obj => {
                if (obj.parent) obj.parent.remove(obj);
            });

            // Replace transparent/transmission materials with solid neon materials
            // since Three.js doesn't handle KHR_materials_transmission well without env maps
            model.traverse((child) => {
                if (child.isMesh) {
                    const matName = child.material ? child.material.name : '';

                    if (matName.toLowerCase().includes('magenta') || matName.toLowerCase().includes('front')) {
                        // Saturated magenta acrylic - make it solid neon magenta
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xFF0066,
                            metalness: 0.3,
                            roughness: 0.15,
                            emissive: 0xFF0066,
                            emissiveIntensity: 0.3,
                            side: THREE.DoubleSide
                        });
                    } else if (matName.toLowerCase().includes('pink') || matName.toLowerCase().includes('glass') || matName.toLowerCase().includes('bevel')) {
                        // Hot pink glass bevel - semi-transparent pink
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xFF3399,
                            metalness: 0.2,
                            roughness: 0.1,
                            emissive: 0xFF0080,
                            emissiveIntensity: 0.2,
                            transparent: true,
                            opacity: 0.75,
                            side: THREE.DoubleSide
                        });
                    } else if (matName.toLowerCase().includes('plain') || matName.toLowerCase().includes('studio')) {
                        // Remove studio background material entirely
                        child.visible = false;
                    }

                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Center and scale the model (after removing plane)
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            const scale = 3.0 / maxDim;
            model.scale.setScalar(scale);

            // Re-center
            const scaledBox = new THREE.Box3().setFromObject(model);
            const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
            model.position.sub(scaledCenter);

            scene.add(model);

            // Position camera to see model
            camera.position.set(0, 0.5, 5);
            controls.target.set(0, 0, 0);
            controls.update();

            console.log('[Hero3D] Model loaded. Meshes visible.');
        },
        undefined,
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
        const width = container.clientWidth || 350;
        const height = container.clientHeight || 350;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(() => onResize());
    observer.observe(container);
}

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
} else {
    initHero3D();
}

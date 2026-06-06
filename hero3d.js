import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ========== THREE.JS HERO 3D MODEL ==========
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
    camera.position.set(0, 0.5, 9);

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

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const keyLight = new THREE.DirectionalLight(0xFF0080, 2.5);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xFF69B4, 1.5);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xFFFFFF, 1.5);
    rimLight.position.set(0, -3, -4);
    scene.add(rimLight);

    scene.add(new THREE.PointLight(0xFF0080, 2, 20));

    // Orbit Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.target.set(0, 0, 0);

    // Resolve model path relative to the HTML file
    const modelPath = new URL('models/untitled.glb', window.location.href).href;

    // Load GLB model
    const loader = new GLTFLoader();

    loader.load(
        modelPath,
        (gltf) => {
            const model = gltf.scene;

            // Remove shadow plane / background objects
            const toRemove = [];
            model.traverse((child) => {
                if (child.name && (child.name.toLowerCase().includes('plane') || child.name.toLowerCase().includes('background'))) {
                    toRemove.push(child);
                }
            });
            toRemove.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });

            // Force all remaining meshes to use visible solid materials
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshPhongMaterial({
                        color: 0xFF0080,
                        emissive: 0xFF0080,
                        emissiveIntensity: 0.4,
                        shininess: 100,
                        specular: 0xFFFFFF,
                        side: THREE.DoubleSide,
                        transparent: false
                    });
                    child.visible = true;
                    child.frustumCulled = false;
                }
            });

            // Center and scale
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            if (maxDim > 0) {
                const scale = 6.25 / maxDim;
                model.scale.setScalar(scale);
                const newBox = new THREE.Box3().setFromObject(model);
                const newCenter = newBox.getCenter(new THREE.Vector3());
                model.position.sub(newCenter);
            }

            scene.add(model);
            controls.update();
        },
        undefined,
        (error) => {
            console.error('[Hero3D] LOAD ERROR:', error);
            // Fallback: show a simple rotating cube
            const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
            const mat = new THREE.MeshPhongMaterial({
                color: 0xFF0080,
                emissive: 0xFF0080,
                emissiveIntensity: 0.3,
                wireframe: false
            });
            const cube = new THREE.Mesh(geo, mat);
            scene.add(cube);

            const wire = new THREE.LineSegments(
                new THREE.EdgesGeometry(geo),
                new THREE.LineBasicMaterial({ color: 0xFF69B4 })
            );
            scene.add(wire);
        }
    );

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
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

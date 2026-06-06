import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ========== THREE.JS HERO 3D — PYTHAS "P" LOGO ==========
// Procedurally generated from the new racing-style P logo shape.

function createPythasLogo() {
    // Outer shape of the logo — traced from the new P mark
    // Coordinate space: roughly 0-10 width, 0-12 height, origin bottom-left
    const outer = new THREE.Shape();

    // Start from top-left area, go clockwise
    // Top edge (the flat top of the P with slight angle)
    outer.moveTo(1.2, 11.0);
    outer.lineTo(8.2, 11.0);
    // Top-right rounded corner into right side
    outer.quadraticCurveTo(9.8, 11.0, 10.0, 9.8);
    // Right side going down
    outer.lineTo(9.6, 8.0);
    outer.quadraticCurveTo(9.4, 7.0, 8.8, 6.2);
    // The sharp inward cut (where the P's counter starts from right)
    outer.lineTo(7.0, 5.8);
    // Sharp point going down-right to bottom-right area
    outer.lineTo(6.5, 4.5);
    // The dramatic spike going down to bottom point
    outer.lineTo(5.0, 1.5);
    outer.lineTo(3.8, 0.0);
    // Bottom spike tip
    outer.lineTo(3.2, 0.8);
    // Left side going back up — the straight left edge
    outer.lineTo(2.0, 4.0);
    outer.lineTo(1.0, 7.0);
    // Left side top
    outer.lineTo(0.5, 9.5);
    outer.quadraticCurveTo(0.4, 10.5, 1.2, 11.0);

    // Inner cutout (the hole in the P) — counter-clockwise for hole
    const hole = new THREE.Path();
    hole.moveTo(4.5, 9.2);
    hole.lineTo(7.0, 9.2);
    hole.quadraticCurveTo(7.8, 9.1, 7.8, 8.3);
    hole.lineTo(7.5, 7.2);
    hole.quadraticCurveTo(7.3, 6.8, 6.6, 6.6);
    // Sharp inner point
    hole.lineTo(5.2, 6.8);
    hole.lineTo(4.0, 7.5);
    hole.lineTo(3.8, 8.5);
    hole.quadraticCurveTo(3.9, 9.2, 4.5, 9.2);

    outer.holes.push(hole);

    return outer;
}

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

    // Lighting — pink/magenta theme matching new logo
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    const keyLight = new THREE.DirectionalLight(0xFF0080, 3.0);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xFF69B4, 1.5);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xFFFFFF, 1.2);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    const topLight = new THREE.PointLight(0xFF0080, 2, 20);
    topLight.position.set(0, 5, 3);
    scene.add(topLight);

    // Orbit Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.target.set(0, 0, 0);

    // Create the extruded P logo
    const logoShape = createPythasLogo();

    const extrudeSettings = {
        depth: 1.2,
        bevelEnabled: true,
        bevelThickness: 0.15,
        bevelSize: 0.1,
        bevelOffset: 0,
        bevelSegments: 3
    };

    const geometry = new THREE.ExtrudeGeometry(logoShape, extrudeSettings);

    // Material — glossy magenta/pink
    const material = new THREE.MeshPhongMaterial({
        color: 0xFF0080,
        emissive: 0xFF0080,
        emissiveIntensity: 0.25,
        shininess: 120,
        specular: 0xFFFFFF,
        side: THREE.DoubleSide,
        transparent: false
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Center the geometry
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Scale to fit nicely in the scene
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 5.5 / maxDim;
    mesh.scale.setScalar(scale);

    // Center the mesh
    mesh.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    // Wrap in group for easier rotation
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);

    // Add subtle wireframe edge glow
    const edges = new THREE.EdgesGeometry(geometry, 30);
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0xFF69B4,
        transparent: true,
        opacity: 0.4
    });
    const edgeMesh = new THREE.LineSegments(edges, edgeMaterial);
    edgeMesh.scale.copy(mesh.scale);
    edgeMesh.position.copy(mesh.position);
    group.add(edgeMesh);

    // Animation loop with gentle floating motion
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        // Subtle floating
        group.position.y = Math.sin(time) * 0.15;

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

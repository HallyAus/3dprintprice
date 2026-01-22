'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

interface ModelViewerProps {
  downloadUrl: string;
}

export function ModelViewer({ downloadUrl }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
    camera.position.set(150, 150, 150);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(100, 100, 100);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-100, -100, -100);
    scene.add(directionalLight2);

    // Grid
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x333333);
    scene.add(gridHelper);

    // Animation loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Load STL
    const loader = new STLLoader();
    fetch(downloadUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        const geometry = loader.parse(buffer);

        // Center geometry
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!;
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Create mesh
        const material = new THREE.MeshPhongMaterial({
          color: 0x2563eb,
          specular: 0x111111,
          shininess: 50,
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Position on grid
        const minY = boundingBox.min.y - center.y;
        mesh.position.y = -minY;
        mesh.rotation.x = -Math.PI / 2;

        scene.add(mesh);

        // Adjust camera
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = 50 * (Math.PI / 180);
        const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

        camera.position.set(cameraDistance, cameraDistance, cameraDistance);
        camera.lookAt(0, size.z / 2, 0);
        controls.update();
      })
      .catch((err) => {
        console.error('Failed to load model:', err);
      });

    // Resize handler
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [downloadUrl]);

  return <div ref={containerRef} className="model-viewer" />;
}

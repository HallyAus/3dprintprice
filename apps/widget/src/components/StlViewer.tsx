import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

interface StlViewerProps {
  file: File;
  onDimensionsLoaded?: (dimensions: { x: number; y: number; z: number }) => void;
}

export function StlViewer({ file, onDimensionsLoaded }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number | null>(null);

  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
    camera.position.set(150, 150, 150);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(100, 100, 100);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-100, -100, -100);
    scene.add(directionalLight2);

    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x333333);
    gridHelper.rotation.x = 0;
    scene.add(gridHelper);

    // Animation loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  const loadSTL = useCallback(async (file: File) => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // Remove existing model
    const existingModel = scene.getObjectByName('stl-model');
    if (existingModel) {
      scene.remove(existingModel);
    }

    const loader = new STLLoader();

    try {
      const buffer = await file.arrayBuffer();
      const geometry = loader.parse(buffer);

      // Center geometry
      geometry.computeBoundingBox();
      const boundingBox = geometry.boundingBox!;
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      // Calculate dimensions
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      // Report dimensions
      if (onDimensionsLoaded) {
        onDimensionsLoaded({
          x: Math.round(size.x * 100) / 100,
          y: Math.round(size.y * 100) / 100,
          z: Math.round(size.z * 100) / 100,
        });
      }

      // Create mesh with material
      const material = new THREE.MeshPhongMaterial({
        color: 0x2563eb,
        specular: 0x111111,
        shininess: 50,
        flatShading: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'stl-model';

      // Move model so it sits on the grid
      const minY = boundingBox.min.y - center.y;
      mesh.position.y = -minY;

      // Rotate to Z-up if needed (STL files are often Z-up)
      mesh.rotation.x = -Math.PI / 2;

      scene.add(mesh);

      // Adjust camera to fit model
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = 50 * (Math.PI / 180);
      const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

      const camera = controlsRef.current?.object as THREE.PerspectiveCamera;
      if (camera) {
        camera.position.set(cameraDistance, cameraDistance, cameraDistance);
        camera.lookAt(0, size.z / 2, 0);
        controlsRef.current?.update();
      }
    } catch (error) {
      console.error('Failed to load STL:', error);
    }
  }, [onDimensionsLoaded]);

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);

  useEffect(() => {
    if (file) {
      loadSTL(file);
    }
  }, [file, loadSTL]);

  return (
    <div ref={containerRef} className="pf-viewer" />
  );
}

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function ThreeParticles() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 30;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create a procedural glowing circular particle texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const gradient = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.9)'); // Sky blue primary
      gradient.addColorStop(0.3, 'rgba(14, 165, 233, 0.5)'); // Slightly deeper blue
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      pCtx.fillStyle = gradient;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.CanvasTexture(pCanvas);

    // Geometry
    const count = 350;
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Position
      positions[i * 3 + 0] = (Math.random() - 0.5) * 80; // X
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60; // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60; // Z

      // Random speed/direction variables
      randoms[i * 3 + 0] = Math.random(); // speed factor
      randoms[i * 3 + 1] = Math.random(); // swing speed
      randoms[i * 3 + 2] = Math.random(); // scale
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Material
    const material = new THREE.PointsMaterial({
      size: 1.2, // Slightly larger size for visibility
      map: particleTexture,
      transparent: true,
      blending: THREE.NormalBlending, // Normal blending for light theme
      depthWrite: false,
      opacity: 0.5, // Subtle opacity
    });

    // Points
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Mouse movement interaction variables
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - window.innerWidth / 2) / 100;
      mouseY = (e.clientY - window.innerHeight / 2) / 100;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const positionsArray = geometry.attributes.position.array as Float32Array;

      // Animate particles (drift upwards and side-to-side)
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const speed = randoms[i3 + 0] * 0.05 + 0.01;
        const swing = randoms[i3 + 1] * 0.5 + 0.1;

        // Move up
        positionsArray[i3 + 1] += speed;

        // Oscillate left-right
        positionsArray[i3 + 0] += Math.sin(elapsedTime * swing + randoms[i3 + 2] * 10) * 0.01;

        // If particle moves too high, reset to bottom
        if (positionsArray[i3 + 1] > 35) {
          positionsArray[i3 + 1] = -35;
          positionsArray[i3 + 0] = (Math.random() - 0.5) * 80;
        }
      }
      geometry.attributes.position.needsUpdate = true;

      // Parallax effect on mouse movement
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      points.rotation.y = targetX * 0.2 + elapsedTime * 0.01;
      points.rotation.x = -targetY * 0.2;

      renderer.render(scene, camera);
    };

    animate();

    // Clean up
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      particleTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden" 
    />
  );
}

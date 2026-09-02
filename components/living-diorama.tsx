'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

type Focus = { x: number; y: number };
type DioramaMode = 'living' | 'still';

export function LivingDiorama({ src, alt, focus, onModeChange }: { src: string; alt: string; focus: Focus; onModeChange?: (mode: DioramaMode) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(focus);

  useEffect(() => { focusRef.current = focus; }, [focus]);

  useEffect(() => {
    const host = hostRef.current;
    onModeChange?.('still');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = window.matchMedia('(max-width: 719px)').matches;
    const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const lowPower = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4;
    if (!host || reducedMotion || compact || !precisePointer || lowPower || !document.createElement('canvas').getContext('webgl2')) return;

    let disposed = false;
    let frame = 0;
    let cleanup = () => {};

    void import('three').then((THREE) => {
      if (disposed || !hostRef.current) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, 0.1, 100);
      camera.position.set(0, 0, 5.4);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.setClearColor('#0d0d0a', 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.className = 'diorama-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight('#f6d7b0', 1.8));
      const spot = new THREE.SpotLight('#ffad73', 10, 16, Math.PI / 5, 0.8, 1.3);
      spot.position.set(-2.6, 3.4, 5); scene.add(spot);

      let textureReady = false;
      let firstFrameReady = false;
      const texture = new THREE.TextureLoader().load(src, (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        const ratio = loaded.image.width / loaded.image.height;
        const width = ratio >= 1 ? 4.8 : 4.8 * ratio;
        const height = ratio >= 1 ? 4.8 / ratio : 4.8;
        artwork.scale.set(width, height, 1);
        textureReady = true;
      }, undefined, () => onModeChange?.('still'));
      texture.colorSpace = THREE.SRGBColorSpace;
      const artwork = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1, 24, 24),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0.02 }),
      );
      artwork.position.z = 0; scene.add(artwork);

      const dustGeometry = new THREE.BufferGeometry();
      const dust = new Float32Array(180 * 3);
      for (let index = 0; index < dust.length; index += 3) {
        dust[index] = (Math.random() - 0.5) * 6;
        dust[index + 1] = (Math.random() - 0.5) * 4;
        dust[index + 2] = Math.random() * 2.5 + 0.2;
      }
      dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
      const particles = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#ffd8a6', size: 0.018, transparent: true, opacity: 0.55 }));
      scene.add(particles);

      const pointer = { x: 0, y: 0 };
      const onPointer = (event: PointerEvent) => {
        const bounds = host.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      };
      const onLeave = () => { pointer.x = 0; pointer.y = 0; };
      const onResize = () => {
        if (!host.clientWidth || !host.clientHeight) return;
        camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight);
      };
      host.addEventListener('pointermove', onPointer); host.addEventListener('pointerleave', onLeave); window.addEventListener('resize', onResize);

      const startedAt = performance.now();
      let intersectsViewport = true;
      let animationRunning = false;
      const animate = () => {
        if (disposed || document.hidden || !intersectsViewport) {
          animationRunning = false;
          frame = 0;
          return;
        }
        const elapsed = (performance.now() - startedAt) / 1000;
        const active = focusRef.current;
        const focusX = (active.x / 100 - 0.5) * 0.24;
        const focusY = (0.5 - active.y / 100) * 0.18;
        camera.position.x += (pointer.x * 0.075 + focusX - camera.position.x) * 0.035;
        camera.position.y += (-pointer.y * 0.055 + focusY - camera.position.y) * 0.035;
        camera.lookAt(focusX * 0.28, focusY * 0.28, 0);
        artwork.rotation.y = pointer.x * 0.012; artwork.rotation.x = pointer.y * 0.008;
        particles.rotation.z = elapsed * 0.006; particles.position.y = Math.sin(elapsed * 0.35) * 0.025;
        renderer.render(scene, camera);
        if (textureReady && !firstFrameReady) {
          firstFrameReady = true;
          renderer.domElement.classList.add('is-ready');
          onModeChange?.('living');
        }
        frame = requestAnimationFrame(animate);
      };
      const startAnimation = () => {
        if (animationRunning || disposed || document.hidden || !intersectsViewport) return;
        animationRunning = true;
        frame = requestAnimationFrame(animate);
      };
      const stopAnimation = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        animationRunning = false;
      };
      const onVisibility = () => document.hidden ? stopAnimation() : startAnimation();
      const onContextLost = (event: Event) => {
        event.preventDefault();
        stopAnimation();
        renderer.domElement.classList.remove('is-ready');
        onModeChange?.('still');
      };
      const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
        intersectsViewport = entry?.isIntersecting ?? true;
        if (intersectsViewport) startAnimation(); else stopAnimation();
      }, { threshold: 0.05 });
      observer?.observe(host);
      document.addEventListener('visibilitychange', onVisibility);
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      startAnimation();

      cleanup = () => {
        stopAnimation();
        observer?.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        host.removeEventListener('pointermove', onPointer); host.removeEventListener('pointerleave', onLeave); window.removeEventListener('resize', onResize);
        texture.dispose(); artwork.geometry.dispose(); artwork.material.dispose(); dustGeometry.dispose(); (particles.material as InstanceType<typeof THREE.PointsMaterial>).dispose(); renderer.dispose(); renderer.domElement.remove();
      };
    }).catch(() => onModeChange?.('still'));

    return () => { disposed = true; cleanup(); };
  }, [onModeChange, src]);

  return (
    <div ref={hostRef} className="living-diorama">
      <Image className="static-render" src={src} alt={alt} fill sizes="(max-width: 860px) 100vw, 73vw" unoptimized />
    </div>
  );
}

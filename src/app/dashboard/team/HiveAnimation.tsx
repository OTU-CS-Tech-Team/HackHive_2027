'use client';
import { useEffect, useRef } from 'react';
import styles from './team.module.css';

export function HiveAnimation() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let teardown = () => {};
    void import('three').then(THREE => {
      if (disposed) return;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
      if (!context) return; // Keep the static honeycomb when WebGL is unavailable.
      const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 2), 3));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-3.7, 3.7, 2, -2, .1, 30);
      camera.position.z = 12;
      scene.add(new THREE.AmbientLight(0xffedc6, 2));
      const light = new THREE.DirectionalLight(0xffe0a0, 5); light.position.set(2, 4, 8); scene.add(light);
      const glint = new THREE.PointLight(0xfff4d6, 16, 12, 2);
      glint.position.set(-3, 1.8, 3); scene.add(glint);
      const hive = new THREE.Group(); scene.add(hive);
      const shape = new THREE.Shape(); const hole = new THREE.Path();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 6 + i * Math.PI / 3;
        const innerAngle = Math.PI / 6 - i * Math.PI / 3;
        if (!i) { shape.moveTo(Math.cos(angle) * .7, Math.sin(angle) * .7); hole.moveTo(Math.cos(innerAngle) * .56, Math.sin(innerAngle) * .56); }
        else { shape.lineTo(Math.cos(angle) * .7, Math.sin(angle) * .7); hole.lineTo(Math.cos(innerAngle) * .56, Math.sin(innerAngle) * .56); }
      }
      shape.closePath(); hole.closePath(); shape.holes.push(hole);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .24, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .025, bevelThickness: .025 });
      const cells: { x: number; material: import('three').MeshStandardMaterial }[] = [];
      const locations = [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
      locations.forEach(([q, r]) => {
        const material = new THREE.MeshStandardMaterial({
          color: 0xf4bc42, roughness: .2, metalness: .5,
          emissive: 0xc88a20, emissiveIntensity: .06,
        });
        const cell = new THREE.Mesh(geometry, material);
        cell.position.set(Math.sqrt(3) * .71 * (q + r / 2), 1.5 * .71 * r, 0);
        hive.add(cell);
        cells.push({ x: cell.position.x, material });
      });
      hive.scale.setScalar(.95); hive.rotation.set(.12,-.18,.02); hive.updateMatrixWorld(true);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      // A soft highlight travels across the fixed gold hexagons.
      let visible = true, frame = 0, last = 0, previous = 0, elapsed = 0;
      const draw = () => {
        const sweep = reduced.matches ? 0 : Math.sin(elapsed / 1800) * 3;
        glint.position.x = sweep;
        element.dataset.phase = reduced.matches ? 'static' : 'glistening';
        cells.forEach(({ x, material }) => {
          const highlight = Math.exp(-Math.pow(x - sweep, 2) / .45);
          material.emissiveIntensity = reduced.matches ? .06 : .04 + .28 * highlight;
        });
        renderer.render(scene, camera);
      };
      const animate = (time: number) => {
        if (previous) elapsed += Math.max(0, time - previous);
        previous = time;
        if (time - last >= 32) { draw(); last = time; }
        frame = requestAnimationFrame(animate);
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        previous = 0;
        const running = visible && !document.hidden && !reduced.matches;
        element.dataset.motion = reduced.matches ? 'reduced' : running ? 'running' : 'suspended';
        if (running) frame = requestAnimationFrame(animate);
        else draw();
      };
      const resize = new ResizeObserver(() => { const { width, height } = element.getBoundingClientRect(); if (width && height) { renderer.setSize(width, height); camera.left = -2 * width / height; camera.right = 2 * width / height; camera.updateProjectionMatrix(); draw(); } });
      const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
      element.appendChild(canvas); element.dataset.renderer = 'three';
      resize.observe(element); observer.observe(element); reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync); draw(); sync();
      teardown = () => {
        cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
        geometry.dispose(); cells.forEach(cell => cell.material.dispose()); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); element.dataset.renderer = 'fallback';
      };
    }).catch(() => { /* The static fallback keeps discovery usable if 3D cannot load. */ });
    return () => { disposed = true; teardown(); };
  }, []);
  return <div className={styles.hiveAnimation}>
    <div ref={host} className={styles.hiveScene} data-renderer="fallback" aria-hidden="true">
      <svg viewBox="0 0 230 140" fill="none"><path d="M58 6 88 23V57L58 74 28 57V23ZM118 6 148 23V57L118 74 88 57V23ZM178 6 208 23V57L178 74 148 57V23ZM88 57 118 74V108L88 125 58 108V74ZM148 57 178 74V108L148 125 118 108V74Z" stroke="currentColor" strokeWidth="1.5" /></svg>
    </div>
  </div>;
}

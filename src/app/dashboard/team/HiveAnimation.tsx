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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-3.7, 3.7, 2, -2, .1, 30);
      camera.position.z = 12;
      scene.add(new THREE.AmbientLight(0xffedc6, 2));
      const light = new THREE.DirectionalLight(0xffe0a0, 5); light.position.set(2, 4, 8); scene.add(light);
      const hive = new THREE.Group(); scene.add(hive); hive.position.x = .35;
      const shape = new THREE.Shape(); const hole = new THREE.Path();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 6 + i * Math.PI / 3;
        const innerAngle = Math.PI / 6 - i * Math.PI / 3;
        if (!i) { shape.moveTo(Math.cos(angle) * .7, Math.sin(angle) * .7); hole.moveTo(Math.cos(innerAngle) * .56, Math.sin(innerAngle) * .56); }
        else { shape.lineTo(Math.cos(angle) * .7, Math.sin(angle) * .7); hole.lineTo(Math.cos(innerAngle) * .56, Math.sin(innerAngle) * .56); }
      }
      shape.closePath(); hole.closePath(); shape.holes.push(hole);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .24, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025 });
      const wax = new THREE.MeshStandardMaterial({ color: 0xf4bc42, roughness: .32, metalness: .28 });
      const honey = new THREE.MeshStandardMaterial({ color: 0xd88b0b, roughness: .2, metalness: .35 });
      const fill = new THREE.CylinderGeometry(.55, .55, .07, 6); fill.rotateX(Math.PI / 2); fill.rotateZ(Math.PI / 6);
      const cells: import('three').Mesh[] = [], nectarCells: import('three').Mesh[] = [];
      [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].forEach(([q, r], i) => {
        const cell = new THREE.Mesh(geometry, wax); cell.position.set(Math.sqrt(3) * .71 * (q + r / 2), 1.5 * .71 * r, 0); hive.add(cell); cells.push(cell);
        if (i % 2 === 0) { const nectar = new THREE.Mesh(fill, honey); nectar.position.copy(cell.position); nectar.position.z = .04; hive.add(nectar); nectarCells.push(nectar); }
      });
      const bee = new THREE.Group(); scene.add(bee);
      const sphere = new THREE.SphereGeometry(1, 16, 10);
      const black = new THREE.MeshStandardMaterial({ color: 0x272115, roughness: .55 });
      const body = new THREE.Mesh(sphere, wax); body.scale.set(.36, .23, .22); bee.add(body);
      const head = new THREE.Mesh(sphere, black); head.scale.setScalar(.15); head.position.x = .3; bee.add(head);
      const stripeGeometry = new THREE.TorusGeometry(.215, .035, 6, 24);
      [-.14, .02].forEach(x => { const stripe = new THREE.Mesh(stripeGeometry, black); stripe.rotation.y = Math.PI / 2; stripe.position.x = x; bee.add(stripe); });
      const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xfff8dc, transparent: true, opacity: .7, roughness: .2 });
      const wings = [-1, 1].map(side => { const wing = new THREE.Mesh(sphere, wingMaterial); wing.scale.set(.21, .34, .035); wing.position.set(-.08, side * .24, .17); wing.rotation.z = side * -.35; bee.add(wing); return wing; });
      const droplets = new THREE.Group(); scene.add(droplets);
      for (let i = 0; i < 8; i++) { const drop = new THREE.Mesh(sphere, wax); drop.scale.set(.035, .075, .035); drop.position.set(Math.cos(i * 2.4) * 2.6, Math.sin(i * 2.4) * 1.55, .3); droplets.add(drop); }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      // Short entrance animation, then a static scene: no perpetual motion or
      // pause UI. Offscreen/hidden time doesn't consume the entrance duration.
      const duration = 4200;
      let visible = true, frame = 0, last = 0, previous = 0, elapsed = 0;
      const draw = () => {
        const t = (reduced.matches ? duration : elapsed) / 1000;
        const progress = Math.min(1, t / 4.2);
        const ease = 1 - Math.pow(1 - progress, 3);
        hive.scale.setScalar(.85 + ease * .15);
        hive.rotation.set(.16 + Math.sin(t * .3) * .07, -.25 + Math.sin(t * .25) * .12, .06);
        cells.forEach((cell, i) => { cell.position.z = (1 - ease) * (.3 + i * .16); });
        nectarCells.forEach((cell, i) => { cell.scale.setScalar(.65 + Math.min(1, progress * 2 + i * .08) * .35); });
        bee.position.set(-2.1 + Math.sin(t * .6) * .48, .5 + Math.sin(t * .95) * .55, 1.3);
        bee.rotation.z = Math.sin(t * .95) * .18;
        wings.forEach((wing, i) => { wing.rotation.x = Math.sin(t * 30) * .35 * (i ? 1 : -1) * (1 - Math.pow(progress, 4)); });
        droplets.rotation.z = Math.sin(t * .2) * .08;
        renderer.render(scene, camera);
      };
      const animate = (time: number) => {
        if (previous) elapsed = Math.min(duration, elapsed + Math.max(0, time - previous));
        previous = time;
        if (time - last >= 32 || elapsed === duration) { draw(); last = time; }
        if (elapsed < duration) frame = requestAnimationFrame(animate);
        else element.dataset.motion = 'settled';
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        previous = 0;
        if (reduced.matches) elapsed = duration;
        const running = visible && !document.hidden && !reduced.matches && elapsed < duration;
        element.dataset.motion = reduced.matches ? 'reduced' : running ? 'running' : elapsed >= duration ? 'settled' : 'suspended';
        if (running) frame = requestAnimationFrame(animate);
        else draw();
      };
      const resize = new ResizeObserver(() => { const { width, height } = element.getBoundingClientRect(); if (width && height) { renderer.setSize(width, height); camera.left = -2 * width / height; camera.right = 2 * width / height; camera.updateProjectionMatrix(); draw(); } });
      const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
      element.appendChild(canvas); element.dataset.renderer = 'three';
      resize.observe(element); observer.observe(element); reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync); draw(); sync();
      teardown = () => {
        cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
        geometry.dispose(); fill.dispose(); sphere.dispose(); stripeGeometry.dispose(); wax.dispose(); honey.dispose(); black.dispose(); wingMaterial.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); element.dataset.renderer = 'fallback';
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

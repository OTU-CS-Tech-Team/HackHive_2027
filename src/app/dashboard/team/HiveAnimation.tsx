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
      const honey = new THREE.MeshStandardMaterial({ color: 0xffca32, roughness: .22, metalness: .2 });
      const fill = new THREE.CylinderGeometry(.555, .555, .1, 6); fill.rotateX(Math.PI / 2);
      const nectarCells: import('three').Mesh[] = [];
      const locations = [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
      locations.forEach(([q, r]) => {
        const cell = new THREE.Mesh(geometry, wax); cell.position.set(Math.sqrt(3) * .71 * (q + r / 2), 1.5 * .71 * r, 0); hive.add(cell);
        const nectar = new THREE.Mesh(fill, honey); nectar.position.copy(cell.position); nectar.position.z = .13; hive.add(nectar); nectarCells.push(nectar);
      });
      hive.position.set(.4, .25, 0); hive.scale.setScalar(.76);
      const sphere = new THREE.SphereGeometry(1, 16, 10);
      const black = new THREE.MeshStandardMaterial({ color: 0x272115, roughness: .55 });
      const stripeGeometry = new THREE.TorusGeometry(.215, .035, 6, 24);
      const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xfff8dc, transparent: true, opacity: .7, roughness: .2 });
      const bees = Array.from({length:8}, (_, index) => {
        const bee = new THREE.Group(); scene.add(bee);
        const body = new THREE.Mesh(sphere, wax); body.scale.set(.36, .23, .22); bee.add(body);
        const head = new THREE.Mesh(sphere, black); head.scale.setScalar(.15); head.position.x = .3; bee.add(head);
        [-.14,.02].forEach(x => { const stripe = new THREE.Mesh(stripeGeometry, black); stripe.rotation.y = Math.PI / 2; stripe.position.x = x; bee.add(stripe); });
        const wings = [-1,1].map(side => { const wing = new THREE.Mesh(sphere, wingMaterial); wing.scale.set(.21,.34,.035); wing.position.set(-.08, side * .24, .17); wing.rotation.z = side * -.35; bee.add(wing); return wing; });
        bee.scale.setScalar(.5 + (index % 3) * .06);
        return {bee,wings};
      });
      // Honey appears outside the cells only during the spill, with no ambient flecks.
      const spill = new THREE.Group(); hive.add(spill);
      const honeyRibbon = new THREE.Shape();
      honeyRibbon.moveTo(-.12,.05);
      honeyRibbon.bezierCurveTo(-.11,-.35,-.05,-.65,-.12,-.9);
      honeyRibbon.bezierCurveTo(-.27,-1.15,-.14,-1.35,.02,-1.35);
      honeyRibbon.bezierCurveTo(.26,-1.32,.23,-1.1,.12,-.9);
      honeyRibbon.bezierCurveTo(.06,-.6,.16,-.25,.12,.05);
      honeyRibbon.closePath();
      const streamGeometry = new THREE.ExtrudeGeometry(honeyRibbon, {depth:.07,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,steps:1});
      const spillMaterial = new THREE.MeshBasicMaterial({color:0xffc83f,depthTest:false});
      const streams = [-.615,.615].map(x => {
        const stream = new THREE.Mesh(streamGeometry, spillMaterial); stream.renderOrder = 3; spill.add(stream);
        const drops = Array.from({length:3}, () => { const drop = new THREE.Mesh(sphere, spillMaterial); drop.renderOrder = 3; spill.add(drop); return drop; });
        return {x,stream,drops};
      });
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      // Twelve-second story: swarm, fill, overflow, empty, and repeat.
      // Reduced motion uses a static pose; offscreen and hidden tabs suspend work.
      let visible = true, frame = 0, last = 0, previous = 0, elapsed = 0;
      const draw = () => {
        const t = reduced.matches ? 7 : elapsed / 1000;
        const phase = t % 12;
        const clamp = (value: number) => Math.max(0, Math.min(1, value));
        const approach = 1 - Math.pow(1 - clamp(phase / 2.3), 3);
        const depart = clamp((phase - 10) / 1.5);
        const drain = 1 - clamp((phase - 9.2) / 1.8);
        element.dataset.phase = phase < 2.5 ? 'swarm' : phase < 6.5 ? 'filling' : phase < 7.5 ? 'full' : phase < 8.2 ? 'overflowing' : phase < 10.5 ? 'spilling' : 'reset';
        hive.rotation.set(.1 + Math.sin(t * .3) * .035, -.17 + Math.sin(t * .25) * .07, .025);
        nectarCells.forEach((cell,i) => {
          const amount = clamp((phase - 2.4 - i * .48) / .65) * drain;
          cell.visible = amount > .005;
          cell.scale.setScalar(Math.max(.001, amount));
        });
        bees.forEach(({bee,wings},i) => {
          const angle = t * .9 + i * Math.PI / 4;
          const orbitX = .35 + Math.cos(angle) * (1.75 + (i % 2) * .35);
          const orbitY = .3 + Math.sin(angle) * (1 + (i % 3) * .16);
          bee.position.set((-3.7 - i * .12) * (1 - approach) + orbitX * approach + depart * 4, orbitY + Math.sin(t * 3 + i) * .08, 1 + (i % 3) * .15);
          bee.rotation.z = Math.sin(angle + .5) * .35;
          bee.rotation.y = Math.cos(angle) > 0 ? Math.PI : 0;
          bee.scale.setScalar((.5 + (i % 3) * .06) * (1 - depart));
          wings.forEach((wing,j) => { wing.rotation.x = reduced.matches ? 0 : Math.sin(t * 32 + i) * .45 * (j ? 1 : -1); });
        });
        spill.visible = !reduced.matches && phase >= 7.5 && phase < 11;
        streams.forEach(({x,stream,drops},i) => {
          const flow = clamp((phase - 7.5 - i * .2) / .75) * (1 - clamp((phase - 10.2) / .8));
          stream.scale.set(flow, Math.max(.001,flow), 1);
          stream.position.set(x,-1.48,.38);
          drops.forEach((drop,j) => {
            const fall = ((phase - 7.5) * .85 + j / 3 + i * .17) % 1;
            drop.position.set(x + Math.sin(fall * 4 + i) * .035, -1.62 - fall * 1.6, .4);
            drop.scale.set(.1 * flow, (.14 + fall * .08) * flow, .1 * flow);
          });
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
        geometry.dispose(); fill.dispose(); sphere.dispose(); stripeGeometry.dispose(); streamGeometry.dispose(); spillMaterial.dispose(); wax.dispose(); honey.dispose(); black.dispose(); wingMaterial.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); element.dataset.renderer = 'fallback';
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

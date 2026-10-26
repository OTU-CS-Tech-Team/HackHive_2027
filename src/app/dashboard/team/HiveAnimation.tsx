'use client';
import { useEffect, useId, useRef } from 'react';
import styles from './team.module.css';

const CELLS = [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const HEXAGONS = CELLS.map(([q, r]) => {
  const x = Math.sqrt(3) * 28.4 * (q + r / 2);
  const y = 42.6 * r;
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    return [x + Math.cos(angle) * 28, y + Math.sin(angle) * 28].join(',');
  }).join(' ');
});

export function HiveAnimation() {
  const host = useRef<HTMLDivElement>(null);
  const id = useId();
  const mask = id + '-hexagons';
  const light = id + '-light';

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const sync = () => {
      element.dataset.motion = visible && !document.hidden && !reduced.matches ? 'running' : 'paused';
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      observer.disconnect();
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  // The same geometry paints immediately and remains fixed as highlights move.
  const outlines = HEXAGONS.map((points, index) => <polygon key={index} points={points} />);
  return <div className={styles.hiveAnimation}>
    <div ref={host} className={styles.hiveScene} data-motion="paused" aria-hidden="true">
      <svg viewBox="-140 -80 280 160" fill="none" focusable="false">
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x="-140" y="-80" width="280" height="160">
            <g stroke="white" strokeWidth="1.6" strokeLinejoin="round">{outlines}</g>
          </mask>
          <linearGradient id={light}>
            <stop stopColor="#fff8df" stopOpacity="0" />
            <stop offset=".4" stopColor="#fff1bf" stopOpacity=".7" />
            <stop offset=".5" stopColor="white" />
            <stop offset=".6" stopColor="#fff1bf" stopOpacity=".7" />
            <stop offset="1" stopColor="#fff8df" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="#dba83d" strokeWidth="1.6" strokeLinejoin="round">{outlines}</g>
        <g mask={'url(#' + mask + ')'}>
          <rect className={styles.shimmerAcross} x="-22" y="-180" width="44" height="360" fill={'url(#' + light + ')'} />
          <rect className={styles.shimmerDown} x="-16" y="-180" width="32" height="360" fill={'url(#' + light + ')'} />
          <rect className={styles.shimmerOrbit} x="18" y="-180" width="26" height="360" fill={'url(#' + light + ')'} />
        </g>
      </svg>
    </div>
  </div>;
}

"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import type { ArchiveCollection } from "@/data/hackhive";
import type { HackHiveProject } from "@/types/hackhive";
import YouTubeFacade from "./YouTubeFacade";
import styles from "./museum.module.css";

const TOUR_MS = 6500;
const HUB = { x: 450, y: 400 };

function position(index: number, count: number, year: number) {
  const angle = -90 + index * 360 / count;
  const radius = [0.96, 0.83, 1.04, 0.88, 1, 0.86, 1.03, 0.9, 1.08][(index + year) % 9];
  return { x: HUB.x + Math.cos(angle * Math.PI / 180) * 350 * radius,
    y: HUB.y + Math.sin(angle * Math.PI / 180) * 295 * radius, angle };
}

function poster(project: HackHiveProject) {
  return project.thumbnail || (project.youtubeId ? `https://img.youtube.com/vi/${project.youtubeId}/hqdefault.jpg` : null);
}

export default function Constellation({ collection, number, total, active, reducedMotion }: {
  collection: ArchiveCollection; number: number; total: number; active: boolean; reducedMotion: boolean;
}) {
  const { projects, year } = collection;
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [watching, setWatching] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const project = projects[selected];
  const touring = active && !paused && !watching && !focused && !reducedMotion && projects.length > 1;
  const points = projects.map((_, index) => position(index, projects.length, year));
  const point = points[selected];

  useEffect(() => {
    if (!touring) return;
    const timer = window.setTimeout(() => setSelected(index => (index + 1) % projects.length), TOUR_MS);
    return () => window.clearTimeout(timer);
  }, [touring, selected, projects.length]);

  useEffect(() => () => { setWatching(false); setFocused(false); }, [active]);

  const select = (index: number) => {
    setSelected((index + projects.length) % projects.length);
    setPaused(true);
    setWatching(false);
    setPlaybackKey(value => value + 1);
  };

  return <div className={styles.scene} data-active={active} style={{ "--tour-duration": `${TOUR_MS}ms` } as CSSProperties}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <header className={styles.sceneHeader}>
      <h2>THE {year} CONSTELLATION</h2>
      <span>{String(number).padStart(2, "0")} <span className={styles.dim}>/ {String(total).padStart(2, "0")}</span></span>
    </header>
    {project && point ? <>
      <div className={styles.starMap}>
        <svg className={styles.mapLines} viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx={HUB.x} cy={HUB.y} rx="350" ry="295" className={styles.orbit} />
          <ellipse cx={HUB.x} cy={HUB.y} rx="240" ry="205" className={styles.orbitInner} />
          <path d={`M${HUB.x} 50V750M90 ${HUB.y}H835`} className={styles.crosslines} />
          <path d={`${points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")} Z`} className={styles.connections} />
          {points.map((p, index) => <line key={projects[index].id} x1={HUB.x} y1={HUB.y} x2={p.x} y2={p.y} className={styles.ray} />)}
          {active && <>
            <g key={`sweep-${selected}`} className={styles.sweep} style={{ "--sweep-from": `${point.angle - 360 / projects.length}deg`, "--sweep-to": `${point.angle}deg` } as CSSProperties}>
              <line x1={HUB.x} y1={HUB.y} x2={HUB.x + 350} y2={HUB.y} />
            </g>
            <line key={`ray-${selected}`} x1={HUB.x} y1={HUB.y} x2={point.x} y2={point.y} pathLength="1" className={styles.activeRay} />
          </>}
          <circle cx={HUB.x} cy={HUB.y} r="27" className={styles.hubRing} />
          <path d={`M${HUB.x - 12} ${HUB.y}h24M${HUB.x} ${HUB.y - 12}v24`} className={styles.hubCross} />
          <rect x={HUB.x - 4} y={HUB.y - 4} width="8" height="8" className={styles.hub} />
          <text x={HUB.x + 20} y={HUB.y + 5} className={styles.hubLabel}>HH / {year}</text>
        </svg>
        <div className={styles.nodes} aria-label={`${year} project stars`}>
          {projects.map((item, index) => {
            const p = points[index];
            const image = poster(item);
            return <button key={item.id} type="button" className={styles.node} aria-pressed={index === selected}
              aria-label={`Explore ${item.title}`} onClick={() => select(index)}
              style={{ left: `${p.x / 10}%`, top: `${p.y / 8}%` }}>
              <span className={styles.nodeMark}>{image ? <Image src={image} alt="" fill unoptimized sizes="40px" /> : <span className={styles.nodeSpark} />}</span>
              <span className={styles.nodeText}><span className={styles.nodeNumber}>{String(index + 1).padStart(2, "0")}</span>{item.title}</span>
            </button>;
          })}
        </div>
      </div>
      <article className={styles.preview} aria-label={`${year} featured project`}>
        <div className={styles.previewHeading}><span><span className={styles.liveDot} /> IN FOCUS</span><span>{String(selected + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span></div>
        <div key={`${project.id}-${playbackKey}`} className={styles.media}>
          {active && project.youtubeId ? <YouTubeFacade videoId={project.youtubeId} title={project.title} thumbnail={project.thumbnail} onPlay={() => setWatching(true)} />
            : poster(project) ? <Image src={poster(project)!} alt={project.title} fill unoptimized sizes="(max-width: 760px) 100vw, 360px" className={styles.poster} />
              : <div className={styles.noMedia}><span aria-hidden="true">✳</span>{project.title}</div>}
        </div>
        <div className={styles.previewBody} key={project.id}>
          {project.award && <p className={styles.award}>{project.award}</p>}
          <h3>{project.title}</h3>
          <p className={styles.description}>{project.description}</p>
          {(project.githubUrl || project.devpostUrl) && <div className={styles.projectLinks}>
            {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>}
            {project.devpostUrl && <a href={project.devpostUrl} target="_blank" rel="noopener noreferrer">View project <span aria-hidden="true">↗</span></a>}
          </div>}
        </div>
        <div className={styles.previewControls}>
          <button type="button" className={styles.tourButton} disabled={!active || (reducedMotion && !watching)} onClick={() => { setFocused(false); setPlaybackKey(value => value + 1); setWatching(false); setPaused(value => watching ? false : !value); }} aria-label={reducedMotion && !watching ? "Constellation tour paused" : watching || paused ? "Resume constellation tour" : "Pause constellation tour"}>
            <span aria-hidden="true">{watching || paused ? "▷" : "Ⅱ"}</span>{watching ? "Back to tour" : paused || reducedMotion ? "Tour paused" : "Pause tour"}
          </button>
          <div className={styles.arrows}>
            <button type="button" disabled={!active || projects.length < 2} onClick={() => select(selected - 1)} aria-label="Previous project">←</button>
            <button type="button" disabled={!active || projects.length < 2} onClick={() => select(selected + 1)} aria-label="Next project">→</button>
          </div>
        </div>
        <div className={styles.progressTrack} aria-hidden="true"><span key={`${project.id}-${touring}`} className={touring ? styles.progress : undefined} /></div>
      </article>
      <footer className={styles.sceneFooter}><span>{String(projects.length).padStart(2, "0")} PROJECTS / ONE UNFORGETTABLE WEEKEND</span><span aria-hidden="true">+ {year} +</span></footer>
    </> : <p className={styles.empty}>The next constellation is on its way.</p>}
  </div>;
}

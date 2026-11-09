"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ArchiveCollection } from "@/data/hackhive";
import type { HackHiveProject } from "@/types/hackhive";
import { clockwiseOrder, constellationFor, revealPlan, type StarPoint } from "./constellations";
import YouTubeFacade from "./YouTubeFacade";
import styles from "./museum.module.css";

const TOUR_MS = 2000;
function poster(project: HackHiveProject) {
  return project.thumbnail || (project.youtubeId ? `https://img.youtube.com/vi/${project.youtubeId}/hqdefault.jpg` : null);
}
const at = (point: StarPoint) => ({ left: `${point.x / 10}%`, top: `${point.y / 8}%` });
const line = (from: StarPoint, to: StarPoint) => `M${from.x} ${from.y}L${to.x} ${to.y}`;

export default function Constellation({ collection, active, revealed, reducedMotion }: {
  collection: ArchiveCollection; active: boolean; revealed: boolean; reducedMotion: boolean;
}) {
  const { projects, year } = collection;
  const shape = useMemo(() => constellationFor(year, projects.length), [year, projects.length]);
  const hosts = useMemo(() => shape.points.slice(0, projects.length), [shape, projects.length]);
  const order = useMemo(() => clockwiseOrder(hosts), [hosts]);
  const plan = useMemo(() => revealPlan(shape, projects.length), [shape, projects.length]);
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [watching, setWatching] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const project = projects[selected];
  const touring = active && !paused && !watching && !focused && !reducedMotion && projects.length > 1;
  const to = shape.points[selected];
  // Keep neighboring star targets from intercepting each other on small maps.
  const hitSizes = hosts.map((point, index) => Math.min(100, ...hosts
    .filter((_, other) => other !== index)
    .map(other => Math.hypot((point.x - other.x) / 10, (point.y - other.y) / 8) * .85)));
  // The hovered (or toured) star lights its own lines and the stars they reach.
  const lit = hovered ?? selected;
  const neighbours = new Set(shape.edges.flatMap(([a, b]) => a === lit ? [b] : b === lit ? [a] : []));
  // Each star flies in from its plan origin; offsets use the map's container units so they track its size.
  const flight = (index: number) => {
    const { from, delay, duration } = plan.stars[index], point = shape.points[index];
    return { "--dx": `${(from.x - point.x) / 10}cqw`, "--dy": `${(from.y - point.y) / 8}cqh`, "--delay": `${delay}s`, "--dur": `${duration}s` } as CSSProperties;
  };

  useEffect(() => {
    if (!touring) return;
    const timer = window.setTimeout(() => setSelected(index => order[(order.indexOf(index) + 1) % order.length]), TOUR_MS);
    return () => window.clearTimeout(timer);
  }, [touring, selected, order]);
  useEffect(() => () => { setWatching(false); setFocused(false); }, [active]);

  const select = (index: number) => {
    setSelected(index); setPaused(true); setWatching(false); setPlaybackKey(value => value + 1);
  };
  const step = (direction: number) => select(order[(order.indexOf(selected) + direction + order.length) % order.length]);

  return <div className={styles.scene} data-revealed={revealed} inert={!revealed}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {project && to ? <>
      <div className={styles.starMap}>
        <svg className={styles.mapLines} viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">
          {hosts.map((point, index) => <path key={index} pathLength="1" className={styles.tether} d={line(plan.center, point)}
            style={{ "--delay": `${plan.stars[index].delay}s`, "--dur": `${plan.stars[index].duration}s`, "--fade": `${plan.hubsLanded}s` } as CSSProperties} />)}
          {plan.lines.map(({ from, to: end, delay, duration }) => <g key={`${from}-${end}`} className={styles.line}
            data-lit={from === lit || end === lit ? "" : undefined} style={{ "--delay": `${delay}s`, "--dur": `${duration}s` } as CSSProperties}>
            <path pathLength="1" className={styles.starPath} d={line(shape.points[from], shape.points[end])} />
            <path className={styles.lineHit} d={line(shape.points[from], shape.points[end])} />
          </g>)}
        </svg>
        <div className={styles.nodes} aria-label={`${year} ${shape.name} constellation`}>
          <span className={styles.origin} style={at(plan.center)} aria-hidden="true" />
          {projects.map((item, index) => <button key={item.id} type="button" className={styles.node}
            data-label-align={shape.points[index].x < 220 ? "start" : shape.points[index].x > 780 ? "end" : undefined}
            data-near={neighbours.has(index) ? "" : undefined}
            aria-pressed={index === selected} aria-label={`Explore ${item.title}`} onClick={() => select(index)}
            onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(index); }} onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)} onBlur={() => setHovered(null)}
            style={{ ...at(shape.points[index]), ...flight(index), width: `min(48px, ${hitSizes[index]}%)`, height: `min(48px, ${hitSizes[index]}%)` }}>
            <span className={styles.star} aria-hidden="true" />
            <span className={styles.nodeText}>{item.title}</span>
          </button>)}
          {shape.points.map((point, index) => index < projects.length ? null : <span key={index} className={styles.faintStar} aria-hidden="true"
            data-lit={neighbours.has(index) ? "" : undefined} style={{ ...at(point), ...flight(index) }} />)}
        </div>
      </div>
      <article className={styles.preview} aria-label={`${year} featured project`}>
        <div key={`${project.id}-${playbackKey}`} className={styles.media}>
          {active && project.youtubeId ? <YouTubeFacade videoId={project.youtubeId} title={project.title} thumbnail={project.thumbnail} onPlay={() => setWatching(true)} />
            : poster(project) ? <Image src={poster(project)!} alt={project.title} fill unoptimized sizes="(max-width: 960px) 100vw, 340px" className={styles.poster} />
              : <div className={styles.noMedia}>{project.title}</div>}
        </div>
        <div className={styles.previewBody} key={project.id}>
          {project.award && <p className={styles.award}>{project.award}</p>}
          <h2>{project.title}</h2>
          <p className={styles.description}>{project.description}</p>
          {(project.githubUrl || project.devpostUrl) && <div className={styles.projectLinks}>
            {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>}
            {project.devpostUrl && <a href={project.devpostUrl} target="_blank" rel="noopener noreferrer">View project <span aria-hidden="true">↗</span></a>}
          </div>}
        </div>
        <div className={styles.previewControls}>
          <button type="button" className={styles.tourButton} disabled={!active || (reducedMotion && !watching)}
            onClick={() => { setFocused(false); setPlaybackKey(value => value + 1); setWatching(false); setPaused(value => watching ? false : !value); }}
            aria-label={reducedMotion && !watching ? "Constellation tour paused" : watching || paused ? "Resume constellation tour" : "Pause constellation tour"}>
            {watching ? <><span aria-hidden="true">×</span> Back to tour</> : <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">{paused || reducedMotion ? <path d="m8 5 11 7-11 7Z" fill="currentColor" /> : <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2" />}</svg>}
          </button>
          <div className={styles.arrows}>
            <button type="button" disabled={!active || projects.length < 2} onClick={() => step(-1)} aria-label="Previous project">←</button>
            <button type="button" disabled={!active || projects.length < 2} onClick={() => step(1)} aria-label="Next project">→</button>
          </div>
        </div>
      </article>
    </> : null}
  </div>;
}

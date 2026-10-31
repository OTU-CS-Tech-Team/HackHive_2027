"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ArchiveCollection } from "@/data/hackhive";
import type { HackHiveProject } from "@/types/hackhive";
import { clockwiseOrder, constellationFor } from "./constellations";
import YouTubeFacade from "./YouTubeFacade";
import styles from "./museum.module.css";

const TOUR_MS = 6500;
function poster(project: HackHiveProject) {
  return project.thumbnail || (project.youtubeId ? `https://img.youtube.com/vi/${project.youtubeId}/hqdefault.jpg` : null);
}

export default function Constellation({ collection, active, revealed, reducedMotion }: {
  collection: ArchiveCollection; active: boolean; revealed: boolean; reducedMotion: boolean;
}) {
  const { projects, year } = collection;
  const shape = useMemo(() => constellationFor(year, projects.length), [year, projects.length]);
  const order = useMemo(() => clockwiseOrder(shape.points), [shape]);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [watching, setWatching] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const project = projects[selected];
  const touring = active && !paused && !watching && !focused && !reducedMotion && projects.length > 1;
  const selectedEdge = shape.edges.find(([, to]) => to === selected) ?? shape.edges.find(([from]) => from === selected);
  const from = selectedEdge ? shape.points[selectedEdge[0] === selected ? selectedEdge[1] : selectedEdge[0]] : null;
  const to = shape.points[selected];

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
          {shape.edges.map(([a, b]) => <path key={`${a}-${b}`} pathLength="1" className={styles.starPath}
            d={`M${shape.points[a].x} ${shape.points[a].y}L${shape.points[b].x} ${shape.points[b].y}`} />)}
          {active && from && <path key={project.id} pathLength="1" className={styles.activePath} d={`M${from.x} ${from.y}L${to.x} ${to.y}`} />}
        </svg>
        <div className={styles.nodes} aria-label={`${year} constellation`}>
          {projects.map((item, index) => <button key={item.id} type="button" className={styles.node}
            aria-pressed={index === selected} aria-label={`Explore ${item.title}`} onClick={() => select(index)}
            style={{ left: `${shape.points[index].x / 10}%`, top: `${shape.points[index].y / 8}%` }}>
            <span className={styles.star} aria-hidden="true" />
            <span className={styles.nodeText}>{item.title}</span>
          </button>)}
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

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./museum.module.css";

type YouTubeFacadeProps = { videoId: string; title: string; thumbnail?: string; onPlay?: () => void };

export default function YouTubeFacade({ videoId, title, thumbnail, onPlay }: YouTubeFacadeProps) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    // Next Activity cleans up effects when a cached route is hidden.
    return () => setPlaying(false);
  }, []);

  if (playing) return <iframe className={styles.cardEmbed}
    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
    title={`${title} demo`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />;

  return <button type="button" className={styles.facade} onClick={() => { setPlaying(true); onPlay?.(); }} aria-label={`Play ${title}`}>
    <Image className={styles.poster} src={thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" fill unoptimized sizes="(max-width: 760px) 100vw, 360px" />
    <span className={styles.playIcon} aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19"><path d="m9 5 11 7-11 7Z" fill="currentColor" /></svg></span>
    <span className={styles.demoLabel}>Watch demo <span aria-hidden="true">↗</span></span>
  </button>;
}

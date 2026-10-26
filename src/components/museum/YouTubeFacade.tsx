"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./museum.module.css";

type YouTubeFacadeProps = {
  videoId: string;
  title: string;
};

export default function YouTubeFacade({ videoId, title }: YouTubeFacadeProps) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // Cached pages are hidden by Activity, which runs effect cleanup.
    return () => setPlaying(false);
  }, []);

  if (playing) {
    return (
      <iframe
        className={styles.cardEmbed}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      className={styles.facade}
      onClick={() => setPlaying(true)}
      aria-label={`Play ${title}`}
    >
      <Image
        className={styles.facadeImage}
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        fill
        unoptimized
        sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 25vw"
      />
      <span className={styles.facadePlay} aria-hidden>
        <svg viewBox="0 0 64 72" width="54" height="61">
          <path d="M32 2 62 19v34L32 70 2 53V19Z" fill="currentColor" />
          <path d="m27 25 18 11-18 11Z" fill="#231c10" />
        </svg>
      </span>
      <span className={styles.demoLabel} aria-hidden="true">
        Watch demo <span>↗</span>
      </span>
    </button>
  );
}

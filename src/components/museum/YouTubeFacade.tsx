'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './museum.module.css';

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
        sizes="(max-width: 760px) 100vw, (max-width: 960px) 50vw, 28vw"
      />
      <span className={styles.facadePlay} aria-hidden>
        <svg viewBox="0 0 68 48" width="68" height="48">
          <path
            d="M66.5 7.7c-.8-2.9-3.1-5.2-6-6C55.1.4 34 .4 34 .4S12.9.4 7.5 1.7c-2.9.8-5.2 3.1-6 6C0 13.1 0 24 0 24s0 10.9 1.5 16.3c.8 2.9 3.1 5.2 6 6C12.9 47.6 34 47.6 34 47.6s21.1 0 26.5-1.3c2.9-.8 5.2-3.1 6-6C68 34.9 68 24 68 24s0-10.9-1.5-16.3Z"
            fill="currentColor"
          />
          <path d="M45 24 27 14v20Z" fill="#fff" />
        </svg>
      </span>
    </button>
  );
}

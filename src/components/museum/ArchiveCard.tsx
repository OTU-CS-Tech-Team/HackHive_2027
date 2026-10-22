import Image from 'next/image';
import type { HackHiveProject } from '@/types/hackhive';
import YouTubeFacade from './YouTubeFacade';
import styles from './museum.module.css';

type ArchiveCardProps = {
  project: HackHiveProject;
};

export default function ArchiveCard({ project }: ArchiveCardProps) {
  return (
    <article className={styles.card}>
      <h3 className={styles.cardTitle}>{project.title}</h3>
      <p className={styles.cardCopy}>{project.description}</p>
      <div className={styles.cardMedia}>
        {project.youtubeId ? (
          <YouTubeFacade videoId={project.youtubeId} title={project.title} />
        ) : project.thumbnail ? (
          <Image
            src={project.thumbnail}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 28vw"
            className={styles.cardImage}
          />
        ) : null}
      </div>
    </article>
  );
}

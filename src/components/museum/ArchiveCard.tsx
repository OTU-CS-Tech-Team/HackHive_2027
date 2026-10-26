import Image from "next/image";
import type { HackHiveProject } from "@/types/hackhive";
import YouTubeFacade from "./YouTubeFacade";
import styles from "./museum.module.css";

type ArchiveCardProps = {
  project: HackHiveProject;
};

export default function ArchiveCard({ project }: ArchiveCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cardMedia}>
        {project.youtubeId ? (
          <YouTubeFacade videoId={project.youtubeId} title={project.title} />
        ) : project.thumbnail ? (
          <Image
            src={project.thumbnail}
            alt=""
            fill
            sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className={styles.cardImage}
          />
        ) : null}
      </div>
      <div className={styles.cardBody}>
        {project.award && <p className={styles.award}>{project.award}</p>}
        <h3 className={styles.cardTitle}>{project.title}</h3>
        <p className={styles.cardCopy}>{project.description}</p>
        <span className={styles.cardYear}>{project.year} collection</span>
      </div>
    </article>
  );
}

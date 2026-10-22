import content from './generated/hackhive.json';
import type { HackHiveProject } from '@/types/hackhive';

// Generated from the CS Club repository by `npm run museum:sync`.
export const ARCHIVE_YEARS: number[] = content.years;
export const hackhiveProjects: HackHiveProject[] = content.projects;

export type ArchiveCollection = {
  year: number;
  title: string;
  projects: HackHiveProject[];
};

export function getArchiveCollections(): ArchiveCollection[] {
  return ARCHIVE_YEARS.map((year) => ({
    year,
    title: `${year} HackHive Winners`,
    projects: hackhiveProjects.filter((project) => project.year === year),
  }));
}

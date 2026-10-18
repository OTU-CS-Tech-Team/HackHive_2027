export type CorkboardAnnotation = {
  text: string;
  placement: 'top' | 'bottom';
  ink: 'red' | 'navy' | 'ink' | 'green';
};

export type HackHiveProject = {
  id: string;
  title: string;
  description: string;
  year: number;
  youtubeId?: string;
  thumbnail?: string;
  award?: string;
  team?: string;
  techStack?: string[];
  githubUrl?: string;
  devpostUrl?: string;
  category?: string;
  rotation?: number;
  attachment?: 'pin' | 'tape';
  pinColor?: 'red' | 'green';
  annotation?: CorkboardAnnotation;
};

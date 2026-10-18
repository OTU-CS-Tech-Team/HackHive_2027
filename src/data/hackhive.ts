import type { HackHiveProject } from '@/types/hackhive';

export const ARCHIVE_YEARS = [2026, 2025, 2024] as const;

export const hackhiveProjects: HackHiveProject[] = [
  {
    id: 'neuro-detect',
    title: 'Neuro Detect',
    description:
      'An AI assistant that helps radiologists read brain MRIs faster, with clear and explainable insights.',
    year: 2026,
    category: 'Medical diagnostics',
    team: 'Logan Yee, Krishna Mallick, Ali Hakkani, Kiran Sakthivel',
    techStack: ['TensorFlow', 'FastAPI', 'Python', 'JavaScript', 'Gemini API', 'Render', 'CSS'],
    thumbnail: '/projects/neuro-detect.png',
    youtubeId: 'TcK3JO73CKs',
    githubUrl: 'https://github.com/KrishnaKMA/hackathon-app',
    devpostUrl: 'https://devpost.com/software/neurodetect-rst574',
    rotation: -2,
    attachment: 'pin',
    pinColor: 'green',
    annotation: {
      text: 'First place overall winner!',
      placement: 'top',
      ink: 'green',
    },
  },
  {
    id: 'doug-the-poker-bot',
    title: 'Doug the Poker Bot',
    description:
      'A robot dealer for home poker that deals cards, tracks player actions, and streams the game with live stats.',
    year: 2026,
    category: 'poker robot',
    team: 'Adrian Shkumbov, David Frieri, Jason Wang, Matthew Frieri',
    techStack: ['ESP32', 'Flask', 'OpenAI', 'React', 'YOLO'],
    thumbnail: '/projects/doug-the-poker-bot.png',
    youtubeId: 'NdvToF_4Yp4',
    githubUrl: 'https://github.com/MatthewFrieri/HackHive',
    devpostUrl: 'https://devpost.com/software/doug-the-poker-bot',
    rotation: -4.5,
    attachment: 'pin',
    pinColor: 'red',
    annotation: {
      text: 'second place winner!',
      placement: 'bottom',
      ink: 'navy',
    },
  },
  {
    id: 'rosetta',
    title: 'Rosetta',
    description:
      'Removes language barriers from lectures so everyone in the room can follow along.',
    year: 2026,
    youtubeId: 'lfkztHWLoCs',
  },
  {
    id: 'lockblock',
    title: 'lockblock',
    description:
      'A smart lock that spots strangers, locks the door, and pings your phone, with no extra hardware mess.',
    year: 2026,
    category: 'smart lock',
    team: 'Ethan Yang, Ryan Gao, Jeremy Liu',
    techStack: ['Python', 'Flask', 'OpenCV', 'Solana', 'JavaScript', 'SQLite', 'HTML'],
    thumbnail: '/projects/lockblock.png',
    youtubeId: '1hwgS66tB9k',
    githubUrl: 'https://github.com/e-yang6/lockblock',
    devpostUrl: 'https://devpost.com/software/lockblock-9ct281',
    rotation: 3,
    attachment: 'tape',
    annotation: {
      text: 'best use of solana',
      placement: 'top',
      ink: 'red',
    },
  },
  {
    id: 'cutos',
    title: 'cutOS',
    description:
      'Edit video in plain English with auto-dubbing, voice isolation, and smart search, all with almost no learning curve.',
    year: 2026,
    category: 'AI Editing software',
    team: 'Shams Haroon, Jonathan David McKesey, Julian Cruzet, Vincent Wong',
    techStack: ['Next.js', 'OpenAI', 'ElevenLabs', 'TwelveLabs', 'Supabase', 'WebGL', 'FFmpeg'],
    thumbnail: '/projects/cutos.png',
    youtubeId: 't0zHzwyXm_Q',
    githubUrl: 'https://github.com/shamsharoon/CutOS',
    devpostUrl: 'https://devpost.com/software/cutos',
    rotation: 5,
    attachment: 'tape',
    annotation: {
      text: 'Best use of ElevenLabs',
      placement: 'bottom',
      ink: 'ink',
    },
  },
  {
    id: 'brailliant',
    title: 'Brailliant',
    description:
      'Hardware that helps you grow a brailliant mind, built to make learning tactile.',
    year: 2026,
    youtubeId: 'oT1tkPZwlYM',
  },
  {
    id: 'turtletalk',
    title: 'TurtleTalk',
    description:
      'An AI platform that helps Indigenous communities keep endangered languages alive through lessons and conversation.',
    year: 2026,
    youtubeId: 'PSC9BD6eRjs',
  },
  {
    id: 'katilix',
    title: 'Katilix',
    description:
      'AI support that helps people with ADHD, dyslexia, and visual impairment stay focused and productive online.',
    year: 2026,
    youtubeId: '9WKjWZtJUrg',
  },
  {
    id: 'beeprepared',
    title: 'BeePrepared',
    description:
      'Turns a two-hour lecture into notes, cards, and mock exams in minutes, with bee agents on a study canvas.',
    year: 2026,
    youtubeId: 'VUVFwkcULzk',
  },
  {
    id: 'flash-ai',
    title: 'Flash.AI',
    description: 'Upload. Quiz. Master. Ace your exams with Flash.AI.',
    year: 2025,
    thumbnail: '/projects/flash-ai.png',
  },
  {
    id: 'nexus-ai',
    title: 'Nexus AI',
    description: 'Your very own personal assistant and centralized productivity hub.',
    year: 2025,
    youtubeId: '3SEqVufuHK0',
  },
  {
    id: 'rotify',
    title: 'Rotify',
    description:
      'Save time by brain-rotting your mind. Rotify blends studying with satisfying Gen Z content.',
    year: 2025,
    youtubeId: 'PjXUOong-DI',
  },
  {
    id: 'elva',
    title: 'ELVA',
    description:
      'AI for Alzheimer’s care: facial recognition, object detection, and safer navigation in one app.',
    year: 2025,
    youtubeId: 'khcMJSWu-os',
  },
  {
    id: 'nutriai',
    title: 'NutriAI',
    description:
      'An AI meal planner that builds plans, grocery lists, and insights around your goals.',
    year: 2025,
    youtubeId: 'xUl2urnbG64',
  },
  {
    id: 'cairs-group-39',
    title: 'Cairs Group 39',
    description:
      'The Epic Coders: software that makes everyday life easier and more accessible.',
    year: 2025,
    youtubeId: 'sdE-lb0fNBk',
  },
  {
    id: 'pantrypal',
    title: 'PantryPal',
    description:
      'Give it your ingredients and it cooks up recipes, then walks you through the meal so nothing burns.',
    year: 2024,
    youtubeId: 'dlSGcCcY6I4',
  },
  {
    id: 'ecosort',
    title: 'EcoSort',
    description:
      'Canada sent most of its waste to landfills in 2020. EcoSort is a recycling companion that helps you sort it right.',
    year: 2024,
    youtubeId: 'KU4ODvx5_ao',
  },
  {
    id: 'trash-it',
    title: 'Trash It',
    description:
      'Snap, sort, save the planet. A smart recycling app that turns every toss into a better choice.',
    year: 2024,
    youtubeId: 'cxQMLCtoi_w',
  },
  {
    id: 'biodiversity-monitoring',
    title: 'AI-Powered Biodiversity Monitoring System',
    description:
      'Azure-powered robots, AI, and data insights for tracking biodiversity and a more sustainable future.',
    year: 2024,
    youtubeId: 'nVXslFZauaU',
  },
  {
    id: 'goodsole',
    title: 'GoodSole',
    description: 'Robust inventory management built for a first trip into the cloud.',
    year: 2024,
    youtubeId: 'QGGDmRhm7Cc',
  },
  {
    id: 'levelup',
    title: 'LevelUp',
    description:
      'A public forum for health and self-improvement questions that favours useful advice over engagement bait.',
    year: 2024,
    youtubeId: '__M-AkYt00s',
  },
];

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

export function getProjectById(id: string): HackHiveProject | undefined {
  return hackhiveProjects.find((project) => project.id === id);
}

export function getFeaturedProjects(): HackHiveProject[] {
  return hackhiveProjects.filter((project) => project.attachment);
}

export function getProjectHref(id: string): string {
  return `/hackhive/${id}`;
}

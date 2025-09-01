export type PublicTrack = {
  id: string;
  title: string;
  author: string;
  tags: string[];
  bpm?: number;
  audioUrl?: string;
  description?: string;
  createdAt: number;
};

export const mockCatalog: PublicTrack[] = [
  {
    id: 'demo-1',
    title: 'Demo Jam 1',
    author: 'Alice',
    tags: ['rock', 'riff'],
    bpm: 120,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'demo-2',
    title: 'Slow Ballad',
    author: 'Bob',
    tags: ['ballad', 'slow'],
    bpm: 72,
    createdAt: Date.now() - 3600000,
  },
];








export type Track = {
  id: string;
  name: string;
  description?: string;
  bpm: number;
  blob: Blob;
  buffer?: AudioBuffer;
  offsetSec: number;
  author?: string;
  createdAt: number;
};

export type RecordingState = 'idle' | 'recording' | 'processing';

export type PlayState = 'stopped' | 'playing';

export type Recording = {
  id: string;
  title: string;
  description: string;
  author: string;
  bpm: number;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  uploadDate: string;
  url: string;
};

export type EngineEvent =
  | { type: 'play-started'; atContextTime: number }
  | { type: 'play-stopped'; atContextTime: number };


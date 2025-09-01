import { useRef, useState } from 'react';
import { Track } from '../types';

type Props = {
  onAddTrack: (track: Track) => void;
};

export function TrackUploader({ onAddTrack }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bpm, setBpm] = useState(120);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const newTrack: Track = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: name || file.name,
      description: description || undefined,
      bpm: bpm,
      blob: file,
      buffer: undefined,
      offsetSec: 0,
      createdAt: Date.now(),
    };
    onAddTrack(newTrack);
    setName('');
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Track name"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
      />
      <label className="inline">
        BPM
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value) || 0)}
          min={30}
          max={300}
        />
      </label>
    </div>
  );
}

export default TrackUploader;




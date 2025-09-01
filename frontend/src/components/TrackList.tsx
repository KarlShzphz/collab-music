import { Track } from '../types';

type Props = {
  tracks: Array<Track>;
  onChangeOffset: (id: string, newOffset: number) => void;
};

export function TrackList({ tracks, onChangeOffset }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tracks.length === 0 && <div style={{ opacity: 0.7 }}>No tracks yet</div>}
      {tracks.map((t) => (
        <div key={t.id} style={{ border: '1px solid #444', borderRadius: 8, padding: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            {t.description && <div style={{ fontSize: 12, opacity: 0.8 }}>{t.description}</div>}
            <div style={{ fontSize: 12, opacity: 0.8 }}>BPM: {t.bpm}</div>
          </div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Offset (s)
            <input type="number" value={t.offsetSec} step={0.01} onChange={(e) => onChangeOffset(t.id, Number(e.target.value) || 0)} />
          </label>
          <a href={URL.createObjectURL(t.blob)} download={t.name + '.webm'}>
            Save
          </a>
        </div>
      ))}
    </div>
  );
}

export default TrackList;




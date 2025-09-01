import { useEffect, useState } from 'react';
import { useRecorder } from '../hooks';
import { Track } from '../types';

type Props = {
  bpm: number;
  onFinished: (track: Track) => void;
};

export function Recorder({ bpm, onFinished }: Props) {
  const { recordingState, startRecording, stopRecording, takeRecordingBlob } = useRecorder();
  const [name, setName] = useState('My recording');

  useEffect(() => {
    if (recordingState === 'processing') {
      const blob = takeRecordingBlob();
      if (blob) {
        onFinished({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          bpm,
          description: undefined,
          blob,
          offsetSec: 0,
          createdAt: Date.now(),
        });
      }
    }
  }, [recordingState]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recording name" />
      {recordingState === 'recording' ? (
        <button onClick={stopRecording}>Stop Rec</button>
      ) : (
        <button
          onClick={async () => {
            try {
              await startRecording();
            } catch (e) {
              alert('Доступ к микрофону отклонён или недоступен. Проверьте разрешения браузера.');
            }
          }}
        >
          Start Rec
        </button>
      )}
      <span style={{ opacity: 0.7 }}>State: {recordingState}</span>
    </div>
  );
}

export default Recorder;



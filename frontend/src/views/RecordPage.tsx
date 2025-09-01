import { useState, useRef, useEffect } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import { audioEngine } from '../audioEngine';

export function RecordPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (isMetronomePlaying) {
        audioEngine.stopMetronome();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isMetronomePlaying]);

  const startMetronome = async () => {
    if (isMetronomePlaying) {
      audioEngine.stopMetronome();
      setIsMetronomePlaying(false);
    } else {
      await audioEngine.startMetronome(bpm);
      setIsMetronomePlaying(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const options: MediaRecorderOptions = {};
      try {
        options.mimeType = 'audio/webm;codecs=opus';
      } catch {
        // Fallback to default
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        const audio = new Audio(URL.createObjectURL(blob));
        setRecordedAudio(audio);
        setIsRecording(false);
        
        // Stop microphone
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      alert('Ошибка доступа к микрофону. Проверьте разрешения браузера.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const playRecordedAudio = () => {
    if (recordedAudio) {
      recordedAudio.currentTime = 0;
      recordedAudio.play();
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(20px, 4vw, 30px)', maxWidth: 'clamp(300px, 90vw, 600px)', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => window.history.back()}>← Назад</button>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 24px)' }}>Запись аудио</h2>
        </div>

        {/* Metronome Controls */}
        <div className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>Метроном</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              BPM:
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Math.max(30, Math.min(300, Number(e.target.value) || 120)))}
                min={30}
                max={300}
                style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </label>
            <button
              onClick={startMetronome}
              style={{
                padding: 'clamp(8px, 2vw, 12px) clamp(16px, 3vw, 24px)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: isMetronomePlaying ? 'var(--link)' : 'var(--button-bg)',
                color: isMetronomePlaying ? 'white' : 'var(--button-fg)',
                cursor: 'pointer'
              }}
            >
              {isMetronomePlaying ? 'Остановить' : 'Запустить'} метроном
            </button>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>Запись</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {!isRecording ? (
              <button
                onClick={startRecording}
                style={{
                  padding: 'clamp(12px, 3vw, 16px) clamp(24px, 4vw, 32px)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--button-bg)',
                  color: 'var(--button-fg)',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 2.5vw, 16px)'
                }}
              >
                Начать запись
              </button>
            ) : (
              <button
                onClick={stopRecording}
                style={{
                  padding: 'clamp(12px, 3vw, 16px) clamp(24px, 4vw, 32px)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#dc3545',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 2.5vw, 16px)'
                }}
              >
                Остановить запись
              </button>
            )}
          </div>
          {isRecording && (
            <div style={{ marginTop: 16, color: '#dc3545', fontWeight: 'bold' }}>
              🎤 Запись...
            </div>
          )}
        </div>

        {/* Playback Controls */}
        {recordedBlob && (
          <div className="card" style={{ width: '100%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>Воспроизведение</h3>
            <button
              onClick={playRecordedAudio}
              style={{
                padding: 'clamp(12px, 3vw, 16px) clamp(24px, 4vw, 32px)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--link)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 'clamp(14px, 2.5vw, 16px)'
              }}
            >
              ▶️ Воспроизвести запись
            </button>
            <div style={{ marginTop: 12, fontSize: 'clamp(12px, 2.5vw, 14px)', opacity: 0.7 }}>
              Размер: {(recordedBlob.size / 1024).toFixed(1)} KB
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecordPage;




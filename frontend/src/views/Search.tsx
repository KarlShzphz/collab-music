import { useMemo, useState, useEffect } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import { mockCatalog } from '../mockCatalog';
import { useRef } from 'react';
import { audioEngine } from '../audioEngine';
import LiveVisualizer from '../components/LiveVisualizer';
import AudioVisualizer from '../components/AudioVisualizer';

type Props = {
  goHome: () => void;
};

type ServerRecording = {
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

export function Search({ goHome }: Props) {
  const [query, setQuery] = useState('');
  const [serverRecordings, setServerRecordings] = useState<ServerRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [overdubTarget, setOverdubTarget] = useState<ServerRecording | null>(null);
  const [isOverdubOpen, setIsOverdubOpen] = useState(false);

  // Загружаем записи с сервера
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('http://localhost:3003/api/recordings');
        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        
        const recordings = await response.json();
        setServerRecordings(recordings);
        console.log('🎵 Загружены записи с сервера:', recordings);
      } catch (error) {
        console.error('Ошибка при загрузке записей:', error);
        setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordings();
  }, []);

  // После монтирования/загрузки — проверяем, есть ли свежезагруженная запись
  useEffect(() => {
    try {
      const recentId = localStorage.getItem('recentUploadedRecordingId');
      if (recentId) {
        setHighlightId(recentId);
        // Автопрокрутка к элементу
        setTimeout(() => {
          const el = document.getElementById(`track-${recentId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        // Чистим флаг
        localStorage.removeItem('recentUploadedRecordingId');
      }
    } catch {}
  }, [serverRecordings.length]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    // Объединяем mock данные и записи с сервера
    const allRecordings = [
      ...mockCatalog,
      ...serverRecordings.map(rec => ({
        id: rec.id,
        title: rec.title,
        author: rec.author,
        bpm: rec.bpm,
        tags: rec.description ? [rec.description] : [],
        url: rec.url,
        isServerRecording: true,
        size: rec.size,
        uploadDate: rec.uploadDate
      }))
    ];
    
    if (!q) return allRecordings;
    
    return allRecordings.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.author.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [query, serverRecordings]);

  return (
    <div id="search-page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div id="search-theme-toggle" style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div id="search-main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(16px, 3vw, 20px)', maxWidth: 'clamp(280px, 90vw, 800px)', width: '100%' }}>
        <div id="search-header" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button id="search-home-button" onClick={goHome}>← На главную</button>
          <h2 id="search-page-title" style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 22px)' }}>Поиск треков</h2>
        </div>
        <input 
          id="search-input"
          type="search" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Название, автор или тег"
          style={{ width: '100%', maxWidth: 'clamp(250px, 80vw, 600px)' }}
        />
        
        {/* Статус загрузки */}
        {isLoading && (
          <div id="loading-status" style={{ 
            textAlign: 'center', 
            padding: '20px',
            color: '#666',
            fontSize: 'clamp(14px, 2.5vw, 16px)'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              border: '2px solid #2196f3',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 8px'
            }}></div>
            Загрузка записей с сервера...
          </div>
        )}
        
        {/* Ошибка */}
        {error && (
          <div id="error-status" style={{ 
            textAlign: 'center', 
            padding: '20px',
            background: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '8px',
            color: '#c62828',
            fontSize: 'clamp(14px, 2.5vw, 16px)'
          }}>
            ❌ Ошибка загрузки: {error}
            <div style={{ marginTop: '8px', fontSize: 'clamp(12px, 2vw, 14px)' }}>
              Показываем только демо-записи
            </div>
          </div>
        )}
        
        <div id="search-results" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxHeight: '60vh', overflowY: 'auto' }}>
          {results.map((t) => (
            <div key={t.id} id={`track-${t.id}`} className="card" style={{ 
              position: 'relative',
              border: highlightId === t.id ? '2px solid #2196F3' : (t as any).isServerRecording ? '2px solid #4CAF50' : undefined,
              boxShadow: highlightId === t.id ? '0 0 0 4px rgba(33,150,243,0.15)' : undefined,
              background: highlightId === t.id
                ? 'linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%)'
                : (t as any).isServerRecording ? 'linear-gradient(135deg, #f8fff8 0%, #e8f5e8 100%)' : undefined
            }}>
              {/* Индикатор записи с сервера */}
              {(t as any).isServerRecording && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: '#4CAF50',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  🌐 СЕРВЕР
                </div>
              )}
              
              <div id={`track-title-${t.id}`} style={{ fontWeight: 600, fontSize: 'clamp(14px, 3vw, 16px)' }}>
                {t.title}
                {(t as any).isServerRecording && <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>🎵</span>}
              </div>
              
              <div id={`track-author-${t.id}`} style={{ opacity: 0.8, fontSize: 'clamp(11px, 2.5vw, 12px)' }}>
                Автор: {t.author}{t.bpm ? ` · ${t.bpm} BPM` : ''}
              </div>
              
              {t.tags.length > 0 && (
                <div id={`track-tags-${t.id}`} style={{ opacity: 0.8, fontSize: 'clamp(11px, 2.5vw, 12px)' }}>
                  Теги: {t.tags.join(', ')}
                </div>
              )}
              
              {/* Дополнительная информация для записей с сервера */}
              {(t as any).isServerRecording && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px', 
                  background: 'rgba(76, 175, 80, 0.1)', 
                  borderRadius: '4px',
                  fontSize: 'clamp(10px, 2vw, 11px)',
                  opacity: 0.8
                }}>
                  <div>📁 Размер: {((t as any).size / 1024).toFixed(1)} KB</div>
                  <div>📅 Загружено: {new Date((t as any).uploadDate).toLocaleDateString('ru-RU')}</div>
                  {(t as any).url && (
                    <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => window.open(`http://localhost:3003${(t as any).url}`, '_blank')}
                        style={{
                          background: '#2196F3',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        ▶️ Прослушать
                      </button>
                      <button 
                        onClick={() => {
                          setOverdubTarget(t as any);
                          setIsOverdubOpen(true);
                        }}
                        style={{
                          background: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        🎤 Записать поверх
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Overdub Modal */}
      {isOverdubOpen && overdubTarget && (
        <OverdubModal
          base={overdubTarget}
          onClose={() => { setIsOverdubOpen(false); setOverdubTarget(null); }}
        />
      )}
    </div>
  );
}

export default Search;

// Lightweight overdub modal living in Search, to keep overdub workflow on top of Search
function OverdubModal({ base, onClose }: { base: ServerRecording; onClose: () => void }) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const baseAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bpm, setBpm] = useState(base.bpm || 120);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [microphoneVolume, setMicrophoneVolume] = useState(0.8);
  const [microphoneSensitivity, setMicrophoneSensitivity] = useState(1.0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const recordingTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const a = new Audio(`http://localhost:3003${base.url}`);
    a.preload = 'metadata';
    baseAudioRef.current = a;
    return () => { 
      a.pause(); 
      // Cleanup timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
      // Stop audio engine
      audioEngine.stopMicrophoneMonitoring();
      audioEngine.stopMetronome();
    };
  }, [base.url]);

  const start = async () => {
    const rawStream = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000
    }});
    // мониторинг микрофона как в RecordPage
    const processed = audioEngine.setupMicrophoneMonitoring(rawStream);
    audioEngine.setMicrophoneVolume(microphoneVolume);
    audioEngine.setMicrophoneSensitivity(microphoneSensitivity);
    streamRef.current = processed;
    chunksRef.current = [];
    const options: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported('audio/mp4')) options.mimeType = 'audio/mp4';
    const rec = new MediaRecorder(processed, options);
    mediaRecorderRef.current = rec;
    rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstart = () => {
      setIsRecording(true);
      // play base
      baseAudioRef.current?.play().catch(() => {});
      if (metronomeOn) {
        audioEngine.startMetronome(bpm).catch(() => {});
        audioEngine.setMetronomeVolume(0.7);
      }
      // Start recording timer
      setRecordingTime(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    };
    rec.onstop = async () => {
      setIsRecording(false);
      baseAudioRef.current?.pause();
      audioEngine.stopMicrophoneMonitoring();
      audioEngine.stopMetronome();
      
      // Stop recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Create recorded blob and audio element
      let mimeType = 'audio/webm';
      if (options.mimeType) {
        mimeType = options.mimeType;
      }
      const recordedBlob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(recordedBlob);
      
      // Create audio element for playback
      const audioUrl = URL.createObjectURL(recordedBlob);
      const audio = new Audio(audioUrl);
      audio.preload = 'metadata';
      setIsAudioLoading(true);
      
      audio.onloadedmetadata = () => {
        const audioDuration = audio.duration;
        if (isFinite(audioDuration) && audioDuration > 0) {
          setDuration(audioDuration);
          setIsAudioLoading(false);
        } else {
          setDuration(0);
        }
      };
      
      audio.oncanplaythrough = () => {
        if (duration === 0 && isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
          setIsAudioLoading(false);
        }
      };
      
      audio.oncanplay = () => {
        if (duration === 0 && isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
          setIsAudioLoading(false);
        }
      };
      
      audio.ontimeupdate = () => {
        const time = audio.currentTime;
        if (isFinite(time) && time >= 0) {
          setCurrentTime(time);
        }
      };
      
      audio.onplay = () => {
        setIsPlaying(true);
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
        }
        playbackTimerRef.current = window.setInterval(() => {
          if (audio && !audio.paused && !audio.ended) {
            const time = audio.currentTime;
            if (isFinite(time) && time >= 0) {
              setCurrentTime(time);
            }
          }
        }, 100);
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
        // Останавливаем базовый трек при окончании записанной дорожки
        if (baseAudioRef.current) {
          baseAudioRef.current.pause();
          baseAudioRef.current.currentTime = 0;
        }
      };
      
      audio.onpause = () => {
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
        // Останавливаем базовый трек при паузе записанной дорожки
        if (baseAudioRef.current) {
          baseAudioRef.current.pause();
        }
      };
      
      setRecordedAudio(audio);
    };
    rec.start();
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    
    // Stop recording timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const playRecordedAudio = async () => {
    if (!recordedAudio) return;
    try {
      // Воспроизводим записанную дорожку
      await recordedAudio.play();
      // Одновременно воспроизводим базовый трек
      if (baseAudioRef.current) {
        baseAudioRef.current.currentTime = 0;
        await baseAudioRef.current.play();
      }
    } catch (error) {
      console.error('Ошибка воспроизведения:', error);
    }
  };

  const stopRecordedAudio = () => {
    if (recordedAudio) {
      recordedAudio.pause();
      recordedAudio.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
    
    // Останавливаем базовый трек
    if (baseAudioRef.current) {
      baseAudioRef.current.pause();
      baseAudioRef.current.currentTime = 0;
    }
  };

  const seekToPosition = (position: number) => {
    if (recordedAudio && duration > 0 && isFinite(duration) && isFinite(position)) {
      const newTime = (position / 100) * duration;
      
      if (isFinite(newTime) && newTime >= 0 && newTime <= duration) {
        recordedAudio.currentTime = newTime;
        setCurrentTime(newTime);
        
        // Синхронизируем базовый трек
        if (baseAudioRef.current) {
          baseAudioRef.current.currentTime = newTime;
        }
        
        // If playback was paused, restart timer
        if (isPlaying && !playbackTimerRef.current) {
          playbackTimerRef.current = window.setInterval(() => {
            if (recordedAudio && !recordedAudio.paused && !recordedAudio.ended) {
              const time = recordedAudio.currentTime;
              if (isFinite(time) && time >= 0) {
                setCurrentTime(time);
                // Синхронизируем базовый трек
                if (baseAudioRef.current) {
                  baseAudioRef.current.currentTime = time;
                }
              }
            }
          }, 100);
        }
      }
    }
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadMix = async () => {
    if (!chunksRef.current.length) return;
    setIsSaving(true);
    try {
      const recorded = new Blob(chunksRef.current, { type: chunksRef.current[0].type || 'audio/webm' });
      // 1) Смешиваем буферы в AudioBuffer
      const ctx = new AudioContext();
      const baseBuf = await (await fetch(`http://localhost:3003${base.url}`)).arrayBuffer().then(b => ctx.decodeAudioData(b));
      const recBuf = await recorded.arrayBuffer().then(b => ctx.decodeAudioData(b));
      const len = Math.max(baseBuf.length, recBuf.length);
      const out = ctx.createBuffer(Math.max(baseBuf.numberOfChannels, recBuf.numberOfChannels), len, baseBuf.sampleRate);
      for (let ch = 0; ch < out.numberOfChannels; ch++) {
        const o = out.getChannelData(ch);
        const a = baseBuf.getChannelData(ch % baseBuf.numberOfChannels);
        const b = recBuf.getChannelData(ch % recBuf.numberOfChannels);
        for (let i = 0; i < len; i++) {
          const s = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0);
          o[i] = Math.max(-1, Math.min(1, s));
        }
      }

      // 2) Пытаемся экспортировать через MediaRecorder в MP4 (AAC) или WebM (Opus)
      const mimeMp4 = 'audio/mp4';
      const mimeWebm = 'audio/webm;codecs=opus';
      const preferredMime = (window.MediaRecorder && MediaRecorder.isTypeSupported(mimeMp4))
        ? mimeMp4
        : (window.MediaRecorder && MediaRecorder.isTypeSupported(mimeWebm))
          ? mimeWebm
          : '';

      if (preferredMime) {
        const renderCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = renderCtx.createMediaStreamDestination();
        const src = renderCtx.createBufferSource();
        src.buffer = out;
        src.connect(destination);
        src.connect(renderCtx.destination);
        const rec = new MediaRecorder(destination.stream, { mimeType: preferredMime, audioBitsPerSecond: 128000 });
        const chunks: BlobPart[] = [];
        const done = new Promise<Blob>((resolve) => {
          rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = () => resolve(new Blob(chunks, { type: preferredMime }));
        });
        rec.start();
        src.start();
        src.onended = () => rec.stop();
        // Ждём завершения
        const blob = await done;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${base.title.replace(/\s+/g,'_')}_overdub${preferredMime === mimeMp4 ? '.mp4' : '.webm'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        renderCtx.close();
        return;
      }

      // 3) Fallback: WAV
      const wav = await (async (buf: AudioBuffer) => {
        const channels = buf.numberOfChannels, sampleRate = buf.sampleRate, length = buf.length;
        const ab = new ArrayBuffer(44 + length * channels * 2);
        const view = new DataView(ab);
        const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); view.setUint32(4, 36 + length * channels * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
        view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); w(36, 'data');
        view.setUint32(40, length * channels * 2, true);
        let off = 44;
        for (let i = 0; i < length; i++) for (let ch = 0; ch < channels; ch++) {
          const s = Math.max(-1, Math.min(1, buf.getChannelData(ch)[i]));
          view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
        }
        return new Blob([ab], { type: 'audio/wav' });
      })(out);
      const url = URL.createObjectURL(wav);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base.title.replace(/\s+/g,'_')}_overdub.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', color: '#111', width: 'min(92vw, 720px)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Запись поверх: {base.title} — {base.author}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✖</button>
        </div>
        {/* Metronome + Mic controls */}
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => { if (metronomeOn) { audioEngine.stopMetronome(); setMetronomeOn(false); } else { audioEngine.startMetronome(bpm); audioEngine.setMetronomeVolume(0.7); setMetronomeOn(true); } }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>
              {metronomeOn ? '⏹️ Метроном' : '▶️ Метроном'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>BPM</span>
              <input type="range" min={30} max={300} step={1} value={bpm} onChange={e => { const v = Number(e.target.value); setBpm(v); if (metronomeOn) audioEngine.setMetronomeBpm(v); }} />
              <span style={{ fontWeight: 600 }}>{bpm}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>🎤 Громкость:</span>
            <input type="range" min={0} max={1} step={0.1} value={microphoneVolume} onChange={e => { const v = Number(e.target.value); setMicrophoneVolume(v); audioEngine.setMicrophoneVolume(v); }} />
            <span style={{ fontWeight: 600 }}>{Math.round(microphoneVolume * 100)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>📶 Чувствительность:</span>
            <input type="range" min={0.1} max={3.0} step={0.1} value={microphoneSensitivity} onChange={e => { const v = Number(e.target.value); setMicrophoneSensitivity(v); audioEngine.setMicrophoneSensitivity(v); }} />
            <span style={{ fontWeight: 600 }}>{microphoneSensitivity.toFixed(1)}x</span>
          </div>
          {/* Live Visualizer */}
          <div>
            <LiveVisualizer isRecording={isRecording} microphoneStream={streamRef.current} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {!isRecording ? (
            <button onClick={start} style={{ padding: '10px 16px', background: '#2196F3', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer' }}>🎤 Начать запись поверх</button>
          ) : (
            <button onClick={stop} style={{ padding: '10px 16px', background: '#f44336', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer' }}>⏹️ Остановить</button>
          )}
          <button onClick={() => baseAudioRef.current?.play()} style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>▶️ Прослушать базовый</button>
          <button onClick={() => { baseAudioRef.current?.pause(); if (baseAudioRef.current) baseAudioRef.current.currentTime = 0; }} style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>⏹️ Стоп базового</button>
          <button disabled={!chunksRef.current.length || isRecording || isSaving} onClick={downloadMix} style={{ padding: '10px 16px', background: '#4CAF50', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer', opacity: (!chunksRef.current.length || isRecording || isSaving) ? 0.6 : 1 }}>💾 Скачать микс (MP4/WebM/WAV)</button>
        </div>
        
        {/* Recording status and timer */}
        {isRecording && (
          <div style={{ marginTop: 12, color: '#dc3545', fontWeight: 'bold', fontSize: 14 }}>
            🎤 Запись... {formatTime(recordingTime)}
          </div>
        )}
        
        {/* Recorded audio playback controls */}
        {recordedBlob && !isRecording && (
          <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 16 }}>🎵 Записанная дорожка</h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {!isPlaying ? (
                <button onClick={playRecordedAudio} style={{ padding: '8px 16px', background: '#28a745', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                  ▶️ Воспроизвести
                </button>
              ) : (
                <button onClick={stopRecordedAudio} style={{ padding: '8px 16px', background: '#ffc107', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                  ⏹️ Остановить
                </button>
              )}
            </div>
            
            {/* Audio visualizer */}
            {duration > 0 ? (
              <AudioVisualizer 
                audioBlob={recordedBlob}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                onSeek={seekToPosition}
                onPlayPause={isPlaying ? stopRecordedAudio : playRecordedAudio}
              />
            ) : (
              <div style={{
                background: isAudioLoading ? '#e3f2fd' : '#fff3cd',
                border: `1px solid ${isAudioLoading ? '#2196f3' : '#ffeaa7'}`,
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                color: isAudioLoading ? '#1976d2' : '#856404',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {isAudioLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #2196f3',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      ⚡ Быстрая загрузка аудио...
                    </>
                  ) : (
                    '⏳ Загрузка метаданных аудио...'
                  )}
                </div>
                <div style={{ fontSize: '12px' }}>
                  {isAudioLoading ? 'Оптимизированная загрузка в процессе' : 'Если этот блок не исчезает, попробуйте остановить и снова воспроизвести запись'}
                </div>
              </div>
            )}
            
            {/* Playback status */}
            {isPlaying && (
              <div style={{ marginTop: 8, color: '#007bff', fontWeight: 'bold', fontSize: 14 }}>
                ▶️ Воспроизведение... {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Во время записи базовый трек автоматически играет в наушники, но не попадает в вашу дорожку.</div>
      </div>
    </div>
  );
}




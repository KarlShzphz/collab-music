import { useState, useRef, useEffect } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import AudioVisualizer from '../components/AudioVisualizer';
import LiveVisualizer from '../components/LiveVisualizer';
import { audioEngine } from '../audioEngine';
import type { Recording } from '../types';


export function RecordPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [metronomeVolume, setMetronomeVolume] = useState(0.7);
  const [microphoneVolume, setMicrophoneVolume] = useState(0.8);
  const [microphoneSensitivity, setMicrophoneSensitivity] = useState(1.0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [filename, setFilename] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingDescription, setRecordingDescription] = useState('');
  const [recordingAuthor, setRecordingAuthor] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const [mixedPreviewBlob, setMixedPreviewBlob] = useState<Blob | null>(null);
  // overdub state
  const [selectedTrack, setSelectedTrack] = useState<Recording | null>(null);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedTrackAudio, setSelectedTrackAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingSelectedTrack, setIsPlayingSelectedTrack] = useState(false);
  

  const startMetronome = async () => {
    if (isMetronomePlaying) {
      audioEngine.stopMetronome();
      setIsMetronomePlaying(false);
    } else {
      audioEngine.setMetronomeVolume(metronomeVolume);
      await audioEngine.startMetronome(bpm);
      setIsMetronomePlaying(true);
    }
  };

  const handleMetronomeVolumeChange = (volume: number) => {
    setMetronomeVolume(volume);
    audioEngine.setMetronomeVolume(volume);
  };

  const handleMicrophoneVolumeChange = (volume: number) => {
    setMicrophoneVolume(volume);
    audioEngine.setMicrophoneVolume(volume);
  };

  const handleMicrophoneSensitivityChange = (sensitivity: number) => {
    setMicrophoneSensitivity(sensitivity);
    audioEngine.setMicrophoneSensitivity(sensitivity);
  };

  const handleBpmChange = (newBpm: number) => {
    const validBpm = Math.max(30, Math.min(300, newBpm || 120));
    setBpm(validBpm);
    // Update metronome BPM in real-time if it's playing
    if (isMetronomePlaying) {
      audioEngine.setMetronomeBpm(validBpm);
    }
  };

  // WAV encoder
  const audioBufferToBlob = async (buf: AudioBuffer): Promise<Blob> => {
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
  };

  const mixRecordings = async (newRec: Blob, base: Recording): Promise<Blob> => {
    const ctx = new AudioContext();
    const baseBuf = await (await fetch(`http://localhost:3003${base.url}`)).arrayBuffer()
      .then(b => ctx.decodeAudioData(b));
    const newBuf = await newRec.arrayBuffer().then(b => ctx.decodeAudioData(b));
    const len = Math.max(baseBuf.length, newBuf.length);
    const out = ctx.createBuffer(Math.max(baseBuf.numberOfChannels, newBuf.numberOfChannels), len, baseBuf.sampleRate);
    for (let ch = 0; ch < out.numberOfChannels; ch++) {
      const o = out.getChannelData(ch);
      const a = baseBuf.getChannelData(ch % baseBuf.numberOfChannels);
      const b = newBuf.getChannelData(ch % newBuf.numberOfChannels);
      for (let i = 0; i < len; i++) {
        const s = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0);
        o[i] = Math.max(-1, Math.min(1, s));
      }
    }
    return audioBufferToBlob(out);
  };

  const loadRecordings = async () => {
    try { setIsLoadingTrack(true);
      const r = await fetch('http://localhost:3003/api/recordings'); const list = await r.json();
      setRecordings(list); return list;
    } finally { setIsLoadingTrack(false); }
  };

  const selectTrack = async (track: Recording) => {
    console.log('🎵 Выбираем трек для записи поверх:', track);
    setSelectedTrack(track);
    if (selectedTrackAudio) { 
      selectedTrackAudio.pause(); 
      selectedTrackAudio.currentTime = 0; 
    }
    const a = new Audio(`http://localhost:3003${track.url}`); 
    a.preload = 'metadata';
    a.onplay = () => {
      console.log('🎵 Базовый трек начал воспроизведение');
      setIsPlayingSelectedTrack(true);
    };
    a.onpause = a.onended = () => {
      console.log('🎵 Базовый трек остановлен');
      setIsPlayingSelectedTrack(false);
    };
    setSelectedTrackAudio(a);
    console.log('🎵 selectedTrackAudio создан:', a);
  };

  const playSelectedTrack = async () => { if (selectedTrackAudio) await selectedTrackAudio.play(); };
  const stopSelectedTrack = () => { if (selectedTrackAudio) { selectedTrackAudio.pause(); selectedTrackAudio.currentTime = 0; } };

  // Cleanup only on component unmount
  useEffect(() => {
    return () => {
      // Stop metronome on unmount
      audioEngine.stopMetronome();
      // Stop microphone monitoring
      audioEngine.stopMicrophoneMonitoring();
      // Stop microphone stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, []); // Empty dependency array - runs only on mount/unmount

  useEffect(() => { setMixedPreviewBlob(null); }, [selectedTrack]);
  useEffect(() => { setMixedPreviewBlob(null); }, [recordedBlob]);


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      // Setup monitoring and get processed stream with applied sensitivity
      const processedStream = audioEngine.setupMicrophoneMonitoring(stream);
      audioEngine.setMicrophoneVolume(microphoneVolume);
      audioEngine.setMicrophoneSensitivity(microphoneSensitivity);

      // Воспроизводим выбранный трек при начале записи
      console.log('🎵 Проверяем selectedTrackAudio при начале записи:', {
        hasSelectedTrack: !!selectedTrack,
        hasSelectedTrackAudio: !!selectedTrackAudio,
        selectedTrackAudioSrc: selectedTrackAudio?.src
      });
      
      if (selectedTrackAudio) {
        console.log('🎵 Воспроизводим базовый трек при записи');
        selectedTrackAudio.currentTime = 0;
        selectedTrackAudio.play().catch(console.error);
        setIsPlayingSelectedTrack(true);
      } else {
        console.log('❌ selectedTrackAudio не найден при начале записи');
      }

      const options: MediaRecorderOptions = {};
      try {
        // Пробуем записать в MP4 (AAC) - лучший MP3-совместимый формат
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
          options.audioBitsPerSecond = 128000;
          console.log('🎵 Используем MP4 (AAC) для записи');
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options.mimeType = 'audio/webm;codecs=opus';
          options.audioBitsPerSecond = 128000;
          console.log('🎵 Используем WebM (Opus) для записи');
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options.mimeType = 'audio/webm';
          console.log('🎵 Используем WebM для записи');
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          options.mimeType = 'audio/wav';
          console.log('🎵 Используем WAV для записи');
        }
      } catch {
        // Fallback to default
      }

      // MediaRecorder records processed stream with applied sensitivity
      const recorder = new MediaRecorder(processedStream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Определяем правильный MIME тип на основе того, что использовалось для записи
        let mimeType = 'audio/webm'; // fallback
        if (options.mimeType) {
          mimeType = options.mimeType;
        }
        
        // Создаем blob с РЕАЛЬНЫМ форматом записи
        const recordedBlob = new Blob(chunksRef.current, { type: mimeType });
        
        console.log('🎵 РЕАЛЬНАЯ запись завершена:', {
          mimeType: mimeType,
          size: recordedBlob.size,
          isMP4: mimeType === 'audio/mp4',
          isWebM: mimeType.includes('webm')
        });
        
        // Сохраняем blob как есть - без обмана с MIME типами
        setRecordedBlob(recordedBlob);
        
        // Создаем blob URL для быстрого доступа
        const audioUrl = URL.createObjectURL(recordedBlob);
        const audio = new Audio(audioUrl);
        
        // Оптимизируем загрузку - предзагружаем метаданные
        audio.preload = 'metadata';
        
        // Показываем индикатор загрузки
        setIsAudioLoading(true);
        
        // Настраиваем события аудио
        audio.onloadedmetadata = () => {
          const audioDuration = audio.duration;
          console.log('🎵 Audio loaded metadata:', {
            duration: audioDuration,
            isFinite: isFinite(audioDuration),
            readyState: audio.readyState,
            src: audio.src.substring(0, 50) + '...'
          });
          
          // Проверяем что duration корректное число
          if (isFinite(audioDuration) && audioDuration > 0) {
            setDuration(audioDuration);
            setIsAudioLoading(false); // Скрываем индикатор загрузки
            console.log('✅ Duration set to:', audioDuration);
          } else {
            console.log('❌ Invalid duration, setting to 0:', audioDuration);
            setDuration(0);
          }
        };
        
        // Добавляем резервный способ загрузки метаданных
        audio.oncanplaythrough = () => {
          if (duration === 0 && isFinite(audio.duration) && audio.duration > 0) {
            console.log('🔄 Setting duration from canplaythrough:', audio.duration);
            setDuration(audio.duration);
            setIsAudioLoading(false); // Скрываем индикатор загрузки
          }
        };
        
        // Добавляем обработчик для быстрой загрузки
        audio.oncanplay = () => {
          if (duration === 0 && isFinite(audio.duration) && audio.duration > 0) {
            console.log('⚡ Setting duration from canplay (fast):', audio.duration);
            setDuration(audio.duration);
            setIsAudioLoading(false); // Скрываем индикатор загрузки
          }
        };
        
        audio.ontimeupdate = () => {
          const time = audio.currentTime;
          if (isFinite(time) && time >= 0) {
            setCurrentTime(time);
          }
        };
        
        // Добавляем обработчик события play для восстановления таймера
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
        };
        
        audio.onpause = () => {
          if (playbackTimerRef.current) {
            clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        };
        
        setRecordedAudio(audio);
        setIsRecording(false);
        
        // Останавливаем таймер записи
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // Stop monitoring and microphone
        audioEngine.stopMicrophoneMonitoring();
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(true);
      
      // Запускаем таймер записи
      setRecordingTime(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      alert('Ошибка доступа к микрофону. Проверьте разрешения браузера.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Останавливаем базовый трек при остановке записи
      if (selectedTrackAudio && !selectedTrackAudio.paused) {
        console.log('🎵 Останавливаем базовый трек при остановке записи');
        selectedTrackAudio.pause();
        setIsPlayingSelectedTrack(false);
      }
      
      // Останавливаем таймер записи
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Stop microphone monitoring
      audioEngine.stopMicrophoneMonitoring();
      // Автоматически выключаем метроном после окончания записи
      if (isMetronomePlaying) {
        audioEngine.stopMetronome();
        setIsMetronomePlaying(false);
      }
    }
  };

  const playRecordedAudio = async () => {
    if (!recordedBlob) return;

    try {
      setIsAudioLoading(true);

      // 1) готовим микс (и кэшируем его)
      let blobToPlay = recordedBlob;
      if (selectedTrack) {
        if (!mixedPreviewBlob) {
          console.log('🎛️ Готовим МИКС для предпрослушивания…');
          const mixed = await mixRecordings(recordedBlob, selectedTrack);
          setMixedPreviewBlob(mixed);
          blobToPlay = mixed;
        } else {
          blobToPlay = mixedPreviewBlob;
        }
      }

      // 2) создаём новый audio из нужного blob (микс/оригинал)
      const url = URL.createObjectURL(blobToPlay);
      const audio = new Audio(url);
      audio.preload = 'auto';

      audio.onloadedmetadata = () => {
        setDuration(isFinite(audio.duration) ? audio.duration : 0);
        setIsAudioLoading(false);
      };
      audio.onplay = () => {
        setIsPlaying(true);
        if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = window.setInterval(() => {
          if (!audio.paused && !audio.ended) setCurrentTime(audio.currentTime);
        }, 100);
      };
      audio.onpause = audio.onended = () => {
        setIsPlaying(false);
        if (playbackTimerRef.current) { clearInterval(playbackTimerRef.current); playbackTimerRef.current = null; }
      };

      setRecordedAudio(audio);
      await audio.play();
    } catch (error) {
      console.error('Ошибка воспроизведения:', error);
      setIsAudioLoading(false);
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
  };

  const seekToPosition = (position: number) => {
    console.log('🎵 seekToPosition called:', {
      position,
      duration,
      hasRecordedAudio: !!recordedAudio,
      isPlaying,
      currentPlaybackTimer: !!playbackTimerRef.current
    });
    
    if (recordedAudio && duration > 0 && isFinite(duration) && isFinite(position)) {
      const newTime = (position / 100) * duration;
      
      console.log('🎯 Calculating new time:', {
        position,
        duration,
        newTime,
        isFiniteNewTime: isFinite(newTime),
        inBounds: newTime >= 0 && newTime <= duration
      });
      
      // Проверяем что newTime корректное число и в допустимых пределах
      if (isFinite(newTime) && newTime >= 0 && newTime <= duration) {
        recordedAudio.currentTime = newTime;
        setCurrentTime(newTime);
        
        console.log('✅ Successfully set audio currentTime to:', newTime);
        
        // Если воспроизведение было приостановлено, возобновляем таймер
        if (isPlaying && !playbackTimerRef.current) {
          console.log('🔄 Restarting playback timer');
          playbackTimerRef.current = window.setInterval(() => {
            if (recordedAudio && !recordedAudio.paused && !recordedAudio.ended) {
              const time = recordedAudio.currentTime;
              if (isFinite(time) && time >= 0) {
                setCurrentTime(time);
              }
            }
          }, 100);
        }
      } else {
        console.log('❌ Invalid newTime:', newTime);
      }
    } else {
      console.log('❌ Invalid conditions for seeking:', {
        hasRecordedAudio: !!recordedAudio,
        duration,
        isFiniteDuration: isFinite(duration),
        isFinitePosition: isFinite(position)
      });
    }
  };

  const formatTime = (seconds: number): string => {
    // Проверяем что seconds корректное число
    if (!isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveRecording = async () => {
    if (!recordedBlob) {
      alert('Нет записи для сохранения');
      return;
    }

    try {
      let finalBlob = mixedPreviewBlob ?? recordedBlob;
      if (selectedTrack && !mixedPreviewBlob) {
        console.log('🎛️ Кэша нет — считаем микс перед сохранением…');
        finalBlob = await mixRecordings(recordedBlob, selectedTrack);
        setMixedPreviewBlob(finalBlob);
      }
      
      console.log('💾 Сохраняем запись:', {
        blobType: finalBlob.type,
        blobSize: finalBlob.size
      });

      // Генерируем имя файла если не указано
      const finalFilename = filename.trim() || `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
      
      // Определяем расширение файла на основе РЕАЛЬНОГО MIME типа
      let extension = '.mp4'; // По умолчанию MP4
      if (finalBlob.type === 'audio/mp4') {
        extension = '.mp4'; // MP4 сохраняем как MP4
      } else if (finalBlob.type.includes('webm')) {
        extension = '.webm'; // WebM сохраняем как WebM
      } else if (finalBlob.type.includes('wav')) {
        extension = '.wav'; // WAV сохраняем как WAV
      }
      
      console.log('📁 Файл будет сохранен как:', `${finalFilename}${extension}`);

      // Создаем ссылку для скачивания
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${finalFilename}${extension}`;
      
      // Добавляем ссылку в DOM, кликаем и удаляем
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Освобождаем память
      URL.revokeObjectURL(url);
      
      console.log('🎵 Запись сохранена:', `${finalFilename}${extension}`);
      
    } catch (error) {
      console.error('Ошибка сохранения записи:', error);
      alert('Ошибка при сохранении записи');
    }
  };

  const uploadToServer = async () => {
    if (!recordedBlob) {
      alert('Нет записи для загрузки');
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      // Определяем имя файла на основе РЕАЛЬНОГО формата
      let uploadFilename = filename || 'recording';
      if (recordedBlob.type === 'audio/mp4') {
        uploadFilename += '.mp4'; // MP4 сохраняем как MP4
      } else if (recordedBlob.type.includes('webm')) {
        uploadFilename += '.webm'; // WebM сохраняем как WebM
      } else {
        uploadFilename += '.mp4'; // fallback к MP4
      }
      
      console.log('🌐 Загружаем на сервер:', {
        blobType: recordedBlob.type,
        blobSize: recordedBlob.size,
        uploadFilename: uploadFilename
      });
      
      formData.append('audio', recordedBlob, uploadFilename);
      formData.append('title', recordingTitle || 'Без названия');
      formData.append('description', recordingDescription);
      formData.append('author', recordingAuthor || 'Аноним');
      formData.append('bpm', bpm.toString());

      const response = await fetch('http://localhost:3003/api/recordings', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const result = await response.json();
      console.log('🎵 Запись загружена на сервер:', result);
      
      setUploadSuccess(true);
      
      // Сбрасываем форму через 3 секунды
      setTimeout(() => {
        setUploadSuccess(false);
        setRecordingTitle('');
        setRecordingDescription('');
        setRecordingAuthor('');
      }, 3000);

    } catch (error) {
      console.error('Ошибка при загрузке на сервер:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при загрузке на сервер: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Загружаем записи при монтировании компонента
  useEffect(() => {
    loadRecordings();
  }, []);

  return (
    <div id="record-page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div id="record-theme-toggle" style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      
      <div id="record-main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(20px, 4vw, 30px)', maxWidth: 'clamp(300px, 90vw, 600px)', width: '100%' }}>
        <div id="record-header" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button id="back-button" onClick={() => window.history.back()}>← Назад</button>
          <h2 id="page-title" style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 24px)' }}>Запись аудио</h2>
        </div>

        {/* Metronome Controls */}
        <div id="metronome-section" className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h3 id="metronome-title" style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>Метроном</h3>
          <div id="metronome-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)' }}>
            <div id="metronome-buttons" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                id="metronome-toggle-button"
                onClick={startMetronome}
                style={{
                  padding: 'clamp(8px, 2vw, 12px) clamp(16px, 3vw, 24px)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: isMetronomePlaying ? 'var(--link)' : 'var(--button-bg)',
                  color: isMetronomePlaying ? 'white' : 'var(--button-fg)',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 2.5vw, 16px)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isMetronomePlaying ? '⏹️ Остановить' : '▶️ Запустить'} метроном
              </button>
            </div>
            
            {/* Metronome Volume Control */}
            <div id="metronome-volume-control" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: '300px' }}>
              <span id="metronome-volume-label" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '60px' }}>🔊 Метроном:</span>
              <input
                id="metronome-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={metronomeVolume}
                onChange={(e) => handleMetronomeVolumeChange(Number(e.target.value))}
                style={{ 
                  flex: 1, 
                  height: '6px', 
                  borderRadius: '3px', 
                  background: 'var(--border)',
                  cursor: 'pointer'
                }}
              />
              <span id="metronome-volume-value" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '40px', fontWeight: 'bold' }}>
                {Math.round(metronomeVolume * 100)}%
              </span>
            </div>
            
            {/* Microphone Monitoring Volume Control */}
            <div id="microphone-volume-control" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: '300px' }}>
              <span id="microphone-volume-label" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '60px' }}>🎤 Громкость:</span>
              <input
                id="microphone-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={microphoneVolume}
                onChange={(e) => handleMicrophoneVolumeChange(Number(e.target.value))}
                style={{ 
                  flex: 1, 
                  height: '6px', 
                  borderRadius: '3px', 
                  background: 'var(--border)',
                  cursor: 'pointer'
                }}
              />
              <span id="microphone-volume-value" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '40px', fontWeight: 'bold' }}>
                {Math.round(microphoneVolume * 100)}%
              </span>
            </div>
            
            {/* Microphone Sensitivity Control */}
            <div id="microphone-sensitivity-control" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: '300px' }}>
              <span id="microphone-sensitivity-label" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '60px' }}>📶 Чувствительность:</span>
              <input
                id="microphone-sensitivity-slider"
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={microphoneSensitivity}
                onChange={(e) => handleMicrophoneSensitivityChange(Number(e.target.value))}
                style={{ 
                  flex: 1, 
                  height: '6px', 
                  borderRadius: '3px', 
                  background: 'var(--border)',
                  cursor: 'pointer'
                }}
              />
              <span id="microphone-sensitivity-value" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '40px', fontWeight: 'bold' }}>
                {microphoneSensitivity.toFixed(1)}x
              </span>
            </div>
            
            {/* BPM Range Slider */}
            <div id="bpm-control" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: '300px' }}>
              <span id="bpm-label" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '60px' }}>🎵 BPM:</span>
              <input
                id="bpm-slider"
                type="range"
                min="30"
                max="300"
                step="1"
                value={bpm}
                onChange={(e) => handleBpmChange(Number(e.target.value))}
                style={{ 
                  flex: 1, 
                  height: '6px', 
                  borderRadius: '3px', 
                  background: 'var(--border)',
                  cursor: 'pointer'
                }}
              />
              <span id="bpm-value" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', minWidth: '40px', fontWeight: 'bold' }}>
                {bpm}
              </span>
            </div>
            
            {/* Status indicators */}
            <div id="metronome-status-indicators" style={{ textAlign: 'center' }}>
              {isMetronomePlaying && (
                <div id="metronome-playing-status" style={{ 
                  fontSize: 'clamp(12px, 2.5vw, 14px)', 
                  color: 'var(--link)', 
                  fontWeight: 'bold',
                  marginBottom: '4px'
                }}>
                  🎵 Метроном: {bpm} BPM
                </div>
              )}
              
              {isRecording && (
                <div id="recording-clean-status" style={{ 
                  fontSize: 'clamp(12px, 2.5vw, 14px)', 
                  color: '#dc3545', 
                  fontWeight: 'bold'
                }}>
                  🎤 Чистая запись (без метронома)
                </div>
              )}
              
              {isRecording && isMetronomePlaying && (
                <div id="recording-with-metronome-hint" style={{ 
                  fontSize: '10px', 
                  opacity: 0.7, 
                  marginTop: '4px'
                }}>
                  Вы слышите метроном в наушниках, но он не записывается
                </div>
              )}
            </div>
            

          </div>
        </div>

        {/* Live визуализация во время записи */}
        <div id="live-visualizer-container">
          <LiveVisualizer 
            isRecording={isRecording}
            microphoneStream={mediaStreamRef.current}
          />
        </div>

        {/* Recording Controls */}
        <div id="recording-section" className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h3 id="recording-title" style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>Запись</h3>
          
          {/* Quality Info */}
          <div id="recording-quality-info" style={{ 
            background: 'rgba(var(--link-rgb, 0, 123, 255), 0.1)', 
            border: '1px solid rgba(var(--link-rgb, 0, 123, 255), 0.3)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: 'clamp(11px, 2vw, 13px)',
            lineHeight: '1.4'
          }}>
            💡 <strong>Высокое качество записи:</strong><br/>
            Метроном слышен только в наушниках/колонках для синхронизации.<br/>
            В запись попадает ваш голос/инструмент с применённой чувствительностью.<br/>
            📶 <strong>Чувствительность:</strong> 0.1x = тихо, 1.0x = норма, 3.0x = очень громко<br/>
            🎧 <strong>Тестируйте уровни:</strong> Говорите в микрофон и слушайте изменения в наушниках
          </div>
          <div id="recording-playback-buttons" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {!isRecording ? (
              <button
                id="start-recording-button"
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
                🎤 Начать запись
              </button>
            ) : (
              <button
                id="stop-recording-button"
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
                ⏹️ Остановить запись
              </button>
            )}
            
            {/* Кнопки воспроизведения */}
            {recordedBlob && !isRecording && (
              <div id="playback-buttons">
                {!isPlaying ? (
            <button
                    id="play-button"
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
                    ▶️ Воспроизвести
                  </button>
                ) : (
                  <button
                    id="stop-playback-button"
                    onClick={stopRecordedAudio}
                    style={{
                      padding: 'clamp(12px, 3vw, 16px) clamp(24px, 4vw, 32px)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ff9800',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: 'clamp(14px, 2.5vw, 16px)'
                    }}
                  >
                    ⏹️ Остановить
            </button>
                )}
              </div>
            )}
          </div>
          
          {/* Статус индикаторы и таймеры */}
          <div id="status-indicators" style={{ marginTop: 16 }}>
            {isRecording && (
              <div id="recording-status" style={{ color: '#dc3545', fontWeight: 'bold', fontSize: 'clamp(14px, 2.5vw, 16px)' }}>
                🎤 Запись... {formatTime(recordingTime)}
              </div>
            )}
            {isPlaying && (
              <div id="playback-status" style={{ color: 'var(--link)', fontWeight: 'bold', fontSize: 'clamp(14px, 2.5vw, 16px)' }}>
                ▶️ Воспроизведение... {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            )}

          </div>

          {/* Аудиовизуализация */}
          {recordedBlob && (
            <div id="audio-visualizer-section">

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
                <div id="audio-loading-indicator" style={{
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
            </div>
          )}

          {/* Сохранение записи */}
          {recordedBlob && duration > 0 && (
            <div id="save-recording-section" className="card" style={{ width: '100%', textAlign: 'center' }}>
              <h3 id="save-recording-title" style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>
                💾 Сохранить запись
              </h3>
              
              <div id="save-recording-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)' }}>
                {/* Поле для имени файла */}
                <div id="filename-input-container" style={{ width: '100%', maxWidth: '400px' }}>
                  <label id="filename-label" htmlFor="filename-input" style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: 'clamp(12px, 2.5vw, 14px)', 
                    fontWeight: '500' 
                  }}>
                    Имя файла (необязательно):
                  </label>
                  <input
                    id="filename-input"
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="Моя запись"
                    style={{
                      width: '100%',
                      padding: 'clamp(8px, 2vw, 12px)',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text)',
                      fontSize: 'clamp(14px, 2.5vw, 16px)',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--link)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                  <div id="filename-hint" style={{ 
                    fontSize: 'clamp(10px, 1.8vw, 11px)', 
                    opacity: 0.6, 
                    marginTop: '4px',
                    textAlign: 'left'
                  }}>
                    Если не указано, будет использовано: recording_YYYY-MM-DD_HH-MM-SS
                  </div>
                </div>

                {/* Кнопка сохранения */}
                <button
                  id="save-recording-button"
                  onClick={saveRecording}
                  style={{
                    padding: 'clamp(12px, 3vw, 16px) clamp(24px, 4vw, 32px)',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 'clamp(14px, 2.5vw, 16px)',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
                  }}
                >
                  💾 Скачать запись
                </button>

                {/* Информация о файле */}
                <div id="file-info" style={{ 
                  fontSize: 'clamp(11px, 2vw, 12px)', 
                  opacity: 0.7,
                  textAlign: 'center',
                  lineHeight: 1.4
                }}>
                  <div>📊 Длительность: {formatTime(duration)}</div>
                  <div>📁 Размер: {(recordedBlob.size / 1024).toFixed(1)} KB</div>
                  <div>🎵 Формат: MP3 (совместимый)</div>
                </div>
            </div>
          </div>
        )}

          {/* Загрузка на сервер */}
          {recordedBlob && duration > 0 && (
            <div id="upload-to-server-section" className="card" style={{ width: '100%', textAlign: 'center' }}>
              <h3 id="upload-to-server-title" style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>
                🌐 Сохранить на сайте
              </h3>
              
              <div id="upload-to-server-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)' }}>
                
                {/* Форма для метаданных */}
                <div id="recording-metadata-form" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Название записи */}
                  <div id="title-input-container">
                    <label id="title-label" htmlFor="title-input" style={{ 
                      display: 'block', 
                      marginBottom: '4px', 
                      fontSize: 'clamp(12px, 2.5vw, 14px)', 
                      fontWeight: '500' 
                    }}>
                      Название записи: *
                    </label>
                    <input
                      id="title-input"
                      type="text"
                      value={recordingTitle}
                      onChange={(e) => setRecordingTitle(e.target.value)}
                      placeholder="Моя музыкальная запись"
                      style={{
                        width: '100%',
                        padding: 'clamp(8px, 2vw, 12px)',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        fontSize: 'clamp(14px, 2.5vw, 16px)',
                        outline: 'none',
                        transition: 'border-color 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--link)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>

                  {/* Автор */}
                  <div id="author-input-container">
                    <label id="author-label" htmlFor="author-input" style={{ 
                      display: 'block', 
                      marginBottom: '4px', 
                      fontSize: 'clamp(12px, 2.5vw, 14px)', 
                      fontWeight: '500' 
                    }}>
                      Автор:
                    </label>
                    <input
                      id="author-input"
                      type="text"
                      value={recordingAuthor}
                      onChange={(e) => setRecordingAuthor(e.target.value)}
                      placeholder="Ваше имя"
                      style={{
                        width: '100%',
                        padding: 'clamp(8px, 2vw, 12px)',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        fontSize: 'clamp(14px, 2.5vw, 16px)',
                        outline: 'none',
                        transition: 'border-color 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--link)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>

                  {/* Описание */}
                  <div id="description-input-container">
                    <label id="description-label" htmlFor="description-input" style={{ 
                      display: 'block', 
                      marginBottom: '4px', 
                      fontSize: 'clamp(12px, 2.5vw, 14px)', 
                      fontWeight: '500' 
                    }}>
                      Описание:
                    </label>
                    <textarea
                      id="description-input"
                      value={recordingDescription}
                      onChange={(e) => setRecordingDescription(e.target.value)}
                      placeholder="Опишите вашу запись..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 'clamp(8px, 2vw, 12px)',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        fontSize: 'clamp(14px, 2.5vw, 16px)',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                        resize: 'vertical',
                        minHeight: '60px'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--link)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>
                </div>

                {/* Кнопка загрузки */}
                <button
                  id="upload-to-server-button"
                  onClick={uploadToServer}
                  disabled={isUploading || !recordingTitle.trim()}
                  style={{
                    padding: 'clamp(12px, 3vw, 16px) clamp(24px, 4vw, 32px)',
                    borderRadius: '8px',
                    border: 'none',
                    background: uploadSuccess 
                      ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
                      : isUploading 
                        ? 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)'
                        : 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                    color: 'white',
                    cursor: isUploading || !recordingTitle.trim() ? 'not-allowed' : 'pointer',
                    fontSize: 'clamp(14px, 2.5vw, 16px)',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: isUploading || !recordingTitle.trim() ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isUploading && recordingTitle.trim()) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
                  }}
                >
                  {uploadSuccess ? (
                    <>✅ Загружено на сайт!</>
                  ) : isUploading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Загрузка...
                    </>
                  ) : (
                    <>🌐 Сохранить на сайте</>
                  )}
                </button>

                {/* Информация о загрузке */}
                <div id="upload-info" style={{ 
                  fontSize: 'clamp(11px, 2vw, 12px)', 
                  opacity: 0.7,
                  textAlign: 'center',
                  lineHeight: 1.4
                }}>
                  <div>📊 BPM: {bpm}</div>
                  <div>⏱️ Длительность: {formatTime(duration)}</div>
                  <div>📁 Размер: {(recordedBlob.size / 1024).toFixed(1)} KB</div>
                  <div style={{ marginTop: '8px', fontSize: 'clamp(10px, 1.8vw, 11px)', opacity: 0.6 }}>
                    Запись будет доступна другим пользователям для совместного творчества
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Выбор трека для записи поверх */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Выберите трек для записи поверх</h3>
          {isLoadingTrack ? (
            <div className="text-center py-4">Загрузка записей...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recordings.map((track) => (
                <div
                  key={track.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTrack?.id === track.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => selectTrack(track)}
                >
                  <h4 className="font-medium">{track.title}</h4>
                  <p className="text-sm text-gray-600">{track.author}</p>
                  <p className="text-xs text-gray-500">BPM: {track.bpm}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(track.uploadDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {selectedTrack && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800">Выбранный трек:</h4>
              <p className="text-blue-600">{selectedTrack.title} - {selectedTrack.author}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={playSelectedTrack}
                  disabled={isPlayingSelectedTrack}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  ▶️ Воспроизвести
                </button>
                <button
                  onClick={stopSelectedTrack}
                  disabled={!isPlayingSelectedTrack}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  ⏹️ Остановить
                </button>
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  ❌ Отменить выбор
                </button>
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}

export default RecordPage;




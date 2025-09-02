import { useState, useRef, useEffect } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import AudioVisualizer from '../components/AudioVisualizer';
import LiveVisualizer from '../components/LiveVisualizer';
import { audioEngine } from '../audioEngine';

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

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

      const options: MediaRecorderOptions = {};
      try {
        // Пробуем использовать более эффективные кодеки
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options.mimeType = 'audio/webm;codecs=opus';
          options.audioBitsPerSecond = 128000; // Оптимальное качество для быстрой загрузки
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options.mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        
        // Создаем blob URL для быстрого доступа
        const audioUrl = URL.createObjectURL(blob);
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
    if (recordedAudio) {
      try {
        // Показываем индикатор загрузки если аудио еще не готово
        if (recordedAudio.readyState < 2) {
          setIsAudioLoading(true);
        }
        
        await recordedAudio.play();
        setIsPlaying(true);
        setIsAudioLoading(false);
        
        // Очищаем предыдущий таймер если есть
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
        }
        
        // Запускаем обновление позиции воспроизведения
        playbackTimerRef.current = window.setInterval(() => {
          if (recordedAudio && !recordedAudio.paused && !recordedAudio.ended) {
            const time = recordedAudio.currentTime;
            if (isFinite(time) && time >= 0) {
              setCurrentTime(time);
            }
          }
        }, 100);
      } catch (error) {
        console.error('Ошибка воспроизведения:', error);
        setIsAudioLoading(false);
      }
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


        </div>


      </div>
    </div>
  );
}

export default RecordPage;




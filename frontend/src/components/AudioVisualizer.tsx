import { useEffect, useRef, useState } from 'react';

type AudioVisualizerProps = {
  audioBlob: Blob;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (position: number) => void;
  onPlayPause?: () => void;
};

export function AudioVisualizer({ audioBlob, currentTime, duration, isPlaying, onSeek, onPlayPause }: AudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  // Генерируем waveform из аудио blob
  useEffect(() => {
    if (!audioBlob) return;

    const generateWaveform = async () => {
      setIsLoading(true);
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0); // Берем первый канал
        const samples = 150; // Оптимальное количество для современного вида
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];

        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const sample = Math.abs(rawData[blockStart + j] || 0);
            sum += sample;
            max = Math.max(max, sample);
          }
          // Используем комбинацию среднего и максимального значения
          filteredData.push((sum / blockSize) * 0.6 + max * 0.4);
        }

        // Нормализуем данные
        const maxVal = Math.max(...filteredData);
        const normalizedData = filteredData.map(val => (val / maxVal) || 0);
        
        setWaveformData(normalizedData);
        setIsLoading(false);
      } catch (error) {
        console.error('Ошибка генерации waveform:', error);
        setIsLoading(false);
        // Создаем фейковые данные в случае ошибки
        setWaveformData(Array.from({ length: 150 }, () => Math.random() * 0.5));
      }
    };

    generateWaveform();
  }, [audioBlob]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const progress = (mouseX / rect.width) * 100;
    setHoverPosition(Math.max(0, Math.min(100, progress)));
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('🎵 AudioVisualizer click detected', { duration, containerRef: !!containerRef.current });
    
    if (!containerRef.current || duration === 0) {
      console.log('❌ Click cancelled - missing container or zero duration');
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progress = (clickX / rect.width) * 100;
    const seekPosition = Math.max(0, Math.min(100, progress));
    
    console.log('🎯 Seeking to position:', {
      clickX,
      containerWidth: rect.width,
      progress: progress.toFixed(2),
      seekPosition: seekPosition.toFixed(2),
      targetTime: ((seekPosition / 100) * duration).toFixed(2)
    });
    
    onSeek(seekPosition);
  };

  const formatTimeFromPercent = (percent: number): string => {
    const time = (percent / 100) * duration;
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div id="audio-visualizer" style={{ width: '100%', marginTop: 24 }}>
      <div id="audio-visualizer-container" style={{ 
        background: '#ffffff', 
        borderRadius: '12px', 
        padding: '20px',
        boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
        border: '1px solid #f0f0f0'
      }}>
        
        {isLoading ? (
          <div id="audio-visualizer-loading" style={{ 
            height: 60, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '14px',
            color: '#666',
            background: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <div>Загрузка...</div>
          </div>
        ) : (
          <>
            {/* Минималистичная waveform */}
            <div id="waveform-player" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              height: '60px'
            }}>
              {/* Waveform область */}
              <div 
                id="waveform-container"
                ref={containerRef}
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  width: '100%',
                  height: '60px',
                  position: 'relative',
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Кликните для перехода к нужной позиции"
              >
                {/* Waveform bars - розовый стиль */}
                <div id="waveform-bars" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  height: '100%', 
                  gap: '1px',
                  pointerEvents: 'none'
                }}>
                  {waveformData.map((amplitude, index) => {
                    const barProgress = (index / waveformData.length) * 100;
                    const isPlayed = barProgress <= progress;
                    const isHovered = hoverPosition !== null && Math.abs(barProgress - hoverPosition) < 3;
                    
                    return (
                      <div
                        key={index}
                        id={`waveform-bar-${index}`}
                        style={{
                          width: '2px',
                          height: `${Math.max(2, amplitude * 50)}px`,
                          minHeight: '2px',
                          background: isPlayed 
                            ? '#e91e63'  // Ярко-розовый для воспроизведенного
                            : isHovered 
                              ? '#f48fb1'  // Светло-розовый при hover
                              : '#f8bbd9',  // Бледно-розовый для невоспроизведенного
                          borderRadius: '1px',
                          transition: 'all 0.1s ease',
                          transform: isHovered ? 'scaleY(1.2)' : 'scaleY(1)',
                          pointerEvents: 'none'
                        }}
                      />
                    );
                  })}
                </div>
                
                {/* Progress line - минималистичный */}
                <div id="waveform-progress-line" style={{
                  position: 'absolute',
                  left: `${progress}%`,
                  top: '0',
                  bottom: '0',
                  width: '2px',
                  background: '#e91e63',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  transition: 'left 0.1s ease',
                  pointerEvents: 'none'
                }} />
                
                {/* Hover indicator */}
                {hoverPosition !== null && (
                  <div id="waveform-hover-indicator" style={{
                    position: 'absolute',
                    left: `${hoverPosition}%`,
                    top: '0',
                    bottom: '0',
                    width: '1px',
                    background: 'rgba(233, 30, 99, 0.5)',
                    transform: 'translateX(-50%)',
                    zIndex: 5,
                    pointerEvents: 'none'
                  }} />
                )}
              </div>
              

            </div>
            
            {/* Минималистичная информация */}
            <div id="waveform-time-info" style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              color: '#666',
              fontSize: '12px'
            }}>
              <div id="current-time-display">
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
              </div>
              
              {hoverPosition !== null && (
                <div id="hover-time-display" style={{ 
                  background: '#f0f0f0',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#666'
                }}>
                  {formatTimeFromPercent(hoverPosition)}
                </div>
              )}
              
              <div id="total-time-display">
                {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AudioVisualizer;

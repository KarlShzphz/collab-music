import { useEffect, useRef } from 'react';

type LiveVisualizerProps = {
  isRecording: boolean;
  microphoneStream?: MediaStream | null;
};

export function LiveVisualizer({ isRecording, microphoneStream }: LiveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording || !microphoneStream) {
      // Останавливаем визуализацию
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      
      // Очищаем canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    // Создаем анализатор для live визуализации
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(microphoneStream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    
    analyserRef.current = analyser;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording || !analyserRef.current) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      
      // Очищаем canvas
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      
      // Рисуем частотный спектр
      const barWidth = width / bufferLength * 2;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.8;
        
        // Цветовая схема: от зеленого к красному в зависимости от уровня
        const intensity = dataArray[i] / 255;
        const hue = (1 - intensity) * 120; // 120 = зеленый, 0 = красный
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
      
      // Рисуем общий уровень громкости
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const levelPercent = (average / 255) * 100;
      
      // Индикатор уровня в правой части
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.fillText(`${Math.round(levelPercent)}%`, width - 40, 20);
      
      // Полоска уровня
      const levelBarWidth = 20;
      const levelBarHeight = height - 40;
      const levelBarX = width - 30;
      const levelBarY = 30;
      
      // Фон полоски
      ctx.fillStyle = '#ddd';
      ctx.fillRect(levelBarX, levelBarY, levelBarWidth, levelBarHeight);
      
      // Заполнение полоски
      const fillHeight = (levelPercent / 100) * levelBarHeight;
      const fillY = levelBarY + levelBarHeight - fillHeight;
      
      if (levelPercent > 80) {
        ctx.fillStyle = '#ff4444'; // Красный для высокого уровня
      } else if (levelPercent > 50) {
        ctx.fillStyle = '#ffaa00'; // Оранжевый для среднего уровня
      } else {
        ctx.fillStyle = '#44ff44'; // Зеленый для низкого уровня
      }
      
      ctx.fillRect(levelBarX, fillY, levelBarWidth, fillHeight);

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    };
  }, [isRecording, microphoneStream]);

  if (!isRecording) {
    return null;
  }

  return (
    <div id="live-visualizer" style={{ width: '100%', marginTop: 24 }}>
      <div id="live-visualizer-container" style={{ 
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%)', 
        borderRadius: '16px', 
        padding: '24px',
        boxShadow: '0 8px 32px rgba(255, 107, 107, 0.2)',
        border: '1px solid rgba(255,255,255,0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background */}
        <div id="live-visualizer-bg-animation" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          animation: 'pulse 2s ease-in-out infinite alternate'
        }} />
        
        <div id="live-visualizer-title" style={{ 
          fontSize: 'clamp(14px, 2.5vw, 18px)', 
          fontWeight: '600', 
          marginBottom: 16,
          textAlign: 'center',
          color: 'white',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          🎤 Live запись - частотный анализ
        </div>
        
        <div id="live-visualizer-canvas-container" style={{ 
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '12px',
          padding: '16px',
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(10px)'
        }}>
          <canvas
            id="live-visualizer-canvas"
            ref={canvasRef}
            width={600}
            height={100}
            style={{
              width: '100%',
              height: '100px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)'
            }}
          />
        </div>
        
        <div id="live-visualizer-description" style={{ 
          fontSize: 'clamp(11px, 2vw, 13px)', 
          color: 'rgba(255,255,255,0.9)', 
          textAlign: 'center',
          marginTop: 12,
          position: 'relative',
          zIndex: 1
        }}>
          📊 Показывает частотный спектр и уровень входящего сигнала в реальном времени
        </div>
      </div>
    </div>
  );
}

export default LiveVisualizer;

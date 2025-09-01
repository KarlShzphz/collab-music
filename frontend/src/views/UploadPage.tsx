import { useState, useRef } from 'react';
import ThemeToggle from '../components/ThemeToggle';

export function UploadPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('audio/')) {
      setUploadedFile(file);
    } else {
      alert('Пожалуйста, выберите аудио файл');
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const playAudio = () => {
    if (uploadedFile) {
      const audio = new Audio(URL.createObjectURL(uploadedFile));
      audio.play();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(20px, 4vw, 30px)', maxWidth: 'clamp(300px, 90vw, 600px)', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => window.history.back()}>← Назад</button>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 24px)' }}>Загрузка аудио</h2>
        </div>

        {/* File Upload Area */}
        <div className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>Выберите аудио файл</h3>
          
          <div
            style={{
              border: `2px dashed ${isDragOver ? 'var(--link)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: 'clamp(20px, 5vw, 40px)',
              background: isDragOver ? 'var(--link)' + '10' : 'transparent',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadClick}
          >
            <div style={{ fontSize: 'clamp(14px, 3vw, 18px)', marginBottom: '12px' }}>
              🎵 Перетащите аудио файл сюда или кликните для выбора
            </div>
            <div style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', opacity: 0.7 }}>
              Поддерживаемые форматы: MP3, WAV, OGG, M4A
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          <button
            onClick={handleUploadClick}
            style={{
              marginTop: '16px',
              padding: 'clamp(10px, 2.5vw, 14px) clamp(20px, 4vw, 28px)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--button-bg)',
              color: 'var(--button-fg)',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 2.5vw, 16px)'
            }}
          >
            Выбрать файл
          </button>
        </div>

        {/* File Info and Playback */}
        {uploadedFile && (
          <div className="card" style={{ width: '100%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 'clamp(16px, 3vw, 20px)' }}>Загруженный файл</h3>
            
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Название:</strong> {uploadedFile.name}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Размер:</strong> {formatFileSize(uploadedFile.size)}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Тип:</strong> {uploadedFile.type || 'Неизвестно'}
              </div>
              <div>
                <strong>Дата:</strong> {new Date(uploadedFile.lastModified).toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'clamp(12px, 3vw, 20px)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={playAudio}
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
              
              <button
                onClick={() => setUploadedFile(null)}
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
                Удалить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadPage;




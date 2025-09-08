import { useMemo, useState, useEffect } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import { mockCatalog } from '../mockCatalog';

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
              border: (t as any).isServerRecording ? '2px solid #4CAF50' : undefined,
              background: (t as any).isServerRecording ? 'linear-gradient(135deg, #f8fff8 0%, #e8f5e8 100%)' : undefined
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
                          // Передаем выбранную запись на страницу записи
                          const selectedRecording = {
                            id: (t as any).id,
                            title: (t as any).title,
                            description: (t as any).description,
                            author: (t as any).author,
                            bpm: (t as any).bpm,
                            filename: (t as any).filename,
                            originalName: (t as any).originalName,
                            size: (t as any).size,
                            mimetype: (t as any).mimetype,
                            uploadDate: (t as any).uploadDate,
                            url: (t as any).url
                          };
                          
                          // Сохраняем в localStorage для передачи на RecordPage
                          localStorage.setItem('selectedRecordingForOverdub', JSON.stringify(selectedRecording));
                          
                          // Переходим на страницу записи
                          window.location.href = '/record';
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
    </div>
  );
}

export default Search;




import { useMemo, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import { mockCatalog } from '../mockCatalog';

type Props = {
  goHome: () => void;
};

export function Search({ goHome }: Props) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockCatalog;
    return mockCatalog.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.author.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(16px, 3vw, 20px)', maxWidth: 'clamp(280px, 90vw, 800px)', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={goHome}>← На главную</button>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 22px)' }}>Поиск треков</h2>
        </div>
        <input 
          type="search" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Название, автор или тег"
          style={{ width: '100%', maxWidth: 'clamp(250px, 80vw, 600px)' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxHeight: '60vh', overflowY: 'auto' }}>
          {results.map((t) => (
            <div key={t.id} className="card">
              <div style={{ fontWeight: 600, fontSize: 'clamp(14px, 3vw, 16px)' }}>{t.title}</div>
              <div style={{ opacity: 0.8, fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Автор: {t.author}{t.bpm ? ` · ${t.bpm} BPM` : ''}</div>
              {t.tags.length > 0 && (
                <div style={{ opacity: 0.8, fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Теги: {t.tags.join(', ')}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Search;




import { useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import RecordPage from './RecordPage';
import UploadPage from './UploadPage';

export function RecordUpload() {
  const [currentPage, setCurrentPage] = useState<'choice' | 'record' | 'upload'>('choice');

  if (currentPage === 'record') {
    return <RecordPage />;
  }

  if (currentPage === 'upload') {
    return <UploadPage />;
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px, 4vw, 60px)', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
        <div className="iconCard iconCard--record" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setCurrentPage('record')}>
          <div>
            <img src="/Record icon frame.svg" alt="Record an audio" style={{ width: 'clamp(80px, 20vw, 150px)', height: 'clamp(80px, 20vw, 150px)' }} />
          </div>
          <div style={{ marginTop: 16, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>Record an audio</div>
        </div>
        <div style={{ opacity: 0.8, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>or</div>
        <div className="iconCard iconCard--record" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setCurrentPage('upload')}>
          <div>
            <img src="/Upload icon frame.svg" alt="Upload an audio" style={{ width: 'clamp(80px, 20vw, 150px)', height: 'clamp(80px, 20vw, 150px)' }} />
          </div>
          <div style={{ marginTop: 16, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>Upload an audio</div>
        </div>
      </div>
    </div>
  );
}

export default RecordUpload;




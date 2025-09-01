// Using provided SVGs from public folder
import ThemeToggle from '../components/ThemeToggle';

type Props = {
  goToRecordUpload: () => void;
  goToSearch: () => void;
};

export function Home({ goToRecordUpload, goToSearch }: Props) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px, 4vw, 60px)', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
        <div className="iconCard iconCard--record" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={goToRecordUpload}>
          <div>
            <img src="/Record frame.svg" alt="Record or upload" style={{ width: 'clamp(80px, 20vw, 150px)', height: 'clamp(80px, 20vw, 150px)' }} />
          </div>
          <div style={{ marginTop: 16, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>Record or upload an audio</div>
        </div>
        <div style={{ opacity: 1, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>or</div>
        <div className="iconCard iconCard--search" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={goToSearch}>
          <div>
            <img src="/Search frame.svg" alt="Look for an audio" style={{ width: 'clamp(80px, 20vw, 150px)', height: 'clamp(80px, 20vw, 150px)' }} />
          </div>
          <div style={{ marginTop: 16, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>Look for an audio</div>
        </div>
      </div>
    </div>
  );
}

export default Home;



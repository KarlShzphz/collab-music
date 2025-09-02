import ThemeToggle from '../components/ThemeToggle';

type HomeProps = {
  goToRecordUpload: () => void;
  goToSearch: () => void;
};

/**
 * Home page component with navigation options
 * @param goToRecordUpload - Function to navigate to record/upload page
 * @param goToSearch - Function to navigate to search page
 * @returns Home page component with navigation cards
 */
export function Home({ goToRecordUpload, goToSearch }: HomeProps) {
  return (
    <div id="home-page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      <div id="theme-toggle-container" style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div id="navigation-cards" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px, 4vw, 60px)', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
        <div id="record-upload-card" className="iconCard iconCard--record" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={goToRecordUpload}>
          <div id="record-upload-icon">
            <img id="record-upload-image" src="/Record frame.svg" alt="Record or upload" style={{ width: 'clamp(80px, 20vw, 150px)', height: 'clamp(80px, 20vw, 150px)' }} />
          </div>
          <div id="record-upload-text" style={{ marginTop: 16, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>Record or upload an audio</div>
        </div>
        <div id="navigation-separator" style={{ opacity: 1, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>or</div>
        <div id="search-card" className="iconCard iconCard--search" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={goToSearch}>
          <div id="search-icon">
            <img id="search-image" src="/Search frame.svg" alt="Look for an audio" style={{ width: 'clamp(80px, 20vw, 150px)', height: 'clamp(80px, 20vw, 150px)' }} />
          </div>
          <div id="search-text" style={{ marginTop: 16, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>Look for an audio</div>
        </div>
      </div>
    </div>
  );
}

export default Home;

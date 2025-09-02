import { useEffect, useState } from 'react'
import './App.css'
import type { Track } from './types'
// import { useAudioBuffers } from './hooks' // Reserved for future use
import Home from './views/Home'
import RecordUpload from './views/RecordUpload'
import Search from './views/Search'

/**
 * Main application component that handles routing and track management
 * @returns The main app component with route-based rendering
 */
function App() {
  // const [bpm, setBpm] = useState(120) // Reserved for future use
  // const [tracks, setTracks] = useState<Array<Track>>([]) // Reserved for future use
  // const { isDecoding } = useAudioBuffers(tracks) // Reserved for future use
  const [route, setRoute] = useState<'home' | 'recordUpload' | 'search'>('home')

  useEffect(() => {
    function parseRouteFromHash(): 'home' | 'recordUpload' | 'search' {
      const h = window.location.hash.replace(/^#/, '')
      if (h === '/record-upload' || h === 'record-upload') return 'recordUpload'
      if (h === '/search' || h === 'search') return 'search'
      return 'home'
    }

    // Init from current hash
    setRoute(parseRouteFromHash())

    const onHashChange = () => setRoute(parseRouteFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigateTo(next: 'home' | 'recordUpload' | 'search') {
    const hash = next === 'home' ? '/' : next === 'recordUpload' ? '/record-upload' : '/search'
    if (window.location.hash !== `#${hash}`) {
      window.location.hash = hash
    } else {
      setRoute(next)
    }
  }

  // Reserved for future use - track management functions
  // function addTrack(t: Track) {
  //   setTracks((prev) => [...prev, t])
  // }

  // function updateOffset(id: string, offset: number) {
  //   setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, offsetSec: offset } : t)))
  // }

  return (
    <div id="app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {route === 'home' && (
        <div id="home-route">
          <Home
            goToRecordUpload={() => navigateTo('recordUpload')}
            goToSearch={() => navigateTo('search')}
          />
        </div>
      )}

      {route === 'recordUpload' && (
        <div id="record-upload-route">
          <RecordUpload />
        </div>
      )}

      {route === 'search' && (
        <div id="search-route">
          <Search goHome={() => navigateTo('home')} />
        </div>
      )}
    </div>
  )
}

export default App

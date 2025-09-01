import { useEffect, useState } from 'react'
import './App.css'
import type { Track } from './types'
import { useAudioBuffers } from './hooks'
import Home from './views/Home'
import RecordUpload from './views/RecordUpload'
import Search from './views/Search'

function App() {
  const [bpm, setBpm] = useState(120)
  const [tracks, setTracks] = useState<Array<Track>>([])
  const { isDecoding } = useAudioBuffers(tracks)
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

  function addTrack(t: Track) {
    setTracks((prev) => [...prev, t])
  }

  function updateOffset(id: string, offset: number) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, offsetSec: offset } : t)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {route === 'home' && (
        <Home
          goToRecordUpload={() => navigateTo('recordUpload')}
          goToSearch={() => navigateTo('search')}
        />
      )}

      {route === 'recordUpload' && (
        <RecordUpload />
      )}

      {route === 'search' && (
        <Search goHome={() => navigateTo('home')} />
      )}
    </div>
  )
}

export default App

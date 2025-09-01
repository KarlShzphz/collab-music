import { useEffect, useState } from 'react';
import { audioEngine } from '../audioEngine';
import { Track } from '../types';

type Props = {
  tracks: Array<Track>;
  bpm: number;
};

export function Transport({ tracks, bpm }: Props) {
  const [isTracksPlaying, setIsTracksPlaying] = useState(false);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [masterGain, setMasterGain] = useState(0.9);

  useEffect(() => {
    return () => audioEngine.stopAll();
  }, []);

  async function handlePlayTracks() {
    audioEngine.stopTracks();
    await audioEngine.resume();
    await audioEngine.startTracks(tracks, masterGain);
    setIsTracksPlaying(true);
  }

  function handleStopTracks() {
    audioEngine.stopTracks();
    setIsTracksPlaying(false);
  }

  async function toggleMetronome() {
    if (isMetronomeOn) {
      audioEngine.stopMetronome();
      setIsMetronomeOn(false);
    } else {
      await audioEngine.startMetronome(bpm);
      setIsMetronomeOn(true);
    }
  }

  useEffect(() => {
    if (isMetronomeOn) {
      audioEngine.setMetronomeBpm(bpm);
    }
  }, [bpm, isMetronomeOn]);

  useEffect(() => {
    audioEngine.setMasterGain(masterGain);
  }, [masterGain]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={isTracksPlaying ? handleStopTracks : handlePlayTracks}>
        {isTracksPlaying ? 'Stop Tracks' : 'Play Tracks'}
      </button>
      <button onClick={toggleMetronome}>
        {isMetronomeOn ? 'Stop Metronome' : 'Start Metronome'}
      </button>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Master
        <input type="range" min={0} max={1} step={0.01} value={masterGain} onChange={(e) => setMasterGain(Number(e.target.value))} />
      </label>
      <span style={{ opacity: 0.7 }}>BPM: {bpm}</span>
    </div>
  );
}

export default Transport;



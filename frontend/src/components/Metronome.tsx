import { useEffect, useState } from 'react';
import { audioEngine } from '../audioEngine';

type MetronomeProps = {
  bpm: number;
  durationSec: number;
  isEnabled: boolean;
};

/**
 * Metronome component that provides timing reference for recording
 * @param bpm - Beats per minute for the metronome
 * @param durationSec - Duration in seconds for the metronome playback
 * @param isEnabled - Whether the metronome controls are enabled
 * @returns Metronome control component
 */
export function Metronome({ bpm, durationSec, isEnabled }: MetronomeProps) {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;
    if (isOn) {
      audioEngine.playMetronome(bpm, durationSec);
      return () => audioEngine.stopAll();
    }
  }, [isOn, bpm, durationSec, isEnabled]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={() => setIsOn((v) => !v)}>{isOn ? 'Stop metronome' : 'Start metronome'}</button>
      <span>BPM: {bpm}</span>
    </div>
  );
}

export default Metronome;


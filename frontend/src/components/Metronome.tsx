import { useEffect, useState } from 'react';
import { audioEngine } from '../audioEngine';

type Props = {
  bpm: number;
  durationSec: number;
  isEnabled: boolean;
};

export function Metronome({ bpm, durationSec, isEnabled }: Props) {
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




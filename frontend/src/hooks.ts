import { useEffect, useState } from 'react';
import type { Track } from './types';

export function useAudioBuffers(tracks: Track[]) {
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    if (tracks.length === 0) return;

    setIsDecoding(true);
    
    const decodeTracks = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        for (const track of tracks) {
          if (!track.buffer && track.blob) {
            const arrayBuffer = await track.blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            track.buffer = audioBuffer;
          }
        }
      } catch (error) {
        console.error('Error decoding audio:', error);
      } finally {
        setIsDecoding(false);
      }
    };

    decodeTracks();
  }, [tracks]);

  return { isDecoding };
}
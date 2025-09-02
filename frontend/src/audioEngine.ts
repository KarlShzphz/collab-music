import type { Track, EngineEvent } from './types';

/**
 * Audio engine class that manages audio playback, metronome, and track scheduling
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private eventListeners: Array<(event: EngineEvent) => void> = [];
  private masterGainNode: GainNode | null = null;
  private metronomeGainNode: GainNode | null = null;
  private monitoringGainNode: GainNode | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private microphoneGainNode: GainNode | null = null;
  private microphoneSensitivityNode: GainNode | null = null;
  private microphoneDestination: MediaStreamAudioDestinationNode | null = null;
  private processedMicrophoneStream: MediaStream | null = null;
  private scheduledMetronomeNodes: Array<AudioBufferSourceNode | OscillatorNode> = [];
  private scheduledTrackNodes: Array<AudioBufferSourceNode> = [];

  // Metronome scheduler state
  private metronomeOn: boolean = false;
  private metronomeBpm: number = 120;
  private metronomeBeatIndex: number = 0;
  private metronomeNextNoteTime: number = 0;
  private metronomeSchedulerId: number | null = null;
  private readonly lookaheadMs: number = 25;
  private readonly scheduleAheadSec: number = 0.1;
  private metronomeVolume: number = 0.7;
  private microphoneSensitivity: number = 1.0;

  /**
   * Ensures audio context is initialized and returns it
   * @returns The audio context instance
   */
  ensureContext(): AudioContext {
    if (this.audioContext) return this.audioContext;
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.audioContext = context;
    
    // Master output for monitoring (headphones/speakers)
    this.masterGainNode = context.createGain();
    this.masterGainNode.connect(context.destination);
    
    // Metronome chain
    this.metronomeGainNode = context.createGain();
    this.metronomeGainNode.gain.value = this.metronomeVolume;
    this.metronomeGainNode.connect(this.masterGainNode);
    
    // Microphone monitoring chain
    this.microphoneGainNode = context.createGain();
    this.microphoneGainNode.gain.value = 0.8; // Monitoring volume
    this.microphoneGainNode.connect(this.masterGainNode);
    
    return context;
  }

  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    // Some browsers start in 'suspended' state until a user gesture
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
  }

  onEvent(cb: (event: EngineEvent) => void) {
    this.eventListeners.push(cb);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== cb);
    };
  }

  private emit(event: EngineEvent) {
    this.eventListeners.forEach((cb) => cb(event));
  }

  async decodeBlob(blob: Blob): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const arrayBuffer = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  stopAll(): void {
    this.stopMetronome();
    this.stopTracks();
  }

  private scheduleMetronomeClicks() {
    const ctx = this.ensureContext();
    const secondsPerBeat = 60 / Math.max(1, this.metronomeBpm);
    while (this.metronomeOn && this.metronomeNextNoteTime < ctx.currentTime + this.scheduleAheadSec) {
      const time = this.metronomeNextNoteTime;
      const isDownbeat = this.metronomeBeatIndex % 4 === 0;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = isDownbeat ? 1760 : 880;
      gain.gain.value = isDownbeat ? 0.7 : 0.45;
      osc.connect(gain);
      gain.connect(this.metronomeGainNode!);
      osc.start(time);
      osc.stop(time + 0.03);
      this.scheduledMetronomeNodes.push(osc);

      this.metronomeNextNoteTime += secondsPerBeat;
      this.metronomeBeatIndex += 1;
    }
  }

  /**
   * Starts the metronome with specified BPM
   * @param bpm - Beats per minute for the metronome
   */
  async startMetronome(bpm: number): Promise<void> {
    const ctx = this.ensureContext();
    await this.resume();
    this.metronomeBpm = Math.max(1, bpm);
    if (!this.metronomeOn) {
      this.metronomeOn = true;
      this.metronomeBeatIndex = 0;
      this.metronomeNextNoteTime = ctx.currentTime + 0.05;
      this.scheduleMetronomeClicks();
      this.metronomeSchedulerId = window.setInterval(() => this.scheduleMetronomeClicks(), this.lookaheadMs);
      this.emit({ type: 'play-started', atContextTime: this.metronomeNextNoteTime });
    }
  }

  stopMetronome(): void {
    if (this.metronomeSchedulerId !== null) {
      window.clearInterval(this.metronomeSchedulerId);
      this.metronomeSchedulerId = null;
    }
    if (!this.metronomeOn) return;
    this.metronomeOn = false;
    this.scheduledMetronomeNodes.forEach((n) => {
      try { (n as any).stop?.(); } catch { /* ignore */ }
    });
    this.scheduledMetronomeNodes = [];
    if (this.audioContext) {
      this.emit({ type: 'play-stopped', atContextTime: this.audioContext.currentTime });
    }
  }

  async playMetronome(bpm: number, durationSec: number, startAt?: number): Promise<void> {
    const ctx = this.ensureContext();
    await this.resume();
    const startTime = startAt ?? ctx.currentTime + 0.05;
    const secondsPerBeat = 60 / Math.max(1, bpm);
    const totalBeats = Math.ceil(durationSec / secondsPerBeat) + 1;

    for (let i = 0; i < totalBeats; i++) {
      const time = startTime + i * secondsPerBeat;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const isDownbeat = i % 4 === 0;
      osc.type = 'square';
      osc.frequency.value = isDownbeat ? 1760 : 880;
      gain.gain.value = isDownbeat ? 0.7 : 0.45;
      osc.connect(gain);
      gain.connect(this.metronomeGainNode!);
      osc.start(time);
      osc.stop(time + 0.03);
      this.scheduledMetronomeNodes.push(osc);
    }
    this.emit({ type: 'play-started', atContextTime: startTime });
  }

  async playTracks(tracks: Array<Track>, masterGain: number, startAt?: number): Promise<void> {
    const ctx = this.ensureContext();
    await this.resume();
    const startTime = startAt ?? ctx.currentTime + 0.05;
    if (this.masterGainNode) this.masterGainNode.gain.value = masterGain;

    tracks.forEach((track) => {
      if (!track.buffer) return;
      const src = ctx.createBufferSource();
      src.buffer = track.buffer;
      src.connect(this.masterGainNode!);
      const when = startTime + Math.max(0, track.offsetSec);
      src.start(when);
      this.scheduledTrackNodes.push(src);
    });
    this.emit({ type: 'play-started', atContextTime: startTime });
  }

   startTracks(tracks: Array<Track>, masterGain: number) {
     return this.playTracks(tracks, masterGain);
   }

   stopTracks(): void {
     this.scheduledTrackNodes.forEach((n) => {
       try { n.stop(); } catch { /* ignore */ }
     });
     this.scheduledTrackNodes = [];
     if (this.audioContext) {
       this.emit({ type: 'play-stopped', atContextTime: this.audioContext.currentTime });
     }
   }

   /**
    * Sets metronome BPM in real-time, adjusting the next beat timing
    * @param bpm - New beats per minute value
    */
   setMetronomeBpm(bpm: number) {
     const newBpm = Math.max(1, bpm);
     if (newBpm === this.metronomeBpm) return;
     
     if (this.metronomeOn && this.audioContext) {
       // Calculate how much time has passed since the last scheduled beat
       const oldSecondsPerBeat = 60 / this.metronomeBpm;
       const newSecondsPerBeat = 60 / newBpm;
       const currentTime = this.audioContext.currentTime;
       
       // Adjust the next note timing to maintain rhythm continuity
       const timeSinceLastBeat = currentTime - (this.metronomeNextNoteTime - oldSecondsPerBeat);
       const progressInBeat = Math.min(timeSinceLastBeat / oldSecondsPerBeat, 1);
       
       // Schedule next beat based on progress in current beat with new tempo
       this.metronomeNextNoteTime = currentTime + (1 - progressInBeat) * newSecondsPerBeat;
     }
     
     this.metronomeBpm = newBpm;
   }

   setMasterGain(value: number) {
     const ctx = this.ensureContext();
     void ctx; // keep reference consistent
     if (this.masterGainNode) this.masterGainNode.gain.value = value;
   }

   /**
    * Sets the metronome volume level
    * @param volume - Volume level between 0 and 1
    */
   setMetronomeVolume(volume: number): void {
     this.metronomeVolume = Math.max(0, Math.min(1, volume));
     if (this.metronomeGainNode) {
       this.metronomeGainNode.gain.value = this.metronomeVolume;
     }
   }

   /**
    * Gets the current metronome volume level
    * @returns Current volume level between 0 and 1
    */
   getMetronomeVolume(): number {
     return this.metronomeVolume;
   }

   /**
    * Sets up microphone monitoring and processing for recording
    * @param stream - MediaStream from getUserMedia
    * @returns Processed MediaStream with applied sensitivity
    */
   setupMicrophoneMonitoring(stream: MediaStream): MediaStream {
     const ctx = this.ensureContext();
     
     if (this.microphoneSource) {
       this.microphoneSource.disconnect();
     }
     
     // Create microphone source
     this.microphoneSource = ctx.createMediaStreamSource(stream);
     
     // Create sensitivity gain node for microphone input
     if (!this.microphoneSensitivityNode) {
       this.microphoneSensitivityNode = ctx.createGain();
       this.microphoneSensitivityNode.gain.value = this.microphoneSensitivity;
     }
     
     // Create destination for processed stream (for recording)
     if (!this.microphoneDestination) {
       this.microphoneDestination = ctx.createMediaStreamDestination();
     }
     
     // Connect: Microphone → Sensitivity → [Split]
     this.microphoneSource.connect(this.microphoneSensitivityNode);
     
     // Branch 1: To monitoring (what you hear)
     this.microphoneSensitivityNode.connect(this.microphoneGainNode!);
     
     // Branch 2: To recording destination (what gets recorded)
     this.microphoneSensitivityNode.connect(this.microphoneDestination);
     
     // Return the processed stream for MediaRecorder
     this.processedMicrophoneStream = this.microphoneDestination.stream;
     return this.processedMicrophoneStream;
   }

   /**
    * Stops microphone monitoring
    */
   stopMicrophoneMonitoring(): void {
     if (this.microphoneSource) {
       this.microphoneSource.disconnect();
       this.microphoneSource = null;
     }
     if (this.microphoneSensitivityNode) {
       this.microphoneSensitivityNode.disconnect();
       this.microphoneSensitivityNode = null;
     }
     if (this.microphoneDestination) {
       this.microphoneDestination.disconnect();
       this.microphoneDestination = null;
     }
     this.processedMicrophoneStream = null;
   }

   /**
    * Sets microphone monitoring volume
    * @param volume - Volume level between 0 and 1
    */
   setMicrophoneVolume(volume: number): void {
     if (this.microphoneGainNode) {
       this.microphoneGainNode.gain.value = Math.max(0, Math.min(1, volume));
     }
   }

   /**
    * Sets microphone input sensitivity (gain)
    * @param sensitivity - Sensitivity level between 0.1 and 3.0
    */
   setMicrophoneSensitivity(sensitivity: number): void {
     this.microphoneSensitivity = Math.max(0.1, Math.min(3.0, sensitivity));
     if (this.microphoneSensitivityNode) {
       this.microphoneSensitivityNode.gain.value = this.microphoneSensitivity;
     }
   }

   /**
    * Gets the current microphone sensitivity level
    * @returns Current sensitivity level between 0.1 and 3.0
    */
   getMicrophoneSensitivity(): number {
     return this.microphoneSensitivity;
   }
}

export const audioEngine = new AudioEngine();



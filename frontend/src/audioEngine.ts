import { Track, EngineEvent } from './types';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private eventListeners: Array<(event: EngineEvent) => void> = [];
  private masterGainNode: GainNode | null = null;
  private metronomeGainNode: GainNode | null = null;
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

  ensureContext(): AudioContext {
    if (this.audioContext) return this.audioContext;
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.audioContext = context;
    this.masterGainNode = context.createGain();
    this.masterGainNode.connect(context.destination);
    this.metronomeGainNode = context.createGain();
    this.metronomeGainNode.gain.value = 0.35;
    this.metronomeGainNode.connect(this.masterGainNode);
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

   setMetronomeBpm(bpm: number) {
     this.metronomeBpm = Math.max(1, bpm);
   }

   setMasterGain(value: number) {
     const ctx = this.ensureContext();
     void ctx; // keep reference consistent
     if (this.masterGainNode) this.masterGainNode.gain.value = value;
   }
}

export const audioEngine = new AudioEngine();



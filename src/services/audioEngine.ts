import { RadioStation } from '../types/radio';

class RadioAudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;
  private isSynthesizing = false;
  private synthInterval: number | null = null;
  private currentStation: RadioStation | null = null;
  private volume = 0.8;
  private isMuted = false;
  private tuningGain: GainNode | null = null;

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public async playStation(station: RadioStation): Promise<void> {
    this.initContext();
    this.currentStation = station;

    // Trigger authentic analog radio tuning static transition
    this.playTuningStatic(0.2);

    // Stop existing audio sources
    this.stopPlayback(false);

    let streamSucceeded = false;

    // Try HTML5 audio stream first if stream URL provided
    if (station.audioStreamUrl) {
      try {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = station.audioStreamUrl;
        audio.preload = 'none';

        // Connect to analyser if allowed by CORS, else direct playback
        if (this.audioCtx && this.masterGain) {
          try {
            this.audioSourceNode = this.audioCtx.createMediaElementSource(audio);
            this.audioSourceNode.connect(this.masterGain);
          } catch {
            // In case of media element source cross-origin restriction
          }
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          this.audioElement = audio;
          streamSucceeded = true;
        }
      } catch {
        // Stream failed or blocked by CORS, proceed to procedural fallback
        streamSucceeded = false;
      }
    }

    // If external stream failed or wasn't provided, launch procedural music generator
    if (!streamSucceeded) {
      this.startProceduralBroadcast(station.audioGenreSeed || 'synthwave');
    }
  }

  public stop(): void {
    this.stopPlayback(true);
    this.currentStation = null;
  }

  private stopPlayback(resetElement = true): void {
    if (this.audioElement && resetElement) {
      try {
        this.audioElement.pause();
        this.audioElement.src = '';
      } catch {
        // ignore
      }
      this.audioElement = null;
    }

    if (this.synthInterval) {
      window.clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.isSynthesizing = false;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx?.currentTime || 0);
    }
    if (this.audioElement && !this.audioSourceNode) {
      this.audioElement.volume = this.isMuted ? 0 : this.volume;
    }
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.audioCtx?.currentTime || 0);
    }
    if (this.audioElement && !this.audioSourceNode) {
      this.audioElement.muted = muted;
    }
  }

  public getFrequencyData(): Uint8Array<ArrayBuffer> {
    if (!this.analyser) return new Uint8Array(128);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  public getTimeDomainData(): Uint8Array<ArrayBuffer> {
    if (!this.analyser) return new Uint8Array(128);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  // Play realistic radio frequency tuning static & heterodyne whistle
  public playTuningStatic(durationSec = 0.25): void {
    try {
      this.initContext();
      if (!this.audioCtx || !this.masterGain) return;

      const bufferSize = this.audioCtx.sampleRate * durationSec;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      // Pink/Brownish radio static noise
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.1) * 0.18;
      }

      const noiseSource = this.audioCtx.createBufferSource();
      noiseSource.buffer = buffer;

      // Bandpass filter for authentic radio tuner dial sweep
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(3200, this.audioCtx.currentTime + durationSec);
      filter.Q.value = 4.0;

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + durationSec);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noiseSource.start();
      noiseSource.stop(this.audioCtx.currentTime + durationSec);
    } catch {
      // AudioContext not ready yet
    }
  }

  // Procedural Generative Radio Music Engine: always delivers genre-specific music
  private startProceduralBroadcast(genreSeed: string): void {
    if (!this.audioCtx || !this.masterGain) return;
    this.isSynthesizing = true;

    // Subtle background vinyl warmth/analog tape hiss
    this.startAnalogWarmth();

    let step = 0;
    const bpm = genreSeed === 'jazz' ? 84 : genreSeed === 'ambient' ? 52 : genreSeed === 'rock' ? 124 : 110;
    const stepTimeMs = (60 / bpm / 4) * 1000;

    // Harmonic chord progressions by genre
    const scales: Record<string, number[][]> = {
      synthwave: [
        [110, 164.81, 220, 277.18], // A min
        [98, 146.83, 196, 246.94],  // G maj
        [87.31, 130.81, 174.61, 220], // F maj
        [82.41, 123.47, 164.81, 207.65], // E min
      ],
      jazz: [
        [130.81, 196, 246.94, 293.66], // Cmaj9
        [110, 164.81, 220, 261.63],   // Am7
        [146.83, 220, 261.63, 329.63], // Dm9
        [98, 146.83, 233.08, 293.66],  // G7b9
      ],
      cyberpunk: [
        [73.42, 110, 146.83, 220],    // D minor dark
        [65.41, 98, 130.81, 196],     // C dark
        [58.27, 87.31, 116.54, 174.61], // Bb dark
        [82.41, 123.47, 164.81, 246.94], // E dim
      ],
      ambient: [
        [130.81, 196, 261.63, 392],   // C open fifths
        [146.83, 220, 293.66, 440],   // D ethereal
        [164.81, 246.94, 329.63, 493.88], // E soft
        [174.61, 261.63, 349.23, 523.25], // F dream
      ],
      funk: [
        [98, 146.83, 196, 246.94, 293.66], // G9
        [110, 164.81, 220, 261.63],        // Am7
      ],
      lofi: [
        [130.81, 164.81, 196, 246.94], // Cmaj7
        [110, 138.59, 164.81, 207.65], // Am(maj7)
        [146.83, 174.61, 220, 261.63], // Dm7
        [98, 123.47, 146.83, 220],     // G13
      ],
      rock: [
        [82.41, 123.47, 164.81], // E5 power
        [110, 164.81, 220],     // A5 power
        [98, 146.83, 196],      // G5 power
        [73.42, 110, 146.83],   // D5 power
      ],
    };

    const currentScaleProg = scales[genreSeed] || scales.synthwave;

    this.synthInterval = window.setInterval(() => {
      if (!this.audioCtx || !this.masterGain) return;

      const beat = step % 16;
      const bar = Math.floor(step / 16) % currentScaleProg.length;
      const chord = currentScaleProg[bar];

      // Rhythm Kick
      if (beat === 0 || beat === 8 || (genreSeed === 'rock' && (beat === 4 || beat === 12))) {
        this.triggerKick();
      }

      // Snare / Clap / Finger Snap
      if (beat === 4 || beat === 12) {
        this.triggerSnare(genreSeed === 'jazz' || genreSeed === 'lofi');
      }

      // Hi-Hat / Shaker
      if (beat % 2 === 0 || genreSeed === 'jazz') {
        this.triggerHiHat(beat % 4 === 2);
      }

      // Bassline note
      if (beat === 0 || beat === 6 || beat === 10 || beat === 14) {
        const rootFreq = chord[0];
        this.triggerBass(rootFreq, genreSeed);
      }

      // Melodic / Harmony Arpeggio
      if (beat % 4 === 0 || (genreSeed === 'synthwave' && beat % 2 === 0)) {
        const noteIndex = (beat / 2) % chord.length;
        const noteFreq = chord[noteIndex] * 2;
        this.triggerChime(noteFreq, genreSeed);
      }

      step++;
    }, stepTimeMs);
  }

  private triggerKick(): void {
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    const t = this.audioCtx.currentTime;
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  private triggerSnare(soft = false): void {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;

    // Noise component
    const bufferSize = this.audioCtx.sampleRate * 0.15;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = soft ? 1200 : 800;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(soft ? 0.15 : 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.15);
  }

  private triggerHiHat(accent = false): void {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;

    const bufferSize = this.audioCtx.sampleRate * 0.05;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 9500;
    filter.Q.value = 6;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(accent ? 0.12 : 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.05);
  }

  private triggerBass(freq: number, genre: string): void {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    osc.type = genre === 'cyberpunk' ? 'sawtooth' : genre === 'jazz' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(freq / 2, t);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(genre === 'cyberpunk' ? 600 : 350, t);
    filter.frequency.exponentialRampToValueAtTime(150, t + 0.3);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  private triggerChime(freq: number, genre: string): void {
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    osc.type = genre === 'synthwave' ? 'sawtooth' : genre === 'lofi' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(genre === 'ambient' ? 800 : 2400, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.45);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  private startAnalogWarmth(): void {
    if (!this.audioCtx || !this.masterGain) return;
    const bufferSize = this.audioCtx.sampleRate * 2;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Gentle vinyl crackle & warm hiss
      const crackle = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.15 : 0;
      data[i] = (Math.random() * 0.01 - 0.005) + crackle;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.5;

    const gain = this.audioCtx.createGain();
    gain.gain.value = 0.03; // Very quiet background analog texture

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
  }

  public getStation(): RadioStation | null {
    return this.currentStation;
  }

  public isPlaying(): boolean {
    return Boolean(this.audioElement || this.isSynthesizing);
  }
}

export const radioAudio = new RadioAudioEngine();

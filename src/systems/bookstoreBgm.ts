// Web Audio API Synthesizer for DOKJA Bookstore (독자서점)
// Warm Felt Jazz Piano + Music Box (Celesta) + Upright Bass with Entrance Spatial Audio Fade-In

interface MelodyNote {
  beatOffset: number; // in beats (0..3.9)
  midi: number;
  duration: number; // in seconds
  velocity: number; // 0..1
  musicBox?: boolean;
}

interface JazzBar {
  bassMidi: number;
  secondaryBassMidi?: number;
  chordMidis: number[];
  melody: MelodyNote[];
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 8-bar lyrical Bookstore Jazz Ballad / Waltz-Ballad progression (Fmaj9 - A7b9 - Dm9 - Cm9/F13 - Bbmaj9 - Bbm6 - Am7/D7b9 - Gm9/C13)
const BOOKSTORE_JAZZ_PROGRESSION: JazzBar[] = [
  // Bar 1: Fmaj9 (Warm, welcoming terracotta light)
  {
    bassMidi: 41, // F2
    secondaryBassMidi: 48, // C3
    chordMidis: [57, 60, 64, 67], // A3, C4, E4, G4
    melody: [
      { beatOffset: 0.5, midi: 72, duration: 1.6, velocity: 0.72, musicBox: true }, // C5
      { beatOffset: 1.75, midi: 69, duration: 1.2, velocity: 0.62 }, // A4
      { beatOffset: 2.75, midi: 67, duration: 1.1, velocity: 0.58 }, // G4
      { beatOffset: 3.5, midi: 65, duration: 0.9, velocity: 0.52 }, // F4
    ],
  },
  // Bar 2: Em7b5 -> A7b9 (Nostalgic European alley turn)
  {
    bassMidi: 40, // E2
    secondaryBassMidi: 45, // A2
    chordMidis: [55, 58, 61, 64], // G3, Bb3, C#4, E4
    melody: [
      { beatOffset: 0.25, midi: 67, duration: 1.4, velocity: 0.64 }, // G4
      { beatOffset: 1.5, midi: 69, duration: 1.1, velocity: 0.6 }, // A4
      { beatOffset: 2.35, midi: 70, duration: 1.3, velocity: 0.68, musicBox: true }, // Bb4
      { beatOffset: 3.35, midi: 64, duration: 1.1, velocity: 0.52 }, // E4
    ],
  },
  // Bar 3: Dm9 (Deep wooden bookshelves & quiet contemplation)
  {
    bassMidi: 38, // D2
    secondaryBassMidi: 45, // A2
    chordMidis: [53, 57, 60, 64], // F3, A3, C4, E4
    melody: [
      { beatOffset: 0.4, midi: 69, duration: 1.7, velocity: 0.7, musicBox: true }, // A4
      { beatOffset: 1.85, midi: 65, duration: 1.2, velocity: 0.58 }, // F4
      { beatOffset: 2.8, midi: 64, duration: 1.1, velocity: 0.56 }, // E4
      { beatOffset: 3.5, midi: 62, duration: 1.0, velocity: 0.5 }, // D4
    ],
  },
  // Bar 4: Cm9 -> F13 (Turning a page under the crystal chandelier)
  {
    bassMidi: 36, // C2
    secondaryBassMidi: 41, // F2
    chordMidis: [51, 55, 58, 62], // Eb3, G3, Bb3, D4
    melody: [
      { beatOffset: 0.35, midi: 67, duration: 1.3, velocity: 0.65 }, // G4
      { beatOffset: 1.5, midi: 72, duration: 1.3, velocity: 0.72, musicBox: true }, // C5
      { beatOffset: 2.55, midi: 74, duration: 1.2, velocity: 0.68, musicBox: true }, // D5
      { beatOffset: 3.4, midi: 72, duration: 1.0, velocity: 0.58 }, // C5
    ],
  },
  // Bar 5: Bbmaj9 (Sunlight through lace curtains)
  {
    bassMidi: 34, // Bb1
    secondaryBassMidi: 41, // F2
    chordMidis: [50, 53, 57, 60], // D3, F3, A3, C4
    melody: [
      { beatOffset: 0.25, midi: 74, duration: 1.6, velocity: 0.74, musicBox: true }, // D5
      { beatOffset: 1.65, midi: 72, duration: 1.2, velocity: 0.64 }, // C5
      { beatOffset: 2.6, midi: 69, duration: 1.1, velocity: 0.6 }, // A4
      { beatOffset: 3.4, midi: 65, duration: 1.1, velocity: 0.54 }, // F4
    ],
  },
  // Bar 6: Bbm6 (Bittersweet minor iv — scent of paper and leather)
  {
    bassMidi: 34, // Bb1
    secondaryBassMidi: 41, // F2
    chordMidis: [49, 53, 55, 60], // Db3, F3, G3, C4
    melody: [
      { beatOffset: 0.4, midi: 68, duration: 1.6, velocity: 0.68, musicBox: true }, // Ab4
      { beatOffset: 1.8, midi: 67, duration: 1.2, velocity: 0.62 }, // G4
      { beatOffset: 2.75, midi: 65, duration: 1.1, velocity: 0.56 }, // F4
      { beatOffset: 3.5, midi: 61, duration: 1.0, velocity: 0.5 }, // Db4
    ],
  },
  // Bar 7: Am7 -> D7b9 (Gentle conversation by the recommendation table)
  {
    bassMidi: 33, // A1
    secondaryBassMidi: 38, // D2
    chordMidis: [55, 60, 64, 67], // G3, C4, E4, G4
    melody: [
      { beatOffset: 0.3, midi: 64, duration: 1.3, velocity: 0.62 }, // E4
      { beatOffset: 1.45, midi: 69, duration: 1.2, velocity: 0.68, musicBox: true }, // A4
      { beatOffset: 2.4, midi: 66, duration: 1.2, velocity: 0.64 }, // F#4
      { beatOffset: 3.35, midi: 62, duration: 1.0, velocity: 0.52 }, // D4
    ],
  },
  // Bar 8: Gm9 -> C13sus4 (Warm resolution back to the beginning)
  {
    bassMidi: 31, // G1
    secondaryBassMidi: 36, // C2
    chordMidis: [53, 57, 58, 62], // F3, A3, Bb3, D4
    melody: [
      { beatOffset: 0.3, midi: 69, duration: 1.4, velocity: 0.66, musicBox: true }, // A4
      { beatOffset: 1.55, midi: 67, duration: 1.2, velocity: 0.62 }, // G4
      { beatOffset: 2.55, midi: 65, duration: 1.1, velocity: 0.58 }, // F4
      { beatOffset: 3.4, midi: 64, duration: 1.3, velocity: 0.56, musicBox: true }, // E4
    ],
  },
];

class BookstoreBgmEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private spatialGain: GainNode | null = null;
  private spatialFilter: BiquadFilterNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;

  private isEnabled: boolean = false;
  private isInside: boolean = false;
  private characterZ: number = 8.85;
  private barIndex: number = 0;
  private timerId: number | null = null;

  // Procedural ASMR Channels (Window Rain, Page Turn & Pencil, Warm Fireplace/LP Crackle)
  private asmrLevels = { rain: 0, paper: 0, fireplace: 0 };
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private fireSource: AudioBufferSourceNode | null = null;
  private fireGain: GainNode | null = null;
  private paperTimerId: number | null = null;

  // Initialize AudioContext and spatial audio graph on user gesture
  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();

      // Master on/off gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0001;

      // Spatial gain (road vs. inside bookstore fade-in)
      this.spatialGain = this.ctx.createGain();
      // Spatial low-pass filter (muffled outside on road -> warm & clear inside store)
      this.spatialFilter = this.ctx.createBiquadFilter();
      this.spatialFilter.type = 'lowpass';
      this.spatialFilter.Q.value = 0.55;

      // Dry / Wet reverb blend for cozy bookstore acoustics
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 0.68;

      this.wetGain = this.ctx.createGain();
      this.wetGain.gain.value = 0.42;

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createWarmRoomImpulse(this.ctx, 2.3, 2.6);

      // Connect graph: dry/wet -> spatialFilter -> spatialGain -> masterGain -> destination
      this.dryGain.connect(this.spatialFilter);
      this.wetGain.connect(this.reverbNode);
      this.reverbNode.connect(this.spatialFilter);

      this.spatialFilter.connect(this.spatialGain);
      this.spatialGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applySpatialState(true);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  // Generate a warm stereo room impulse response for the bookstore interior
  private createWarmRoomImpulse(
    ctx: AudioContext,
    durationSec: number,
    decay: number
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let prev = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        // Low-pass filtered pink-ish noise for warm wooden room reflections
        const white = Math.random() * 2 - 1;
        prev = prev * 0.82 + white * 0.18;
        data[i] = prev * env * 0.65;
      }
    }
    return impulse;
  }

  // Update spatial gain & filter based on character Z coordinate (Road Z > 6.45 vs. Interior Z <= 6.2)
  private applySpatialState(immediate = false) {
    if (!this.ctx || !this.spatialGain || !this.spatialFilter) return;

    const now = this.ctx.currentTime;
    // Smooth spatial blend factor: 0.0 when out on the road (Z >= 7.8), 1.0 when inside the store (Z <= 5.8)
    const rawIndoorFactor = (7.6 - this.characterZ) / (7.6 - 5.75);
    const indoorFactor = this.isInside
      ? Math.max(0.88, Math.min(1, rawIndoorFactor))
      : Math.max(0, Math.min(1, rawIndoorFactor));

    // Outside on road: soft & distant (0.20 gain, 540 Hz muffled low-pass as if heard through the window/door)
    // Inside bookstore: full, warm, intimate (0.88 gain, 4800 Hz open acoustic piano & music box)
    const targetSpatialGain = 0.2 + indoorFactor * 0.68;
    const targetCutoffHz = 540 + indoorFactor * 4260;

    if (immediate) {
      this.spatialGain.gain.setValueAtTime(targetSpatialGain, now);
      this.spatialFilter.frequency.setValueAtTime(targetCutoffHz, now);
    } else {
      // Smooth 0.65s time-constant transition so stepping through the door swells naturally
      this.spatialGain.gain.setTargetAtTime(targetSpatialGain, now, 0.55);
      this.spatialFilter.frequency.setTargetAtTime(targetCutoffHz, now, 0.55);
    }
  }

  public setCharacterZ(z: number) {
    this.characterZ = z;
    if (z <= 6.15 && !this.isInside) {
      this.isInside = true;
    } else if (z > 6.85 && this.isInside) {
      this.isInside = false;
    }
    this.applySpatialState(false);
  }

  public triggerEnterStoreSwell() {
    this.isInside = true;
    this.characterZ = Math.min(this.characterZ, 5.25);
    if (this.isEnabled) {
      this.ensureContext();
      this.applySpatialState(false);
    }
  }

  public start(): boolean {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return false;

    this.isEnabled = true;
    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0.45, now, 0.45);
    this.applySpatialState(false);

    if (this.timerId === null) {
      this.scheduleNextBar();
    }
    return true;
  }

  public stop() {
    this.isEnabled = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.25);
    }
  }

  public toggle(): boolean {
    if (this.isEnabled) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  private scheduleNextBar() {
    if (!this.isEnabled || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const bar =
      BOOKSTORE_JAZZ_PROGRESSION[
        this.barIndex % BOOKSTORE_JAZZ_PROGRESSION.length
      ];
    this.barIndex++;

    // Relaxed bookstore jazz tempo: ~65 BPM (1 beat = 0.92s, 4 beats = 3.68s per bar)
    const beatSec = 0.92;
    const barDurationSec = beatSec * 4;
    const now = this.ctx.currentTime + 0.05;

    // 1. Warm Plucked Upright Bass on beat 1 (and gentle secondary bass on beat 3)
    this.playUprightBassNote(now, midiToFreq(bar.bassMidi), beatSec * 2.2, 0.55);
    if (bar.secondaryBassMidi) {
      this.playUprightBassNote(
        now + beatSec * 2.0,
        midiToFreq(bar.secondaryBassMidi),
        beatSec * 1.9,
        0.46
      );
    }

    // 2. Rolled Felt-Piano Jazz Chord Voicing (arpeggiated gently across 55ms)
    bar.chordMidis.forEach((midi, idx) => {
      const rollDelay = idx * 0.055 + (Math.random() - 0.5) * 0.012;
      this.playFeltPianoNote(
        now + Math.max(0, rollDelay),
        midiToFreq(midi),
        barDurationSec * 0.88,
        0.34 - idx * 0.02,
        -0.18 + idx * 0.08
      );
    });

    // Gentle secondary chord comping on beat 2.5
    if (bar.chordMidis.length >= 3) {
      bar.chordMidis.slice(1).forEach((midi, idx) => {
        this.playFeltPianoNote(
          now + beatSec * 2.5 + idx * 0.04,
          midiToFreq(midi),
          beatSec * 1.35,
          0.22,
          -0.1 + idx * 0.08
        );
      });
    }

    // 3. Lyrical Right-Hand Jazz Piano + Music-Box (Celesta) Melody
    bar.melody.forEach((note) => {
      const humanRubato = (Math.random() - 0.5) * 0.025;
      const startTime = now + note.beatOffset * beatSec + humanRubato;
      const freq = midiToFreq(note.midi);

      this.playFeltPianoNote(
        startTime,
        freq,
        note.duration,
        note.velocity * 0.48,
        0.18
      );

      if (note.musicBox) {
        this.playMusicBoxChime(
          startTime + 0.01,
          freq,
          note.duration * 1.15,
          note.velocity * 0.24
        );
      }
    });

    this.timerId = window.setTimeout(() => {
      this.scheduleNextBar();
    }, barDurationSec * 1000);
  }

  // Warm Felt-Piano synthesis (fundamental triangle + 2nd/3rd sine harmonics + dynamic hammer low-pass filter)
  private playFeltPianoNote(
    startTime: number,
    freq: number,
    duration: number,
    velocity: number,
    pan = 0
  ) {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, startTime);
    osc2.detune.setValueAtTime(2.0, startTime);

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, startTime);
    osc3.detune.setValueAtTime(-2.5, startTime);

    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    const g3 = this.ctx.createGain();
    g1.gain.value = 0.72;
    g2.gain.value = 0.22;
    g3.gain.value = 0.06;

    // Warm felt hammer low-pass filter that softens as the note rings out
    const noteFilter = this.ctx.createBiquadFilter();
    noteFilter.type = 'lowpass';
    const peakCutoff = Math.min(2600, freq * 3.6 + velocity * 700);
    const sustainCutoff = Math.max(320, freq * 1.45);
    noteFilter.frequency.setValueAtTime(peakCutoff, startTime);
    noteFilter.frequency.exponentialRampToValueAtTime(
      sustainCutoff,
      startTime + Math.min(duration, 1.4)
    );

    const env = this.ctx.createGain();
    const peakGain = Math.max(0.01, velocity * 0.28);
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.022);
    env.gain.exponentialRampToValueAtTime(
      peakGain * 0.42,
      startTime + Math.min(0.35, duration * 0.35)
    );
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.35);

    osc1.connect(g1);
    osc2.connect(g2);
    osc3.connect(g3);
    g1.connect(noteFilter);
    g2.connect(noteFilter);
    g3.connect(noteFilter);
    noteFilter.connect(env);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.6, Math.min(0.6, pan)), startTime);
      env.connect(panner);
      panner.connect(this.dryGain);
      panner.connect(this.wetGain);
    } else {
      env.connect(this.dryGain);
      env.connect(this.wetGain);
    }

    const stopTime = startTime + duration + 0.4;
    osc1.start(startTime);
    osc2.start(startTime);
    osc3.start(startTime);
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    osc3.stop(stopTime);
  }

  // Delicate Music-Box / Celesta bell chime on upper melody notes
  private playMusicBoxChime(
    startTime: number,
    freq: number,
    duration: number,
    velocity: number
  ) {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const oscFund = this.ctx.createOscillator();
    const oscBell = this.ctx.createOscillator();

    oscFund.type = 'sine';
    oscFund.frequency.setValueAtTime(freq * 2, startTime); // 1 octave higher like a music box tine

    oscBell.type = 'sine';
    oscBell.frequency.setValueAtTime(freq * 6, startTime); // Metallic tine overtone

    const fundGain = this.ctx.createGain();
    const bellGain = this.ctx.createGain();

    const peak = Math.max(0.005, velocity * 0.14);
    fundGain.gain.setValueAtTime(0.0001, startTime);
    fundGain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
    fundGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    bellGain.gain.setValueAtTime(0.0001, startTime);
    bellGain.gain.linearRampToValueAtTime(peak * 0.25, startTime + 0.005);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

    oscFund.connect(fundGain);
    oscBell.connect(bellGain);

    fundGain.connect(this.dryGain);
    fundGain.connect(this.wetGain);
    bellGain.connect(this.wetGain);

    const stopTime = startTime + duration + 0.1;
    oscFund.start(startTime);
    oscBell.start(startTime);
    oscFund.stop(stopTime);
    oscBell.stop(stopTime);
  }

  // Warm Acoustic Upright Double Bass
  private playUprightBassNote(
    startTime: number,
    freq: number,
    duration: number,
    velocity: number
  ) {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, startTime);
    filter.frequency.exponentialRampToValueAtTime(110, startTime + duration);

    const env = this.ctx.createGain();
    const peak = Math.max(0.01, velocity * 0.26);
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peak, startTime + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.2);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.dryGain);
    env.connect(this.wetGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.25);
  }

  // ============================================================
  // PROCEDURAL BOOKSTORE ASMR AMBIENCE CHANNELS
  // 1) Window Rain (창밖 잔잔한 봄비 소리)
  // 2) Paper Page Turn & Pencil Rustle (책장 넘김 & 연필 사각거림)
  // 3) Warm Hearth / Vinyl Crackle (모닥불 & 아날로그 LP 온기)
  // ============================================================
  private initAsmrNodes(ctx: AudioContext) {
    if (!this.rainGain) {
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0.0001;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 880;

      const sampleRate = ctx.sampleRate;
      const len = sampleRate * 5;
      const rainBuf = ctx.createBuffer(2, len, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = rainBuf.getChannelData(ch);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.95 * b2 + white * 0.045;
          // Gentle window droplet patter modulation
          const droplet =
            Math.random() > 0.9985 ? (Math.random() - 0.5) * 0.35 : 0;
          data[i] = (b0 + b1 + b2 + droplet) * 0.32;
        }
      }

      this.rainSource = ctx.createBufferSource();
      this.rainSource.buffer = rainBuf;
      this.rainSource.loop = true;
      this.rainSource.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(ctx.destination);
      this.rainSource.start();
    }

    if (!this.fireGain) {
      this.fireGain = ctx.createGain();
      this.fireGain.gain.value = 0.0001;

      const fireFilter = ctx.createBiquadFilter();
      fireFilter.type = 'bandpass';
      fireFilter.frequency.value = 1450;
      fireFilter.Q.value = 0.7;

      const sampleRate = ctx.sampleRate;
      const len = sampleRate * 5;
      const fireBuf = ctx.createBuffer(2, len, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = fireBuf.getChannelData(ch);
        let lowHum = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          lowHum = lowHum * 0.992 + white * 0.008;
          const crackle =
            Math.random() > 0.9972
              ? (Math.random() * 2 - 1) * 0.55
              : Math.random() > 0.992
              ? (Math.random() * 2 - 1) * 0.14
              : 0;
          data[i] = lowHum * 0.45 + crackle * 0.38;
        }
      }

      this.fireSource = ctx.createBufferSource();
      this.fireSource.buffer = fireBuf;
      this.fireSource.loop = true;
      this.fireSource.connect(fireFilter);
      fireFilter.connect(this.fireGain);
      this.fireGain.connect(ctx.destination);
      this.fireSource.start();
    }
  }

  public setAsmrLevels(levels: {
    rain: number;
    paper: number;
    fireplace: number;
  }) {
    this.asmrLevels = { ...levels };
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.initAsmrNodes(ctx);
    const now = ctx.currentTime;

    if (this.rainGain) {
      const targetRain =
        levels.rain > 0.01 ? Math.max(0.001, levels.rain * 0.36) : 0.0001;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.25);
    }

    if (this.fireGain) {
      const targetFire =
        levels.fireplace > 0.01
          ? Math.max(0.001, levels.fireplace * 0.34)
          : 0.0001;
      this.fireGain.gain.setTargetAtTime(targetFire, now, 0.25);
    }

    if (levels.paper > 0.02 && this.paperTimerId === null) {
      this.schedulePaperRustle();
    } else if (levels.paper <= 0.02 && this.paperTimerId !== null) {
      window.clearTimeout(this.paperTimerId);
      this.paperTimerId = null;
    }
  }

  public getAsmrLevels() {
    return { ...this.asmrLevels };
  }

  private schedulePaperRustle() {
    if (this.asmrLevels.paper <= 0.02 || !this.ctx) {
      this.paperTimerId = null;
      return;
    }

    this.playPaperTurnSound(this.asmrLevels.paper);

    const nextDelayMs = 4200 + Math.random() * 3400;
    this.paperTimerId = window.setTimeout(() => {
      this.schedulePaperRustle();
    }, nextDelayMs);
  }

  // Synthesize a realistic soft book page turn / pencil sketch whisper
  private playPaperTurnSound(level: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dur = 0.42;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.sin(t * Math.PI) * Math.pow(1 - t, 0.7);
      data[i] = (Math.random() * 2 - 1) * env * 0.28;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(2400, ctx.currentTime + dur);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.value = Math.min(0.28, level * 0.22);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // Bright Music-Box Chime when a Treasure-Hunt Stamp is discovered!
  public playStampCollectedChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.02;
    const notes = [77, 81, 84, 89]; // F5, A5, C6, F6
    notes.forEach((midi, idx) => {
      this.playMusicBoxChime(now + idx * 0.11, midiToFreq(midi), 1.2, 0.75);
    });
  }

  // Peaceful Singing-Bowl & Felt-Piano Chord when Reading Timer finishes!
  public playTimerCompleteChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.02;
    const chord = [65, 69, 72, 76, 81]; // Fmaj9
    chord.forEach((midi, idx) => {
      this.playFeltPianoNote(now + idx * 0.09, midiToFreq(midi), 2.8, 0.65, 0);
      this.playMusicBoxChime(now + idx * 0.09, midiToFreq(midi), 2.2, 0.55);
    });
  }
}

export const bookstoreBgm = new BookstoreBgmEngine();

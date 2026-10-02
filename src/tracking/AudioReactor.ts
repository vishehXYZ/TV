/**
 * Optional audio-driven "sound energy" signal, from either the microphone
 * or an uploaded music file played back through the browser. Rather than
 * plumbing a second energy source through every mode, the continuous level
 * is blended (via max, so it only ever boosts, never fights the movement
 * signal) directly into PoseState.energy each frame in main.ts — every mode
 * that already reacts to movement energy becomes sound-reactive too, with
 * no per-mode changes. Separate low/mid/high frequency bands and a punchy
 * bass "kick" detector are also exposed for modes (like Mandala) that want
 * genuine multi-dimensional music-visualizer reactivity rather than one
 * flat number — bass driving pulses, mids driving movement, treble driving
 * sparkle/detail, much closer to a real media-player visualizer.
 */
export class AudioReactor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private micStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private sourceNode: AudioNode | null = null;
  /** Parallel tap of whichever source (mic or uploaded file) is active, so a separate consumer
   * (the recorder) can grab a real MediaStream of the audio without disturbing the analyser or
   * speaker routing. */
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private smoothedLevel = 0;
  private rollingAverage = 0;
  private lastTriggerAt = 0;
  private lastUpdateAt: number | null = null;
  private triggered = false;
  /** Spikes to a guaranteed-strong value on each detected beat/onset and decays over roughly a second — this is
   * what actually makes a beat *felt*: a single-frame energy spike is gone before most modes' own smoothing
   * or the next render even shows it, so this sustains long enough to visibly register. */
  private pulseLevel = 0;
  /** Ambient noise floor subtracted out before scaling, so silence reads as ~0 rather than a constant flicker. */
  private readonly noiseFloor = 0.02;

  // Separate low/mid/high frequency bands — this is what lets a visualizer respond differently to
  // bass (kick/pulse), mids (melody/movement), and treble (sparkle/detail) instead of one flat number.
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedTreble = 0;
  /** Fast-decaying, punchy spike on bass hits specifically — a "kick" for beat-synced pops, distinct
   * from the general onset trigger which reacts to the whole spectrum. */
  private bassKick = 0;
  private bassRollingAverage = 0;
  private lastKickAt = 0;

  get isActive(): boolean {
    return this.analyser !== null;
  }

  get source(): 'mic' | 'music' | 'none' {
    if (!this.isActive) return 'none';
    return this.audioEl ? 'music' : 'mic';
  }

  /** Real MediaStream carrying whichever audio (mic or uploaded music) is currently active — for
   * feeding into MediaRecorder alongside the canvas video track. Null when no audio source is active. */
  get audioStream(): MediaStream | null {
    return this.destinationNode?.stream ?? null;
  }

  /** Smoothed 0..1+ sound level (already includes the sustained beat pulse), comparable in scale to PoseState.energy. */
  get level(): number {
    return Math.max(this.smoothedLevel, this.pulseLevel);
  }

  /** Smoothed low-frequency band level, 0..1+. */
  get bass(): number {
    return this.smoothedBass;
  }

  /** Smoothed mid-frequency band level, 0..1+. */
  get mid(): number {
    return this.smoothedMid;
  }

  /** Smoothed high-frequency band level, 0..1+. */
  get treble(): number {
    return this.smoothedTreble;
  }

  /** Fast, punchy 0..1.4ish spike specifically on bass hits — decays in a few hundred ms, for visible beat-synced pops. */
  get kick(): number {
    return this.bassKick;
  }

  /** True for exactly one read right after a beat/onset is detected — consumes itself, so call once per frame. */
  consumeTrigger(): boolean {
    const t = this.triggered;
    this.triggered = false;
    return t;
  }

  /** Whether an uploaded music file (not mic) is loaded, so play/pause/seek transport controls apply. */
  get hasTrack(): boolean {
    return this.audioEl !== null;
  }

  get isPaused(): boolean {
    return this.audioEl?.paused ?? false;
  }

  get currentTime(): number {
    return this.audioEl?.currentTime ?? 0;
  }

  get duration(): number {
    return this.audioEl?.duration ?? 0;
  }

  /** Pauses playback in place — analysis/visuals keep running off whatever the last analyser frame was
   * (silence reads as near-zero energy), the loaded file stays ready to resume with no re-upload needed. */
  pause(): void {
    this.audioEl?.pause();
  }

  resume(): void {
    void this.audioEl?.play();
  }

  /** Jumps playback by `deltaSeconds` (negative = back), clamped to the track's bounds. */
  seekBy(deltaSeconds: number): void {
    const el = this.audioEl;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(Math.max(el.currentTime + deltaSeconds, 0), el.duration);
  }

  async start(): Promise<void> {
    this.teardownSource();
    if (!this.audioContext) this.audioContext = new AudioContext();
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = this.audioContext.createMediaStreamSource(this.micStream);
    this.attachSource(source);
    await this.audioContext.resume();
  }

  /** Loads and plays an uploaded audio file through the speakers, analyzing it the same way as the mic. */
  async loadFile(file: File): Promise<void> {
    this.teardownSource();
    if (!this.audioContext) this.audioContext = new AudioContext();
    const audioEl = new Audio();
    audioEl.src = URL.createObjectURL(file);
    audioEl.loop = true;
    this.audioEl = audioEl;
    const source = this.audioContext.createMediaElementSource(audioEl);
    this.attachSource(source);
    // Route to speakers too (createMediaElementSource silences default playback otherwise) so the performer hears it.
    source.connect(this.audioContext.destination);
    await this.audioContext.resume();
    await audioEl.play();
  }

  stop(): void {
    this.teardownSource();
    void this.audioContext?.close();
    this.audioContext = null;
  }

  /** Refreshes the cached level, bands, pulse, and trigger from the analyser — call once per render frame. */
  update(): void {
    if (!this.analyser || !this.dataArray) return;
    const now = performance.now() / 1000;
    const dt = this.lastUpdateAt !== null ? Math.min(now - this.lastUpdateAt, 0.2) : 1 / 60;
    this.lastUpdateAt = now;

    this.analyser.getByteFrequencyData(this.dataArray);
    const n = this.dataArray.length;
    let sum = 0;
    // Roughly: bottom ~12% of bins = bass, next ~38% = mid, remaining ~50% = treble (bin frequency
    // spacing is linear, so this weights toward capturing low-end punch in a fairly narrow band).
    const bassEnd = Math.max(1, Math.floor(n * 0.12));
    const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.5));
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    for (let i = 0; i < n; i++) {
      const v = this.dataArray[i]!;
      sum += v;
      if (i < bassEnd) bassSum += v;
      else if (i < midEnd) midSum += v;
      else trebleSum += v;
    }
    const avg = sum / n / 255;
    const bassAvg = bassSum / bassEnd / 255;
    const midAvg = midSum / (midEnd - bassEnd) / 255;
    const trebleAvg = trebleSum / (n - midEnd) / 255;

    // Scaled up so normal speaking/music produces a satisfying reactive range, not just a flicker near 0.
    const raw = Math.max(0, avg - this.noiseFloor) * 3.5;
    this.smoothedLevel += (raw - this.smoothedLevel) * 0.3;

    const bassRaw = Math.max(0, bassAvg - this.noiseFloor) * 3.8;
    const midRaw = Math.max(0, midAvg - this.noiseFloor) * 3.5;
    const trebleRaw = Math.max(0, trebleAvg - this.noiseFloor) * 3.2;
    this.smoothedBass += (bassRaw - this.smoothedBass) * 0.4;
    this.smoothedMid += (midRaw - this.smoothedMid) * 0.3;
    this.smoothedTreble += (trebleRaw - this.smoothedTreble) * 0.25;

    // Onset/beat detection: a slow-following rolling average of the level, and a trigger fires whenever
    // the instantaneous level spikes well above it — catches percussive hits/beats rather than just loud sections.
    this.rollingAverage += (this.smoothedLevel - this.rollingAverage) * 0.05;
    if (this.smoothedLevel > this.rollingAverage * 1.5 + 0.08 && now - this.lastTriggerAt > 0.15) {
      this.triggered = true;
      this.lastTriggerAt = now;
      this.pulseLevel = 1.3;
    }
    // Frame-rate-independent decay — reaches near-zero in roughly a second, long enough to actually be seen.
    this.pulseLevel *= Math.pow(0.02, dt);

    // Bass-specific kick detector — punchier and faster-decaying than the general pulse, tuned to catch
    // kick drums/bass hits specifically for beat-synced visual pops (the core of a "dancing" visualizer).
    this.bassRollingAverage += (this.smoothedBass - this.bassRollingAverage) * 0.04;
    if (this.smoothedBass > this.bassRollingAverage * 1.35 + 0.06 && now - this.lastKickAt > 0.12) {
      this.bassKick = 1.4;
      this.lastKickAt = now;
    }
    this.bassKick *= Math.pow(0.015, dt);
  }

  private attachSource(source: AudioNode): void {
    this.analyser = this.audioContext!.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.5;
    source.connect(this.analyser);
    this.destinationNode = this.audioContext!.createMediaStreamDestination();
    source.connect(this.destinationNode);
    this.sourceNode = source;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  private teardownSource(): void {
    for (const track of this.micStream?.getTracks() ?? []) track.stop();
    this.micStream = null;
    if (this.audioEl) {
      this.audioEl.pause();
      URL.revokeObjectURL(this.audioEl.src);
      this.audioEl.src = '';
      this.audioEl = null;
    }
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.destinationNode = null;
    this.analyser = null;
    this.dataArray = null;
    this.smoothedLevel = 0;
    this.rollingAverage = 0;
    this.pulseLevel = 0;
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;
    this.bassKick = 0;
    this.bassRollingAverage = 0;
    this.lastUpdateAt = null;
  }
}

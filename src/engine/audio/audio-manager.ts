export type AudioGroup = "sfx" | "music";
export type AudioUnlockState = "ready" | "blocked" | "unsupported";

export interface AudioSettings {
  readonly masterVolume: number;
  readonly sfxVolume: number;
  readonly musicVolume: number;
  readonly maxSources: number;
}
export interface PlaySoundOptions {
  readonly group?: AudioGroup;
  readonly volume?: number;
  readonly pitchJitter?: number;
}
type VolumeName = "masterVolume" | "sfxVolume" | "musicVolume";
type Volumes = Record<VolumeName, number>;
const storagePrefix = "furrena.audio.";

/** Web Audio mixer that creates its context only after a user gesture. */
export class AudioManager {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private readonly groups = new Map<AudioGroup, GainNode>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer>>();
  private readonly active = new Set<AudioBufferSourceNode>();
  private volumes_: Volumes;

  constructor(private readonly defaults: AudioSettings) {
    this.volumes_ = {
      masterVolume: readVolume("masterVolume", defaults.masterVolume),
      sfxVolume: readVolume("sfxVolume", defaults.sfxVolume),
      musicVolume: readVolume("musicVolume", defaults.musicVolume),
    };
  }
  get isReady(): boolean {
    return this.context?.state === "running";
  }
  get activeSourceCount(): number {
    return this.active.size;
  }
  get volumes(): Readonly<Volumes> {
    return this.volumes_;
  }

  async unlock(): Promise<AudioUnlockState> {
    if (!this.context) {
      if (!window.AudioContext) return "unsupported";
      this.context = new window.AudioContext();
      this.createMixer(this.context);
    }
    try {
      await this.context.resume();
      return this.context.state === "running" ? "ready" : "blocked";
    } catch {
      return "blocked";
    }
  }

  /** Caches one decoded WAV/OGG buffer per sound ID. */
  load(
    soundId: string,
    url: string,
    signal?: AbortSignal,
  ): Promise<AudioBuffer> {
    const cached = this.buffers.get(soundId);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(soundId);
    if (pending) return pending;
    const task = this.decode(soundId, url, signal);
    this.loading.set(soundId, task);
    void task.finally(() => this.loading.delete(soundId));
    return task;
  }

  playOneShot(soundId: string, options: PlaySoundOptions = {}): boolean {
    const context = this.context;
    const buffer = this.buffers.get(soundId);
    if (
      !context ||
      context.state !== "running" ||
      !buffer ||
      this.active.size >= this.defaults.maxSources
    )
      return false;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 1 + randomPitch(options.pitchJitter ?? 0.035);
    gain.gain.value = clamp(options.volume ?? 1);
    source.connect(gain).connect(this.groups.get(options.group ?? "sfx")!);
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return true;
  }

  setVolume(name: VolumeName, value: number): void {
    const safe = clamp(value);
    this.volumes_ = { ...this.volumes_, [name]: safe };
    writeVolume(name, safe);
    if (name === "masterVolume")
      this.master?.gain.setTargetAtTime(safe, 0, 0.015);
    else
      this.groups
        .get(name === "sfxVolume" ? "sfx" : "music")
        ?.gain.setTargetAtTime(safe, 0, 0.015);
  }
  setMuted(muted: boolean): void {
    this.master?.gain.setTargetAtTime(
      muted ? 0 : this.volumes_.masterVolume,
      0,
      0.01,
    );
  }

  /** Built-in effects keep the demo playable until production audio assets arrive. */
  createDemoSounds(): void {
    const context = this.context;
    if (!context) return;
    this.buffers.set("shot", tone(context, 0.1, 150, 64, 0.38, 0.08));
    this.buffers.set("hit", tone(context, 0.06, 340, 180, 0.3, 0.1));
    this.buffers.set("death", tone(context, 0.3, 180, 42, 0.25, 0.08));
    this.buffers.set("jump", tone(context, 0.09, 210, 350, 0.18, 0.07));
    this.buffers.set("step", tone(context, 0.045, 95, 70, 0.12, 0.045));
  }
  dispose(): void {
    for (const source of this.active) source.stop();
    this.active.clear();
    this.groups.clear();
    this.buffers.clear();
    this.loading.clear();
    if (this.context && this.context.state !== "closed")
      void this.context.close();
  }
  private createMixer(context: AudioContext): void {
    this.master = context.createGain();
    this.master.gain.value = this.volumes_.masterVolume;
    this.master.connect(context.destination);
    for (const group of ["sfx", "music"] as const) {
      const gain = context.createGain();
      gain.gain.value = this.volumes_[`${group}Volume`];
      gain.connect(this.master);
      this.groups.set(group, gain);
    }
  }
  private async decode(
    soundId: string,
    url: string,
    signal?: AbortSignal,
  ): Promise<AudioBuffer> {
    if (!this.context) throw new Error("Сначала разблокируйте звук.");
    const response = await fetch(url, { signal });
    if (!response.ok)
      throw new Error(
        `Не удалось загрузить звук ${soundId}: HTTP ${response.status}.`,
      );
    const buffer = await this.context.decodeAudioData(
      await response.arrayBuffer(),
    );
    this.buffers.set(soundId, buffer);
    return buffer;
  }
}
export function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
export function randomPitch(amount: number): number {
  return (Math.random() * 2 - 1) * Math.max(0, amount);
}
function readVolume(name: VolumeName, fallback: number): number {
  try {
    const value = window.localStorage.getItem(`${storagePrefix}${name}`);
    return value === null ? clamp(fallback) : clamp(Number(value));
  } catch {
    return clamp(fallback);
  }
}
function writeVolume(name: VolumeName, value: number): void {
  try {
    window.localStorage.setItem(`${storagePrefix}${name}`, String(value));
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}
function tone(
  context: AudioContext,
  seconds: number,
  start: number,
  end: number,
  volume: number,
  noise: number,
): AudioBuffer {
  const length = Math.max(1, Math.ceil(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let phase = 0;
  for (let index = 0; index < length; index += 1) {
    const progress = index / length;
    phase +=
      (Math.PI * 2 * (start + (end - start) * progress)) / context.sampleRate;
    samples[index] =
      (Math.sin(phase) * volume + (Math.random() * 2 - 1) * noise) *
      (1 - progress) ** 2;
  }
  return buffer;
}

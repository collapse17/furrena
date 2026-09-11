import { defineEvent } from "../ecs";
import type { Vec3 } from "./components";

export interface BulletTracerEventData {
  readonly start: Vec3;
  readonly end: Vec3;
  readonly materialIndex: number;
}

/** A short visual-only segment emitted by the hitscan system for one shot. */
export const BulletTracerEvent =
  defineEvent<BulletTracerEventData>("BulletTracer");

export type SoundId = "shot" | "hit" | "death" | "jump" | "step";
export interface PlaySoundEventData {
  readonly soundId: SoundId;
  readonly volume?: number;
}
/** Frame-local request consumed by AudioManager after gameplay systems run. */
export const PlaySoundEvent = defineEvent<PlaySoundEventData>("PlaySound");

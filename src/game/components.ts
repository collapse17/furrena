import { defineComponent, type Entity } from "../ecs";

export type Vec3 = [number, number, number];
export interface TransformData {
  position: Vec3;
  yaw: number;
}
export interface VelocityData {
  value: Vec3;
}
export interface CharacterControllerData {
  radius: number;
  height: number;
  grounded: boolean;
  jumpQueued: boolean;
}
export interface CameraData {
  pitch: number;
  eyeHeight: number;
}
export interface HealthData {
  current: number;
  readonly max: number;
  respawnSeconds: number;
}
export interface WeaponData {
  cooldownSeconds: number;
  readonly fireIntervalSeconds: number;
  readonly damage: number;
}
export interface BotControllerData {
  readonly target: Entity;
  decisionSeconds: number;
  strafeDirection: number;
}
export interface AnimatorData {
  clip: "idle" | "run" | "fire";
  fireSeconds: number;
}
/** Reserved for future PannerNode playback; SFX are global in this milestone. */
export interface AudioEmitterData {
  soundId: string;
  volume: number;
  loop: boolean;
}

export const Transform = defineComponent<TransformData>("Transform");
export const Velocity = defineComponent<VelocityData>("Velocity");
export const CharacterController = defineComponent<CharacterControllerData>(
  "CharacterController",
);
export const Camera = defineComponent<CameraData>("Camera");
export const PlayerInput = defineComponent("PlayerInput");
export const Health = defineComponent<HealthData>("Health");
export const Weapon = defineComponent<WeaponData>("Weapon");
export const BotController =
  defineComponent<BotControllerData>("BotController");
export const Animator = defineComponent<AnimatorData>("Animator");
export const AudioEmitter = defineComponent<AudioEmitterData>("AudioEmitter");

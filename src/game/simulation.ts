import type { ComponentType, Entity, World } from "../ecs";
import type { InputState } from "../engine/input/input";
import { BulletTracerEvent, PlaySoundEvent } from "./events";
import {
  Animator,
  BotController,
  Camera,
  CharacterController,
  Health,
  PlayerInput,
  Transform,
  Velocity,
  Weapon,
  type Vec3,
} from "./components";

const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;
const GRAVITY = 20;
const ARENA_LIMIT = 75.2;
const SPAWNS: readonly Vec3[] = [
  [-59.2, 0, -59.2],
  [59.2, 0, -59.2],
  [-59.2, 0, 59.2],
  [59.2, 0, 59.2],
];
const COVERS: readonly (readonly [number, number, number, number])[] = [
  [-47.05, -44.95, -1, 1],
  [-1.2, 1.2, -30.2, -29],
  [38.65, 40.55, -0.6, 0.6],
  [-6.05, -4.35, 31.5, 32.5],
  [45.05, 46.95, 41.45, 42.55],
];
type Intent = { forward: number; side: number; fire: boolean };

/** Fixed-step gameplay systems for the first playable FPS arena. */
export class FpsSimulation {
  private readonly intents = new Map<Entity, Intent>();
  private readonly footstepSeconds = new Map<Entity, number>();
  private spawnIndex = 0;
  constructor(
    readonly world: World,
    readonly player: Entity,
  ) {}

  update(input: InputState, seconds: number): void {
    this.playerControl(input);
    this.botThink(seconds);
    this.move(seconds);
    this.fire(seconds);
    this.animate(seconds);
  }

  camera(): { position: Vec3; yaw: number; pitch: number } {
    const transform = this.require(this.player, Transform);
    const camera = this.require(this.player, Camera);
    return {
      position: [
        transform.position[0],
        transform.position[1] + camera.eyeHeight,
        transform.position[2],
      ],
      yaw: transform.yaw,
      pitch: camera.pitch,
    };
  }

  livingBots(): number {
    return [...this.world.query(BotController, Health)].filter(
      (entity) => this.require(entity, Health).current > 0,
    ).length;
  }

  private playerControl(input: InputState): void {
    const transform = this.require(this.player, Transform);
    const camera = this.require(this.player, Camera);
    transform.yaw += input.lookDeltaX * LOOK_SENSITIVITY;
    camera.pitch = clamp(
      camera.pitch - input.lookDeltaY * LOOK_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH,
    );
    if (input.jump)
      this.require(this.player, CharacterController).jumpQueued = true;
    this.intents.set(this.player, {
      forward: Number(input.forward) - Number(input.backward),
      side: Number(input.right) - Number(input.left),
      fire: input.fire,
    });
  }

  private botThink(seconds: number): void {
    const player = this.require(this.player, Transform).position;
    for (const entity of this.world.query(BotController, Transform, Health)) {
      const bot = this.require(entity, BotController);
      const transform = this.require(entity, Transform);
      if (this.require(entity, Health).current <= 0) continue;
      const dx = player[0] - transform.position[0];
      const dz = player[2] - transform.position[2];
      const distance = Math.hypot(dx, dz);
      transform.yaw = Math.atan2(dx, -dz);
      bot.decisionSeconds -= seconds;
      if (bot.decisionSeconds <= 0) {
        bot.decisionSeconds = 0.35 + Math.random() * 0.35;
        bot.strafeDirection = Math.random() < 0.5 ? -1 : 1;
      }
      this.intents.set(entity, {
        forward: distance > 5.6 ? 1 : distance < 3.8 ? -0.65 : 0,
        side:
          distance > 3.8 && distance < 10.5 ? bot.strafeDirection * 0.55 : 0,
        fire: distance < 15 && !this.coverBlocks(transform.position, player),
      });
    }
  }

  private move(seconds: number): void {
    for (const entity of this.world.query(
      Transform,
      Velocity,
      CharacterController,
      Health,
    )) {
      const health = this.require(entity, Health);
      if (health.current <= 0) {
        health.respawnSeconds -= seconds;
        if (health.respawnSeconds <= 0) this.respawn(entity);
        continue;
      }
      const transform = this.require(entity, Transform);
      const velocity = this.require(entity, Velocity);
      const controller = this.require(entity, CharacterController);
      const intent = this.intents.get(entity) ?? {
        forward: 0,
        side: 0,
        fire: false,
      };
      const magnitude = Math.hypot(intent.forward, intent.side) || 1;
      const speed =
        this.world.has(entity, PlayerInput) && intent.forward > 0 ? 6.4 : 4.6;
      velocity.value[0] =
        ((Math.sin(transform.yaw) * intent.forward +
          Math.cos(transform.yaw) * intent.side) /
          magnitude) *
        speed;
      velocity.value[2] =
        ((-Math.cos(transform.yaw) * intent.forward +
          Math.sin(transform.yaw) * intent.side) /
          magnitude) *
        speed;
      if (controller.jumpQueued && controller.grounded) {
        velocity.value[1] = 7.2;
        controller.grounded = false;
        this.world.events.emit(PlaySoundEvent, {
          soundId: "jump",
          volume: 0.65,
        });
      }
      controller.jumpQueued = false;
      velocity.value[1] -= GRAVITY * seconds;
      transform.position[0] += velocity.value[0] * seconds;
      transform.position[1] += velocity.value[1] * seconds;
      transform.position[2] += velocity.value[2] * seconds;
      const limit = ARENA_LIMIT - controller.radius;
      transform.position[0] = clamp(transform.position[0], -limit, limit);
      transform.position[2] = clamp(transform.position[2], -limit, limit);
      this.resolveCoverCollision(transform.position, controller.radius);
      if (transform.position[1] <= 0) {
        transform.position[1] = 0;
        velocity.value[1] = 0;
        controller.grounded = true;
      }
      this.emitFootsteps(entity, controller, velocity, seconds);
    }
  }

  private fire(seconds: number): void {
    for (const entity of this.world.query(
      Transform,
      Weapon,
      Health,
      Animator,
    )) {
      const weapon = this.require(entity, Weapon);
      const health = this.require(entity, Health);
      weapon.cooldownSeconds = Math.max(0, weapon.cooldownSeconds - seconds);
      if (
        health.current <= 0 ||
        weapon.cooldownSeconds > 0 ||
        !this.intents.get(entity)?.fire
      )
        continue;
      weapon.cooldownSeconds = weapon.fireIntervalSeconds;
      this.world.events.emit(PlaySoundEvent, { soundId: "shot" });
      this.require(entity, Animator).fireSeconds = 0.18;
      const hit = this.hitscan(entity);
      const source = this.muzzlePosition(entity);
      const yaw = this.require(entity, Transform).yaw;
      const direction: Vec3 = [Math.sin(yaw), 0, -Math.cos(yaw)];
      const end =
        hit === undefined
          ? [
              source[0] + direction[0] * 16,
              source[1],
              source[2] + direction[2] * 16,
            ]
          : this.hitPosition(hit.entity);
      this.world.events.emit(BulletTracerEvent, {
        start: source,
        end,
        materialIndex: this.world.has(entity, PlayerInput) ? 3 : 2,
      });
      if (hit === undefined) continue;
      const target = this.require(hit.entity, Health);
      target.current = Math.max(0, target.current - weapon.damage);
      this.world.events.emit(PlaySoundEvent, { soundId: "hit", volume: 0.72 });
      if (target.current === 0) {
        target.respawnSeconds = 2.2;
        this.world.events.emit(PlaySoundEvent, {
          soundId: "death",
          volume: 0.8,
        });
      }
    }
  }
  private animate(seconds: number): void {
    for (const entity of this.world.query(Animator, Velocity, Health)) {
      const animator = this.require(entity, Animator);
      animator.fireSeconds = Math.max(0, animator.fireSeconds - seconds);
      const velocity = this.require(entity, Velocity).value;
      animator.clip =
        animator.fireSeconds > 0
          ? "fire"
          : this.require(entity, Health).current <= 0
            ? "idle"
            : Math.hypot(velocity[0], velocity[2]) > 0.1
              ? "run"
              : "idle";
    }
  }

  private hitscan(
    shooter: Entity,
  ): { entity: Entity; distance: number } | undefined {
    const source = this.require(shooter, Transform).position;
    const yaw = this.require(shooter, Transform).yaw;
    const direction: Vec3 = [Math.sin(yaw), 0, -Math.cos(yaw)];
    let nearest: { entity: Entity; distance: number } | undefined;
    for (const target of this.world.query(
      Transform,
      CharacterController,
      Health,
    )) {
      if (target === shooter || this.require(target, Health).current <= 0)
        continue;
      const position = this.require(target, Transform).position;
      const dx = position[0] - source[0];
      const dz = position[2] - source[2];
      const distance = dx * direction[0] + dz * direction[2];
      const lateral = Math.abs(dx * direction[2] - dz * direction[0]);
      if (
        distance <= 0 ||
        distance > 16 ||
        lateral > this.require(target, CharacterController).radius + 0.22 ||
        this.coverBlocks(source, position)
      )
        continue;
      if (nearest === undefined || distance < nearest.distance)
        nearest = { entity: target, distance };
    }
    return nearest;
  }

  private muzzlePosition(entity: Entity): Vec3 {
    const position = this.require(entity, Transform).position;
    const eyeHeight = this.world.get(entity, Camera)?.eyeHeight ?? 1.08;
    return [position[0], position[1] + eyeHeight - 0.18, position[2]];
  }

  private hitPosition(entity: Entity): Vec3 {
    const position = this.require(entity, Transform).position;
    return [position[0], position[1] + 0.9, position[2]];
  }
  private coverBlocks(source: Vec3, target: Vec3): boolean {
    return COVERS.some(([minX, maxX, minZ, maxZ]) =>
      segmentHitsAabb(source, target, minX, maxX, minZ, maxZ),
    );
  }

  private resolveCoverCollision(position: Vec3, radius: number): void {
    for (const [minX, maxX, minZ, maxZ] of COVERS) {
      const closestX = clamp(position[0], minX, maxX);
      const closestZ = clamp(position[2], minZ, maxZ);
      const deltaX = position[0] - closestX;
      const deltaZ = position[2] - closestZ;
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance >= radius) continue;
      if (distance > 0.0001) {
        const push = radius - distance;
        position[0] += (deltaX / distance) * push;
        position[2] += (deltaZ / distance) * push;
        continue;
      }
      const exits = [
        [position[0] - minX, -1, 0],
        [maxX - position[0], 1, 0],
        [position[2] - minZ, 0, -1],
        [maxZ - position[2], 0, 1],
      ] as const;
      const exit = exits.reduce((best, candidate) =>
        candidate[0] < best[0] ? candidate : best,
      );
      position[0] += (exit[1] ?? 0) * radius;
      position[2] += (exit[2] ?? 0) * radius;
    }
  }

  private respawn(entity: Entity): void {
    const point = SPAWNS[this.spawnIndex++ % SPAWNS.length] ?? [0, 0, 0];
    this.require(entity, Transform).position = [...point];
    this.require(entity, Velocity).value = [0, 0, 0];
    const health = this.require(entity, Health);
    health.current = health.max;
    health.respawnSeconds = 0;
  }

  private emitFootsteps(
    entity: Entity,
    controller: { readonly grounded: boolean },
    velocity: { readonly value: Vec3 },
    seconds: number,
  ): void {
    const speed = Math.hypot(velocity.value[0], velocity.value[2]);
    if (!controller.grounded || speed < 0.2) {
      this.footstepSeconds.delete(entity);
      return;
    }
    const remaining = (this.footstepSeconds.get(entity) ?? 0) - seconds;
    if (remaining > 0) {
      this.footstepSeconds.set(entity, remaining);
      return;
    }
    this.world.events.emit(PlaySoundEvent, {
      soundId: "step",
      volume: Math.min(0.55, 0.18 + speed / 14),
    });
    this.footstepSeconds.set(entity, Math.max(0.22, 0.52 - speed * 0.035));
  }
  private require<T>(entity: Entity, type: ComponentType<T>): T {
    const value = this.world.get(entity, type);
    if (value === undefined)
      throw new Error(`У сущности ${entity} отсутствует ${type.name}.`);
    return value;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
function segmentHitsAabb(
  source: Vec3,
  target: Vec3,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean {
  const pairs = [
    [source[0], target[0] - source[0], minX, maxX],
    [source[2], target[2] - source[2], minZ, maxZ],
  ] as const;
  let enter = 0;
  let exit = 1;
  for (const [origin, direction, minimum, maximum] of pairs) {
    if (Math.abs(direction) < 0.00001) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const a = (minimum - origin) / direction;
    const b = (maximum - origin) / direction;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit;
}

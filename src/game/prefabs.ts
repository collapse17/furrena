import { type Entity, World } from "../ecs";
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

function addCommonCharacter(world: World, position: Vec3): Entity {
  const entity = world.createEntity();
  world.add(entity, Transform, { position: [...position], yaw: 0 });
  world.add(entity, Velocity, { value: [0, 0, 0] });
  world.add(entity, CharacterController, {
    radius: 0.34,
    height: 1.5,
    grounded: true,
    jumpQueued: false,
  });
  world.add(entity, Health, { current: 100, max: 100, respawnSeconds: 0 });
  world.add(entity, Weapon, {
    cooldownSeconds: 0,
    fireIntervalSeconds: 0.42,
    damage: 25,
  });
  world.add(entity, Animator, { clip: "idle", fireSeconds: 0 });
  return entity;
}

export function createPlayer(world: World, position: Vec3): Entity {
  const player = addCommonCharacter(world, position);
  world.add(player, Camera, { pitch: 0, eyeHeight: 1.32 });
  world.add(player, PlayerInput, undefined);
  return player;
}

export function createBot(
  world: World,
  player: Entity,
  position: Vec3,
): Entity {
  const bot = addCommonCharacter(world, position);
  world.add(bot, Weapon, {
    cooldownSeconds: 0.6,
    fireIntervalSeconds: 1.15,
    damage: 7,
  });
  world.add(bot, BotController, {
    target: player,
    decisionSeconds: 0,
    strafeDirection: 1,
  });
  return bot;
}

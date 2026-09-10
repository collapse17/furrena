import { describe, expect, it } from "vitest";
import {
  defineComponent,
  defineEvent,
  defineResource,
  Scheduler,
  World,
} from "./index";

interface Position {
  x: number;
}
interface Velocity {
  x: number;
}
const Position = defineComponent<Position>("Position");
const Velocity = defineComponent<Velocity>("Velocity");
const Frozen = defineComponent<true>("Frozen");

describe("World", () => {
  it("clears all components before safely reusing an entity identifier", () => {
    const world = new World();
    const entity = world.createEntity();
    world.add(entity, Position, { x: 4 });
    expect(world.destroyEntity(entity)).toBe(true);
    const reused = world.createEntity();
    expect(reused).toBe(entity);
    expect(world.get(reused, Position)).toBeUndefined();
    expect(world.destroyEntity(entity)).toBe(true);
  });

  it("returns entities with all requested components and supports exclusions", () => {
    const world = new World();
    const moving = world.createEntity();
    const stationary = world.createEntity();
    const frozen = world.createEntity();
    world.add(moving, Position, { x: 1 });
    world.add(moving, Velocity, { x: 2 });
    world.add(stationary, Position, { x: 3 });
    world.add(frozen, Position, { x: 4 });
    world.add(frozen, Velocity, { x: 0 });
    world.add(frozen, Frozen, true);
    expect([...world.query(Position, Velocity).without(Frozen)]).toEqual([
      moving,
    ]);
  });

  it("stores typed world resources", () => {
    const Time = defineResource<{ elapsed: number }>("Time");
    const world = new World();
    world.setResource(Time, { elapsed: 1 });
    expect(world.requireResource(Time).elapsed).toBe(1);
  });
});

describe("Scheduler and frame events", () => {
  it("uses declared phase order and clears events after every frame", () => {
    const Hit = defineEvent<{ damage: number }>("Hit");
    const world = new World();
    const scheduler = new Scheduler(["input", "simulation", "render"]);
    const calls: string[] = [];
    scheduler
      .add("input", () => calls.push("input"))
      .add("simulation", (activeWorld) =>
        calls.push(`simulation:${activeWorld.events.read(Hit)[0]?.damage}`),
      )
      .add("render", () => calls.push("render"));
    world.events.emit(Hit, { damage: 12 });
    scheduler.run(world, 1 / 60);
    expect(calls).toEqual(["input", "simulation:12", "render"]);
    expect(world.events.read(Hit)).toEqual([]);
    expect(scheduler.debugStats().phaseTimesMs.size).toBe(3);
  });
});

describe("ECS scale smoke test", () => {
  it("creates, updates, queries, and destroys thousands of simple entities", () => {
    const world = new World();
    const entities = Array.from({ length: 5_000 }, () => {
      const entity = world.createEntity();
      world.add(entity, Position, { x: 0 });
      world.add(entity, Velocity, { x: 1 });
      return entity;
    });

    for (const entity of world.query(Position, Velocity)) {
      const position = world.get(entity, Position);
      const velocity = world.get(entity, Velocity);
      if (position && velocity) position.x += velocity.x;
    }
    for (const entity of entities) world.destroyEntity(entity);

    expect(world.debugStats()).toEqual({
      entities: 0,
      components: 0,
      events: 0,
    });
  });
});

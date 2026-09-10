import type { ComponentType } from "./component";
import { EventBuffer } from "./events";
import type { ResourceType } from "./resource";

export type Entity = number;

class ComponentStore<T> {
  private readonly values = new Map<Entity, T>();

  set(entity: Entity, value: T): void {
    this.values.set(entity, value);
  }
  get(entity: Entity): T | undefined {
    return this.values.get(entity);
  }
  has(entity: Entity): boolean {
    return this.values.has(entity);
  }
  delete(entity: Entity): boolean {
    return this.values.delete(entity);
  }
  get size(): number {
    return this.values.size;
  }
  entities(): IterableIterator<Entity> {
    return this.values.keys();
  }
}

export interface WorldDebugStats {
  readonly entities: number;
  readonly components: number;
  readonly events: number;
}

export class EntityQuery implements Iterable<Entity> {
  private readonly excluded = new Set<ComponentType<unknown>>();

  constructor(
    private readonly world: World,
    private readonly required: readonly ComponentType<unknown>[],
  ) {}

  without(...types: ComponentType<unknown>[]): this {
    for (const type of types) this.excluded.add(type);
    return this;
  }

  *[Symbol.iterator](): IterableIterator<Entity> {
    if (this.required.length === 0) {
      for (const entity of this.world.entities())
        if (this.matches(entity)) yield entity;
      return;
    }
    const seed = this.world.smallestStore(this.required);
    if (!seed) return;
    for (const entity of seed.entities())
      if (this.matches(entity)) yield entity;
  }

  private matches(entity: Entity): boolean {
    return (
      this.world.isAlive(entity) &&
      this.required.every((type) => this.world.has(entity, type)) &&
      [...this.excluded].every((type) => !this.world.has(entity, type))
    );
  }
}

/** Owns entity lifetime, component stores, world resources, and frame events. */
export class World {
  readonly events = new EventBuffer();
  private nextEntity = 1;
  private readonly availableEntities: Entity[] = [];
  private readonly aliveEntities = new Set<Entity>();
  private readonly stores = new Map<
    ComponentType<unknown>,
    ComponentStore<unknown>
  >();
  private readonly resources = new Map<ResourceType<unknown>, unknown>();

  createEntity(): Entity {
    const entity = this.availableEntities.pop() ?? this.nextEntity++;
    this.aliveEntities.add(entity);
    return entity;
  }

  destroyEntity(entity: Entity): boolean {
    if (!this.aliveEntities.delete(entity)) return false;
    for (const store of this.stores.values()) store.delete(entity);
    this.availableEntities.push(entity);
    return true;
  }

  isAlive(entity: Entity): boolean {
    return this.aliveEntities.has(entity);
  }
  *entities(): IterableIterator<Entity> {
    yield* this.aliveEntities;
  }

  add<T>(entity: Entity, type: ComponentType<T>, component: T): void {
    this.assertAlive(entity);
    this.store(type).set(entity, component);
  }
  remove<T>(entity: Entity, type: ComponentType<T>): boolean {
    return this.isAlive(entity) && this.store(type).delete(entity);
  }
  has<T>(entity: Entity, type: ComponentType<T>): boolean {
    return this.isAlive(entity) && this.store(type).has(entity);
  }
  get<T>(entity: Entity, type: ComponentType<T>): T | undefined {
    return this.isAlive(entity) ? this.store(type).get(entity) : undefined;
  }
  query(...types: ComponentType<unknown>[]): EntityQuery {
    return new EntityQuery(this, types);
  }

  setResource<T>(type: ResourceType<T>, value: T): void {
    this.resources.set(type as ResourceType<unknown>, value);
  }
  getResource<T>(type: ResourceType<T>): T | undefined {
    return this.resources.get(type as ResourceType<unknown>) as T | undefined;
  }
  requireResource<T>(type: ResourceType<T>): T {
    const resource = this.getResource(type);
    if (resource === undefined)
      throw new Error(`Отсутствует ресурс мира: ${type.name}.`);
    return resource;
  }
  removeResource<T>(type: ResourceType<T>): boolean {
    return this.resources.delete(type as ResourceType<unknown>);
  }

  debugStats(): WorldDebugStats {
    let components = 0;
    for (const store of this.stores.values()) components += store.size;
    return {
      entities: this.aliveEntities.size,
      components,
      events: this.events.size,
    };
  }

  smallestStore(
    types: readonly ComponentType<unknown>[],
  ): ComponentStore<unknown> | undefined {
    let smallest: ComponentStore<unknown> | undefined;
    for (const type of types) {
      const store = this.stores.get(type);
      if (!store) return undefined;
      if (!smallest || store.size < smallest.size) smallest = store;
    }
    return smallest;
  }

  private store<T>(type: ComponentType<T>): ComponentStore<T> {
    let store = this.stores.get(type as ComponentType<unknown>);
    if (!store) {
      store = new ComponentStore<unknown>();
      this.stores.set(type as ComponentType<unknown>, store);
    }
    return store as ComponentStore<T>;
  }

  private assertAlive(entity: Entity): void {
    if (!this.isAlive(entity))
      throw new Error(`Нельзя изменить несуществующую сущность ${entity}.`);
  }
}

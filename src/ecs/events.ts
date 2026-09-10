export interface EventType<T> {
  readonly id: symbol;
  readonly name: string;
  readonly __event?: T;
}

export function defineEvent<T>(name: string): EventType<T> {
  return { id: Symbol(name), name };
}

/** Frame-local event queues. Events are deliberately data-only. */
export class EventBuffer {
  private readonly queues = new Map<EventType<unknown>, unknown[]>();

  emit<T>(type: EventType<T>, event: T): void {
    const queue = this.queues.get(type);
    if (queue) queue.push(event);
    else this.queues.set(type as EventType<unknown>, [event]);
  }

  read<T>(type: EventType<T>): readonly T[] {
    return (this.queues.get(type as EventType<unknown>) ?? []) as readonly T[];
  }

  drain<T>(type: EventType<T>): T[] {
    const queue = this.queues.get(type as EventType<unknown>) ?? [];
    this.queues.delete(type as EventType<unknown>);
    return queue as T[];
  }

  clear(): void {
    this.queues.clear();
  }

  get size(): number {
    let count = 0;
    for (const queue of this.queues.values()) count += queue.length;
    return count;
  }
}

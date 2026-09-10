import type { World } from "./world";

export type SystemPhase = string;
export interface SystemContext {
  readonly phase: SystemPhase;
  readonly deltaSeconds: number;
}
export type System = (world: World, context: SystemContext) => void;
export interface SchedulerDebugStats {
  readonly phaseTimesMs: ReadonlyMap<SystemPhase, number>;
  readonly totalTimeMs: number;
}

/** Runs systems in a declared, deterministic phase and registration order. */
export class Scheduler {
  private readonly systems = new Map<SystemPhase, System[]>();
  private readonly phaseTimesMs = new Map<SystemPhase, number>();
  private lastStats: SchedulerDebugStats = {
    phaseTimesMs: new Map(),
    totalTimeMs: 0,
  };

  constructor(private readonly phases: readonly SystemPhase[]) {}

  add(phase: SystemPhase, system: System): this {
    if (!this.phases.includes(phase))
      throw new Error(`Неизвестная фаза системы: ${phase}.`);
    const systems = this.systems.get(phase) ?? [];
    systems.push(system);
    this.systems.set(phase, systems);
    return this;
  }

  run(world: World, deltaSeconds: number): void {
    this.phaseTimesMs.clear();
    const start = now();
    try {
      for (const phase of this.phases) {
        const phaseStart = now();
        for (const system of this.systems.get(phase) ?? [])
          system(world, { phase, deltaSeconds });
        this.phaseTimesMs.set(phase, now() - phaseStart);
      }
    } finally {
      world.events.clear();
    }
    this.lastStats = {
      phaseTimesMs: new Map(this.phaseTimesMs),
      totalTimeMs: now() - start,
    };
  }

  debugStats(): SchedulerDebugStats {
    return this.lastStats;
  }
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

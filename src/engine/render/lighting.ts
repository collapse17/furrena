export const MAX_POINT_LIGHTS = 4;

export interface DirectionalShadowSettings {
  /** Reserved for the future shadow-map pass; it does not affect this renderer yet. */
  readonly enabled: boolean;
  readonly mapSize: number;
}

export interface DirectionalLight {
  /** Direction in which the light travels, from the source towards the scene. */
  readonly direction: readonly [number, number, number];
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly shadow?: DirectionalShadowSettings;
}

export interface PointLight {
  readonly position: readonly [number, number, number];
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  /** Distance at which this light reaches zero contribution. */
  readonly range: number;
}

export interface HemisphericLight {
  readonly skyColor: readonly [number, number, number];
  readonly groundColor: readonly [number, number, number];
  readonly intensity: number;
}

export interface LightingSettings {
  readonly directional: DirectionalLight;
  readonly hemispheric: HemisphericLight;
  readonly points: readonly PointLight[];
}

export const defaultLighting: LightingSettings = Object.freeze({
  directional: {
    direction: [-0.45, -0.85, -0.3] as const,
    color: [1, 0.93, 0.82] as const,
    intensity: 2.2,
    shadow: { enabled: false, mapSize: 2048 },
  },
  hemispheric: {
    skyColor: [0.19, 0.28, 0.44] as const,
    groundColor: [0.055, 0.035, 0.025] as const,
    intensity: 0.6,
  },
  points: [
    {
      position: [-3.5, 2.7, 1.5] as const,
      color: [0.35, 0.65, 1] as const,
      intensity: 6,
      range: 8,
    },
    {
      position: [3.5, 2.3, 0] as const,
      color: [1, 0.36, 0.16] as const,
      intensity: 5,
      range: 7,
    },
    {
      position: [0, 3.1, -3.5] as const,
      color: [0.8, 0.28, 1] as const,
      intensity: 4,
      range: 7,
    },
  ],
});

function squaredDistance(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  const x = left[0] - right[0];
  const y = left[1] - right[1];
  const z = left[2] - right[2];
  return x * x + y * y + z * z;
}

/** Returns only the lights that can reach the object, ordered from nearest to farthest. */
export function selectClosestPointLights(
  lights: readonly PointLight[],
  objectPosition: readonly [number, number, number],
  limit = MAX_POINT_LIGHTS,
): readonly PointLight[] {
  return lights
    .filter(
      (light) =>
        light.range > 0 &&
        squaredDistance(light.position, objectPosition) <
          light.range * light.range,
    )
    .sort(
      (left, right) =>
        squaredDistance(left.position, objectPosition) -
        squaredDistance(right.position, objectPosition),
    )
    .slice(0, Math.max(0, limit));
}

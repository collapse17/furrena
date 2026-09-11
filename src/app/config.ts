export const appConfig = {
  canvas: {
    id: "game-canvas",
    clearColor: [0.039, 0.055, 0.071, 1] as const,
    maxDevicePixelRatio: 2,
  },
  render: {
    antialias: true,
    alpha: false,
    powerPreference: "high-performance" as const,
  },
  simulation: {
    fixedStepSeconds: 1 / 60,
    maxCatchUpSteps: 4,
    maxDeltaSeconds: 0.25,
  },
  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.9,
    musicVolume: 0.65,
    maxSources: 18,
  },
} as const;

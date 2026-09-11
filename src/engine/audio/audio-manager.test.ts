import { describe, expect, it } from "vitest";
import { clamp, randomPitch } from "./audio-manager";

describe("audio helpers", () => {
  it("clamps unsafe volume values", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(2)).toBe(1);
    expect(clamp(Number.NaN)).toBe(0);
  });
  it("keeps pitch jitter inside its range", () => {
    for (let index = 0; index < 20; index += 1)
      expect(Math.abs(randomPitch(0.04))).toBeLessThanOrEqual(0.04);
  });
});

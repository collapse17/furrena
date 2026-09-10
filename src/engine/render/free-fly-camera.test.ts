import { describe, expect, it } from "vitest";
import type { InputState } from "../input/input";
import { FreeFlyCamera } from "./free-fly-camera";

const idleInput: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  fire: false,
  lookDeltaX: 0,
  lookDeltaY: 0,
  pointerLocked: true,
};

describe("FreeFlyCamera", () => {
  it("moves at a fixed speed along its facing direction", () => {
    const camera = FreeFlyCamera.lookingAt([0, 0, 0], [0, 0, -1]);
    camera.update({ ...idleInput, forward: true }, 1);
    expect(camera.position).toEqual([0, 0, -5]);
  });

  it("uses mouse look and normalizes diagonal movement", () => {
    const camera = FreeFlyCamera.lookingAt([0, 0, 0], [0, 0, -1]);
    camera.update({ ...idleInput, lookDeltaX: 100 }, 0);
    camera.update({ ...idleInput, forward: true, right: true }, 1);
    expect(camera.position[0]).toBeGreaterThan(0);
    expect(Math.hypot(camera.position[0], camera.position[2])).toBeCloseTo(5);
  });
});

import type { InputState } from "../input/input";
import { createLookAtMatrix, type Matrix4 } from "./matrix";

const LOOK_SENSITIVITY = 0.0022;
const MOVE_SPEED = 5;
const MAX_PITCH = Math.PI / 2 - 0.01;

export class FreeFlyCamera {
  private readonly currentPosition: [number, number, number];

  private constructor(
    position: readonly [number, number, number],
    private yaw: number,
    private pitch: number,
  ) {
    this.currentPosition = [...position];
  }

  static lookingAt(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
  ): FreeFlyCamera {
    const x = target[0] - position[0];
    const y = target[1] - position[1];
    const z = target[2] - position[2];
    const horizontalDistance = Math.hypot(x, z) || 1;
    return new FreeFlyCamera(
      position,
      Math.atan2(x, -z),
      Math.atan2(y, horizontalDistance),
    );
  }

  get position(): readonly [number, number, number] {
    return this.currentPosition;
  }

  update(input: InputState, deltaSeconds: number): void {
    this.yaw += input.lookDeltaX * LOOK_SENSITIVITY;
    this.pitch = Math.max(
      -MAX_PITCH,
      Math.min(MAX_PITCH, this.pitch - input.lookDeltaY * LOOK_SENSITIVITY),
    );
    const forward = this.forward();
    const right: readonly [number, number, number] = [
      Math.cos(this.yaw),
      0,
      Math.sin(this.yaw),
    ];
    const forwardAmount = Number(input.forward) - Number(input.backward);
    const sideAmount = Number(input.right) - Number(input.left);
    const verticalAmount = Number(input.jump) - Number(input.sprint);
    const magnitude = Math.hypot(forwardAmount, sideAmount, verticalAmount);
    if (magnitude === 0 || deltaSeconds <= 0) return;
    const distance = (MOVE_SPEED * deltaSeconds) / magnitude;
    this.currentPosition[0] +=
      (forward[0] * forwardAmount + right[0] * sideAmount) * distance;
    this.currentPosition[1] +=
      (forward[1] * forwardAmount + verticalAmount) * distance;
    this.currentPosition[2] +=
      (forward[2] * forwardAmount + right[2] * sideAmount) * distance;
  }

  viewMatrix(): Matrix4 {
    const forward = this.forward();
    return createLookAtMatrix(this.currentPosition, [
      this.currentPosition[0] + forward[0],
      this.currentPosition[1] + forward[1],
      this.currentPosition[2] + forward[2],
    ]);
  }

  private forward(): readonly [number, number, number] {
    const cosPitch = Math.cos(this.pitch);
    return [
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch,
    ];
  }
}

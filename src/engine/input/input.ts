import { defineResource } from "../../ecs/resource";

export interface InputState {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
  readonly sprint: boolean;
  readonly fire: boolean;
  readonly lookDeltaX: number;
  readonly lookDeltaY: number;
  readonly pointerLocked: boolean;
}

export const InputResource = defineResource<InputState>("Input");

/** Owns DOM listeners and exposes immutable snapshots to ECS systems. */
export class InputManager {
  private readonly pressed = new Set<string>();
  private fire = false;
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private pointerLocked = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.reset);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("contextmenu", this.preventContextMenu);
  }

  snapshot(): InputState {
    const state: InputState = {
      forward: this.pressed.has("KeyW"),
      backward: this.pressed.has("KeyS"),
      left: this.pressed.has("KeyA"),
      right: this.pressed.has("KeyD"),
      jump: this.pressed.has("Space"),
      sprint: this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight"),
      fire: this.fire,
      lookDeltaX: this.lookDeltaX,
      lookDeltaY: this.lookDeltaY,
      pointerLocked: this.pointerLocked,
    };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return state;
  }

  clear(): void {
    this.reset();
  }

  dispose(): void {
    this.reset();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.reset);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
        "ShiftLeft",
        "ShiftRight",
      ].includes(event.code)
    )
      event.preventDefault();
    this.pressed.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };
  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) this.fire = true;
  };
  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.fire = false;
  };
  private readonly onMouseMove = (event: MouseEvent): void => {
    if (this.pointerLocked) {
      this.lookDeltaX += event.movementX;
      this.lookDeltaY += event.movementY;
    }
  };
  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };
  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.reset();
  };
  private readonly preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
  private readonly reset = (): void => {
    this.pressed.clear();
    this.fire = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  };
}

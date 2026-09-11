import "./styles.css";
import { appConfig } from "./app/config";
import { World } from "./ecs";
import {
  AssetManager,
  AssetScope,
  describeAssetError,
  loadGltf,
  uploadGltf,
} from "./engine/assets";
import { GltfAnimator } from "./engine/animation/skinning";
import { AudioManager } from "./engine/audio";
import { InputManager, InputResource } from "./engine/input/input";
import { GameLoop } from "./engine/platform/game-loop";
import { resizeCanvasToDisplaySize } from "./engine/render/canvas";
import {
  createLookAtMatrix,
  createPerspectiveMatrix,
  createTrsMatrix,
  type Matrix4,
} from "./engine/render/matrix";
import { Renderer } from "./engine/render/renderer";
import { createWebGlContext } from "./engine/render/webgl";
import {
  Animator,
  BotController,
  Health,
  Transform,
  type Vec3,
} from "./game/components";
import { createBot, createPlayer } from "./game/prefabs";
import { BulletTracerEvent, PlaySoundEvent } from "./game/events";
import { FpsSimulation } from "./game/simulation";

type CameraState = ReturnType<FpsSimulation["camera"]>;

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement))
    throw new Error(`Не найден обязательный элемент #${id}.`);
  return element as T;
}

function showError(message: string): void {
  const overlay = document.getElementById("status-overlay");
  if (overlay instanceof HTMLElement) {
    overlay.textContent = message;
    overlay.hidden = false;
    overlay.classList.add("status-overlay--error");
  }
}

function cameraView(
  position: readonly [number, number, number],
  yaw: number,
  pitch: number,
): Float32Array {
  const cosPitch = Math.cos(pitch);
  return createLookAtMatrix(position, [
    position[0] + Math.sin(yaw) * cosPitch,
    position[1] + Math.sin(pitch),
    position[2] - Math.cos(yaw) * cosPitch,
  ]);
}

function cameraRotation(
  yaw: number,
  pitch: number,
): readonly [number, number, number, number] {
  const halfYaw = (Math.PI - yaw) / 2;
  const halfPitch = -pitch / 2;
  return [
    Math.cos(halfYaw) * Math.sin(halfPitch),
    Math.sin(halfYaw) * Math.cos(halfPitch),
    -Math.sin(halfYaw) * Math.sin(halfPitch),
    Math.cos(halfYaw) * Math.cos(halfPitch),
  ];
}

function multiplyQuaternions(
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  return [
    left[3] * right[0] +
      left[0] * right[3] +
      left[1] * right[2] -
      left[2] * right[1],
    left[3] * right[1] -
      left[0] * right[2] +
      left[1] * right[3] +
      left[2] * right[0],
    left[3] * right[2] +
      left[0] * right[1] -
      left[1] * right[0] +
      left[2] * right[3],
    left[3] * right[3] -
      left[0] * right[0] -
      left[1] * right[1] -
      left[2] * right[2],
  ];
}

function weaponModel(
  camera: CameraState,
  right: number,
  up: number,
  forward: number,
  scale: readonly [number, number, number],
  rotation = cameraRotation(camera.yaw, camera.pitch),
): Matrix4 {
  const cosPitch = Math.cos(camera.pitch);
  const forwardX = Math.sin(camera.yaw) * cosPitch;
  const forwardY = Math.sin(camera.pitch);
  const forwardZ = -Math.cos(camera.yaw) * cosPitch;
  const rightX = Math.cos(camera.yaw);
  const rightZ = Math.sin(camera.yaw);
  return createTrsMatrix(
    [
      camera.position[0] + rightX * right + forwardX * forward,
      camera.position[1] + up + forwardY * forward,
      camera.position[2] + rightZ * right + forwardZ * forward,
    ],
    rotation,
    scale,
  );
}

function tracerModel(start: Vec3, end: Vec3): Matrix4 | undefined {
  const direction: Vec3 = [
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2],
  ];
  const length = Math.hypot(...direction);
  if (length < 0.001) return undefined;
  const unit: Vec3 = [
    direction[0] / length,
    direction[1] / length,
    direction[2] / length,
  ];
  const dot = unit[1];
  const rotation: readonly [number, number, number, number] =
    dot < -0.9999
      ? [1, 0, 0, 0]
      : (() => {
          const quaternion: readonly [number, number, number, number] = [
            unit[2],
            0,
            -unit[0],
            1 + dot,
          ];
          const magnitude = Math.hypot(...quaternion) || 1;
          return [
            quaternion[0] / magnitude,
            quaternion[1] / magnitude,
            quaternion[2] / magnitude,
            quaternion[3] / magnitude,
          ] as const;
        })();
  return createTrsMatrix(
    [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2],
    rotation,
    [0.025, length / 1.3, 0.025],
  );
}
async function startApplication(
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
): Promise<void> {
  const overlay = requiredElement<HTMLButtonElement>("status-overlay");
  const hud = requiredElement<HTMLDivElement>("game-hud");
  const crosshair = requiredElement<HTMLDivElement>("game-crosshair");
  const audioControls = requiredElement<HTMLDivElement>("audio-controls");
  const muteButton = requiredElement<HTMLButtonElement>("audio-mute");
  const volumeInput = requiredElement<HTMLInputElement>("audio-volume");
  const audioStatus = requiredElement<HTMLSpanElement>("audio-status");
  const audio = new AudioManager(appConfig.audio);
  volumeInput.value = String(audio.volumes.masterVolume);
  const assetManager = new AssetManager();
  const scope = new AssetScope(assetManager);
  canvas.dataset.assetState = "loading";
  overlay.textContent = "Загрузка FPS-арены…";
  const stageAsset = await scope.load("scene:fps-stage", async (signal) => {
    const document = await loadGltf("/assets/models/engine-stage.glb", {
      signal,
      onDiagnostic: (diagnostic) => console.warn(diagnostic.message),
    });
    return uploadGltf(context, document);
  });
  canvas.dataset.assetState = "ready";
  const renderer = new Renderer(context, canvas, {
    onContextLost: () =>
      showError("Графический контекст потерян. Восстанавливаем сцену…"),
    onContextRestored: () => window.location.reload(),
  });
  const showDebug =
    new URLSearchParams(window.location.search).get("debug") === "1";
  renderer.debug = { enabled: showDebug, grid: true, axes: true, bounds: true };

  const world = new World();
  const player = createPlayer(world, [0, 0, 48]);
  const bots = [
    createBot(world, player, [-28, 0, -22]),
    createBot(world, player, [30, 0, -17]),
    createBot(world, player, [-24, 0, 22]),
  ];
  const simulation = new FpsSimulation(world, player);
  const input = new InputManager(canvas);
  const botAnimators = new Map(
    bots.map((bot) => [bot, new GltfAnimator(stageAsset.source)]),
  );
  const activeTracers: {
    start: Vec3;
    end: Vec3;
    materialIndex: number;
    remaining: number;
  }[] = [];
  const staticNodes = [6, 7, 8, 9, 10, 11, 12, 13, 14];
  const coverModels = [
    createTrsMatrix([-46, 0.65, 0], [0, 0, 0, 1], [2.1, 1.3, 2]),
    createTrsMatrix([0, 0.65, -29.6], [0, 0, 0, 1], [2.4, 1.3, 1.2]),
    createTrsMatrix([39.6, 0.65, 0], [0, 0, 0, 1], [1.9, 1.3, 1.2]),
    createTrsMatrix([-5.2, 0.65, 32], [0, 0, 0, 1], [1.7, 1.3, 1]),
    createTrsMatrix([46, 0.65, 42], [0, 0, 0, 1], [1.9, 1.3, 1.1]),
  ];
  const resize = (): void => {
    if (resizeCanvasToDisplaySize(canvas, appConfig.canvas.maxDevicePixelRatio))
      renderer.setViewport();
  };

  const renderFrame = (): boolean => {
    try {
      const state = simulation.camera();
      const camera = {
        position: state.position,
        view: cameraView(state.position, state.yaw, state.pitch),
        projection: createPerspectiveMatrix(
          Math.PI / 3,
          canvas.width / canvas.height,
          0.05,
          100,
        ),
      };
      const enqueuePrimitive = (
        meshIndex: number,
        model: Matrix4,
        materialIndex?: number,
      ): void => {
        const primitive = stageAsset.meshes[meshIndex]?.primitives[0];
        if (primitive === undefined) return;
        const chosenMaterial = materialIndex ?? primitive.material;
        const sourceMaterial =
          chosenMaterial === undefined
            ? undefined
            : stageAsset.materials[chosenMaterial];
        renderer.enqueue(primitive, sourceMaterial, model, camera.position);
      };

      renderer.enqueueGltfNode(
        stageAsset,
        1,
        camera.position,
        undefined,
        createTrsMatrix([0, 0, 0], [0, 0, 0, 1], [20, 1, 20]),
      );
      for (const node of staticNodes)
        renderer.enqueueGltfNode(stageAsset, node, camera.position);
      for (const model of coverModels) enqueuePrimitive(6, model);
      for (const tracer of activeTracers) {
        const model = tracerModel(tracer.start, tracer.end);
        if (model !== undefined)
          enqueuePrimitive(8, model, tracer.materialIndex);
      }

      for (const entity of world.query(BotController, Transform, Animator)) {
        const transform = world.get(entity, Transform);
        const animator = botAnimators.get(entity);
        if (
          transform === undefined ||
          animator === undefined ||
          (world.get(entity, Health)?.current ?? 0) <= 0
        )
          continue;
        const halfYaw = transform.yaw / 2;
        renderer.enqueueGltfNode(
          stageAsset,
          2,
          camera.position,
          animator,
          createTrsMatrix(transform.position, [
            0,
            Math.sin(halfYaw),
            0,
            Math.cos(halfYaw),
          ]),
        );
      }

      const fireSeconds = world.get(player, Animator)?.fireSeconds ?? 0;
      const recoil = (fireSeconds / 0.18) * 0.15;
      const weaponRotation = cameraRotation(state.yaw, state.pitch);
      enqueuePrimitive(
        6,
        weaponModel(
          state,
          0.32,
          -0.28,
          0.65 - recoil,
          [0.22, 0.16, 0.48],
          weaponRotation,
        ),
      );
      enqueuePrimitive(
        6,
        weaponModel(
          state,
          0.32,
          -0.43,
          0.52 - recoil,
          [0.13, 0.26, 0.16],
          weaponRotation,
        ),
      );
      enqueuePrimitive(
        8,
        weaponModel(
          state,
          0.32,
          -0.21,
          1.02 - recoil,
          [0.065, 0.28, 0.065],
          multiplyQuaternions(weaponRotation, [
            Math.SQRT1_2,
            0,
            0,
            Math.SQRT1_2,
          ]),
        ),
      );
      if (fireSeconds > 0.08)
        enqueuePrimitive(
          6,
          weaponModel(
            state,
            0.32,
            -0.21,
            1.34 - recoil,
            [0.16, 0.16, 0.16],
            weaponRotation,
          ),
          3,
        );

      const stats = renderer.render(camera);
      canvas.dataset.drawCalls = String(stats.drawCalls);
      return true;
    } catch (error: unknown) {
      showError(`Ошибка отрисовки: ${describeAssetError(error)}`);
      console.error(error);
      return false;
    }
  };
  const updateHud = (): void => {
    const playerHealth = world.get(player, Health)?.current ?? 0;
    hud.textContent = `Здоровье ${playerHealth} · Боты ${simulation.livingBots()}/${bots.length}`;
  };

  resize();
  renderFrame();
  updateHud();
  const loop = new GameLoop({
    ...appConfig.simulation,
    onFixedUpdate: (seconds) => {
      const snapshot = input.snapshot();
      world.setResource(InputResource, snapshot);
      simulation.update(snapshot, seconds);
      for (const tracer of world.events.drain(BulletTracerEvent))
        activeTracers.push({ ...tracer, remaining: 0.11 });
      for (const sound of world.events.drain(PlaySoundEvent))
        audio.playOneShot(sound.soundId, { volume: sound.volume });
      for (let index = activeTracers.length - 1; index >= 0; index -= 1) {
        const tracer = activeTracers[index];
        if (tracer === undefined) continue;
        tracer.remaining -= seconds;
        if (tracer.remaining <= 0) activeTracers.splice(index, 1);
      }
      for (const entity of bots) {
        const animator = botAnimators.get(entity);
        const state = world.get(entity, Animator);
        if (animator === undefined || state === undefined) continue;
        if (animator.clipName !== state.clip)
          animator.setClip(state.clip, 0.12);
        animator.update(seconds);
      }
      updateHud();
    },
    onRender: () => {
      resize();
      if (!renderFrame()) loop.stop();
    },
  });
  const requestPointerLock = (): void => {
    if (document.pointerLockElement !== canvas)
      void Promise.resolve(canvas.requestPointerLock()).catch(() => undefined);
  };
  const start = (lock = true): void => {
    void audio.unlock().then((state) => {
      if (state === "ready") {
        audio.createDemoSounds();
        audioStatus.textContent = "Звук готов";
      } else {
        audioStatus.textContent =
          state === "unsupported"
            ? "Звук не поддерживается"
            : "Звук заблокирован браузером";
      }
      if (!renderFrame()) return;
      overlay.hidden = true;
      hud.hidden = false;
      crosshair.hidden = false;
      audioControls.hidden = false;
      if (lock) requestPointerLock();
      loop.start();
    });
  };
  canvas.addEventListener("click", requestPointerLock);
  muteButton.addEventListener("click", () => {
    const muted = muteButton.getAttribute("aria-pressed") !== "true";
    audio.setMuted(muted);
    muteButton.setAttribute("aria-pressed", String(muted));
    muteButton.textContent = muted ? "Звук: выкл." : "Звук: вкл.";
  });
  volumeInput.addEventListener("input", () =>
    audio.setVolume("masterVolume", Number(volumeInput.value)),
  );
  overlay.textContent =
    "Нажмите, чтобы начать · WASD — движение · мышь — обзор · Space — прыжок · ЛКМ — огонь";
  overlay.classList.remove("status-overlay--error");
  if (showDebug) start(false);
  else overlay.addEventListener("click", () => start(), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      input.clear();
      loop.stop();
    } else loop.start();
  });
  window.addEventListener("resize", resize);
  window.addEventListener(
    "beforeunload",
    () => {
      loop.stop();
      input.dispose();
      renderer.dispose();
      scope.dispose();
      assetManager.clear();
    },
    { once: true },
  );
}

async function boot(): Promise<void> {
  try {
    const canvas = requiredElement<HTMLCanvasElement>(appConfig.canvas.id);
    const result = createWebGlContext(canvas);
    if (!result.ok) showError(result.message);
    else await startApplication(canvas, result.context);
  } catch (error: unknown) {
    showError(`Не удалось запустить приложение: ${describeAssetError(error)}`);
    console.error(error);
  }
}

void boot();

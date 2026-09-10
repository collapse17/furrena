import "./styles.css";
import { appConfig } from "./app/config";
import { World } from "./ecs/world";
import {
  AssetManager,
  AssetScope,
  describeAssetError,
  loadGltf,
  uploadGltf,
} from "./engine/assets";
import { GltfAnimator } from "./engine/animation/skinning";
import { InputManager, InputResource } from "./engine/input/input";
import { GameLoop } from "./engine/platform/game-loop";
import { resizeCanvasToDisplaySize } from "./engine/render/canvas";
import { FreeFlyCamera } from "./engine/render/free-fly-camera";
import { createPerspectiveMatrix } from "./engine/render/matrix";
import { Renderer } from "./engine/render/renderer";
import { createWebGlContext } from "./engine/render/webgl";

function requiredElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement))
    throw new Error(`Не найден обязательный элемент #${id}.`);
  return element as TElement;
}

function showError(message: string): void {
  const overlay = document.getElementById("status-overlay");
  if (overlay instanceof HTMLElement) {
    overlay.textContent = message;
    overlay.hidden = false;
    overlay.classList.add("status-overlay--error");
  }
}

async function startApplication(
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
): Promise<void> {
  const overlay = requiredElement("status-overlay");
  const assetManager = new AssetManager();
  const sceneAssets = new AssetScope(assetManager);
  const useExternalGltf =
    new URLSearchParams(window.location.search).get("asset") === "gltf";
  const stageSource = useExternalGltf
    ? "/assets/models/engine-stage.gltf"
    : "/assets/models/engine-stage.glb";
  canvas.dataset.assetState = "loading";
  canvas.dataset.assetFormat = useExternalGltf ? "gltf" : "glb";
  overlay.textContent = "Загрузка арены и персонажа…";
  const stageAsset = await sceneAssets.load(
    "scene:engine-stage",
    async (signal) => {
      const document = await loadGltf(stageSource, {
        signal,
        onDiagnostic: (diagnostic) => console.warn(diagnostic.message),
      });
      return uploadGltf(context, document);
    },
  );
  canvas.dataset.assetState = "ready";
  canvas.dataset.meshCount = String(stageAsset.meshes.length);
  canvas.dataset.skinCount = String(stageAsset.source.skins.length);
  canvas.dataset.animationClips = stageAsset.source.animations
    .map((animation) => animation.name)
    .join(",");

  const renderer = new Renderer(context, canvas, {
    onContextLost: () =>
      showError("Графический контекст был потерян. Восстанавливаем сцену…"),
    onContextRestored: () => window.location.reload(),
  });
  const showDebug =
    new URLSearchParams(window.location.search).get("debug") === "1";
  renderer.debug = { enabled: showDebug, grid: true, axes: true, bounds: true };
  canvas.dataset.maxUniformJoints = String(renderer.skinningCapabilities.uniformJoints);
  canvas.dataset.texturePalette = String(renderer.skinningCapabilities.texturePalette);
  const flyCamera = FreeFlyCamera.lookingAt([6, 4, 7], [0, 0.6, 0]);
  const animator = new GltfAnimator(stageAsset.source);
  let animationSeconds = 0;
  let running = false;

  const renderFrame = (): boolean => {
    try {
      const camera = {
        position: flyCamera.position,
        view: flyCamera.viewMatrix(),
        projection: createPerspectiveMatrix(
          Math.PI / 3,
          canvas.width / canvas.height,
          0.05,
          100,
        ),
      };
      renderer.enqueueGltf(stageAsset, camera.position, animator);
      const stats = renderer.render(camera);
      canvas.dataset.drawCalls = String(stats.drawCalls);
      return true;
    } catch (error: unknown) {
      showError(`Ошибка отрисовки: ${describeAssetError(error)}`);
      console.error(error);
      return false;
    }
  };
  const world = new World();
  const input = new InputManager(canvas);
  const resize = (): void => {
    if (
      resizeCanvasToDisplaySize(canvas, appConfig.canvas.maxDevicePixelRatio)
    ) {
      renderer.setViewport();
    }
  };
  resize();
  renderFrame();

  const loop = new GameLoop({
    ...appConfig.simulation,
    onFixedUpdate: (deltaSeconds) => {
      const inputState = input.snapshot();
      world.setResource(InputResource, inputState);
      flyCamera.update(inputState, deltaSeconds);
      animationSeconds += deltaSeconds;
      if (animationSeconds >= 2.5) {
        running = !running;
        animator.setClip(running ? "run" : "idle", 0.25);
        animationSeconds = 0;
      }
      animator.update(deltaSeconds);
      canvas.dataset.animationClip = animator.clipName ?? "";
      canvas.dataset.cameraPosition = flyCamera.position
        .map((value) => value.toFixed(2))
        .join(",");
    },
    onRender: () => {
      resize();
      if (!renderFrame()) loop.stop();
    },
  });

  const requestCameraPointerLock = (): void => {
    if (document.pointerLockElement !== canvas) {
      void Promise.resolve(canvas.requestPointerLock()).catch(() => {
        // Pointer lock may be denied by the browser, but rendering can still start.
      });
    }
  };
  const start = (requestPointerLock = true): void => {
    if (!renderFrame()) return;
    overlay.hidden = true;
    if (requestPointerLock) requestCameraPointerLock();
    loop.start();
  };
  canvas.addEventListener("click", requestCameraPointerLock);
  overlay.textContent =
    "Нажмите, чтобы начать · WASD — облет · мышь — обзор · Space/Shift — вверх/вниз · idle/run сменяются плавно";
  overlay.classList.remove("status-overlay--error");
  if (showDebug) {
    overlay.hidden = true;
    start(false);
  } else overlay.addEventListener("click", () => start(), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      input.clear();
      loop.stop();
    } else {
      loop.start();
    }
  });
  window.addEventListener("resize", resize);
  window.addEventListener(
    "beforeunload",
    () => {
      loop.stop();
      canvas.removeEventListener("click", requestCameraPointerLock);
      input.dispose();
      renderer.dispose();
      sceneAssets.dispose();
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

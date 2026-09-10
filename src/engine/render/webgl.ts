import { appConfig } from "../../app/config";

export type WebGlSetupResult =
  | { readonly ok: true; readonly context: WebGL2RenderingContext }
  | { readonly ok: false; readonly message: string };

export function createWebGlContext(
  canvas: HTMLCanvasElement,
): WebGlSetupResult {
  const context = canvas.getContext(
    "webgl2",
    appConfig.render,
  ) as WebGL2RenderingContext | null;
  if (context === null) {
    return {
      ok: false,
      message:
        "WebGL 2 недоступен. Обновите браузер или включите аппаратное ускорение.",
    };
  }
  context.clearColor(...appConfig.canvas.clearColor);
  context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
  return { ok: true, context };
}

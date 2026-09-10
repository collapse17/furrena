/** Keeps the drawing buffer aligned with CSS dimensions and device pixel ratio. */
export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  maxDevicePixelRatio = 2,
): boolean {
  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    maxDevicePixelRatio,
  );
  const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}

export type AssetErrorCode =
  | "FETCH_FAILED"
  | "INVALID_GLTF"
  | "UNSUPPORTED_EXTENSION"
  | "UNSUPPORTED_ATTRIBUTE"
  | "UNSUPPORTED_IMAGE"
  | "GPU_UPLOAD_FAILED";

export class AssetError extends Error {
  constructor(
    readonly code: AssetErrorCode,
    message: string,
    readonly source?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AssetError";
  }
}

export interface AssetDiagnostic {
  readonly severity: "warning" | "error";
  readonly code: AssetErrorCode;
  readonly message: string;
  readonly source?: string;
}

export function describeAssetError(error: unknown): string {
  if (error instanceof AssetError) {
    const location = error.source === undefined ? "" : ` (${error.source})`;
    return `${error.message}${location}`;
  }
  if (error instanceof DOMException && error.name === "AbortError")
    return "Загрузка ресурсов отменена.";
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка загрузки ресурсов.";
}

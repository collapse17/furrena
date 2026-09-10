export interface DisposableAsset {
  dispose(): void;
}

export type AssetStatus = "loading" | "ready" | "error";

export interface AssetState {
  readonly status: AssetStatus;
  readonly references: number;
  readonly error?: unknown;
}

interface CacheEntry<T> {
  readonly controller: AbortController;
  promise: Promise<T>;
  status: AssetStatus;
  references: number;
  value?: T;
  error?: unknown;
}

export interface AssetRequest<T> {
  readonly value: Promise<T>;
  release(): void;
}

export type AssetLoader<T> = (signal: AbortSignal) => Promise<T>;
export type AssetDisposer = (asset: unknown) => void;

function defaultDisposer(asset: unknown): void {
  if (
    typeof asset === "object" &&
    asset !== null &&
    "dispose" in asset &&
    typeof asset.dispose === "function"
  ) {
    (asset as DisposableAsset).dispose();
  }
}

/** A reference-counted cache for scene resources and in-flight requests. */
export class AssetManager {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly disposeAsset: AssetDisposer = defaultDisposer) {}

  acquire<T>(key: string, loader: AssetLoader<T>): AssetRequest<T> {
    let entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (entry?.status === "error" && entry.references === 0) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (entry === undefined) entry = this.createEntry(key, loader);
    entry.references += 1;

    let released = false;
    return {
      value: entry.promise,
      release: (): void => {
        if (released) return;
        released = true;
        this.releaseEntry(key, entry);
      },
    };
  }

  state(key: string): AssetState | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    return {
      status: entry.status,
      references: entry.references,
      ...(entry.error === undefined ? {} : { error: entry.error }),
    };
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.controller.abort("Asset manager cleared");
      if (entry.status === "ready") this.disposeAsset(entry.value);
    }
    this.entries.clear();
  }

  private createEntry<T>(key: string, loader: AssetLoader<T>): CacheEntry<T> {
    const controller = new AbortController();
    const entry: CacheEntry<T> = {
      controller,
      status: "loading",
      references: 0,
      promise: Promise.resolve(undefined as T),
    };
    entry.promise = loader(controller.signal).then(
      (value) => {
        entry.value = value;
        entry.status = "ready";
        if (this.entries.get(key) !== entry || entry.references === 0) {
          this.disposeAsset(value);
          if (this.entries.get(key) === entry) this.entries.delete(key);
        }
        return value;
      },
      (error: unknown) => {
        entry.error = error;
        entry.status = "error";
        if (this.entries.get(key) === entry && entry.references === 0)
          this.entries.delete(key);
        throw error;
      },
    );
    this.entries.set(key, entry as CacheEntry<unknown>);
    return entry;
  }

  private releaseEntry<T>(key: string, entry: CacheEntry<T>): void {
    if (entry.references > 0) entry.references -= 1;
    if (entry.references !== 0 || this.entries.get(key) !== entry) return;
    if (entry.status === "loading") entry.controller.abort("Asset released");
    if (entry.status === "ready") this.disposeAsset(entry.value);
    this.entries.delete(key);
  }
}

function abortError(): DOMException {
  return new DOMException("Scene asset loading was aborted.", "AbortError");
}

/** Owns all references acquired for one scene and releases them as a group. */
export class AssetScope implements DisposableAsset {
  private readonly requests = new Set<AssetRequest<unknown>>();
  private readonly controller = new AbortController();
  private disposed = false;

  constructor(private readonly manager: AssetManager) {}

  async load<T>(key: string, loader: AssetLoader<T>): Promise<T> {
    if (this.disposed) throw abortError();
    const request = this.manager.acquire(key, loader);
    this.requests.add(request as AssetRequest<unknown>);

    const aborted = new Promise<never>((_resolve, reject) => {
      this.controller.signal.addEventListener(
        "abort",
        () => reject(abortError()),
        {
          once: true,
        },
      );
    });
    try {
      return await Promise.race([request.value, aborted]);
    } catch (error: unknown) {
      this.requests.delete(request as AssetRequest<unknown>);
      request.release();
      throw error;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    for (const request of this.requests) request.release();
    this.requests.clear();
  }
}

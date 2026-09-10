import { describe, expect, it, vi } from "vitest";
import { AssetManager, AssetScope } from "./asset-manager";

describe("AssetManager", () => {
  it("shares one in-flight load and disposes after the final release", async () => {
    const dispose = vi.fn();
    const manager = new AssetManager(dispose);
    const asset = { name: "arena" };
    const loader = vi.fn(async () => asset);

    const first = manager.acquire("arena", loader);
    const second = manager.acquire("arena", loader);
    expect(manager.state("arena")).toMatchObject({
      status: "loading",
      references: 2,
    });
    await expect(first.value).resolves.toBe(asset);
    await expect(second.value).resolves.toBe(asset);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(manager.state("arena")).toMatchObject({
      status: "ready",
      references: 2,
    });

    first.release();
    expect(dispose).not.toHaveBeenCalled();
    second.release();
    expect(dispose).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledWith(asset);
    expect(manager.state("arena")).toBeUndefined();
  });

  it("exposes failed state until its request is released", async () => {
    const manager = new AssetManager();
    const failure = new Error("broken GLB");
    const request = manager.acquire("character", async () => {
      throw failure;
    });
    await expect(request.value).rejects.toBe(failure);
    expect(manager.state("character")).toEqual({
      status: "error",
      references: 1,
      error: failure,
    });
    request.release();
    expect(manager.state("character")).toBeUndefined();
  });

  it("aborts an in-flight request when its scene scope is disposed", async () => {
    const manager = new AssetManager();
    const scope = new AssetScope(manager);
    let loaderSignal: AbortSignal | undefined;
    const loading = scope.load("level", (signal) => {
      loaderSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      });
    });

    scope.dispose();
    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    expect(loaderSignal?.aborted).toBe(true);
    expect(manager.state("level")).toBeUndefined();
  });
});

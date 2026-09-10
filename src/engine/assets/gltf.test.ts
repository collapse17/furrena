import { describe, expect, it } from "vitest";
import { AssetError } from "./errors";
import { loadGltf, parseGlb, readGltfAccessor } from "./gltf";

function makeGlb(jsonValue: unknown, binary = new Uint8Array()): ArrayBuffer {
  const encodedJson = new TextEncoder().encode(JSON.stringify(jsonValue));
  const jsonLength = Math.ceil(encodedJson.length / 4) * 4;
  const binaryLength = Math.ceil(binary.length / 4) * 4;
  const output = new ArrayBuffer(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(output);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  const jsonBytes = new Uint8Array(output, 20, jsonLength);
  jsonBytes.fill(0x20);
  jsonBytes.set(encodedJson);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true);
  new Uint8Array(output, binaryHeader + 8, binary.length).set(binary);
  return output;
}

describe("glTF parsing", () => {
  it("parses GLB 2 JSON and binary chunks", () => {
    const parsed = parseGlb(
      makeGlb(
        { asset: { version: "2.0" }, buffers: [{ byteLength: 4 }] },
        new Uint8Array([1, 2, 3, 4]),
      ),
    );
    expect(parsed.json.asset?.version).toBe("2.0");
    expect([
      ...new Uint8Array(parsed.binaryChunk ?? new ArrayBuffer()),
    ]).toEqual([1, 2, 3, 4]);
  });

  it("packs an interleaved accessor for direct GPU upload", () => {
    const buffer = new Float32Array([1, 2, 3, 99, 4, 5, 6, 99]).buffer;
    const json = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: buffer.byteLength }],
      bufferViews: [
        { buffer: 0, byteLength: buffer.byteLength, byteStride: 16 },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 2,
          type: "VEC3",
          min: [1, 2, 3],
          max: [4, 5, 6],
        },
      ],
    } as const;
    const accessor = readGltfAccessor(json, [buffer], 0);
    expect([...accessor.data]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(accessor.min).toEqual([1, 2, 3]);
    expect(accessor.max).toEqual([4, 5, 6]);
  });

  it("reports unsupported required extensions with context", async () => {
    const source = JSON.stringify({
      asset: { version: "2.0" },
      extensionsRequired: ["KHR_draco_mesh_compression"],
    });
    const fetcher = (async () =>
      new Response(source, {
        status: 200,
        headers: { "content-type": "model/gltf+json" },
      })) as typeof fetch;
    await expect(
      loadGltf("model.gltf", {
        baseUrl: "https://assets.example/",
        fetcher,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AssetError>>({
        code: "UNSUPPORTED_EXTENSION",
        source: "https://assets.example/model.gltf",
      }),
    );
  });
});

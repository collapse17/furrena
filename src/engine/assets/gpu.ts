import { AssetError } from "./errors";
import type {
  GltfAccessor,
  GltfDocument,
  GltfMaterial,
  GltfPrimitive,
  GltfTexture,
} from "./gltf";

export const GLTF_ATTRIBUTE_LOCATIONS: Readonly<Record<string, number>> = {
  POSITION: 0,
  NORMAL: 1,
  TEXCOORD_0: 2,
  TANGENT: 3,
  JOINTS_0: 4,
  WEIGHTS_0: 5,
};

export interface MeshBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export class GpuTexture {
  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly handle: WebGLTexture,
    readonly width: number,
    readonly height: number,
    readonly colorSpace: "linear" | "srgb",
  ) {}

  dispose(): void {
    this.gl.deleteTexture(this.handle);
  }
}

export class GpuMeshPrimitive {
  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly vertexArray: WebGLVertexArrayObject,
    private readonly buffers: readonly WebGLBuffer[],
    readonly mode: number,
    readonly vertexCount: number,
    readonly indexCount: number,
    readonly indexType: number | undefined,
    readonly material: number | undefined,
    readonly bounds: MeshBounds,
  ) {}

  draw(): void {
    this.gl.bindVertexArray(this.vertexArray);
    if (this.indexType === undefined)
      this.gl.drawArrays(this.mode, 0, this.vertexCount);
    else this.gl.drawElements(this.mode, this.indexCount, this.indexType, 0);
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.vertexArray);
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer);
  }
}

export interface GpuMesh {
  readonly name: string;
  readonly primitives: readonly GpuMeshPrimitive[];
}

export interface GpuMaterial {
  readonly source: GltfMaterial;
  readonly baseColorTexture?: GpuTexture;
  readonly metallicRoughnessTexture?: GpuTexture;
  readonly normalTexture?: GpuTexture;
  readonly emissiveTexture?: GpuTexture;
}

export class GpuGltfAsset {
  private disposed = false;

  constructor(
    readonly source: GltfDocument,
    readonly meshes: readonly GpuMesh[],
    readonly textures: readonly GpuTexture[],
    readonly materials: readonly GpuMaterial[],
  ) {}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.meshes)
      for (const primitive of mesh.primitives) primitive.dispose();
    for (const texture of this.textures) texture.dispose();
    this.source.dispose();
  }
}

function components(type: GltfAccessor["type"]): number {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
    case "MAT2":
      return 4;
    case "MAT3":
      return 9;
    case "MAT4":
      return 16;
  }
}

function createBuffer(
  gl: WebGL2RenderingContext,
  target: number,
  data: AllowSharedBufferSource,
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (buffer === null)
    throw new AssetError("GPU_UPLOAD_FAILED", "WebGL не создал buffer.");
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}

function computeBounds(position: GltfAccessor): MeshBounds {
  if (
    position.min !== undefined &&
    position.max !== undefined &&
    position.min.length >= 3 &&
    position.max.length >= 3
  ) {
    return {
      min: [position.min[0] ?? 0, position.min[1] ?? 0, position.min[2] ?? 0],
      max: [position.max[0] ?? 0, position.max[1] ?? 0, position.max[2] ?? 0],
    };
  }
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = position.data[vertex * 3 + axis] ?? 0;
      min[axis] = Math.min(min[axis] ?? Number.POSITIVE_INFINITY, value);
      max[axis] = Math.max(max[axis] ?? Number.NEGATIVE_INFINITY, value);
    }
  }
  return { min, max };
}

function validatePrimitiveMode(gl: WebGL2RenderingContext, mode: number): void {
  if (
    mode !== gl.POINTS &&
    mode !== gl.LINES &&
    mode !== gl.LINE_LOOP &&
    mode !== gl.LINE_STRIP &&
    mode !== gl.TRIANGLES &&
    mode !== gl.TRIANGLE_STRIP &&
    mode !== gl.TRIANGLE_FAN
  )
    throw new AssetError(
      "GPU_UPLOAD_FAILED",
      `Неизвестный режим primitive: ${mode}.`,
    );
}

function uploadPrimitive(
  gl: WebGL2RenderingContext,
  primitive: GltfPrimitive,
): GpuMeshPrimitive {
  validatePrimitiveMode(gl, primitive.mode);
  const vertexArray = gl.createVertexArray();
  if (vertexArray === null)
    throw new AssetError("GPU_UPLOAD_FAILED", "WebGL не создал vertex array.");
  const buffers: WebGLBuffer[] = [];
  gl.bindVertexArray(vertexArray);

  try {
    for (const [semantic, accessor] of primitive.attributes) {
      const location = GLTF_ATTRIBUTE_LOCATIONS[semantic];
      if (location === undefined)
        throw new AssetError(
          "GPU_UPLOAD_FAILED",
          `Для атрибута ${semantic} не назначен shader location.`,
        );
      if (accessor.type.startsWith("MAT"))
        throw new AssetError(
          "GPU_UPLOAD_FAILED",
          `Матричный vertex attribute ${semantic} не поддерживается.`,
        );
      const buffer = createBuffer(gl, gl.ARRAY_BUFFER, accessor.data);
      buffers.push(buffer);
      gl.enableVertexAttribArray(location);
      if (semantic.startsWith("JOINTS_"))
        gl.vertexAttribIPointer(
          location,
          components(accessor.type),
          accessor.componentType,
          0,
          0,
        );
      else
        gl.vertexAttribPointer(
          location,
          components(accessor.type),
          accessor.componentType,
          accessor.normalized,
          0,
          0,
        );
    }

    const jointsLocation = GLTF_ATTRIBUTE_LOCATIONS.JOINTS_0 ?? 4;
    const weightsLocation = GLTF_ATTRIBUTE_LOCATIONS.WEIGHTS_0 ?? 5;
    if (!primitive.attributes.has("JOINTS_0")) {
      gl.disableVertexAttribArray(jointsLocation);
      gl.vertexAttribI4ui(jointsLocation, 0, 0, 0, 0);
    }
    if (!primitive.attributes.has("WEIGHTS_0")) {
      gl.disableVertexAttribArray(weightsLocation);
      gl.vertexAttrib4f(weightsLocation, 1, 0, 0, 0);
    }

    let indexType: number | undefined;
    if (primitive.indices !== undefined) {
      if (
        primitive.indices.componentType !== gl.UNSIGNED_BYTE &&
        primitive.indices.componentType !== gl.UNSIGNED_SHORT &&
        primitive.indices.componentType !== gl.UNSIGNED_INT
      )
        throw new AssetError(
          "GPU_UPLOAD_FAILED",
          "Indices должны иметь тип UNSIGNED_BYTE/SHORT/INT.",
        );
      buffers.push(
        createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, primitive.indices.data),
      );
      indexType = primitive.indices.componentType;
    }

    const position = primitive.attributes.get("POSITION");
    if (position === undefined)
      throw new AssetError("GPU_UPLOAD_FAILED", "Primitive не имеет POSITION.");
    return new GpuMeshPrimitive(
      gl,
      vertexArray,
      buffers,
      primitive.mode,
      position.count,
      primitive.indices?.count ?? 0,
      indexType,
      primitive.material,
      computeBounds(position),
    );
  } catch (error: unknown) {
    gl.deleteVertexArray(vertexArray);
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    throw error;
  } finally {
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
}

function samplerFor(
  document: GltfDocument,
  texture: GltfTexture,
): {
  readonly magFilter: number;
  readonly minFilter: number;
  readonly wrapS: number;
  readonly wrapT: number;
} {
  return (
    (texture.sampler === undefined
      ? undefined
      : document.samplers[texture.sampler]) ?? {
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 10497,
      wrapT: 10497,
    }
  );
}

function needsMipmaps(minFilter: number): boolean {
  return (
    minFilter === 9984 ||
    minFilter === 9985 ||
    minFilter === 9986 ||
    minFilter === 9987
  );
}

function uploadTexture(
  gl: WebGL2RenderingContext,
  document: GltfDocument,
  texture: GltfTexture,
  colorSpace: "linear" | "srgb",
): GpuTexture {
  const image = document.images[texture.source];
  if (image === undefined)
    throw new AssetError(
      "GPU_UPLOAD_FAILED",
      `Texture ссылается на отсутствующее image[${texture.source}].`,
      document.sourceUrl,
    );
  const handle = gl.createTexture();
  if (handle === null)
    throw new AssetError("GPU_UPLOAD_FAILED", "WebGL не создал texture.");
  const sampler = samplerFor(document, texture);
  gl.bindTexture(gl.TEXTURE_2D, handle);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    colorSpace === "srgb" ? gl.SRGB8_ALPHA8 : gl.RGBA8,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image.bitmap,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, sampler.magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, sampler.minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, sampler.wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, sampler.wrapT);
  if (needsMipmaps(sampler.minFilter)) gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return new GpuTexture(
    gl,
    handle,
    image.bitmap.width,
    image.bitmap.height,
    colorSpace,
  );
}

function materialTexture(
  textures: readonly GpuTexture[],
  index: number | undefined,
): GpuTexture | undefined {
  return index === undefined ? undefined : textures[index];
}

/** Uploads packed glTF accessors using stable shader attribute locations. */
export function uploadGltf(
  gl: WebGL2RenderingContext,
  document: GltfDocument,
): GpuGltfAsset {
  const uploadedPrimitives: GpuMeshPrimitive[] = [];
  const textures: GpuTexture[] = [];
  try {
    const srgbTextures = new Set<number>();
    for (const material of document.materials) {
      if (material.baseColorTexture !== undefined)
        srgbTextures.add(material.baseColorTexture);
      if (material.emissiveTexture !== undefined)
        srgbTextures.add(material.emissiveTexture);
    }
    for (const [index, texture] of document.textures.entries()) {
      textures.push(
        uploadTexture(
          gl,
          document,
          texture,
          srgbTextures.has(index) ? "srgb" : "linear",
        ),
      );
    }
    const meshes = document.meshes.map((mesh) => ({
      name: mesh.name,
      primitives: mesh.primitives.map((primitive) => {
        const uploaded = uploadPrimitive(gl, primitive);
        uploadedPrimitives.push(uploaded);
        return uploaded;
      }),
    }));
    const materials = document.materials.map((source): GpuMaterial => ({
      source,
      ...(materialTexture(textures, source.baseColorTexture) === undefined
        ? {}
        : {
            baseColorTexture: materialTexture(
              textures,
              source.baseColorTexture,
            ),
          }),
      ...(materialTexture(textures, source.metallicRoughnessTexture) ===
      undefined
        ? {}
        : {
            metallicRoughnessTexture: materialTexture(
              textures,
              source.metallicRoughnessTexture,
            ),
          }),
      ...(materialTexture(textures, source.normalTexture) === undefined
        ? {}
        : { normalTexture: materialTexture(textures, source.normalTexture) }),
      ...(materialTexture(textures, source.emissiveTexture) === undefined
        ? {}
        : {
            emissiveTexture: materialTexture(textures, source.emissiveTexture),
          }),
    }));
    return new GpuGltfAsset(document, meshes, textures, materials);
  } catch (error: unknown) {
    for (const primitive of uploadedPrimitives) primitive.dispose();
    for (const texture of textures) texture.dispose();
    document.dispose();
    if (error instanceof AssetError) throw error;
    throw new AssetError(
      "GPU_UPLOAD_FAILED",
      "Не удалось загрузить glTF в WebGL.",
      document.sourceUrl,
      { cause: error },
    );
  }
}

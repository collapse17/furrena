import { AssetError, type AssetDiagnostic } from "./errors";

export type GltfComponentType = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;
export type GltfAccessorType =
  "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4";
export type GltfTypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Uint32Array
  | Float32Array;

export interface GltfAccessor {
  readonly data: GltfTypedArray;
  readonly componentType: GltfComponentType;
  readonly type: GltfAccessorType;
  readonly count: number;
  readonly normalized: boolean;
  readonly min?: readonly number[];
  readonly max?: readonly number[];
}

export interface GltfPrimitive {
  readonly attributes: ReadonlyMap<string, GltfAccessor>;
  readonly indices?: GltfAccessor;
  readonly material?: number;
  readonly mode: number;
}

export interface GltfMesh {
  readonly name: string;
  readonly primitives: readonly GltfPrimitive[];
}

export interface GltfMaterial {
  readonly name: string;
  readonly baseColorFactor: readonly [number, number, number, number];
  readonly baseColorTexture?: number;
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
  readonly metallicRoughnessTexture?: number;
  readonly normalTexture?: number;
  readonly emissiveFactor: readonly [number, number, number];
  readonly emissiveTexture?: number;
  readonly alphaMode: "OPAQUE" | "MASK" | "BLEND";
  readonly alphaCutoff: number;
  readonly doubleSided: boolean;
  readonly unlit: boolean;
}

export interface GltfImage {
  readonly name: string;
  readonly mimeType: "image/png" | "image/jpeg";
  readonly bitmap: ImageBitmap;
}

export interface GltfSampler {
  readonly magFilter: number;
  readonly minFilter: number;
  readonly wrapS: number;
  readonly wrapT: number;
}

export interface GltfTexture {
  readonly name: string;
  readonly source: number;
  readonly sampler?: number;
}

export interface GltfNode {
  readonly name: string;
  readonly children: readonly number[];
  readonly mesh?: number;
  readonly skin?: number;
  readonly matrix?: readonly number[];
  readonly translation?: readonly number[];
  readonly rotation?: readonly number[];
  readonly scale?: readonly number[];
}

export interface GltfSkin {
  readonly name: string;
  readonly joints: readonly number[];
  readonly skeleton?: number;
  readonly inverseBindMatrices: Float32Array;
}

export interface GltfAnimationSampler {
  readonly input: Float32Array;
  readonly output: Float32Array;
  readonly interpolation: "LINEAR" | "STEP";
  readonly outputType: GltfAccessorType;
}

export interface GltfAnimationChannel {
  readonly sampler: number;
  readonly targetNode: number;
  readonly path: "translation" | "rotation" | "scale" | "weights";
}

export interface GltfAnimation {
  readonly name: string;
  readonly samplers: readonly GltfAnimationSampler[];
  readonly channels: readonly GltfAnimationChannel[];
}

export interface GltfScene {
  readonly name: string;
  readonly nodes: readonly number[];
}

export interface GltfDocument {
  readonly sourceUrl: string;
  readonly meshes: readonly GltfMesh[];
  readonly materials: readonly GltfMaterial[];
  readonly images: readonly GltfImage[];
  readonly textures: readonly GltfTexture[];
  readonly samplers: readonly GltfSampler[];
  readonly nodes: readonly GltfNode[];
  readonly skins: readonly GltfSkin[];
  readonly animations: readonly GltfAnimation[];
  readonly scenes: readonly GltfScene[];
  readonly defaultScene?: number;
  readonly diagnostics: readonly AssetDiagnostic[];
  dispose(): void;
}

interface RawBuffer {
  readonly uri?: string;
  readonly byteLength: number;
}
interface RawBufferView {
  readonly buffer: number;
  readonly byteOffset?: number;
  readonly byteLength: number;
  readonly byteStride?: number;
}
interface RawAccessorSparse {
  readonly count: number;
  readonly indices: {
    readonly bufferView: number;
    readonly byteOffset?: number;
    readonly componentType: 5121 | 5123 | 5125;
  };
  readonly values: {
    readonly bufferView: number;
    readonly byteOffset?: number;
  };
}
interface RawAccessor {
  readonly bufferView?: number;
  readonly byteOffset?: number;
  readonly componentType: GltfComponentType;
  readonly normalized?: boolean;
  readonly count: number;
  readonly type: GltfAccessorType;
  readonly min?: readonly number[];
  readonly max?: readonly number[];
  readonly sparse?: RawAccessorSparse;
}
interface RawPrimitive {
  readonly attributes: Readonly<Record<string, number>>;
  readonly indices?: number;
  readonly material?: number;
  readonly mode?: number;
  readonly targets?: readonly Readonly<Record<string, number>>[];
}
interface RawMaterial {
  readonly name?: string;
  readonly pbrMetallicRoughness?: {
    readonly baseColorFactor?: readonly number[];
    readonly baseColorTexture?: { readonly index: number };
    readonly metallicFactor?: number;
    readonly roughnessFactor?: number;
    readonly metallicRoughnessTexture?: { readonly index: number };
  };
  readonly normalTexture?: { readonly index: number };
  readonly emissiveFactor?: readonly number[];
  readonly emissiveTexture?: { readonly index: number };
  readonly alphaMode?: string;
  readonly alphaCutoff?: number;
  readonly doubleSided?: boolean;
  readonly extensions?: Readonly<Record<string, unknown>>;
}
interface RawAnimation {
  readonly name?: string;
  readonly samplers: readonly {
    readonly input: number;
    readonly output: number;
    readonly interpolation?: string;
  }[];
  readonly channels: readonly {
    readonly sampler: number;
    readonly target: { readonly node?: number; readonly path: string };
  }[];
}
interface RawGltf {
  readonly asset?: { readonly version?: string };
  readonly extensionsRequired?: readonly string[];
  readonly extensionsUsed?: readonly string[];
  readonly buffers?: readonly RawBuffer[];
  readonly bufferViews?: readonly RawBufferView[];
  readonly accessors?: readonly RawAccessor[];
  readonly meshes?: readonly {
    readonly name?: string;
    readonly primitives: readonly RawPrimitive[];
  }[];
  readonly materials?: readonly RawMaterial[];
  readonly images?: readonly {
    readonly name?: string;
    readonly uri?: string;
    readonly mimeType?: string;
    readonly bufferView?: number;
  }[];
  readonly samplers?: readonly {
    readonly magFilter?: number;
    readonly minFilter?: number;
    readonly wrapS?: number;
    readonly wrapT?: number;
  }[];
  readonly textures?: readonly {
    readonly name?: string;
    readonly source?: number;
    readonly sampler?: number;
  }[];
  readonly nodes?: readonly {
    readonly name?: string;
    readonly children?: readonly number[];
    readonly mesh?: number;
    readonly skin?: number;
    readonly matrix?: readonly number[];
    readonly translation?: readonly number[];
    readonly rotation?: readonly number[];
    readonly scale?: readonly number[];
  }[];
  readonly skins?: readonly {
    readonly name?: string;
    readonly joints: readonly number[];
    readonly skeleton?: number;
    readonly inverseBindMatrices?: number;
  }[];
  readonly animations?: readonly RawAnimation[];
  readonly scenes?: readonly {
    readonly name?: string;
    readonly nodes?: readonly number[];
  }[];
  readonly scene?: number;
}

export interface ParsedGlb {
  readonly json: RawGltf;
  readonly binaryChunk?: ArrayBuffer;
}

export interface LoadGltfOptions {
  readonly signal?: AbortSignal;
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
  readonly createBitmap?: (source: ImageBitmapSource) => Promise<ImageBitmap>;
  readonly supportedExtensions?: ReadonlySet<string>;
  readonly onDiagnostic?: (diagnostic: AssetDiagnostic) => void;
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BINARY_CHUNK = 0x004e4942;
const SUPPORTED_ATTRIBUTES = new Set([
  "POSITION",
  "NORMAL",
  "TEXCOORD_0",
  "TANGENT",
  "JOINTS_0",
  "WEIGHTS_0",
]);
const DEFAULT_EXTENSIONS = new Set(["KHR_materials_unlit"]);
const COMPONENTS: Readonly<Record<GltfAccessorType, number>> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};
const COMPONENT_BYTES: Readonly<Record<GltfComponentType, number>> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

function invalid(
  message: string,
  source?: string,
  cause?: unknown,
): AssetError {
  return new AssetError("INVALID_GLTF", message, source, { cause });
}

function parseJson(text: string, source: string): RawGltf {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null)
      throw invalid("Корень glTF должен быть объектом.", source);
    return value as RawGltf;
  } catch (error: unknown) {
    if (error instanceof AssetError) throw error;
    throw invalid("Не удалось разобрать JSON glTF.", source, error);
  }
}

function decodeJsonChunk(chunk: ArrayBuffer): string {
  const decoded = new TextDecoder().decode(chunk);
  let end = decoded.length;
  while (end > 0) {
    const character = decoded.charCodeAt(end - 1);
    if (character !== 0 && character !== 0x20) break;
    end -= 1;
  }
  return decoded.slice(0, end);
}

export function parseGlb(data: ArrayBuffer, source = "GLB"): ParsedGlb {
  if (data.byteLength < 20) throw invalid("Файл GLB слишком короткий.", source);
  const view = new DataView(data);
  if (view.getUint32(0, true) !== GLB_MAGIC)
    throw invalid("Некорректная сигнатура GLB.", source);
  if (view.getUint32(4, true) !== 2)
    throw invalid("Поддерживается только GLB версии 2.", source);
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== data.byteLength)
    throw invalid("Длина GLB не совпадает с заголовком.", source);

  let offset = 12;
  let json: RawGltf | undefined;
  let binaryChunk: ArrayBuffer | undefined;
  while (offset + 8 <= data.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + length > data.byteLength)
      throw invalid("Chunk GLB выходит за границы файла.", source);
    const chunk = data.slice(offset, offset + length);
    if (type === JSON_CHUNK) {
      if (json !== undefined)
        throw invalid("GLB содержит несколько JSON chunks.", source);
      json = parseJson(decodeJsonChunk(chunk), source);
    } else if (type === BINARY_CHUNK && binaryChunk === undefined) {
      binaryChunk = chunk;
    }
    offset += length;
  }
  if (json === undefined)
    throw invalid("В GLB отсутствует JSON chunk.", source);
  return { json, ...(binaryChunk === undefined ? {} : { binaryChunk }) };
}

function absoluteUrl(url: string, baseUrl?: string): string {
  try {
    if (baseUrl !== undefined) return new URL(url, baseUrl).toString();
    return new URL(url).toString();
  } catch (error: unknown) {
    throw invalid(`Не удалось разрешить URL ресурса: ${url}`, url, error);
  }
}

async function fetchBuffer(
  url: string,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<{ readonly data: ArrayBuffer; readonly contentType: string }> {
  let response: Response;
  try {
    response = await fetcher(url, { signal });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new AssetError("FETCH_FAILED", "Не удалось загрузить ресурс.", url, {
      cause: error,
    });
  }
  if (!response.ok)
    throw new AssetError(
      "FETCH_FAILED",
      `Ресурс вернул HTTP ${response.status}.`,
      url,
    );
  return {
    data: await response.arrayBuffer(),
    contentType: response.headers.get("content-type")?.split(";")[0] ?? "",
  };
}

function validateDocument(
  json: RawGltf,
  source: string,
  supportedExtensions: ReadonlySet<string>,
  diagnostics: AssetDiagnostic[],
  onDiagnostic?: (diagnostic: AssetDiagnostic) => void,
): void {
  if (json.asset?.version !== "2.0")
    throw invalid("Поддерживается только glTF 2.0.", source);
  for (const extension of json.extensionsRequired ?? []) {
    if (supportedExtensions.has(extension)) continue;
    throw new AssetError(
      "UNSUPPORTED_EXTENSION",
      `Обязательное расширение glTF не поддерживается: ${extension}.`,
      source,
    );
  }
  for (const extension of json.extensionsUsed ?? []) {
    if (supportedExtensions.has(extension)) continue;
    const diagnostic: AssetDiagnostic = {
      severity: "warning",
      code: "UNSUPPORTED_EXTENSION",
      message: `Необязательное расширение glTF пропущено: ${extension}.`,
      source,
    };
    diagnostics.push(diagnostic);
    onDiagnostic?.(diagnostic);
  }
}

async function loadBuffers(
  json: RawGltf,
  sourceUrl: string,
  binaryChunk: ArrayBuffer | undefined,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<readonly ArrayBuffer[]> {
  return Promise.all(
    (json.buffers ?? []).map(async (buffer, index) => {
      let data: ArrayBuffer;
      if (buffer.uri !== undefined) {
        data = (
          await fetchBuffer(absoluteUrl(buffer.uri, sourceUrl), signal, fetcher)
        ).data;
      } else if (index === 0 && binaryChunk !== undefined) {
        data = binaryChunk;
      } else {
        throw invalid(
          `Для buffer[${index}] не задан uri или GLB chunk.`,
          sourceUrl,
        );
      }
      if (data.byteLength < buffer.byteLength)
        throw invalid(`buffer[${index}] короче объявленной длины.`, sourceUrl);
      return data;
    }),
  );
}

function typedArray(type: GltfComponentType, length: number): GltfTypedArray {
  switch (type) {
    case 5120:
      return new Int8Array(length);
    case 5121:
      return new Uint8Array(length);
    case 5122:
      return new Int16Array(length);
    case 5123:
      return new Uint16Array(length);
    case 5125:
      return new Uint32Array(length);
    case 5126:
      return new Float32Array(length);
  }
}

function componentAt(
  view: DataView,
  offset: number,
  type: GltfComponentType,
): number {
  switch (type) {
    case 5120:
      return view.getInt8(offset);
    case 5121:
      return view.getUint8(offset);
    case 5122:
      return view.getInt16(offset, true);
    case 5123:
      return view.getUint16(offset, true);
    case 5125:
      return view.getUint32(offset, true);
    case 5126:
      return view.getFloat32(offset, true);
  }
}

function requireAt<T>(
  items: readonly T[] | undefined,
  index: number,
  label: string,
): T {
  const item = items?.[index];
  if (item === undefined) throw invalid(`${label}[${index}] отсутствует.`);
  return item;
}

export function readGltfAccessor(
  json: RawGltf,
  buffers: readonly ArrayBuffer[],
  accessorIndex: number,
): GltfAccessor {
  const accessor = requireAt(json.accessors, accessorIndex, "accessor");
  const components = COMPONENTS[accessor.type];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  if (components === undefined || componentBytes === undefined)
    throw invalid(`accessor[${accessorIndex}] имеет неподдерживаемый тип.`);
  const output = typedArray(
    accessor.componentType,
    accessor.count * components,
  );

  if (accessor.bufferView !== undefined) {
    const bufferView = requireAt(
      json.bufferViews,
      accessor.bufferView,
      "bufferView",
    );
    const buffer = requireAt(buffers, bufferView.buffer, "buffer");
    const elementBytes = componentBytes * components;
    const stride = bufferView.byteStride ?? elementBytes;
    if (stride < elementBytes || stride % componentBytes !== 0)
      throw invalid(`Некорректный byteStride у accessor[${accessorIndex}].`);
    const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const requiredEnd =
      start + Math.max(0, accessor.count - 1) * stride + elementBytes;
    if (requiredEnd > buffer.byteLength)
      throw invalid(`accessor[${accessorIndex}] выходит за границы buffer.`);
    const dataView = new DataView(buffer);
    for (let element = 0; element < accessor.count; element += 1) {
      for (let component = 0; component < components; component += 1) {
        output[element * components + component] = componentAt(
          dataView,
          start + element * stride + component * componentBytes,
          accessor.componentType,
        );
      }
    }
  }

  if (accessor.sparse !== undefined) {
    const sparse = accessor.sparse;
    const indicesView = requireAt(
      json.bufferViews,
      sparse.indices.bufferView,
      "bufferView",
    );
    const valuesView = requireAt(
      json.bufferViews,
      sparse.values.bufferView,
      "bufferView",
    );
    const indicesBuffer = requireAt(buffers, indicesView.buffer, "buffer");
    const valuesBuffer = requireAt(buffers, valuesView.buffer, "buffer");
    const indexBytes = COMPONENT_BYTES[sparse.indices.componentType];
    const indicesOffset =
      (indicesView.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0);
    const valuesOffset =
      (valuesView.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0);
    const indicesData = new DataView(indicesBuffer);
    const valuesData = new DataView(valuesBuffer);
    for (let sparseIndex = 0; sparseIndex < sparse.count; sparseIndex += 1) {
      const target = componentAt(
        indicesData,
        indicesOffset + sparseIndex * indexBytes,
        sparse.indices.componentType,
      );
      if (!Number.isInteger(target) || target < 0 || target >= accessor.count)
        throw invalid(`Sparse index accessor[${accessorIndex}] вне диапазона.`);
      for (let component = 0; component < components; component += 1) {
        output[target * components + component] = componentAt(
          valuesData,
          valuesOffset +
            (sparseIndex * components + component) * componentBytes,
          accessor.componentType,
        );
      }
    }
  }

  return {
    data: output,
    componentType: accessor.componentType,
    type: accessor.type,
    count: accessor.count,
    normalized: accessor.normalized ?? false,
    ...(accessor.min === undefined ? {} : { min: [...accessor.min] }),
    ...(accessor.max === undefined ? {} : { max: [...accessor.max] }),
  };
}

function asFloatAccessor(accessor: GltfAccessor, label: string): Float32Array {
  if (!(accessor.data instanceof Float32Array))
    throw invalid(`${label} должен использовать FLOAT accessor.`);
  return accessor.data;
}

function tuple4(
  value: readonly number[] | undefined,
  fallback: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  return [
    value?.[0] ?? fallback[0],
    value?.[1] ?? fallback[1],
    value?.[2] ?? fallback[2],
    value?.[3] ?? fallback[3],
  ];
}

function tuple3(
  value: readonly number[] | undefined,
  fallback: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    value?.[0] ?? fallback[0],
    value?.[1] ?? fallback[1],
    value?.[2] ?? fallback[2],
  ];
}

function parseMaterials(json: RawGltf): readonly GltfMaterial[] {
  return (json.materials ?? []).map((material, index) => {
    const pbr = material.pbrMetallicRoughness;
    const alphaMode = material.alphaMode ?? "OPAQUE";
    if (alphaMode !== "OPAQUE" && alphaMode !== "MASK" && alphaMode !== "BLEND")
      throw invalid(`material[${index}] имеет некорректный alphaMode.`);
    return {
      name: material.name ?? `Material ${index}`,
      baseColorFactor: tuple4(pbr?.baseColorFactor, [1, 1, 1, 1]),
      ...(pbr?.baseColorTexture === undefined
        ? {}
        : { baseColorTexture: pbr.baseColorTexture.index }),
      metallicFactor: pbr?.metallicFactor ?? 1,
      roughnessFactor: pbr?.roughnessFactor ?? 1,
      ...(pbr?.metallicRoughnessTexture === undefined
        ? {}
        : { metallicRoughnessTexture: pbr.metallicRoughnessTexture.index }),
      ...(material.normalTexture === undefined
        ? {}
        : { normalTexture: material.normalTexture.index }),
      emissiveFactor: tuple3(material.emissiveFactor, [0, 0, 0]),
      ...(material.emissiveTexture === undefined
        ? {}
        : { emissiveTexture: material.emissiveTexture.index }),
      alphaMode,
      alphaCutoff: material.alphaCutoff ?? 0.5,
      doubleSided: material.doubleSided ?? false,
      unlit: material.extensions?.KHR_materials_unlit !== undefined,
    };
  });
}

function parseMeshes(
  json: RawGltf,
  buffers: readonly ArrayBuffer[],
  source: string,
): readonly GltfMesh[] {
  return (json.meshes ?? []).map((mesh, meshIndex) => ({
    name: mesh.name ?? `Mesh ${meshIndex}`,
    primitives: mesh.primitives.map((primitive, primitiveIndex) => {
      if (primitive.targets !== undefined)
        throw new AssetError(
          "UNSUPPORTED_ATTRIBUTE",
          "Morph targets пока не поддерживаются.",
          `${source} mesh[${meshIndex}].primitive[${primitiveIndex}]`,
        );
      const attributes = new Map<string, GltfAccessor>();
      for (const [semantic, accessorIndex] of Object.entries(
        primitive.attributes,
      )) {
        if (!SUPPORTED_ATTRIBUTES.has(semantic))
          throw new AssetError(
            "UNSUPPORTED_ATTRIBUTE",
            `Атрибут glTF не поддерживается: ${semantic}.`,
            `${source} mesh[${meshIndex}].primitive[${primitiveIndex}]`,
          );
        attributes.set(
          semantic,
          readGltfAccessor(json, buffers, accessorIndex),
        );
      }
      if (!attributes.has("POSITION"))
        throw invalid(
          `mesh[${meshIndex}].primitive[${primitiveIndex}] не имеет POSITION.`,
          source,
        );
      return {
        attributes,
        ...(primitive.indices === undefined
          ? {}
          : { indices: readGltfAccessor(json, buffers, primitive.indices) }),
        ...(primitive.material === undefined
          ? {}
          : { material: primitive.material }),
        mode: primitive.mode ?? 4,
      };
    }),
  }));
}

function identityMatrices(count: number): Float32Array {
  const matrices = new Float32Array(count * 16);
  for (let index = 0; index < count; index += 1) {
    matrices[index * 16] = 1;
    matrices[index * 16 + 5] = 1;
    matrices[index * 16 + 10] = 1;
    matrices[index * 16 + 15] = 1;
  }
  return matrices;
}

function parseSkins(
  json: RawGltf,
  buffers: readonly ArrayBuffer[],
): readonly GltfSkin[] {
  return (json.skins ?? []).map((skin, index) => {
    let inverseBindMatrices = identityMatrices(skin.joints.length);
    if (skin.inverseBindMatrices !== undefined) {
      const accessor = readGltfAccessor(
        json,
        buffers,
        skin.inverseBindMatrices,
      );
      if (accessor.type !== "MAT4" || accessor.count !== skin.joints.length)
        throw invalid(
          `skin[${index}] имеет некорректные inverse bind matrices.`,
        );
      inverseBindMatrices = asFloatAccessor(
        accessor,
        `skin[${index}].inverseBindMatrices`,
      );
    }
    return {
      name: skin.name ?? `Skin ${index}`,
      joints: [...skin.joints],
      ...(skin.skeleton === undefined ? {} : { skeleton: skin.skeleton }),
      inverseBindMatrices,
    };
  });
}

function parseAnimations(
  json: RawGltf,
  buffers: readonly ArrayBuffer[],
): readonly GltfAnimation[] {
  return (json.animations ?? []).map((animation, animationIndex) => ({
    name: animation.name ?? `Animation ${animationIndex}`,
    samplers: animation.samplers.map((sampler, samplerIndex) => {
      const interpolation = sampler.interpolation ?? "LINEAR";
      if (interpolation !== "LINEAR" && interpolation !== "STEP")
        throw invalid(
          `animation[${animationIndex}].sampler[${samplerIndex}] использует неподдерживаемую интерполяцию ${interpolation}.`,
        );
      const input = readGltfAccessor(json, buffers, sampler.input);
      const output = readGltfAccessor(json, buffers, sampler.output);
      if (input.type !== "SCALAR")
        throw invalid(
          `animation[${animationIndex}].sampler[${samplerIndex}] имеет некорректный input.`,
        );
      return {
        input: asFloatAccessor(input, "Animation input"),
        output: asFloatAccessor(output, "Animation output"),
        interpolation,
        outputType: output.type,
      };
    }),
    channels: animation.channels.map((channel, channelIndex) => {
      const targetNode = channel.target.node;
      const path = channel.target.path;
      if (targetNode === undefined)
        throw invalid(
          `animation[${animationIndex}].channel[${channelIndex}] не имеет target node.`,
        );
      if (
        path !== "translation" &&
        path !== "rotation" &&
        path !== "scale" &&
        path !== "weights"
      )
        throw invalid(
          `animation[${animationIndex}].channel[${channelIndex}] имеет неизвестный path.`,
        );
      return { sampler: channel.sampler, targetNode, path };
    }),
  }));
}

function imageMime(
  declared: string | undefined,
  url: string | undefined,
  contentType: string,
): "image/png" | "image/jpeg" {
  const mime = declared ?? contentType;
  if (mime === "image/png" || mime === "image/jpeg") return mime;
  if (url?.toLowerCase().match(/\.png(?:$|[?#])/u)) return "image/png";
  if (url?.toLowerCase().match(/\.jpe?g(?:$|[?#])/u)) return "image/jpeg";
  throw new AssetError(
    "UNSUPPORTED_IMAGE",
    `Поддерживаются только PNG/JPEG, получен ${mime || "неизвестный формат"}.`,
    url,
  );
}

async function loadImages(
  json: RawGltf,
  buffers: readonly ArrayBuffer[],
  sourceUrl: string,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
  bitmapFactory: (source: ImageBitmapSource) => Promise<ImageBitmap>,
): Promise<readonly GltfImage[]> {
  return Promise.all(
    (json.images ?? []).map(async (image, index) => {
      let blob: Blob;
      let resolvedUrl: string | undefined;
      let contentType = "";
      if (image.uri !== undefined) {
        resolvedUrl = absoluteUrl(image.uri, sourceUrl);
        const loaded = await fetchBuffer(resolvedUrl, signal, fetcher);
        contentType = loaded.contentType;
        blob = new Blob([loaded.data]);
      } else if (image.bufferView !== undefined) {
        const bufferView = requireAt(
          json.bufferViews,
          image.bufferView,
          "bufferView",
        );
        const buffer = requireAt(buffers, bufferView.buffer, "buffer");
        const start = bufferView.byteOffset ?? 0;
        blob = new Blob([buffer.slice(start, start + bufferView.byteLength)]);
      } else {
        throw invalid(
          `image[${index}] не имеет uri или bufferView.`,
          sourceUrl,
        );
      }
      const mimeType = imageMime(image.mimeType, resolvedUrl, contentType);
      const typedBlob = new Blob([blob], { type: mimeType });
      let bitmap: ImageBitmap;
      try {
        bitmap = await bitmapFactory(typedBlob);
      } catch (error: unknown) {
        throw new AssetError(
          "UNSUPPORTED_IMAGE",
          `Не удалось декодировать image[${index}] как ${mimeType}.`,
          resolvedUrl ?? sourceUrl,
          { cause: error },
        );
      }
      return { name: image.name ?? `Image ${index}`, mimeType, bitmap };
    }),
  );
}

export async function loadGltf(
  url: string,
  options: LoadGltfOptions = {},
): Promise<GltfDocument> {
  const documentBase =
    options.baseUrl ??
    (typeof globalThis.document === "undefined"
      ? undefined
      : globalThis.document.baseURI);
  const sourceUrl = absoluteUrl(url, documentBase);
  const fetcher = options.fetcher ?? fetch;
  const source = await fetchBuffer(sourceUrl, options.signal, fetcher);
  const header =
    source.data.byteLength >= 4
      ? new DataView(source.data).getUint32(0, true)
      : undefined;
  const parsed =
    header === GLB_MAGIC
      ? parseGlb(source.data, sourceUrl)
      : {
          json: parseJson(new TextDecoder().decode(source.data), sourceUrl),
        };
  const diagnostics: AssetDiagnostic[] = [];
  validateDocument(
    parsed.json,
    sourceUrl,
    options.supportedExtensions ?? DEFAULT_EXTENSIONS,
    diagnostics,
    options.onDiagnostic,
  );
  const buffers = await loadBuffers(
    parsed.json,
    sourceUrl,
    parsed.binaryChunk,
    options.signal,
    fetcher,
  );
  const bitmapFactory =
    options.createBitmap ??
    ((imageSource: ImageBitmapSource) =>
      createImageBitmap(imageSource, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      }));
  const images = await loadImages(
    parsed.json,
    buffers,
    sourceUrl,
    options.signal,
    fetcher,
    bitmapFactory,
  );
  const nodes = (parsed.json.nodes ?? []).map((node, index): GltfNode => ({
    name: node.name ?? `Node ${index}`,
    children: [...(node.children ?? [])],
    ...(node.mesh === undefined ? {} : { mesh: node.mesh }),
    ...(node.skin === undefined ? {} : { skin: node.skin }),
    ...(node.matrix === undefined ? {} : { matrix: [...node.matrix] }),
    ...(node.translation === undefined
      ? {}
      : { translation: [...node.translation] }),
    ...(node.rotation === undefined ? {} : { rotation: [...node.rotation] }),
    ...(node.scale === undefined ? {} : { scale: [...node.scale] }),
  }));
  const gltfDocument: GltfDocument = {
    sourceUrl,
    meshes: parseMeshes(parsed.json, buffers, sourceUrl),
    materials: parseMaterials(parsed.json),
    images,
    textures: (parsed.json.textures ?? []).map((texture, index) => {
      if (texture.source === undefined)
        throw invalid(`texture[${index}] не имеет source.`, sourceUrl);
      return {
        name: texture.name ?? `Texture ${index}`,
        source: texture.source,
        ...(texture.sampler === undefined ? {} : { sampler: texture.sampler }),
      };
    }),
    samplers: (parsed.json.samplers ?? []).map((sampler) => ({
      magFilter: sampler.magFilter ?? 9729,
      minFilter: sampler.minFilter ?? 9987,
      wrapS: sampler.wrapS ?? 10497,
      wrapT: sampler.wrapT ?? 10497,
    })),
    nodes,
    skins: parseSkins(parsed.json, buffers),
    animations: parseAnimations(parsed.json, buffers),
    scenes: (parsed.json.scenes ?? []).map((scene, index) => ({
      name: scene.name ?? `Scene ${index}`,
      nodes: [...(scene.nodes ?? [])],
    })),
    ...(parsed.json.scene === undefined
      ? {}
      : { defaultScene: parsed.json.scene }),
    diagnostics,
    dispose: (): void => {
      for (const image of images) image.bitmap.close();
    },
  };
  return gltfDocument;
}

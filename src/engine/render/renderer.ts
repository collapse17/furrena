import type { GltfAnimator, JointPalette } from "../animation/skinning";
import type {
  GpuGltfAsset,
  GpuMaterial,
  GpuMeshPrimitive,
} from "../assets/gpu";
import {
  defaultLighting,
  MAX_POINT_LIGHTS,
  selectClosestPointLights,
  type LightingSettings,
} from "./lighting";
import {
  createNormalMatrix,
  createTrsMatrix,
  multiplyMatrices,
  transformPoint,
  type Matrix4,
} from "./matrix";
import { Material, ShaderProgram, Texture } from "./resources";

export interface RenderCamera {
  readonly view: Matrix4;
  readonly projection: Matrix4;
  readonly position: readonly [number, number, number];
}

export interface RenderDebugOptions {
  readonly enabled: boolean;
  readonly grid: boolean;
  readonly axes: boolean;
  readonly bounds: boolean;
}

export interface RenderStats {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly opaqueCount: number;
  readonly transparentCount: number;
}

export interface RendererCallbacks {
  readonly onContextLost?: () => void;
  readonly onContextRestored?: () => void;
}

interface QueuedItem {
  readonly primitive: GpuMeshPrimitive;
  readonly material: Material;
  readonly model: Matrix4;
  readonly distance: number;
  readonly meshOrder: number;
  readonly jointPalette?: JointPalette;
}

const MAX_UNIFORM_JOINTS = 64;
const VERTEX_SOURCE = `#version 300 es
#define MAX_UNIFORM_JOINTS ${MAX_UNIFORM_JOINTS}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
layout(location = 4) in uvec4 aJoints;
layout(location = 5) in vec4 aWeights;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;
uniform int uSkinningMode;
uniform mat4 uJointMatrices[MAX_UNIFORM_JOINTS];
uniform sampler2D uJointPalette;
out vec2 vUv;
out vec3 vWorldPosition;
out vec3 vWorldNormal;
mat4 jointMatrix(uint index) {
  if (uSkinningMode == 1) return uJointMatrices[index];
  int row = int(index);
  return mat4(
    texelFetch(uJointPalette, ivec2(0, row), 0),
    texelFetch(uJointPalette, ivec2(1, row), 0),
    texelFetch(uJointPalette, ivec2(2, row), 0),
    texelFetch(uJointPalette, ivec2(3, row), 0)
  );
}
void main() {
  mat4 skinMatrix = mat4(1.0);
  if (uSkinningMode != 0)
    skinMatrix = aWeights.x * jointMatrix(aJoints.x) + aWeights.y * jointMatrix(aJoints.y) + aWeights.z * jointMatrix(aJoints.z) + aWeights.w * jointMatrix(aJoints.w);
  vec4 worldPosition = uModel * skinMatrix * vec4(aPosition, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(uNormalMatrix * mat3(skinMatrix) * aNormal);
  vUv = aUv;
  gl_Position = uProjection * uView * worldPosition;
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
const int MAX_POINT_LIGHTS = ${MAX_POINT_LIGHTS};
in vec2 vUv;
in vec3 vWorldPosition;
in vec3 vWorldNormal;
uniform vec4 uBaseColor;
uniform sampler2D uBaseColorTexture;
uniform float uMetallic;
uniform float uRoughness;
uniform sampler2D uMetallicRoughnessTexture;
uniform vec3 uEmissive;
uniform sampler2D uEmissiveTexture;
uniform int uAlphaMode;
uniform float uAlphaCutoff;
uniform bool uUnlit;
uniform vec3 uCameraPosition;
uniform vec3 uDirectionalDirection;
uniform vec3 uDirectionalColor;
uniform float uDirectionalIntensity;
uniform vec3 uHemisphericSkyColor;
uniform vec3 uHemisphericGroundColor;
uniform float uHemisphericIntensity;
uniform int uPointLightCount;
uniform vec4 uPointLightPositionRange[MAX_POINT_LIGHTS];
uniform vec4 uPointLightColorIntensity[MAX_POINT_LIGHTS];
out vec4 outColor;

vec3 acesToneMap(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 color) {
  vec3 low = color * 12.92;
  vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(high, low, lessThanEqual(color, vec3(0.0031308)));
}

vec3 evaluateLight(vec3 lightDirection, vec3 lightColor, float lightIntensity, vec3 normal, vec3 viewDirection, vec3 baseColor, float metallic, float roughness) {
  float nDotL = max(dot(normal, lightDirection), 0.0);
  if (nDotL <= 0.0) return vec3(0.0);
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  float shininess = mix(8.0, 256.0, 1.0 - roughness);
  float specularPower = pow(max(dot(normal, halfDirection), 0.0), shininess);
  vec3 specularColor = mix(vec3(0.04), baseColor, metallic);
  vec3 diffuseColor = baseColor * (1.0 - metallic);
  return (diffuseColor * nDotL + specularColor * specularPower * nDotL) * lightColor * lightIntensity;
}

void main() {
  vec4 base = uBaseColor * texture(uBaseColorTexture, vUv);
  if (uAlphaMode == 1 && base.a < uAlphaCutoff) discard;
  vec4 metallicRoughness = texture(uMetallicRoughnessTexture, vUv);
  float metallic = clamp(uMetallic * metallicRoughness.b, 0.0, 1.0);
  float roughness = clamp(uRoughness * metallicRoughness.g, 0.045, 1.0);
  vec3 emissive = uEmissive * texture(uEmissiveTexture, vUv).rgb;
  vec3 linearColor;
  if (uUnlit) {
    linearColor = base.rgb + emissive;
  } else {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float hemisphereMix = normal.y * 0.5 + 0.5;
    vec3 ambient = mix(uHemisphericGroundColor, uHemisphericSkyColor, hemisphereMix) * uHemisphericIntensity * base.rgb;
    vec3 directional = evaluateLight(normalize(-uDirectionalDirection), uDirectionalColor, uDirectionalIntensity, normal, viewDirection, base.rgb, metallic, roughness);
    vec3 points = vec3(0.0);
    for (int index = 0; index < MAX_POINT_LIGHTS; index += 1) {
      if (index >= uPointLightCount) break;
      vec4 positionRange = uPointLightPositionRange[index];
      vec3 offset = positionRange.xyz - vWorldPosition;
      float distanceToLight = length(offset);
      float reach = clamp(1.0 - distanceToLight / max(positionRange.w, 0.0001), 0.0, 1.0);
      vec4 colorIntensity = uPointLightColorIntensity[index];
      points += evaluateLight(offset / max(distanceToLight, 0.0001), colorIntensity.rgb, colorIntensity.a * reach * reach, normal, viewDirection, base.rgb, metallic, roughness);
    }
    linearColor = ambient + directional + points + emissive;
  }
  outColor = vec4(linearToSrgb(acesToneMap(linearColor)), base.a);
}`;

const DEBUG_VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aColor;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}`;

const DEBUG_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main() { outColor = vec4(vColor, 1.0); }`;

export class Renderer {
  readonly extensions: Readonly<Record<string, unknown>>;
  readonly skinningCapabilities: Readonly<{
    uniformJoints: number;
    texturePalette: boolean;
  }>;
  debug: RenderDebugOptions = {
    enabled: false,
    grid: true,
    axes: true,
    bounds: true,
  };
  private shader: ShaderProgram;
  private debugShader: ShaderProgram;
  private whiteTexture: Texture;
  private jointPaletteTexture: WebGLTexture;
  private readonly opaqueQueue: QueuedItem[] = [];
  private readonly transparentQueue: QueuedItem[] = [];
  private readonly materialCache = new Map<GpuMaterial | undefined, Material>();
  private readonly primitiveOrders = new Map<GpuMeshPrimitive, number>();
  private readonly debugVertexArray: WebGLVertexArrayObject;
  private readonly debugBuffer: WebGLBuffer;
  private lighting: LightingSettings = defaultLighting;
  private nextPrimitiveOrder = 0;
  private contextLost = false;
  private disposed = false;
  private stats: RenderStats = {
    drawCalls: 0,
    triangles: 0,
    opaqueCount: 0,
    transparentCount: 0,
  };

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly canvas: HTMLCanvasElement,
    callbacks: RendererCallbacks = {},
  ) {
    this.extensions = Object.freeze({
      colorBufferFloat: gl.getExtension("EXT_color_buffer_float"),
      anisotropicFiltering: gl.getExtension("EXT_texture_filter_anisotropic"),
      debugRendererInfo: gl.getExtension("WEBGL_debug_renderer_info"),
    });
    this.skinningCapabilities = Object.freeze({
      uniformJoints: Math.max(
        0,
        Math.min(
          MAX_UNIFORM_JOINTS,
          Math.floor(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) / 4) - 32,
        ),
      ),
      texturePalette: gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4,
    });
    this.shader = new ShaderProgram(
      gl,
      VERTEX_SOURCE,
      FRAGMENT_SOURCE,
      "lit mesh",
    );
    this.debugShader = new ShaderProgram(
      gl,
      DEBUG_VERTEX_SOURCE,
      DEBUG_FRAGMENT_SOURCE,
      "debug",
    );
    this.whiteTexture = Texture.solid(gl, [255, 255, 255, 255]);
    const jointPaletteTexture = gl.createTexture();
    if (jointPaletteTexture === null)
      throw new Error("WebGL не создал texture palette.");
    this.jointPaletteTexture = jointPaletteTexture;
    const vertexArray = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (vertexArray === null || buffer === null)
      throw new Error("WebGL не создал debug buffer.");
    this.debugVertexArray = vertexArray;
    this.debugBuffer = buffer;
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.configureState();
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.contextLost = true;
      callbacks.onContextLost?.();
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.contextLost = false;
      this.rebuildContextResources();
      callbacks.onContextRestored?.();
    });
  }

  get lastStats(): RenderStats {
    return this.stats;
  }

  /** Replaces the frame lighting. Point lights are culled per object before drawing. */
  setLighting(lighting: LightingSettings): void {
    this.lighting = lighting;
  }

  setViewport(width = this.canvas.width, height = this.canvas.height): void {
    this.gl.viewport(0, 0, width, height);
  }

  enqueue(
    primitive: GpuMeshPrimitive,
    sourceMaterial: GpuMaterial | undefined,
    model: Matrix4,
    cameraPosition: readonly [number, number, number],
    jointPalette?: JointPalette,
  ): void {
    const material = this.materialFor(sourceMaterial);
    const x = (model[12] ?? 0) - cameraPosition[0];
    const y = (model[13] ?? 0) - cameraPosition[1];
    const z = (model[14] ?? 0) - cameraPosition[2];
    const item: QueuedItem = {
      primitive,
      material,
      model,
      distance: x * x + y * y + z * z,
      meshOrder: this.primitiveOrder(primitive),
      ...(jointPalette === undefined ? {} : { jointPalette }),
      ...(jointPalette === undefined ? {} : { jointPalette }),
    };
    (material.options.alphaMode === "BLEND"
      ? this.transparentQueue
      : this.opaqueQueue
    ).push(item);
  }

  enqueueGltf(
    asset: GpuGltfAsset,
    cameraPosition: readonly [number, number, number],
    animator?: GltfAnimator,
    rootTransform: Matrix4 = createTrsMatrix(),
  ): void {
    const scene = asset.source.scenes[asset.source.defaultScene ?? 0];
    if (scene === undefined) return;
    const visit = (nodeIndex: number, parent: Matrix4): void => {
      const node = asset.source.nodes[nodeIndex];
      if (node === undefined) return;
      const local =
        node.matrix !== undefined && node.matrix.length === 16
          ? new Float32Array(node.matrix)
          : createTrsMatrix(node.translation, node.rotation, node.scale);
      const world = multiplyMatrices(parent, local);
      if (node.mesh !== undefined) {
        const mesh = asset.meshes[node.mesh];
        if (mesh !== undefined) {
          for (const primitive of mesh.primitives)
            this.enqueue(
              primitive,
              primitive.material === undefined
                ? undefined
                : asset.materials[primitive.material],
              world,
              cameraPosition,
              node.skin === undefined || animator === undefined
                ? undefined
                : animator.jointPalette(node.skin, world, rootTransform),
            );
        }
      }
      for (const child of node.children) visit(child, world);
    };
    const identity = createTrsMatrix();
    identity.set(rootTransform);
    for (const rootNode of scene.nodes) visit(rootNode, identity);
  }

  /** Queues one glTF node and its descendants, for independently placed instances. */
  enqueueGltfNode(
    asset: GpuGltfAsset,
    nodeIndex: number,
    cameraPosition: readonly [number, number, number],
    animator?: GltfAnimator,
    rootTransform: Matrix4 = createTrsMatrix(),
  ): void {
    const visit = (index: number, parent: Matrix4): void => {
      const node = asset.source.nodes[index];
      if (node === undefined) return;
      const local =
        node.matrix !== undefined && node.matrix.length === 16
          ? new Float32Array(node.matrix)
          : createTrsMatrix(node.translation, node.rotation, node.scale);
      const world = multiplyMatrices(parent, local);
      if (node.mesh !== undefined) {
        const mesh = asset.meshes[node.mesh];
        if (mesh !== undefined)
          for (const primitive of mesh.primitives)
            this.enqueue(
              primitive,
              primitive.material === undefined
                ? undefined
                : asset.materials[primitive.material],
              world,
              cameraPosition,
              node.skin === undefined || animator === undefined
                ? undefined
                : animator.jointPalette(node.skin, world, rootTransform),
            );
      }
      for (const child of node.children) visit(child, world);
    };
    visit(nodeIndex, rootTransform);
  }

  render(camera: RenderCamera): RenderStats {
    if (this.disposed || this.contextLost) return this.stats;
    this.setViewport();
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.opaqueQueue.sort(
      (left, right) =>
        (left.primitive.material ?? -1) - (right.primitive.material ?? -1) ||
        left.meshOrder - right.meshOrder,
    );
    this.transparentQueue.sort((left, right) => right.distance - left.distance);
    const debugItems = this.debug.enabled
      ? [...this.opaqueQueue, ...this.transparentQueue]
      : [];
    let drawCalls = 0;
    let triangles = 0;
    for (const item of this.opaqueQueue) {
      triangles += this.drawItem(item, camera);
      drawCalls += 1;
    }
    for (const item of this.transparentQueue) {
      triangles += this.drawItem(item, camera);
      drawCalls += 1;
    }
    if (this.debug.enabled) drawCalls += this.drawDebug(camera, debugItems);
    this.stats = {
      drawCalls,
      triangles,
      opaqueCount: this.opaqueQueue.length,
      transparentCount: this.transparentQueue.length,
    };
    this.opaqueQueue.length = 0;
    this.transparentQueue.length = 0;
    return this.stats;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.whiteTexture.dispose();
    this.shader.dispose();
    this.debugShader.dispose();
    this.gl.deleteBuffer(this.debugBuffer);
    this.gl.deleteVertexArray(this.debugVertexArray);
    for (const material of this.materialCache.values()) material.dispose();
    this.materialCache.clear();
  }

  private configureState(): void {
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.BACK);
    this.gl.frontFace(this.gl.CCW);
    this.gl.clearColor(0.039, 0.055, 0.071, 1);
  }

  private rebuildContextResources(): void {
    this.whiteTexture.dispose();
    this.shader.dispose();
    this.debugShader.dispose();
    this.shader = new ShaderProgram(
      this.gl,
      VERTEX_SOURCE,
      FRAGMENT_SOURCE,
      "lit mesh",
    );
    this.debugShader = new ShaderProgram(
      this.gl,
      DEBUG_VERTEX_SOURCE,
      DEBUG_FRAGMENT_SOURCE,
      "debug",
    );
    this.whiteTexture = Texture.solid(this.gl, [255, 255, 255, 255]);
    const jointPaletteTexture = this.gl.createTexture();
    if (jointPaletteTexture === null)
      throw new Error("WebGL не создал texture palette.");
    this.jointPaletteTexture = jointPaletteTexture;
    this.configureState();
  }

  private materialFor(source: GpuMaterial | undefined): Material {
    const existing = this.materialCache.get(source);
    if (existing !== undefined) return existing;
    const material = new Material({
      baseColor: source?.source.baseColorFactor ?? [1, 1, 1, 1],
      ...(source?.baseColorTexture === undefined
        ? {}
        : { baseColorTexture: source.baseColorTexture.handle }),
      metallic: source?.source.metallicFactor ?? 0,
      roughness: source?.source.roughnessFactor ?? 1,
      ...(source?.metallicRoughnessTexture === undefined
        ? {}
        : { metallicRoughnessTexture: source.metallicRoughnessTexture.handle }),
      emissive: source?.source.emissiveFactor ?? [0, 0, 0],
      ...(source?.emissiveTexture === undefined
        ? {}
        : { emissiveTexture: source.emissiveTexture.handle }),
      alphaMode: source?.source.alphaMode ?? "OPAQUE",
      alphaCutoff: source?.source.alphaCutoff ?? 0.5,
      doubleSided: source?.source.doubleSided ?? false,
      unlit: source?.source.unlit ?? false,
    });
    this.materialCache.set(source, material);
    return material;
  }

  private primitiveOrder(primitive: GpuMeshPrimitive): number {
    const existing = this.primitiveOrders.get(primitive);
    if (existing !== undefined) return existing;
    const order = this.nextPrimitiveOrder;
    this.nextPrimitiveOrder += 1;
    this.primitiveOrders.set(primitive, order);
    return order;
  }

  private drawItem(item: QueuedItem, camera: RenderCamera): number {
    const { gl } = this;
    const { options } = item.material;
    if (options.doubleSided) gl.disable(gl.CULL_FACE);
    else gl.enable(gl.CULL_FACE);
    if (options.alphaMode === "BLEND") {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
    } else {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    this.shader.use();
    gl.uniformMatrix4fv(this.shader.uniform("uModel"), false, item.model);
    gl.uniformMatrix4fv(this.shader.uniform("uView"), false, camera.view);
    gl.uniformMatrix4fv(
      this.shader.uniform("uProjection"),
      false,
      camera.projection,
    );
    gl.uniformMatrix3fv(
      this.shader.uniform("uNormalMatrix"),
      false,
      createNormalMatrix(item.model),
    );
    gl.uniform4fv(this.shader.uniform("uBaseColor"), options.baseColor);
    gl.uniform1f(this.shader.uniform("uMetallic"), options.metallic);
    gl.uniform1f(this.shader.uniform("uRoughness"), options.roughness);
    gl.uniform3fv(this.shader.uniform("uEmissive"), options.emissive);
    gl.uniform1i(
      this.shader.uniform("uAlphaMode"),
      options.alphaMode === "MASK" ? 1 : 0,
    );
    gl.uniform1f(this.shader.uniform("uAlphaCutoff"), options.alphaCutoff);
    gl.uniform1i(this.shader.uniform("uUnlit"), options.unlit ? 1 : 0);
    gl.uniform3fv(this.shader.uniform("uCameraPosition"), camera.position);
    this.uploadSkinning(item.jointPalette);
    this.bindTexture("uBaseColorTexture", 0, options.baseColorTexture);
    this.bindTexture(
      "uMetallicRoughnessTexture",
      1,
      options.metallicRoughnessTexture,
    );
    this.bindTexture("uEmissiveTexture", 2, options.emissiveTexture);
    this.uploadLights(item);
    item.primitive.draw();
    return item.primitive.mode === gl.TRIANGLES
      ? Math.floor(
          (item.primitive.indexType === undefined
            ? item.primitive.vertexCount
            : item.primitive.indexCount) / 3,
        )
      : 0;
  }

  private uploadSkinning(palette: JointPalette | undefined): void {
    const { gl } = this;
    if (palette === undefined) {
      gl.uniform1i(this.shader.uniform("uSkinningMode"), 0);
      return;
    }
    if (palette.jointCount <= this.skinningCapabilities.uniformJoints) {
      gl.uniform1i(this.shader.uniform("uSkinningMode"), 1);
      gl.uniformMatrix4fv(
        this.shader.uniform("uJointMatrices[0]"),
        false,
        palette.matrices,
      );
      return;
    }
    if (palette.jointCount > gl.getParameter(gl.MAX_TEXTURE_SIZE)) {
      gl.uniform1i(this.shader.uniform("uSkinningMode"), 0);
      console.warn(
        `Скелет содержит ${palette.jointCount} joints и не помещается в texture palette.`,
      );
      return;
    }
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.jointPaletteTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      4,
      palette.jointCount,
      0,
      gl.RGBA,
      gl.FLOAT,
      palette.matrices,
    );
    gl.uniform1i(this.shader.uniform("uJointPalette"), 3);
    gl.uniform1i(this.shader.uniform("uSkinningMode"), 2);
  }
  private bindTexture(
    uniform: string,
    unit: number,
    texture: WebGLTexture | undefined,
  ): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture ?? this.whiteTexture.handle);
    gl.uniform1i(this.shader.uniform(uniform), unit);
  }

  private uploadLights(item: QueuedItem): void {
    const { gl } = this;
    const { directional, hemispheric } = this.lighting;
    const min = item.primitive.bounds.min;
    const max = item.primitive.bounds.max;
    const center = transformPoint(item.model, [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ]);
    const points = selectClosestPointLights(this.lighting.points, center);
    const positionsRanges = new Float32Array(MAX_POINT_LIGHTS * 4);
    const colorsIntensities = new Float32Array(MAX_POINT_LIGHTS * 4);
    for (const [index, light] of points.entries()) {
      positionsRanges.set([...light.position, light.range], index * 4);
      colorsIntensities.set([...light.color, light.intensity], index * 4);
    }
    gl.uniform3fv(
      this.shader.uniform("uDirectionalDirection"),
      directional.direction,
    );
    gl.uniform3fv(this.shader.uniform("uDirectionalColor"), directional.color);
    gl.uniform1f(
      this.shader.uniform("uDirectionalIntensity"),
      directional.intensity,
    );
    gl.uniform3fv(
      this.shader.uniform("uHemisphericSkyColor"),
      hemispheric.skyColor,
    );
    gl.uniform3fv(
      this.shader.uniform("uHemisphericGroundColor"),
      hemispheric.groundColor,
    );
    gl.uniform1f(
      this.shader.uniform("uHemisphericIntensity"),
      hemispheric.intensity,
    );
    gl.uniform1i(this.shader.uniform("uPointLightCount"), points.length);
    gl.uniform4fv(
      this.shader.uniform("uPointLightPositionRange[0]"),
      positionsRanges,
    );
    gl.uniform4fv(
      this.shader.uniform("uPointLightColorIntensity[0]"),
      colorsIntensities,
    );
  }

  private drawDebug(
    camera: RenderCamera,
    items: readonly QueuedItem[],
  ): number {
    const vertices: number[] = [];
    if (this.debug.grid) appendGrid(vertices);
    if (this.debug.axes) appendAxes(vertices);
    if (this.debug.bounds)
      for (const item of items)
        appendBounds(
          vertices,
          item.model,
          item.primitive.bounds.min,
          item.primitive.bounds.max,
        );
    if (vertices.length === 0) return 0;
    const gl = this.gl;
    this.debugShader.use();
    gl.uniformMatrix4fv(this.debugShader.uniform("uView"), false, camera.view);
    gl.uniformMatrix4fv(
      this.debugShader.uniform("uProjection"),
      false,
      camera.projection,
    );
    gl.bindVertexArray(this.debugVertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    gl.drawArrays(gl.LINES, 0, vertices.length / 6);
    gl.depthMask(true);
    return 1;
  }
}

function appendLine(
  vertices: number[],
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  color: readonly [number, number, number],
): void {
  vertices.push(...start, ...color, ...end, ...color);
}

function appendGrid(vertices: number[]): void {
  for (let index = -10; index <= 10; index += 1) {
    const color: readonly [number, number, number] =
      index === 0 ? [0.3, 0.38, 0.48] : [0.13, 0.17, 0.22];
    appendLine(vertices, [index, 0, -10], [index, 0, 10], color);
    appendLine(vertices, [-10, 0, index], [10, 0, index], color);
  }
}

function appendAxes(vertices: number[]): void {
  appendLine(vertices, [0, 0.01, 0], [2, 0.01, 0], [1, 0.2, 0.2]);
  appendLine(vertices, [0, 0.01, 0], [0, 2.01, 0], [0.2, 1, 0.2]);
  appendLine(vertices, [0, 0.01, 0], [0, 0.01, 2], [0.2, 0.45, 1]);
}

function appendBounds(
  vertices: number[],
  model: Matrix4,
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): void {
  const corners = [
    transformPoint(model, [min[0], min[1], min[2]]),
    transformPoint(model, [max[0], min[1], min[2]]),
    transformPoint(model, [max[0], max[1], min[2]]),
    transformPoint(model, [min[0], max[1], min[2]]),
    transformPoint(model, [min[0], min[1], max[2]]),
    transformPoint(model, [max[0], min[1], max[2]]),
    transformPoint(model, [max[0], max[1], max[2]]),
    transformPoint(model, [min[0], max[1], max[2]]),
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ] as const;
  for (const [start, end] of edges)
    appendLine(
      vertices,
      corners[start] ?? [0, 0, 0],
      corners[end] ?? [0, 0, 0],
      [1, 0.7, 0.15],
    );
}

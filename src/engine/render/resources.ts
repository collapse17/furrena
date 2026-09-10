export class ShaderProgram {
  readonly program: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation>();
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    readonly label: string,
  ) {
    const vertexShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      vertexSource,
      `${label} vertex`,
    );
    const fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentSource,
      `${label} fragment`,
    );
    const program = gl.createProgram();
    if (program === null)
      throw new Error(`WebGL не создал программу ${label}.`);
    this.program = program;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message =
        gl.getProgramInfoLog(program) ?? "без дополнительной информации";
      gl.deleteProgram(program);
      throw new Error(`Не удалось слинковать шейдер ${label}: ${message}`);
    }
  }

  use(): void {
    if (this.disposed) throw new Error(`Шейдер ${this.label} уже освобождён.`);
    this.gl.useProgram(this.program);
  }

  uniform(name: string): WebGLUniformLocation {
    const cached = this.uniforms.get(name);
    if (cached !== undefined) return cached;
    const location = this.gl.getUniformLocation(this.program, name);
    if (location === null)
      throw new Error(`Шейдер ${this.label} не содержит uniform ${name}.`);
    this.uniforms.set(name, location);
    return location;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.uniforms.clear();
    this.gl.deleteProgram(this.program);
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  label: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (shader === null) throw new Error(`WebGL не создал ${label} shader.`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const log = gl.getShaderInfoLog(shader) ?? "без дополнительной информации";
  gl.deleteShader(shader);
  throw new Error(
    `Ошибка компиляции ${label}:\n${log}\n${withLineNumbers(source)}`,
  );
}

function withLineNumbers(source: string): string {
  return source
    .split("\n")
    .map((line, index) => `${String(index + 1).padStart(3, " ")} | ${line}`)
    .join("\n");
}

export class Texture {
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly handle: WebGLTexture,
  ) {}

  static solid(
    gl: WebGL2RenderingContext,
    rgba: readonly [number, number, number, number],
  ): Texture {
    const handle = gl.createTexture();
    if (handle === null) throw new Error("WebGL не создал текстуру.");
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(rgba),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new Texture(gl, handle);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gl.deleteTexture(this.handle);
  }
}

export class Mesh {
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly vertexArray: WebGLVertexArrayObject,
    private readonly buffers: readonly WebGLBuffer[],
    readonly mode: number,
    readonly count: number,
  ) {}

  draw(): void {
    if (this.disposed) return;
    this.gl.bindVertexArray(this.vertexArray);
    this.gl.drawArrays(this.mode, 0, this.count);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gl.deleteVertexArray(this.vertexArray);
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer);
  }
}

export interface MaterialOptions {
  readonly baseColor: readonly [number, number, number, number];
  readonly baseColorTexture?: WebGLTexture;
  readonly metallic: number;
  readonly roughness: number;
  readonly metallicRoughnessTexture?: WebGLTexture;
  readonly emissive: readonly [number, number, number];
  readonly emissiveTexture?: WebGLTexture;
  readonly alphaMode: "OPAQUE" | "MASK" | "BLEND";
  readonly alphaCutoff: number;
  readonly doubleSided: boolean;
  readonly unlit: boolean;
}

export class Material {
  private disposed = false;

  constructor(readonly options: MaterialOptions) {}

  dispose(): void {
    // Textures are shared assets, so material disposal only releases its references.
    this.disposed = true;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}

export class RenderTarget {
  readonly framebuffer: WebGLFramebuffer;
  readonly texture: Texture;
  readonly depthBuffer: WebGLRenderbuffer;
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly width: number,
    readonly height: number,
  ) {
    const framebuffer = gl.createFramebuffer();
    const textureHandle = gl.createTexture();
    const depthBuffer = gl.createRenderbuffer();
    if (framebuffer === null || textureHandle === null || depthBuffer === null)
      throw new Error("WebGL не создал render target.");
    this.framebuffer = framebuffer;
    this.texture = new Texture(gl, textureHandle);
    this.depthBuffer = depthBuffer;
    gl.bindTexture(gl.TEXTURE_2D, textureHandle);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      textureHandle,
      0,
    );
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      width,
      height,
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depthBuffer,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("Render target неполный.");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.texture.dispose();
    this.gl.deleteRenderbuffer(this.depthBuffer);
    this.gl.deleteFramebuffer(this.framebuffer);
  }
}

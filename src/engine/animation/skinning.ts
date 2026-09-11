import type {
  GltfAnimation,
  GltfAnimationChannel,
  GltfDocument,
  GltfNode,
} from "../assets/gltf";
import {
  createIdentityMatrix,
  createTrsMatrix,
  invertMatrix,
  multiplyMatrices,
  type Matrix4,
} from "../render/matrix";

export interface JointPalette {
  readonly matrices: Float32Array;
  readonly jointCount: number;
}
interface Pose {
  translation: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  scale: readonly [number, number, number];
}
interface ClipState {
  readonly animation: GltfAnimation;
  time: number;
}
const vec3 = (
  value: readonly number[] | undefined,
  fallback: number,
): readonly [number, number, number] => [
  value?.[0] ?? fallback,
  value?.[1] ?? fallback,
  value?.[2] ?? fallback,
];
const quat = (
  value: readonly number[] | undefined,
): readonly [number, number, number, number] => [
  value?.[0] ?? 0,
  value?.[1] ?? 0,
  value?.[2] ?? 0,
  value?.[3] ?? 1,
];
const lerp = (left: number, right: number, alpha: number): number =>
  left + (right - left) * alpha;
function slerp(
  left: readonly [number, number, number, number],
  inputRight: readonly [number, number, number, number],
  alpha: number,
): readonly [number, number, number, number] {
  let right = inputRight;
  let dot =
    left[0] * right[0] +
    left[1] * right[1] +
    left[2] * right[2] +
    left[3] * right[3];
  if (dot < 0) {
    right = [-right[0], -right[1], -right[2], -right[3]];
    dot = -dot;
  }
  if (dot > 0.9995) {
    const value: readonly [number, number, number, number] = [
      lerp(left[0], right[0], alpha),
      lerp(left[1], right[1], alpha),
      lerp(left[2], right[2], alpha),
      lerp(left[3], right[3], alpha),
    ];
    const length = Math.hypot(...value) || 1;
    return [
      value[0] / length,
      value[1] / length,
      value[2] / length,
      value[3] / length,
    ];
  }
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
  const sine = Math.sin(angle);
  const a = Math.sin((1 - alpha) * angle) / sine;
  const b = Math.sin(alpha * angle) / sine;
  return [
    left[0] * a + right[0] * b,
    left[1] * a + right[1] * b,
    left[2] * a + right[2] * b,
    left[3] * a + right[3] * b,
  ];
}
function sample(
  animation: GltfAnimation,
  channel: GltfAnimationChannel,
  time: number,
): readonly number[] {
  const sampler = animation.samplers[channel.sampler];
  if (sampler === undefined) return [];
  let index = 0;
  while (
    index + 1 < sampler.input.length &&
    (sampler.input[index + 1] ?? 0) <= time
  )
    index += 1;
  const next = Math.min(index + 1, sampler.input.length - 1);
  const width = channel.path === "rotation" ? 4 : 3;
  const left = Array.from(
    sampler.output.slice(index * width, index * width + width),
  );
  if (sampler.interpolation === "STEP" || index === next) return left;
  const right = Array.from(
    sampler.output.slice(next * width, next * width + width),
  );
  const start = sampler.input[index] ?? 0;
  const end = sampler.input[next] ?? start;
  const alpha = end === start ? 0 : (time - start) / (end - start);
  return channel.path === "rotation"
    ? slerp(
        left as [number, number, number, number],
        right as [number, number, number, number],
        alpha,
      )
    : left.map((value, part) => lerp(value, right[part] ?? value, alpha));
}
function clipDuration(animation: GltfAnimation): number {
  return Math.max(
    0,
    ...animation.samplers.map(
      (sampler) => sampler.input[sampler.input.length - 1] ?? 0,
    ),
  );
}
function rest(node: GltfNode): Pose {
  return {
    translation: vec3(node.translation, 0),
    rotation: quat(node.rotation),
    scale: vec3(node.scale, 1),
  };
}
function copy(pose: Pose): Pose {
  return {
    translation: [...pose.translation] as [number, number, number],
    rotation: [...pose.rotation] as [number, number, number, number],
    scale: [...pose.scale] as [number, number, number],
  };
}

/** Per-instance evaluator for glTF node poses, clips and joint palettes. */
export class GltfAnimator {
  readonly clips: readonly string[];
  loop = true;
  speed = 1;
  paused = false;
  private readonly base: readonly Pose[];
  private readonly parents: number[];
  private readonly worlds: Matrix4[];
  private active: ClipState | undefined;
  private previous: ClipState | undefined;
  private fadeDuration = 0;
  private fadeElapsed = 0;
  constructor(readonly document: GltfDocument) {
    this.base = document.nodes.map(rest);
    this.parents = [];
    for (const [parent, node] of document.nodes.entries())
      for (const child of node.children) {
        if (this.parents[child] !== undefined)
          throw new Error(`Node ${child} имеет несколько родителей.`);
        this.parents[child] = parent;
      }
    this.worlds = document.nodes.map(() => createIdentityMatrix());
    this.clips = document.animations.map((clip) => clip.name);
    if (document.animations[0] !== undefined)
      this.active = { animation: document.animations[0], time: 0 };
    this.evaluate();
  }
  get clipName(): string | undefined {
    return this.active?.animation.name;
  }
  setClip(name: string, fadeSeconds = 0): void {
    const animation = this.document.animations.find(
      (clip) => clip.name === name,
    );
    if (animation === undefined)
      throw new Error(`Не найден animation clip: ${name}.`);
    if (animation === this.active?.animation) return;
    this.previous = fadeSeconds > 0 ? this.active : undefined;
    this.active = { animation, time: 0 };
    this.fadeDuration = Math.max(0, fadeSeconds);
    this.fadeElapsed = 0;
    this.evaluate();
  }
  update(deltaSeconds: number): void {
    if (!this.paused) {
      const elapsed = Math.max(0, deltaSeconds) * Math.max(0, this.speed);
      if (this.active !== undefined)
        this.active.time = this.advance(this.active, elapsed);
      if (this.previous !== undefined)
        this.previous.time = this.advance(this.previous, elapsed);
      this.fadeElapsed += elapsed;
      if (this.fadeElapsed >= this.fadeDuration) this.previous = undefined;
    }
    this.evaluate();
  }
  worldMatrix(node: number): Matrix4 {
    return this.worlds[node] ?? createIdentityMatrix();
  }
  jointPalette(
    skinIndex: number,
    meshWorld: Matrix4,
    skeletonTransform: Matrix4 = createIdentityMatrix(),
  ): JointPalette | undefined {
    const skin = this.document.skins[skinIndex];
    const inverseMesh = invertMatrix(meshWorld);
    if (skin === undefined || inverseMesh === undefined) return undefined;
    const matrices = new Float32Array(skin.joints.length * 16);
    for (const [joint, node] of skin.joints.entries())
      matrices.set(
        multiplyMatrices(
          multiplyMatrices(
            multiplyMatrices(inverseMesh, skeletonTransform),
            this.worldMatrix(node),
          ),
          skin.inverseBindMatrices.slice(joint * 16, joint * 16 + 16),
        ),
        joint * 16,
      );
    return { matrices, jointCount: skin.joints.length };
  }
  private advance(state: ClipState, elapsed: number): number {
    const duration = clipDuration(state.animation);
    if (duration <= 0) return 0;
    const time = state.time + elapsed;
    return this.loop ? time % duration : Math.min(time, duration);
  }
  private poseFor(state: ClipState | undefined): Pose[] {
    const poses = this.base.map(copy);
    if (state === undefined) return poses;
    for (const channel of state.animation.channels) {
      if (channel.path === "weights") continue;
      const pose = poses[channel.targetNode];
      if (pose === undefined) continue;
      const value = sample(state.animation, channel, state.time);
      if (channel.path === "translation") pose.translation = vec3(value, 0);
      else if (channel.path === "rotation") pose.rotation = quat(value);
      else pose.scale = vec3(value, 1);
    }
    return poses;
  }
  private evaluate(): void {
    const target = this.poseFor(this.active);
    const alpha = Math.min(
      1,
      this.fadeElapsed / Math.max(this.fadeDuration, Number.EPSILON),
    );
    const poses =
      this.previous === undefined
        ? target
        : target.map((pose, index) => {
            const from = this.poseFor(this.previous)[index] ?? pose;
            return {
              translation: [
                lerp(from.translation[0], pose.translation[0], alpha),
                lerp(from.translation[1], pose.translation[1], alpha),
                lerp(from.translation[2], pose.translation[2], alpha),
              ] as [number, number, number],
              rotation: slerp(from.rotation, pose.rotation, alpha),
              scale: [
                lerp(from.scale[0], pose.scale[0], alpha),
                lerp(from.scale[1], pose.scale[1], alpha),
                lerp(from.scale[2], pose.scale[2], alpha),
              ] as [number, number, number],
            };
          });
    for (let index = 0; index < this.document.nodes.length; index += 1) {
      const node = this.document.nodes[index];
      if (node === undefined) continue;
      const pose = poses[index] ?? rest(node);
      const local =
        node.matrix !== undefined && node.matrix.length === 16
          ? new Float32Array(node.matrix)
          : createTrsMatrix(pose.translation, pose.rotation, pose.scale);
      const parent = this.parents[index];
      this.worlds[index] =
        parent === undefined
          ? local
          : multiplyMatrices(
              this.worlds[parent] ?? createIdentityMatrix(),
              local,
            );
    }
  }
}

import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = path.join(projectRoot, "public", "assets", "models");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGO48/rr/5iyif8ZQASIAwBrpQw7Jm7R5gAAAABJRU5ErkJggg==",
  "base64",
);

const pieces = [];
const bufferViews = [];
let byteOffset = 0;

function addBufferView(value, target) {
  const data = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  const padding = (4 - (byteOffset % 4)) % 4;
  if (padding > 0) {
    pieces.push(Buffer.alloc(padding));
    byteOffset += padding;
  }
  const view = {
    buffer: 0,
    byteOffset,
    byteLength: data.length,
    ...(target === undefined ? {} : { target }),
  };
  const index = bufferViews.push(view) - 1;
  pieces.push(data);
  byteOffset += data.length;
  const trailingPadding = (4 - (byteOffset % 4)) % 4;
  if (trailingPadding > 0) {
    pieces.push(Buffer.alloc(trailingPadding));
    byteOffset += trailingPadding;
  }
  return index;
}

const accessors = [];
function addAccessor(bufferView, componentType, count, type, options = {}) {
  return (
    accessors.push({
      bufferView,
      componentType,
      count,
      type,
      ...options,
    }) - 1
  );
}

const arenaPositions = [];
const arenaNormals = [];
const arenaUvs = [];
const arenaIndices = [];
const faces = [
  {
    normal: [0, 1, 0],
    corners: [
      [-4, 0.2, -4],
      [4, 0.2, -4],
      [4, 0.2, 4],
      [-4, 0.2, 4],
    ],
  },
  {
    normal: [0, -1, 0],
    corners: [
      [-4, -0.2, 4],
      [4, -0.2, 4],
      [4, -0.2, -4],
      [-4, -0.2, -4],
    ],
  },
  {
    normal: [1, 0, 0],
    corners: [
      [4, -0.2, -4],
      [4, -0.2, 4],
      [4, 0.2, 4],
      [4, 0.2, -4],
    ],
  },
  {
    normal: [-1, 0, 0],
    corners: [
      [-4, -0.2, 4],
      [-4, -0.2, -4],
      [-4, 0.2, -4],
      [-4, 0.2, 4],
    ],
  },
  {
    normal: [0, 0, 1],
    corners: [
      [4, -0.2, 4],
      [-4, -0.2, 4],
      [-4, 0.2, 4],
      [4, 0.2, 4],
    ],
  },
  {
    normal: [0, 0, -1],
    corners: [
      [-4, -0.2, -4],
      [4, -0.2, -4],
      [4, 0.2, -4],
      [-4, 0.2, -4],
    ],
  },
];
for (const face of faces) {
  const base = arenaPositions.length / 3;
  for (const corner of face.corners) {
    arenaPositions.push(...corner);
    arenaNormals.push(...face.normal);
  }
  arenaUvs.push(0, 0, 4, 0, 4, 4, 0, 4);
  arenaIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const arenaPositionAccessor = addAccessor(
  addBufferView(new Float32Array(arenaPositions), 34962),
  5126,
  arenaPositions.length / 3,
  "VEC3",
  { min: [-4, -0.2, -4], max: [4, 0.2, 4] },
);
const arenaNormalAccessor = addAccessor(
  addBufferView(new Float32Array(arenaNormals), 34962),
  5126,
  arenaNormals.length / 3,
  "VEC3",
);
const arenaUvAccessor = addAccessor(
  addBufferView(new Float32Array(arenaUvs), 34962),
  5126,
  arenaUvs.length / 2,
  "VEC2",
);
const arenaIndexAccessor = addAccessor(
  addBufferView(new Uint16Array(arenaIndices), 34963),
  5123,
  arenaIndices.length,
  "SCALAR",
);

const characterPositions = new Float32Array([
  -0.35, 0, 0, 0.35, 0, 0, -0.35, 1.5, 0, 0.35, 1.5, 0,
]);
const characterNormals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
const characterUvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
const characterJoints = new Uint16Array([
  0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
]);
const characterWeights = new Float32Array([
  1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
]);
const characterIndices = new Uint16Array([0, 1, 2, 2, 1, 3]);

const characterPositionAccessor = addAccessor(
  addBufferView(characterPositions, 34962),
  5126,
  4,
  "VEC3",
  { min: [-0.35, 0, 0], max: [0.35, 1.5, 0] },
);
const characterNormalAccessor = addAccessor(
  addBufferView(characterNormals, 34962),
  5126,
  4,
  "VEC3",
);
const characterUvAccessor = addAccessor(
  addBufferView(characterUvs, 34962),
  5126,
  4,
  "VEC2",
);
const characterJointAccessor = addAccessor(
  addBufferView(characterJoints, 34962),
  5123,
  4,
  "VEC4",
);
const characterWeightAccessor = addAccessor(
  addBufferView(characterWeights, 34962),
  5126,
  4,
  "VEC4",
);
const characterIndexAccessor = addAccessor(
  addBufferView(characterIndices, 34963),
  5123,
  6,
  "SCALAR",
);

const showcasePositions = new Float32Array([
  -0.55, -0.55, 0, 0.55, -0.55, 0, -0.55, 0.55, 0, 0.55, 0.55, 0,
]);
const showcaseNormals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
const showcaseUvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
const showcaseIndices = new Uint16Array([0, 1, 2, 2, 1, 3]);
const showcasePositionAccessor = addAccessor(
  addBufferView(showcasePositions, 34962),
  5126,
  4,
  "VEC3",
  { min: [-0.55, -0.55, 0], max: [0.55, 0.55, 0] },
);
const showcaseNormalAccessor = addAccessor(
  addBufferView(showcaseNormals, 34962),
  5126,
  4,
  "VEC3",
);
const showcaseUvAccessor = addAccessor(
  addBufferView(showcaseUvs, 34962),
  5126,
  4,
  "VEC2",
);
const showcaseIndexAccessor = addAccessor(
  addBufferView(showcaseIndices, 34963),
  5123,
  6,
  "SCALAR",
);
function addGeometry(positions, normals, uvs, indices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  return {
    position: addAccessor(
      addBufferView(new Float32Array(positions), 34962),
      5126,
      positions.length / 3,
      "VEC3",
      { min, max },
    ),
    normal: addAccessor(
      addBufferView(new Float32Array(normals), 34962),
      5126,
      normals.length / 3,
      "VEC3",
    ),
    uv: addAccessor(
      addBufferView(new Float32Array(uvs), 34962),
      5126,
      uvs.length / 2,
      "VEC2",
    ),
    index: addAccessor(
      addBufferView(new Uint16Array(indices), 34963),
      5123,
      indices.length,
      "SCALAR",
    ),
  };
}

function createBox(size = 1) {
  const half = size / 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (const face of [
    {
      normal: [1, 0, 0],
      corners: [
        [half, -half, -half],
        [half, -half, half],
        [half, half, half],
        [half, half, -half],
      ],
    },
    {
      normal: [-1, 0, 0],
      corners: [
        [-half, -half, half],
        [-half, -half, -half],
        [-half, half, -half],
        [-half, half, half],
      ],
    },
    {
      normal: [0, 1, 0],
      corners: [
        [-half, half, -half],
        [half, half, -half],
        [half, half, half],
        [-half, half, half],
      ],
    },
    {
      normal: [0, -1, 0],
      corners: [
        [-half, -half, half],
        [half, -half, half],
        [half, -half, -half],
        [-half, -half, -half],
      ],
    },
    {
      normal: [0, 0, 1],
      corners: [
        [-half, -half, half],
        [-half, half, half],
        [half, half, half],
        [half, -half, half],
      ],
    },
    {
      normal: [0, 0, -1],
      corners: [
        [half, -half, -half],
        [half, half, -half],
        [-half, half, -half],
        [-half, -half, -half],
      ],
    },
  ]) {
    const base = positions.length / 3;
    for (const corner of face.corners) {
      positions.push(...corner);
      normals.push(...face.normal);
    }
    uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return addGeometry(positions, normals, uvs, indices);
}

function createUvSphere(longitudes = 16, latitudes = 10) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let latitude = 0; latitude <= latitudes; latitude += 1) {
    const v = latitude / latitudes;
    const phi = v * Math.PI;
    for (let longitude = 0; longitude <= longitudes; longitude += 1) {
      const u = longitude / longitudes;
      const theta = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      positions.push(x, y, z);
      normals.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let latitude = 0; latitude < latitudes; latitude += 1) {
    for (let longitude = 0; longitude < longitudes; longitude += 1) {
      const start = latitude * (longitudes + 1) + longitude;
      indices.push(
        start,
        start + longitudes + 1,
        start + 1,
        start + 1,
        start + longitudes + 1,
        start + longitudes + 2,
      );
    }
  }
  return addGeometry(positions, normals, uvs, indices);
}

function createCylinder(bottomRadius, topRadius, height = 1, segments = 16) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const slope = (bottomRadius - topRadius) / height;
  const normalLength = Math.hypot(1, slope);
  for (let row = 0; row <= 1; row += 1) {
    const radius = row === 0 ? bottomRadius : topRadius;
    const y = row === 0 ? -height / 2 : height / 2;
    for (let segment = 0; segment <= segments; segment += 1) {
      const u = segment / segments;
      const angle = u * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(radius * x, y, radius * z);
      normals.push(x / normalLength, slope / normalLength, z / normalLength);
      uvs.push(u, row);
    }
  }
  for (let segment = 0; segment < segments; segment += 1) {
    const next = segment + 1;
    indices.push(
      segment,
      segments + 1 + segment,
      next,
      next,
      segments + 1 + segment,
      segments + 1 + next,
    );
  }

  const appendCap = (radius, y, normalY) => {
    const center = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, normalY, 0);
    uvs.push(0.5, 0.5);
    const rimStart = positions.length / 3;
    for (let segment = 0; segment <= segments; segment += 1) {
      const u = segment / segments;
      const angle = u * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(radius * x, y, radius * z);
      normals.push(0, normalY, 0);
      uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
    }
    for (let segment = 0; segment < segments; segment += 1) {
      const current = rimStart + segment;
      const next = current + 1;
      if (normalY > 0) indices.push(center, next, current);
      else indices.push(center, current, next);
    }
  };
  appendCap(bottomRadius, -height / 2, -1);
  appendCap(topRadius, height / 2, 1);
  return addGeometry(positions, normals, uvs, indices);
}

function createTorus(
  majorRadius = 0.7,
  minorRadius = 0.18,
  majorSegments = 18,
  minorSegments = 8,
) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let major = 0; major <= majorSegments; major += 1) {
    const u = major / majorSegments;
    const theta = u * Math.PI * 2;
    for (let minor = 0; minor <= minorSegments; minor += 1) {
      const v = minor / minorSegments;
      const phi = v * Math.PI * 2;
      const radial = majorRadius + minorRadius * Math.cos(phi);
      const x = radial * Math.cos(theta);
      const y = minorRadius * Math.sin(phi);
      const z = radial * Math.sin(theta);
      positions.push(x, y, z);
      normals.push(
        Math.cos(phi) * Math.cos(theta),
        Math.sin(phi),
        Math.cos(phi) * Math.sin(theta),
      );
      uvs.push(u, v);
    }
  }
  for (let major = 0; major < majorSegments; major += 1) {
    for (let minor = 0; minor < minorSegments; minor += 1) {
      const start = major * (minorSegments + 1) + minor;
      indices.push(
        start,
        start + minorSegments + 1,
        start + 1,
        start + 1,
        start + minorSegments + 1,
        start + minorSegments + 2,
      );
    }
  }
  return addGeometry(positions, normals, uvs, indices);
}

const standardBox = createBox();
const standardSphere = createUvSphere();
const standardCylinder = createCylinder(0.5, 0.5);
const standardTorus = createTorus();
const teapotSpout = createCylinder(0.46, 0.05, 1.3);
const inverseBindMatrices = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0,
  1, 0, 0, -1, 0, 1,
]);
const inverseBindAccessor = addAccessor(
  addBufferView(inverseBindMatrices),
  5126,
  2,
  "MAT4",
);

const idleTimes = new Float32Array([0, 1, 2]);
const idleRotations = new Float32Array([
  0, 0, -0.0249974, 0.9996875, 0, 0, 0.0249974, 0.9996875, 0, 0, -0.0249974,
  0.9996875,
]);
const runTimes = new Float32Array([0, 0.5, 1]);
const runTranslations = new Float32Array([0, 0, 0, 0, 0.08, 0, 0, 0, 0]);
const fireTimes = new Float32Array([0, 0.08, 0.25]);
const fireRotations = new Float32Array([
  0, 0, 0, 1, -0.1741081, 0, 0, 0.9847265, 0, 0, 0, 1,
]);
const idleInput = addAccessor(addBufferView(idleTimes), 5126, 3, "SCALAR", {
  min: [0],
  max: [2],
});
const idleOutput = addAccessor(addBufferView(idleRotations), 5126, 3, "VEC4");
const runInput = addAccessor(addBufferView(runTimes), 5126, 3, "SCALAR", {
  min: [0],
  max: [1],
});
const runOutput = addAccessor(addBufferView(runTranslations), 5126, 3, "VEC3");
const fireInput = addAccessor(addBufferView(fireTimes), 5126, 3, "SCALAR", {
  min: [0],
  max: [0.25],
});
const fireOutput = addAccessor(addBufferView(fireRotations), 5126, 3, "VEC4");

const coreBinary = Buffer.concat(pieces);
const imageBufferView = bufferViews.length;
bufferViews.push({
  buffer: 0,
  byteOffset: coreBinary.length,
  byteLength: png.length,
});
const imagePadding = (4 - (png.length % 4)) % 4;
const glbBinary = Buffer.concat([coreBinary, png, Buffer.alloc(imagePadding)]);

const gltf = {
  asset: {
    version: "2.0",
    generator:
      "Furrena standard mesh, teapot, material and lighting showcase generator",
    extras: {
      purpose:
        "Verified arena, skinned idle/run/fire character, standard meshes, a teapot, and material-lighting showcase for engine stage 5",
    },
  },
  extensionsUsed: ["KHR_materials_unlit"],
  scene: 0,
  scenes: [{ name: "Engine stage 3", nodes: [0] }],
  nodes: [
    { name: "SceneRoot", children: [1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    { name: "ArenaBlock", mesh: 0, translation: [0, -0.2, 0] },
    { name: "CharacterRoot", children: [3, 4], translation: [0, 0.01, 0] },
    { name: "CharacterMesh", mesh: 1, skin: 0 },
    { name: "Hips", children: [5] },
    { name: "HeadJoint", translation: [0, 1, 0] },
    { name: "Metallic panel", mesh: 2, translation: [-1.9, 1.55, -3.45] },
    { name: "Emissive panel", mesh: 3, translation: [-0.63, 1.55, -3.45] },
    { name: "Glass panel", mesh: 4, translation: [0.63, 1.55, -3.45] },
    { name: "Unlit panel", mesh: 5, translation: [1.9, 1.55, -3.45] },
    { name: "Standard cube", mesh: 6, translation: [-3.0, 0.55, 1.7] },
    {
      name: "Standard sphere",
      mesh: 7,
      translation: [-1.65, 0.62, 1.7],
      scale: [0.62, 0.62, 0.62],
    },
    { name: "Standard cylinder", mesh: 8, translation: [-0.25, 0.55, 1.7] },
    {
      name: "Standard torus",
      mesh: 9,
      translation: [1.25, 0.68, 1.7],
      scale: [0.7, 0.7, 0.7],
    },
    {
      name: "Low-poly teapot",
      children: [15, 16, 17, 18, 19],
      translation: [2.35, 0.78, 0.1],
    },
    { name: "Teapot body", mesh: 7, scale: [0.76, 0.56, 0.76] },
    {
      name: "Teapot lid",
      mesh: 8,
      translation: [0, 0.56, 0],
      scale: [0.44, 0.1, 0.44],
    },
    {
      name: "Teapot spout",
      mesh: 10,
      translation: [-0.72, 0.1, 0],
      rotation: [0, 0, 0.5, 0.866],
    },
    {
      name: "Teapot handle",
      mesh: 9,
      translation: [0.78, 0.08, 0],
      rotation: [0, 0, 0.707, 0.707],
      scale: [0.58, 0.78, 0.58],
    },
    {
      name: "Teapot lid knob",
      mesh: 7,
      translation: [0, 0.73, 0],
      scale: [0.12, 0.12, 0.12],
    },
  ],
  buffers: [{ byteLength: glbBinary.length }],
  bufferViews,
  accessors,
  samplers: [
    {
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 10497,
      wrapT: 10497,
    },
  ],
  images: [
    {
      name: "Arena checker",
      bufferView: imageBufferView,
      mimeType: "image/png",
    },
  ],
  textures: [{ name: "Arena checker", sampler: 0, source: 0 }],
  materials: [
    {
      name: "Arena",
      pbrMetallicRoughness: {
        baseColorFactor: [0.35, 0.42, 0.48, 1],
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    },
    {
      name: "Character",
      pbrMetallicRoughness: {
        baseColorFactor: [0.95, 0.32, 0.12, 1],
        metallicFactor: 0,
        roughnessFactor: 0.65,
      },
      doubleSided: true,
    },
    {
      name: "Metallic showcase",
      pbrMetallicRoughness: {
        baseColorFactor: [0.08, 0.28, 0.95, 1],
        metallicFactor: 0.92,
        roughnessFactor: 0.14,
      },
    },
    {
      name: "Emissive showcase",
      pbrMetallicRoughness: {
        baseColorFactor: [0.08, 0.03, 0.01, 1],
        metallicFactor: 0,
        roughnessFactor: 0.48,
      },
      emissiveFactor: [3.8, 0.26, 0.02],
    },
    {
      name: "Transparent double-sided showcase",
      pbrMetallicRoughness: {
        baseColorFactor: [0.05, 0.9, 0.82, 0.36],
        metallicFactor: 0.12,
        roughnessFactor: 0.2,
      },
      alphaMode: "BLEND",
      doubleSided: true,
    },
    {
      name: "Unlit showcase",
      pbrMetallicRoughness: {
        baseColorFactor: [1, 0.78, 0.08, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      extensions: { KHR_materials_unlit: {} },
      doubleSided: true,
    },
    {
      name: "Polished brass standard meshes",
      pbrMetallicRoughness: {
        baseColorFactor: [0.82, 0.36, 0.055, 1],
        metallicFactor: 0.88,
        roughnessFactor: 0.16,
      },
    },
  ],
  meshes: [
    {
      name: "Arena block",
      primitives: [
        {
          attributes: {
            POSITION: arenaPositionAccessor,
            NORMAL: arenaNormalAccessor,
            TEXCOORD_0: arenaUvAccessor,
          },
          indices: arenaIndexAccessor,
          material: 0,
        },
      ],
    },
    {
      name: "Skinned character",
      primitives: [
        {
          attributes: {
            POSITION: characterPositionAccessor,
            NORMAL: characterNormalAccessor,
            TEXCOORD_0: characterUvAccessor,
            JOINTS_0: characterJointAccessor,
            WEIGHTS_0: characterWeightAccessor,
          },
          indices: characterIndexAccessor,
          material: 1,
        },
      ],
    },
    {
      name: "Metallic showcase panel",
      primitives: [
        {
          attributes: {
            POSITION: showcasePositionAccessor,
            NORMAL: showcaseNormalAccessor,
            TEXCOORD_0: showcaseUvAccessor,
          },
          indices: showcaseIndexAccessor,
          material: 2,
        },
      ],
    },
    {
      name: "Emissive showcase panel",
      primitives: [
        {
          attributes: {
            POSITION: showcasePositionAccessor,
            NORMAL: showcaseNormalAccessor,
            TEXCOORD_0: showcaseUvAccessor,
          },
          indices: showcaseIndexAccessor,
          material: 3,
        },
      ],
    },
    {
      name: "Transparent showcase panel",
      primitives: [
        {
          attributes: {
            POSITION: showcasePositionAccessor,
            NORMAL: showcaseNormalAccessor,
            TEXCOORD_0: showcaseUvAccessor,
          },
          indices: showcaseIndexAccessor,
          material: 4,
        },
      ],
    },
    {
      name: "Unlit showcase panel",
      primitives: [
        {
          attributes: {
            POSITION: showcasePositionAccessor,
            NORMAL: showcaseNormalAccessor,
            TEXCOORD_0: showcaseUvAccessor,
          },
          indices: showcaseIndexAccessor,
          material: 5,
        },
      ],
    },
    {
      name: "Standard cube",
      primitives: [
        {
          attributes: {
            POSITION: standardBox.position,
            NORMAL: standardBox.normal,
            TEXCOORD_0: standardBox.uv,
          },
          indices: standardBox.index,
          material: 6,
        },
      ],
    },
    {
      name: "Standard sphere",
      primitives: [
        {
          attributes: {
            POSITION: standardSphere.position,
            NORMAL: standardSphere.normal,
            TEXCOORD_0: standardSphere.uv,
          },
          indices: standardSphere.index,
          material: 6,
        },
      ],
    },
    {
      name: "Standard cylinder",
      primitives: [
        {
          attributes: {
            POSITION: standardCylinder.position,
            NORMAL: standardCylinder.normal,
            TEXCOORD_0: standardCylinder.uv,
          },
          indices: standardCylinder.index,
          material: 6,
        },
      ],
    },
    {
      name: "Standard torus",
      primitives: [
        {
          attributes: {
            POSITION: standardTorus.position,
            NORMAL: standardTorus.normal,
            TEXCOORD_0: standardTorus.uv,
          },
          indices: standardTorus.index,
          material: 6,
        },
      ],
    },
    {
      name: "Teapot spout cone",
      primitives: [
        {
          attributes: {
            POSITION: teapotSpout.position,
            NORMAL: teapotSpout.normal,
            TEXCOORD_0: teapotSpout.uv,
          },
          indices: teapotSpout.index,
          material: 6,
        },
      ],
    },
  ],
  skins: [
    {
      name: "Character skeleton",
      inverseBindMatrices: inverseBindAccessor,
      skeleton: 4,
      joints: [4, 5],
    },
  ],
  animations: [
    {
      name: "idle",
      samplers: [
        { input: idleInput, output: idleOutput, interpolation: "LINEAR" },
      ],
      channels: [{ sampler: 0, target: { node: 5, path: "rotation" } }],
    },
    {
      name: "run",
      samplers: [
        { input: runInput, output: runOutput, interpolation: "LINEAR" },
      ],
      channels: [{ sampler: 0, target: { node: 4, path: "translation" } }],
    },
    {
      name: "fire",
      samplers: [
        { input: fireInput, output: fireOutput, interpolation: "LINEAR" },
      ],
      channels: [{ sampler: 0, target: { node: 5, path: "rotation" } }],
    },
  ],
};

function makeGlb(json, binary) {
  const jsonSource = Buffer.from(JSON.stringify(json));
  const jsonPadding = (4 - (jsonSource.length % 4)) % 4;
  const jsonChunk = Buffer.concat([
    jsonSource,
    Buffer.alloc(jsonPadding, 0x20),
  ]);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binary.length;
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonChunk.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(output, 20);
  const binaryHeader = 20 + jsonChunk.length;
  output.writeUInt32LE(binary.length, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binary.copy(output, binaryHeader + 8);
  return output;
}

const externalGltf = JSON.parse(JSON.stringify(gltf));
externalGltf.buffers = [
  { byteLength: coreBinary.length, uri: "engine-stage.bin" },
];
externalGltf.bufferViews = externalGltf.bufferViews.slice(0, imageBufferView);
externalGltf.images = [
  { name: "Arena checker", uri: "checker.png", mimeType: "image/png" },
];

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDirectory, "engine-stage.glb"),
    makeGlb(gltf, glbBinary),
  ),
  writeFile(
    path.join(outputDirectory, "engine-stage.gltf"),
    `${JSON.stringify(externalGltf, null, 2)}\n`,
  ),
  writeFile(path.join(outputDirectory, "engine-stage.bin"), coreBinary),
  writeFile(path.join(outputDirectory, "checker.png"), png),
]);

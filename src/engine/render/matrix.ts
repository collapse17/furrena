export type Matrix4 = Float32Array;
export type Matrix3 = Float32Array;

export function createIdentityMatrix(): Matrix4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function multiplyMatrices(left: Matrix4, right: Matrix4): Matrix4 {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    const offset = column * 4;
    for (let row = 0; row < 4; row += 1) {
      result[offset + row] =
        (left[row] ?? 0) * (right[offset] ?? 0) +
        (left[4 + row] ?? 0) * (right[offset + 1] ?? 0) +
        (left[8 + row] ?? 0) * (right[offset + 2] ?? 0) +
        (left[12 + row] ?? 0) * (right[offset + 3] ?? 0);
    }
  }
  return result;
}

export function createPerspectiveMatrix(
  fieldOfViewRadians: number,
  aspectRatio: number,
  near: number,
  far: number,
): Matrix4 {
  const focalLength = 1 / Math.tan(fieldOfViewRadians / 2);
  const depth = 1 / (near - far);
  return new Float32Array([
    focalLength / aspectRatio,
    0,
    0,
    0,
    0,
    focalLength,
    0,
    0,
    0,
    0,
    (far + near) * depth,
    -1,
    0,
    0,
    2 * far * near * depth,
    0,
  ]);
}

export function createLookAtMatrix(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
  up: readonly [number, number, number] = [0, 1, 0],
): Matrix4 {
  let z0 = eye[0] - target[0];
  let z1 = eye[1] - target[1];
  let z2 = eye[2] - target[2];
  const length = Math.hypot(z0, z1, z2) || 1;
  z0 /= length;
  z1 /= length;
  z2 /= length;
  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  const xLength = Math.hypot(x0, x1, x2) || 1;
  x0 /= xLength;
  x1 /= xLength;
  x2 /= xLength;
  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;
  return new Float32Array([
    x0,
    y0,
    z0,
    0,
    x1,
    y1,
    z1,
    0,
    x2,
    y2,
    z2,
    0,
    -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]),
    -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
    -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
    1,
  ]);
}

export function createTrsMatrix(
  translation: readonly number[] = [0, 0, 0],
  rotation: readonly number[] = [0, 0, 0, 1],
  scale: readonly number[] = [1, 1, 1],
): Matrix4 {
  const x = rotation[0] ?? 0;
  const y = rotation[1] ?? 0;
  const z = rotation[2] ?? 0;
  const w = rotation[3] ?? 1;
  const sx = scale[0] ?? 1;
  const sy = scale[1] ?? 1;
  const sz = scale[2] ?? 1;
  return new Float32Array([
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    translation[0] ?? 0,
    translation[1] ?? 0,
    translation[2] ?? 0,
    1,
  ]);
}

export function createNormalMatrix(model: Matrix4): Matrix3 {
  const a00 = model[0] ?? 0;
  const a01 = model[1] ?? 0;
  const a02 = model[2] ?? 0;
  const a10 = model[4] ?? 0;
  const a11 = model[5] ?? 0;
  const a12 = model[6] ?? 0;
  const a20 = model[8] ?? 0;
  const a21 = model[9] ?? 0;
  const a22 = model[10] ?? 0;
  const determinant =
    a00 * (a11 * a22 - a12 * a21) -
    a10 * (a01 * a22 - a02 * a21) +
    a20 * (a01 * a12 - a02 * a11);
  if (Math.abs(determinant) < 0.000001)
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const inverse = 1 / determinant;
  return new Float32Array([
    (a11 * a22 - a12 * a21) * inverse,
    (a12 * a20 - a10 * a22) * inverse,
    (a10 * a21 - a11 * a20) * inverse,
    (a02 * a21 - a01 * a22) * inverse,
    (a00 * a22 - a02 * a20) * inverse,
    (a01 * a20 - a00 * a21) * inverse,
    (a01 * a12 - a02 * a11) * inverse,
    (a02 * a10 - a00 * a12) * inverse,
    (a00 * a11 - a01 * a10) * inverse,
  ]);
}

export function transformPoint(
  matrix: Matrix4,
  point: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    (matrix[0] ?? 0) * point[0] +
      (matrix[4] ?? 0) * point[1] +
      (matrix[8] ?? 0) * point[2] +
      (matrix[12] ?? 0),
    (matrix[1] ?? 0) * point[0] +
      (matrix[5] ?? 0) * point[1] +
      (matrix[9] ?? 0) * point[2] +
      (matrix[13] ?? 0),
    (matrix[2] ?? 0) * point[0] +
      (matrix[6] ?? 0) * point[1] +
      (matrix[10] ?? 0) * point[2] +
      (matrix[14] ?? 0),
  ];
}

/** Returns the inverse matrix, or undefined for a singular transform. */
export function invertMatrix(matrix: Matrix4): Matrix4 | undefined {
  const at = (index: number): number => matrix[index] ?? 0;
  const b00 = at(0) * at(5) - at(1) * at(4);
  const b01 = at(0) * at(6) - at(2) * at(4);
  const b02 = at(0) * at(7) - at(3) * at(4);
  const b03 = at(1) * at(6) - at(2) * at(5);
  const b04 = at(1) * at(7) - at(3) * at(5);
  const b05 = at(2) * at(7) - at(3) * at(6);
  const b06 = at(8) * at(13) - at(9) * at(12);
  const b07 = at(8) * at(14) - at(10) * at(12);
  const b08 = at(8) * at(15) - at(11) * at(12);
  const b09 = at(9) * at(14) - at(10) * at(13);
  const b10 = at(9) * at(15) - at(11) * at(13);
  const b11 = at(10) * at(15) - at(11) * at(14);
  const determinant =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(determinant) < 0.0000001) return undefined;
  const inverse = 1 / determinant;
  return new Float32Array([
    (at(5) * b11 - at(6) * b10 + at(7) * b09) * inverse,
    (at(2) * b10 - at(1) * b11 - at(3) * b09) * inverse,
    (at(13) * b05 - at(14) * b04 + at(15) * b03) * inverse,
    (at(10) * b04 - at(9) * b05 - at(11) * b03) * inverse,
    (at(6) * b08 - at(4) * b11 - at(7) * b07) * inverse,
    (at(0) * b11 - at(2) * b08 + at(3) * b07) * inverse,
    (at(14) * b02 - at(12) * b05 - at(15) * b01) * inverse,
    (at(8) * b05 - at(10) * b02 + at(11) * b01) * inverse,
    (at(4) * b10 - at(5) * b08 + at(7) * b06) * inverse,
    (at(1) * b08 - at(0) * b10 - at(3) * b06) * inverse,
    (at(12) * b04 - at(13) * b02 + at(15) * b00) * inverse,
    (at(9) * b02 - at(8) * b04 - at(11) * b00) * inverse,
    (at(5) * b07 - at(4) * b09 - at(6) * b06) * inverse,
    (at(0) * b09 - at(1) * b07 + at(2) * b06) * inverse,
    (at(13) * b01 - at(12) * b03 - at(14) * b00) * inverse,
    (at(8) * b03 - at(9) * b01 + at(10) * b00) * inverse,
  ]);
}

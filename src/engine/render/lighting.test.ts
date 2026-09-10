import { describe, expect, it } from "vitest";
import {
  MAX_POINT_LIGHTS,
  selectClosestPointLights,
  type PointLight,
} from "./lighting";

const light = (x: number, range = 20): PointLight => ({
  position: [x, 0, 0],
  color: [1, 1, 1],
  intensity: 1,
  range,
});

describe("selectClosestPointLights", () => {
  it("keeps only reachable lights, nearest first, within the GPU limit", () => {
    const selected = selectClosestPointLights(
      [light(8), light(1), light(-2), light(3), light(4), light(100)],
      [0, 0, 0],
    );

    expect(selected).toHaveLength(MAX_POINT_LIGHTS);
    expect(selected.map((item) => item.position[0])).toEqual([1, -2, 3, 4]);
  });

  it("accepts a smaller explicit limit and ignores non-positive ranges", () => {
    expect(
      selectClosestPointLights([light(1), light(2), light(0, 0)], [0, 0, 0], 1),
    ).toEqual([light(1)]);
  });
});

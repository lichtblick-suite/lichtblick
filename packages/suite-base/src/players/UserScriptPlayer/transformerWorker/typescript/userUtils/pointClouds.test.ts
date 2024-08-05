import {
  sensor_msgs__PointCloud2,
  readPoints,
  norm,
  setRayDistance,
  convertToRangeView,
} from "./pointClouds"; // Adjust the import path as needed
import { Point } from "./types"; // Adjust the import path as needed

jest.mock("./readers", () => ({
  getReader: jest.fn().mockImplementation(() => ({
    read: jest.fn((data: Uint8Array, dataStart: number) => data[dataStart]),
  })),
}));

describe("readPoints", () => {
  it("should read points correctly from a PointCloud2 message", () => {
    const message: sensor_msgs__PointCloud2 = {
      header: { frame_id: "", stamp: { sec: 0, nsec: 0 }, seq: 0 },
      height: 2,
      width: 2,
      fields: [{ name: "x", offset: 0, datatype: 7, count: 1 }],
      is_bigendian: false,
      point_step: 4,
      row_step: 1,
      data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      is_dense: true,
    };

    const points = readPoints(message);

    expect(points).toEqual([[1], [5], [2], [6]]);
  });
});

describe("norm", () => {
  it("should return the correct norm of a point", () => {
    const point: Point = { x: 3, y: 4, z: 12 };
    const result = norm(point);
    expect(result).toBe(13);
  });
});

describe("setRayDistance", () => {
  it("should set the correct distance for a point", () => {
    const point: Point = { x: 3, y: 4, z: 0 };
    const distance = 10;
    const result = setRayDistance(point, distance);
    expect(result).toEqual({ x: 6, y: 8, z: 0 });
  });
});

describe("convertToRangeView", () => {
  it("should convert points to range view and create colors if specified", () => {
    const points: Point[] = [
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 },
      { x: 3, y: 3, z: 3 },
    ];
    const range = 5;
    const makeColors = true;
    const colors = convertToRangeView(points, range, makeColors);
    expect(colors).toHaveLength(points.length);
    expect(points[0]).toEqual(setRayDistance({ x: 1, y: 1, z: 1 }, range));
  });

  it("should convert points to range view without creating colors", () => {
    const points: Point[] = [
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 },
      { x: 3, y: 3, z: 3 },
    ];
    const range = 5;
    const makeColors = false;
    const colors = convertToRangeView(points, range, makeColors);
    expect(colors).toHaveLength(0);
    expect(points[0]).toEqual(setRayDistance({ x: 1, y: 1, z: 1 }, range));
  });
});

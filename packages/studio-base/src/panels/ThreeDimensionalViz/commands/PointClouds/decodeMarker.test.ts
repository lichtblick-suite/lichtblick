// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { PointCloudMarker } from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/types";

import { FLOAT_SIZE } from "./buffers";
import { decodeMarker } from "./decodeMarker";
import { POINT_CLOUD_MESSAGE, POINT_CLOUD_WITH_ADDITIONAL_FIELDS } from "./fixture/pointCloudData";

describe("<PointClouds />", () => {
  describe("positions", () => {
    it("builds position buffer by reinterpreting data from PointCloud2", () => {
      const result = decodeMarker(POINT_CLOUD_MESSAGE);
      const { positionBuffer } = result;
      const { buffer, offset, stride } = positionBuffer;
      expect(buffer.length).toBe(6 * FLOAT_SIZE);
      expect(offset).toBe(0);
      expect(stride).toBe(32 / FLOAT_SIZE);
      expect(Math.floor(buffer[0]!)).toBe(-2239);
      expect(Math.floor(buffer[1]!)).toBe(-706);
      expect(Math.floor(buffer[2]!)).toBe(-3);
      expect(Math.floor(buffer[8]!)).toBe(-2239);
      expect(Math.floor(buffer[9]!)).toBe(-706);
      expect(Math.floor(buffer[10]!)).toBe(-3);
    });

    it("builds a point cloud with height 3", () => {
      const result = decodeMarker({
        ...POINT_CLOUD_MESSAGE,
        height: 3,
        width: 1,
        row_step: 32,
      });
      const { positionBuffer } = result;
      const { buffer, offset, stride } = positionBuffer;
      expect(buffer.length).toBe(6 * FLOAT_SIZE);
      expect(offset).toBe(0);
      expect(stride).toBe(32 / FLOAT_SIZE);
      expect(Math.floor(buffer[0]!)).toBe(-2239);
      expect(Math.floor(buffer[1]!)).toBe(-706);
      expect(Math.floor(buffer[2]!)).toBe(-3);
      expect(Math.floor(buffer[8]!)).toBe(-2239);
      expect(Math.floor(buffer[9]!)).toBe(-706);
      expect(Math.floor(buffer[10]!)).toBe(-3);
    });

    it("extracts both positions from data since stride is not multiple of sizeof(float)", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
        settings: {
          colorMode: {
            mode: "gradient",
            minColor: { r: 1, g: 0, b: 0, a: 1 },
            maxColor: { r: 0, g: 0, b: 1, a: 1 },
            colorField: "foo",
          },
        },
      };
      const result = decodeMarker(input);
      const { positionBuffer } = result;
      // Positions are extracted because stride is not divisible by sizeof(float)
      expect(positionBuffer.buffer.length).toBe(6);
      expect(positionBuffer.offset).toBe(0);
      expect(positionBuffer.stride).toBe(3);
    });
  });

  describe("flat colors", () => {
    it("builds empty color buffer from PointCloud2 when colorMode=='flat'", () => {
      const result = decodeMarker({
        ...POINT_CLOUD_MESSAGE,
        settings: { colorMode: { mode: "flat", flatColor: { r: 1, g: 0, b: 0, a: 1 } } },
      });
      const { colorBuffer } = result;
      expect(colorBuffer).toBeUndefined();
    });
  });

  describe("rgb/rgba colors", () => {
    it.each(["rgba", "bgra", "abgr"] as const)(
      "builds color buffer by extracting RGB data as %s from PointCloud2",
      (rgbByteOrder) => {
        const result = decodeMarker({
          ...POINT_CLOUD_MESSAGE,
          settings: { colorMode: { mode: "rgb", rgbByteOrder } },
        });
        const { colorBuffer, data } = result;
        expect(colorBuffer).not.toBeNullOrUndefined();
        expect(data.length).toBe(96);
        const { buffer, offset, stride } = colorBuffer ?? {};
        if (!buffer) {
          throw new Error("Buffer is undefined");
        }
        expect(buffer.length).toBe(2 * 4);
        expect(offset).toBe(0);
        expect(stride).toBe(4);
        const alpha = 255;
        switch (rgbByteOrder) {
          case "rgba":
            // eslint-disable-next-line jest/no-conditional-expect
            expect(Array.from(buffer)).toEqual([10, 255, 230, alpha, 10, 255, 255, alpha]);
            break;
          case "abgr":
            // eslint-disable-next-line jest/no-conditional-expect
            expect(Array.from(buffer)).toEqual([127, 230, 255, alpha, 127, 255, 255, alpha]);
            break;
          case "bgra":
            // eslint-disable-next-line jest/no-conditional-expect
            expect(Array.from(buffer)).toEqual([230, 255, 10, alpha, 255, 255, 10, alpha]);
            break;
        }
      },
    );

    const messageWithRGBA = {
      ...POINT_CLOUD_MESSAGE,
      fields: POINT_CLOUD_MESSAGE.fields.map((field) =>
        field.name === "rgb" ? { ...field, name: "rgba" } : field,
      ),
    };
    it.each(["rgba", "bgra", "abgr"] as const)(
      "builds color buffer by extracting RGBA data as %s from PointCloud2",
      (rgbByteOrder) => {
        const result = decodeMarker({
          ...messageWithRGBA,
          settings: { colorMode: { mode: "rgba", rgbByteOrder } },
        });
        const { colorBuffer, data } = result;
        expect(colorBuffer).not.toBeNullOrUndefined();
        expect(data.length).toBe(96);
        const { buffer, offset, stride } = colorBuffer ?? {};
        if (!buffer) {
          throw new Error("Buffer is undefined");
        }
        expect(buffer.length).toBe(2 * 4);
        expect(offset).toBe(0);
        expect(stride).toBe(4);
        switch (rgbByteOrder) {
          case "rgba":
            // eslint-disable-next-line jest/no-conditional-expect
            expect(Array.from(buffer)).toEqual([10, 255, 230, 127, 10, 255, 255, 127]);
            break;
          case "abgr":
            // eslint-disable-next-line jest/no-conditional-expect
            expect(Array.from(buffer)).toEqual([127, 230, 255, 10, 127, 255, 255, 10]);
            break;
          case "bgra":
            // eslint-disable-next-line jest/no-conditional-expect
            expect(Array.from(buffer)).toEqual([230, 255, 10, 127, 255, 255, 10, 127]);
            break;
        }
      },
    );
  });

  describe("rainbow colors", () => {
    it("builds point cloud with rainbow colors. Reinterpret positions and colors", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_MESSAGE,
        settings: { colorMode: { mode: "rainbow", colorField: "y" } },
      };
      const result = decodeMarker(input);
      const { positionBuffer, colorBuffer } = result;
      expect(positionBuffer.buffer.length).toBe(6 * FLOAT_SIZE);
      expect(positionBuffer.offset).toBe(0);
      expect(positionBuffer.stride).toBe(32 / FLOAT_SIZE);
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer.length).toBe(6 * FLOAT_SIZE);
      expect(colorBuffer?.offset).toBe(1);
      expect(colorBuffer?.stride).toBe(32 / FLOAT_SIZE);
      expect(colorBuffer?.buffer[1]).toBe(positionBuffer.buffer[1]);
      expect(colorBuffer?.buffer[9]).toBe(positionBuffer.buffer[9]);
      expect(colorBuffer?.buffer[17]).toBe(positionBuffer.buffer[17]);
    });

    it("builds point cloud with rainbow colors. Extract both positions and colors", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
        settings: { colorMode: { mode: "rainbow", colorField: "foo" } },
      };
      const result = decodeMarker(input);
      const { positionBuffer, colorBuffer } = result;
      // Positions are extracted because stride is not divisible by sizeof(float)
      expect(positionBuffer.buffer.length).toBe(6);
      expect(positionBuffer.offset).toBe(0);
      expect(positionBuffer.stride).toBe(3);
      // Colors are extracted because color field type is not float
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer.length).toBe(2);
      expect(colorBuffer?.offset).toBe(0);
      expect(colorBuffer?.stride).toBe(1);
      expect(colorBuffer?.buffer[0]).toBe(7);
      expect(colorBuffer?.buffer[1]).toBe(9);
    });
  });

  describe("gradient colors", () => {
    it("builds point cloud with rainbow colors. Reinterpret positions and colors", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_MESSAGE,
        settings: {
          colorMode: {
            mode: "gradient",
            minColor: { r: 1, g: 0, b: 0, a: 1 },
            maxColor: { r: 0, g: 0, b: 1, a: 1 },
            colorField: "y",
          },
        },
      };
      const result = decodeMarker(input);
      const { positionBuffer, colorBuffer } = result;
      expect(positionBuffer.buffer.length).toBe(6 * FLOAT_SIZE);
      expect(positionBuffer.offset).toBe(0);
      expect(positionBuffer.stride).toBe(32 / FLOAT_SIZE);
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer.length).toBe(6 * FLOAT_SIZE);
      expect(colorBuffer?.offset).toBe(1);
      expect(colorBuffer?.stride).toBe(32 / FLOAT_SIZE);
      expect(colorBuffer?.buffer[1]).toBe(positionBuffer.buffer[1]);
      expect(colorBuffer?.buffer[9]).toBe(positionBuffer.buffer[9]);
      expect(colorBuffer?.buffer[17]).toBe(positionBuffer.buffer[17]);
    });

    it("builds point cloud with gradient colors. Extract both positions and colors", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
        settings: {
          colorMode: {
            mode: "gradient",
            minColor: { r: 1, g: 0, b: 0, a: 1 },
            maxColor: { r: 0, g: 0, b: 1, a: 1 },
            colorField: "foo",
          },
        },
      };
      const result = decodeMarker(input);
      const { positionBuffer, colorBuffer } = result;
      // Positions are extracted because stride is not divisible by sizeof(float)
      expect(positionBuffer.buffer.length).toBe(6);
      expect(positionBuffer.offset).toBe(0);
      expect(positionBuffer.stride).toBe(3);
      // Colors are extracted because color field type is not float
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer).toEqual(new Float32Array([7, 9]));
      expect(colorBuffer?.offset).toBe(0);
      expect(colorBuffer?.stride).toBe(1);
    });
  });

  describe("color field of different types", () => {
    // Colors are always extracted because of stride size
    const extractMarkerColors = (colorField: any) => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
        settings: { colorMode: { mode: "rainbow", colorField } },
      };
      const result = decodeMarker(input);
      const { colorBuffer } = result;
      return colorBuffer;
    };
    it("float", () => {
      const colorBuffer = extractMarkerColors("x");
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer).toEqual(new Float32Array([0, 0]));
      expect(colorBuffer?.offset).toBe(0);
      expect(colorBuffer?.stride).toBe(1);
    });
    it("uint8", () => {
      const colorBuffer = extractMarkerColors("foo");
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer).toEqual(new Float32Array([7, 9]));
      expect(colorBuffer?.offset).toBe(0);
      expect(colorBuffer?.stride).toBe(1);
    });
    it("uint16", () => {
      const colorBuffer = extractMarkerColors("bar");
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer).toEqual(new Float32Array([6, 8]));
      expect(colorBuffer?.offset).toBe(0);
      expect(colorBuffer?.stride).toBe(1);
    });
    it("int16", () => {
      const colorBuffer = extractMarkerColors("foo16_some_really_really_long_name");
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer).toEqual(new Float32Array([265, 2]));
      expect(colorBuffer?.offset).toBe(0);
      expect(colorBuffer?.stride).toBe(1);
    });
    it("int32", () => {
      const colorBuffer = extractMarkerColors("baz");
      expect(colorBuffer).not.toBeNullOrUndefined();
      expect(colorBuffer?.buffer).toEqual(new Float32Array([5, 7]));
      expect(colorBuffer?.offset).toBe(0);
      expect(colorBuffer?.stride).toBe(1);
    });
  });

  describe("min/max", () => {
    it("auto calculates min/max color values", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_MESSAGE,
        settings: { colorMode: { mode: "rainbow", colorField: "y" } },
      };
      const result = decodeMarker(input);
      const { minColorValue, maxColorValue } = result;
      expect(Math.floor(minColorValue)).toBe(-2239);
      expect(Math.floor(maxColorValue)).toBe(-706);
    });

    it("auto calculates max color values. Min color value provided", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_MESSAGE,
        settings: { colorMode: { mode: "rainbow", colorField: "y", minValue: -3000 } },
      };
      const result = decodeMarker(input);
      const { minColorValue, maxColorValue } = result;
      expect(Math.floor(minColorValue)).toBe(-3000);
      expect(Math.floor(maxColorValue)).toBe(-706);
    });

    it("auto calculates min color values. Max color value provided", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_MESSAGE,
        settings: { colorMode: { mode: "rainbow", colorField: "y", maxValue: 200 } },
      };
      const result = decodeMarker(input);
      const { minColorValue, maxColorValue } = result;
      expect(Math.floor(minColorValue)).toBe(-2239);
      expect(Math.floor(maxColorValue)).toBe(200);
    });

    it("does not calculate min/max color values since they are provided", () => {
      const input: PointCloudMarker = {
        ...POINT_CLOUD_MESSAGE,
        settings: {
          colorMode: { mode: "rainbow", colorField: "y", minValue: -3000, maxValue: 200 },
        },
      };
      const result = decodeMarker(input);
      const { minColorValue, maxColorValue } = result;
      expect(Math.floor(minColorValue)).toBe(-3000);
      expect(Math.floor(maxColorValue)).toBe(200);
    });
  });
});

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { PointCloudSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PointCloudSettingsEditor";

import { decodeMarker } from "./decodeMarker";
import { POINT_CLOUD_MESSAGE, POINT_CLOUD_WITH_ADDITIONAL_FIELDS } from "./fixture/pointCloudData";
import { getClickedInfo, getAllPoints, decodeAdditionalFields } from "./selection";

describe("<PointClouds />", () => {
  describe("getClickedInfo", () => {
    it("returns undefined when points field is empty", () => {
      const partiallyDecodedMarker = decodeMarker(POINT_CLOUD_WITH_ADDITIONAL_FIELDS);
      const fullyDecodedMarker = decodeAdditionalFields(partiallyDecodedMarker);
      expect(getClickedInfo(fullyDecodedMarker, 1000)).toEqual(undefined);
    });

    it("returns undefined when instanceIndex does not match any point", () => {
      const partiallyDecodedMarker = decodeMarker(POINT_CLOUD_WITH_ADDITIONAL_FIELDS);
      const fullyDecodedMarker = decodeAdditionalFields(partiallyDecodedMarker);
      expect(getClickedInfo(fullyDecodedMarker, undefined)).toEqual(undefined);
      expect(getClickedInfo(fullyDecodedMarker, 1000)).toEqual(undefined);
    });

    it("returns selected point positions and colors", () => {
      const marker = decodeMarker(POINT_CLOUD_MESSAGE);
      const clickInfo = getClickedInfo(marker, 1);
      expect(clickInfo).not.toBeNullOrUndefined();
      expect((clickInfo?.clickedPoint ?? []).map((v) => Math.floor(v))).toStrictEqual([
        -2239, -706, -3,
      ]);
      expect((clickInfo?.clickedPointColor ?? []).map((v) => Math.floor(v))).toStrictEqual([
        127, 255, 255, 1,
      ]);
      expect(clickInfo?.additionalFieldValues).toBeUndefined();
    });

    it("returns selected point positions and colors when instanceIndex is zero", () => {
      const marker = decodeMarker(POINT_CLOUD_MESSAGE);
      const clickInfo = getClickedInfo(marker, 0);
      expect(clickInfo).not.toBeNullOrUndefined();
      expect((clickInfo?.clickedPoint ?? []).map((v) => Math.floor(v))).toStrictEqual([
        -2239, -706, -3,
      ]);
      expect((clickInfo?.clickedPointColor ?? []).map((v) => Math.floor(v))).toStrictEqual([
        127, 225, 255, 1,
      ]);
      expect(clickInfo?.additionalFieldValues).toBeUndefined();
    });

    it("handles endianness", () => {
      const marker = decodeMarker({
        ...POINT_CLOUD_MESSAGE,
        settings: { colorMode: { mode: "rgb" } },
        is_bigendian: true,
      });
      const clickInfo = getClickedInfo(marker, 1);
      expect(clickInfo).not.toBeNullOrUndefined();
      expect((clickInfo?.clickedPoint ?? []).map((v) => Math.floor(v))).toStrictEqual([
        -2239, -706, -3,
      ]);
      expect((clickInfo?.clickedPointColor ?? []).map((v) => Math.floor(v))).toStrictEqual([
        255, 255, 127, 1,
      ]);
      expect(clickInfo?.additionalFieldValues).toBeUndefined();
    });

    it("handles rainbow colors", () => {
      const input = {
        ...POINT_CLOUD_MESSAGE,
        settings: { colorMode: { mode: "rainbow", colorField: "y" } } as PointCloudSettings,
      };
      const marker = decodeMarker(input);
      const clickInfo = getClickedInfo(marker, 1);
      expect(clickInfo).not.toBeNullOrUndefined();
      expect((clickInfo?.clickedPoint ?? []).map((v) => Math.floor(v))).toStrictEqual([
        -2239, -706, -3,
      ]);
      expect((clickInfo?.clickedPointColor ?? []).map((v) => Math.floor(v))).toStrictEqual([
        255, 0, 255, 1,
      ]);
      expect(clickInfo?.additionalFieldValues).toBeUndefined();
    });

    it("handles gradient colors", () => {
      const input = {
        ...POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
        settings: {
          colorMode: {
            mode: "gradient",
            minColor: { r: 1, g: 0, b: 0, a: 1 },
            maxColor: { r: 0, g: 0, b: 1, a: 1 },
            colorField: "foo",
          },
        } as PointCloudSettings,
      };
      const marker = decodeMarker(input);
      const clickInfo = getClickedInfo(marker, 1);
      expect(clickInfo).not.toBeNullOrUndefined();
      expect((clickInfo?.clickedPoint ?? []).map((v) => Math.floor(v))).toStrictEqual([0, 1, 2]);
      expect((clickInfo?.clickedPointColor ?? []).map((v) => Math.floor(v))).toStrictEqual([
        0, 0, 255, 1,
      ]);
      expect(clickInfo?.additionalFieldValues).toStrictEqual({});
    });

    it("handles additional fields", () => {
      const input = {
        ...POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
        settings: { colorMode: { mode: "rainbow", colorField: "bar" } } as PointCloudSettings,
      };
      const marker = decodeMarker(input);
      const clickInfo = getClickedInfo(decodeAdditionalFields(marker), 1);
      expect(clickInfo).not.toBeNullOrUndefined();
      expect((clickInfo?.clickedPoint ?? []).map((v) => Math.floor(v))).toStrictEqual([0, 1, 2]);
      expect((clickInfo?.clickedPointColor ?? []).map((v) => Math.floor(v))).toStrictEqual([
        255, 0, 255, 1,
      ]);
      expect(clickInfo?.additionalFieldValues).toStrictEqual({
        bar: 8,
        baz: 7,
        foo: 9,
        foo16_some_really_really_long_name: 2,
      });
    });
  });

  describe("getAllPoints", () => {
    it("converts float array to numbers", () => {
      const marker = decodeMarker(POINT_CLOUD_MESSAGE);
      const points = getAllPoints(marker);
      expect(points.map((v) => Math.floor(v))).toStrictEqual([-2239, -706, -3, -2239, -706, -3]);
    });
  });

  describe("decodeAdditionalFields", () => {
    it("decodes additional fields", () => {
      const fullyDecodedMarker = decodeAdditionalFields(POINT_CLOUD_WITH_ADDITIONAL_FIELDS);
      expect(fullyDecodedMarker.bar).toEqual([6, 8]);
      expect(fullyDecodedMarker.baz).toEqual([5, 7]);
      expect(fullyDecodedMarker.foo).toEqual([7, 9]);
      expect(fullyDecodedMarker.foo16_some_really_really_long_name).toEqual([265, 2]);
    });
  });
});

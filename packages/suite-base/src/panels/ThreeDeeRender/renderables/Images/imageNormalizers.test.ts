// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompressedImage, RawImage } from "@foxglove/schemas";

import { PartialMessage } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtension";

import { CompressedVideo } from "./ImageTypes";
import {
  normalizeCompressedImage,
  normalizeCompressedVideo,
  normalizeRawImage,
  normalizeRosCompressedImage,
  normalizeRosImage,
} from "./imageNormalizers";
import { Image as RosImage, CompressedImage as RosCompressedImage } from "../../ros";

describe("imageNormalizers", () => {
  const mockTime = { sec: 123, nsec: 456000000 };
  const mockHeader = { stamp: mockTime, frame_id: "test_frame" };
  const mockData = new Uint8Array([1, 2, 3, 4]);

  describe("normalizeRosImage", () => {
    it("should normalize a complete RosImage message", () => {
      const input: PartialMessage<RosImage> = {
        header: mockHeader,
        height: 480,
        width: 640,
        encoding: "rgb8",
        is_bigendian: false,
        step: 1920,
        data: mockData,
      };
      // Expect input to be already normalized
      expect(normalizeRosImage(input)).toEqual(input);
    });

    it("should handle missing fields with defaults", () => {
      const input: PartialMessage<RosImage> = {};
      const expected: RosImage = {
        header: { stamp: { sec: 0, nsec: 0 }, frame_id: "" },
        height: 0,
        width: 0,
        encoding: "",
        is_bigendian: false,
        step: 0,
        data: new Uint8Array(0),
      };
      expect(normalizeRosImage(input)).toEqual(expected);
    });

    it("should handle partial header", () => {
      const input: PartialMessage<RosImage> = { header: { frame_id: "partial_frame" } };
      const expected: RosImage = {
        header: { stamp: { sec: 0, nsec: 0 }, frame_id: "partial_frame" },
        height: 0,
        width: 0,
        encoding: "",
        is_bigendian: false,
        step: 0,
        data: new Uint8Array(0),
      };
      expect(normalizeRosImage(input)).toEqual(expected);
    });

    it("should handle Int8Array data", () => {
      const int8Data = new Int8Array([1, -2, 3, -4]);
      const input: PartialMessage<RosImage> = { data: int8Data };
      const expected: RosImage = {
        header: { stamp: { sec: 0, nsec: 0 }, frame_id: "" },
        height: 0,
        width: 0,
        encoding: "",
        is_bigendian: false,
        step: 0,
        data: int8Data, // Expecting the same Int8Array instance
      };
      const result = normalizeRosImage(input);
      expect(result).toEqual(expected);
      expect(result.data).toBeInstanceOf(Int8Array);
    });
  });

  describe("normalizeRosCompressedImage", () => {
    it("should normalize a complete RosCompressedImage message", () => {
      const input: PartialMessage<RosCompressedImage> = {
        header: mockHeader,
        format: "jpeg",
        data: mockData,
      };
      // Expect input to be already normalized
      expect(normalizeRosCompressedImage(input)).toEqual(input);
    });

    it("should handle missing fields with defaults", () => {
      const input: PartialMessage<RosCompressedImage> = {};
      const expected: RosCompressedImage = {
        header: { stamp: { sec: 0, nsec: 0 }, frame_id: "" },
        format: "",
        data: new Uint8Array(0),
      };
      expect(normalizeRosCompressedImage(input)).toEqual(expected);
    });
  });

  describe("normalizeRawImage", () => {
    it("should normalize a complete RawImage message", () => {
      const input: PartialMessage<RawImage> = {
        timestamp: mockTime,
        frame_id: "test_frame",
        height: 480,
        width: 640,
        encoding: "rgb8",
        step: 1920,
        data: mockData,
      };
      // Expect input to be already normalized
      expect(normalizeRawImage(input)).toEqual(input);
    });

    it("should handle missing fields with defaults", () => {
      const input: PartialMessage<RawImage> = {};
      const expected: RawImage = {
        timestamp: { sec: 0, nsec: 0 },
        frame_id: "",
        height: 0,
        width: 0,
        encoding: "",
        step: 0,
        data: new Uint8Array(0),
      };
      expect(normalizeRawImage(input)).toEqual(expected);
    });
  });

  describe("normalizeCompressedImage", () => {
    it("should normalize a complete CompressedImage message", () => {
      const input: PartialMessage<CompressedImage> = {
        timestamp: mockTime,
        frame_id: "test_frame",
        format: "jpeg",
        data: mockData,
      };
      // Expect input to be already normalized
      expect(normalizeCompressedImage(input)).toEqual(input);
    });

    it("should handle missing fields with defaults", () => {
      const input: PartialMessage<CompressedImage> = {};
      const expected: CompressedImage = {
        timestamp: { sec: 0, nsec: 0 },
        frame_id: "",
        format: "",
        data: new Uint8Array(0),
      };
      expect(normalizeCompressedImage(input)).toEqual(expected);
    });
  });

  describe("normalizeCompressedVideo", () => {
    it("should normalize a complete CompressedVideo message by calling normalizeCompressedImage", () => {
      const input: PartialMessage<CompressedVideo> = {
        timestamp: mockTime,
        frame_id: "test_frame",
        format: "h264",
        data: mockData,
      };
      // Expect input to be already normalized
      expect(normalizeCompressedVideo(input)).toEqual(input);
    });

    it("should handle missing fields with defaults by calling normalizeCompressedImage", () => {
      const input: PartialMessage<CompressedVideo> = {};
      const expected: CompressedVideo = {
        timestamp: { sec: 0, nsec: 0 },
        frame_id: "",
        format: "",
        data: new Uint8Array(0),
      };
      expect(normalizeCompressedVideo(input)).toEqual(expected);
    });
  });
});

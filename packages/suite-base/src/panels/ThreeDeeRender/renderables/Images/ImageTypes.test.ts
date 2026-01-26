// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompressedImage, RawImage } from "@foxglove/schemas";

import { Time } from "@lichtblick/rostime";

import {
  AnyImage,
  CompressedVideo,
  getFrameIdFromImage,
  getTimestampFromImage,
} from "./ImageTypes";
import { Image as RosImage, CompressedImage as RosCompressedImage } from "../../ros";

describe("ImageTypes utility functions", () => {
  const mockTime: Time = { sec: 123, nsec: 456000000 };
  const mockHeader = { stamp: mockTime, frame_id: "ros_frame" };
  const mockData = new Uint8Array([1, 2, 3]);

  const rosImage: RosImage = {
    header: mockHeader,
    height: 10,
    width: 20,
    encoding: "rgb8",
    is_bigendian: false,
    step: 60,
    data: mockData,
  };

  const rosCompressedImage: RosCompressedImage = {
    header: mockHeader,
    format: "jpeg",
    data: mockData,
  };

  const rawImage: RawImage = {
    timestamp: mockTime,
    frame_id: "foxglove_frame",
    height: 10,
    width: 20,
    encoding: "rgb8",
    step: 60,
    data: mockData,
  };

  const compressedImage: CompressedImage = {
    timestamp: mockTime,
    frame_id: "foxglove_frame",
    format: "png",
    data: mockData,
  };

  const compressedVideo: CompressedVideo = {
    timestamp: mockTime,
    frame_id: "foxglove_frame",
    format: "h264",
    data: mockData,
  };

  const testCases: Array<{
    name: string;
    image: AnyImage;
    expectedFrameId: string;
    expectedTime: Time;
  }> = [
    {
      name: "RosImage",
      image: rosImage,
      expectedFrameId: "ros_frame",
      expectedTime: mockTime,
    },
    {
      name: "RosCompressedImage",
      image: rosCompressedImage,
      expectedFrameId: "ros_frame",
      expectedTime: mockTime,
    },
    {
      name: "RawImage",
      image: rawImage,
      expectedFrameId: "foxglove_frame",
      expectedTime: mockTime,
    },
    {
      name: "CompressedImage",
      image: compressedImage,
      expectedFrameId: "foxglove_frame",
      expectedTime: mockTime,
    },
    {
      name: "CompressedVideo",
      image: compressedVideo,
      expectedFrameId: "foxglove_frame",
      expectedTime: mockTime,
    },
  ];

  describe("getFrameIdFromImage", () => {
    testCases.forEach(({ name, image, expectedFrameId }) => {
      it(`should return the correct frame_id for ${name}`, () => {
        expect(getFrameIdFromImage(image)).toBe(expectedFrameId);
      });
    });
  });

  describe("getTimestampFromImage", () => {
    testCases.forEach(({ name, image, expectedTime }) => {
      it(`should return the correct timestamp for ${name}`, () => {
        expect(getTimestampFromImage(image)).toEqual(expectedTime);
      });
    });
  });
});

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  VideoCodec,
  canonicalVideoCodec,
  isVideoKeyframe,
  videoCodecNeedsKeyframeReplay,
  videoCodecNeedsSeekBackfill,
} from "./codec";
import { H264 } from "./h264";
import { H265 } from "./h265";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("canonicalVideoCodec", () => {
  it("normalizes both 'h265' and the 'hevc' alias to H265", () => {
    expect(canonicalVideoCodec("h265")).toBe(VideoCodec.H265);
    expect(canonicalVideoCodec("hevc")).toBe(VideoCodec.H265);
  });

  it("maps 'h264' to H264", () => {
    expect(canonicalVideoCodec("h264")).toBe(VideoCodec.H264);
  });

  it("returns undefined for unrecognized formats", () => {
    expect(canonicalVideoCodec("vp9")).toBeUndefined();
    expect(canonicalVideoCodec("")).toBeUndefined();
  });
});

describe("isVideoKeyframe", () => {
  it("dispatches to the H264 parser for h264", () => {
    const spy = jest.spyOn(H264, "IsKeyframe").mockReturnValue(true);
    const data = new Uint8Array([0x65]);
    expect(isVideoKeyframe("h264", data)).toBe(true);
    expect(spy).toHaveBeenCalledWith(data);
  });

  it("dispatches to the H265 parser for the 'hevc' alias", () => {
    const spy = jest.spyOn(H265, "IsKeyframe").mockReturnValue(true);
    const data = new Uint8Array([0x26]);
    expect(isVideoKeyframe("hevc", data)).toBe(true);
    expect(spy).toHaveBeenCalledWith(data);
  });

  it("returns false for unrecognized formats without consulting any parser", () => {
    const h264Spy = jest.spyOn(H264, "IsKeyframe");
    const h265Spy = jest.spyOn(H265, "IsKeyframe");
    expect(isVideoKeyframe("vp9", new Uint8Array([0x01]))).toBe(false);
    expect(h264Spy).not.toHaveBeenCalled();
    expect(h265Spy).not.toHaveBeenCalled();
  });
});

describe("videoCodecNeedsKeyframeReplay", () => {
  it("is true only for codecs that cannot decode a delta frame in isolation", () => {
    expect(videoCodecNeedsKeyframeReplay(VideoCodec.H265)).toBe(true);
    expect(videoCodecNeedsKeyframeReplay(VideoCodec.H264)).toBe(false);
    expect(videoCodecNeedsKeyframeReplay(undefined)).toBe(false);
  });
});

describe("videoCodecNeedsSeekBackfill", () => {
  it("is true for every inter-frame-dependent codec", () => {
    // H.264 belongs here too even though it does not need the renderable's queue at playback time:
    // a seek that lands on a P-frame still needs the preceding GOP for the decoder to produce a
    // picture, so backfill is required at the player/source boundary.
    expect(videoCodecNeedsSeekBackfill(VideoCodec.H264)).toBe(true);
    expect(videoCodecNeedsSeekBackfill(VideoCodec.H265)).toBe(true);
    expect(videoCodecNeedsSeekBackfill(undefined)).toBe(false);
  });
});

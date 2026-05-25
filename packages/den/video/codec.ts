// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H264 as H264Parser } from "./h264";
import { H265 as H265Parser } from "./h265";

/**
 * Canonical codec identifier used internally so callers do not need to know that some recordings
 * tag H.265 streams as "hevc" while others tag them as "h265".
 */
export enum VideoCodec {
  H264 = "h264",
  H265 = "h265",
}

/**
 * Maps an external `CompressedVideo.format` string to the canonical {@link VideoCodec}, or returns
 * undefined if the format is not a recognized video codec. This is the single boundary where the
 * "hevc" alias is normalized to {@link VideoCodec.H265}.
 */
export function canonicalVideoCodec(format: string): VideoCodec | undefined {
  switch (format) {
    case "h264":
      return VideoCodec.H264;
    case "h265":
    case "hevc":
      return VideoCodec.H265;
  }
  return undefined;
}

/**
 * Returns whether the given frame is a keyframe, dispatching to the parser for its (normalized)
 * codec. Non-video formats always return false.
 */
export function isVideoKeyframe(format: string, data: Uint8Array): boolean {
  switch (canonicalVideoCodec(format)) {
    case VideoCodec.H264:
      // Search for an IDR NAL unit to determine if this is a keyframe.
      return H264Parser.IsKeyframe(data);
    case VideoCodec.H265:
      return H265Parser.IsKeyframe(data);
  }
  return false;
}

/**
 * Codecs whose non-keyframes can only be decoded by replaying the full GOP (the most recent
 * keyframe plus every frame after it). For these we cannot decode from the latest frame alone.
 */
export function videoCodecNeedsKeyframeReplay(codec: VideoCodec | undefined): boolean {
  return codec === VideoCodec.H265;
}

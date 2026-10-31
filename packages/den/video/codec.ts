// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AV1 as AV1Parser } from "./av1";
import { H265_CODEC_FORMAT_STRINGS } from "./constants";
import { H264 as H264Parser } from "./h264";
import { H265 as H265Parser } from "./h265";

/**
 * Canonical codec identifier used internally so callers do not need to handle external aliases.
 */
export enum VideoCodec {
  H264 = "h264",
  H265 = "h265",
  AV1 = "av1",
}

/**
 * Maps an external `CompressedVideo.format` string to the canonical {@link VideoCodec}, or returns
 * undefined if the format is not a recognized video codec.
 */
export function canonicalVideoCodec(format: string): VideoCodec | undefined {
  if (format === "av1") {
    return VideoCodec.AV1;
  }

  if (H265_CODEC_FORMAT_STRINGS.some((substr) => format.startsWith(substr))) {
    return VideoCodec.H265;
  }

  if (format === "h264") {
    return VideoCodec.H264;
  }

  return undefined;
}

/**
 * Returns whether the given frame is a keyframe, dispatching to the parser for its (normalized)
 * codec. Non-video formats always return false.
 */
export function isVideoKeyframe(
  format: string,
  data: Uint8Array,
  resolvedCodec?: VideoCodec,
): boolean {
  switch (resolvedCodec ?? canonicalVideoCodec(format)) {
    case VideoCodec.H264:
      // Search for an IDR NAL unit to determine if this is a keyframe.
      return H264Parser.IsKeyframe(data);
    case VideoCodec.H265:
      return H265Parser.IsKeyframe(data);
    case VideoCodec.AV1:
      return AV1Parser.IsKeyframe(data);
  }
  return false;
}

/**
 * Codecs whose non-keyframes can only be decoded by replaying the full GOP (the most recent
 * keyframe plus every frame after it). For these we cannot decode from the latest frame alone.
 *
 * This gates the in-renderable GOP history used to replay a dependency chain after decoder resets.
 * AV1 and H.265 may buffer several submitted chunks before emitting the target frame. H.264 emits
 * promptly and only needs source-side seek backfill, not an additional in-renderable history.
 */
export function videoCodecNeedsKeyframeReplay(codec: VideoCodec | undefined): boolean {
  return codec === VideoCodec.H265 || codec === VideoCodec.AV1;
}

/**
 * Codecs whose seek target may be a P-frame that cannot be decoded without first replaying the
 * preceding GOP (most recent keyframe → target). AV1, H.264, and H.265 have inter-frame
 * dependencies, so a seek that lands on a non-keyframe needs the keyframe and
 * every intervening P-frame attached. Without this, a forward seek to a P-frame produces garbled
 * decoder output (stale reference state) and a backward seek waits seconds for the next IDR
 * before any picture appears.
 *
 * This is intentionally separate from {@link videoCodecNeedsKeyframeReplay}: backfill is a
 * correctness requirement at the player/source boundary, whereas keyframe-replay queueing is a
 * codec-specific performance trade-off inside the renderable.
 */
export function videoCodecNeedsSeekBackfill(codec: VideoCodec | undefined): boolean {
  return codec === VideoCodec.H264 || codec === VideoCodec.H265 || codec === VideoCodec.AV1;
}

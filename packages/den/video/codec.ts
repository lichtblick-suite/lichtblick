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
 *
 * This gates the in-renderable queue + drain serialization. H.265 needs it because the decoder
 * holds many submitted chunks in its pipeline before emitting the target frame, so the renderable
 * must drive submission in order. H.264, by contrast, emits a decoded VideoFrame within ~2 ms and
 * can run its `#startDecode` calls in parallel — serializing it through the drain queue adds
 * per-frame latency that surfaces as 30 fps jank. Use {@link videoCodecNeedsSeekBackfill} (not
 * this predicate) when deciding whether a seek target needs its preceding GOP attached: both
 * H.264 and H.265 P-frames require the GOP for a correct seek, but only H.265 needs the
 * renderable's queue to drive submission order during normal playback.
 */
export function videoCodecNeedsKeyframeReplay(codec: VideoCodec | undefined): boolean {
  return codec === VideoCodec.H265;
}

/**
 * Codecs whose seek target may be a P-frame that cannot be decoded without first replaying the
 * preceding GOP (most recent keyframe → target). Both H.264 and H.265 have inter-frame
 * dependencies, so for either codec a seek that lands on a non-keyframe needs the keyframe and
 * every intervening P-frame attached. Without this, a forward seek to a P-frame produces garbled
 * decoder output (stale reference state) and a backward seek waits seconds for the next IDR
 * before any picture appears.
 *
 * This is intentionally separate from {@link videoCodecNeedsKeyframeReplay}: backfill is a
 * correctness requirement at the player/source boundary, whereas keyframe-replay queueing is a
 * codec-specific performance trade-off inside the renderable.
 */
export function videoCodecNeedsSeekBackfill(codec: VideoCodec | undefined): boolean {
  return codec === VideoCodec.H264 || codec === VideoCodec.H265;
}

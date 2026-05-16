// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import DenH265FrameBuilder from "@lichtblick/den/testing/builders/H265FrameBuilder";
import { H265SliceType } from "@lichtblick/den/video";
import { CompressedVideo } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/Images/ImageTypes";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

/**
 * Test scaffolding for H.265 `CompressedVideo` messages. The byte-level NAL unit, slice, and
 * frame builders live in `@lichtblick/den/testing/builders/H265FrameBuilder` so they can be reused by
 * the codec parser tests; this class wraps them and adds a `frame()` factory that produces a
 * full `CompressedVideo` message with sensible defaults.
 */
export default class H265FrameBuilder {
  public static readonly lengthPrefixedNalu = DenH265FrameBuilder.lengthPrefixedNalu;
  public static readonly annexBNalu = DenH265FrameBuilder.annexBNalu;
  public static readonly frameData = DenH265FrameBuilder.frameData;
  public static readonly slice = DenH265FrameBuilder.slice;
  public static readonly keyframeWithParameterSets = DenH265FrameBuilder.keyframeWithParameterSets;
  public static readonly lengthPrefixedKeyframeWithParameterSets =
    DenH265FrameBuilder.lengthPrefixedKeyframeWithParameterSets;
  public static readonly keyframeOnly = DenH265FrameBuilder.keyframeOnly;
  public static readonly deltaFrame = DenH265FrameBuilder.deltaFrame;
  public static readonly deltaFrameWithPps = DenH265FrameBuilder.deltaFrameWithPps;

  public static frame(props: Partial<CompressedVideo> = {}): CompressedVideo {
    return defaults<CompressedVideo>(props, {
      format: "h265",
      data: H265FrameBuilder.keyframeWithParameterSets(),
      frame_id: BasicBuilder.string(),
      timestamp: RosTimeBuilder.time(),
    });
  }

  // Re-exported for convenience so tests can use `H265FrameBuilder.SliceType.B` etc. without an
  // additional import.
  public static readonly SliceType = H265SliceType;
}

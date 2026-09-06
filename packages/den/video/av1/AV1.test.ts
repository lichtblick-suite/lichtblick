// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AV1 } from "./AV1";
import { OBU_TYPE_SHIFT } from "./constants";
import { AV1FrameType, AV1ObuType } from "./types";
import AV1FrameBuilder from "../../testing/builders/AV1FrameBuilder";

describe("AV1", () => {
  it("detects a shown key frame carrying a sequence header", () => {
    // Given a compliant AV1 keyframe and delta frame
    const keyframe = AV1FrameBuilder.keyframe();
    const deltaFrame = AV1FrameBuilder.deltaFrame();

    // When keyframe detection runs
    // Then only the shown key frame is a keyframe
    expect(AV1.IsKeyframe(keyframe)).toBe(true);
    expect(AV1.IsKeyframe(deltaFrame)).toBe(false);
  });

  it("does not treat a sequence header in front of a delta frame as a keyframe", () => {
    // Given an inter frame preceded by a repeated sequence header, which AV1 permits
    const deltaFrame = AV1FrameBuilder.deltaFrameWithSequenceHeader();

    // When keyframe detection runs
    // Then the frame header, not the sequence header, decides the outcome
    expect(AV1.IsKeyframe(deltaFrame)).toBe(false);
  });

  it("rejects frame types that are not random-access points", () => {
    // Given frames that are intra-only, switch, or merely re-displayed from the reference buffer
    const frames = [
      AV1FrameBuilder.frame({ frameType: AV1FrameType.IntraOnlyFrame }),
      AV1FrameBuilder.frame({ frameType: AV1FrameType.SwitchFrame }),
      AV1FrameBuilder.frame({ showExistingFrame: true }),
    ];

    // When each is inspected together with a sequence header
    // Then none of them qualifies as a keyframe
    for (const frame of frames) {
      const data = new Uint8Array([
        ...AV1FrameBuilder.obu(AV1ObuType.SequenceHeader, AV1FrameBuilder.sequenceHeader()),
        ...frame,
      ]);
      expect(AV1.IsKeyframe(data)).toBe(false);
    }
  });

  it("treats a hidden key frame as a random-access point", () => {
    // Given a forward key frame, i.e. a key frame coded with show_frame = 0 and displayed later
    const data = new Uint8Array([
      ...AV1FrameBuilder.obu(AV1ObuType.SequenceHeader, AV1FrameBuilder.sequenceHeader()),
      ...AV1FrameBuilder.frame({ showFrame: false }),
    ]);

    // When keyframe detection runs
    // Then it is still a point the decoder can be started from
    expect(AV1.IsKeyframe(data)).toBe(true);
  });

  it("finds a key frame that is not the first frame of the temporal unit", () => {
    // Given a temporal unit that packs hidden frames ahead of the key frame, as encoders do
    const data = new Uint8Array([
      ...AV1FrameBuilder.obu(AV1ObuType.SequenceHeader, AV1FrameBuilder.sequenceHeader()),
      ...AV1FrameBuilder.frame({ frameType: AV1FrameType.InterFrame, showFrame: false }),
      ...AV1FrameBuilder.frame(),
    ]);

    // When keyframe detection runs
    // Then the whole temporal unit is scanned instead of stopping at its first frame header
    expect(AV1.IsKeyframe(data)).toBe(true);
  });

  it("does not mistake a hidden inter frame for a key frame", () => {
    // Given the common alt-ref layout: hidden inter frames followed by the shown inter frame
    const data = new Uint8Array([
      ...AV1FrameBuilder.obu(AV1ObuType.SequenceHeader, AV1FrameBuilder.sequenceHeader()),
      ...AV1FrameBuilder.frame({ frameType: AV1FrameType.InterFrame, showFrame: false }),
      ...AV1FrameBuilder.frame({ frameType: AV1FrameType.InterFrame }),
    ]);

    // When the whole temporal unit is scanned
    // Then no frame in it is a random-access point
    expect(AV1.IsKeyframe(data)).toBe(false);
  });

  it("requires a sequence header for a random-access point", () => {
    // Given a shown key frame without the sequence header the decoder needs
    const data = new Uint8Array(AV1FrameBuilder.frame());

    // When keyframe detection runs
    // Then the temporal unit is not a usable random-access point
    expect(AV1.IsKeyframe(data)).toBe(false);
  });

  it("treats a reduced still picture as a keyframe", () => {
    // Given a still picture, whose frame header codes no fields and implies a shown key frame
    const data = new Uint8Array([
      ...AV1FrameBuilder.obu(
        AV1ObuType.SequenceHeader,
        AV1FrameBuilder.sequenceHeader({ reducedStillPicture: true }),
      ),
      ...AV1FrameBuilder.obu(AV1ObuType.Frame, [0x00]),
    ]);

    // When it is inspected
    // Then the implied key frame is detected and the reduced header remains correctly aligned
    expect(AV1.IsKeyframe(data)).toBe(true);
    expect(AV1.ParseDecoderConfig(data)).toEqual({
      codec: "av01.0.05M.08",
      codedWidth: 640,
      codedHeight: 480,
    });
  });

  it("ignores a temporal unit without a coded frame", () => {
    // Given a sequence header preceded by a temporal delimiter, but no frame data
    const data = new Uint8Array([
      ...AV1FrameBuilder.obu(AV1ObuType.TemporalDelimiter, []),
      ...AV1FrameBuilder.obu(AV1ObuType.SequenceHeader, AV1FrameBuilder.sequenceHeader()),
    ]);

    // When keyframe detection runs
    // Then there is no frame to classify as a keyframe
    expect(AV1.IsKeyframe(data)).toBe(false);
  });

  it("derives the WebCodecs configuration from the sequence header", () => {
    // Given a Main profile, level 3.1, 8-bit 640x480 keyframe
    const keyframe = AV1FrameBuilder.keyframe();

    // When its decoder configuration is parsed
    const config = AV1.ParseDecoderConfig(keyframe);

    // Then the codec string and coded dimensions match the sequence header
    expect(config).toEqual({ codec: "av01.0.05M.08", codedWidth: 640, codedHeight: 480 });
  });

  it("supports high-tier Professional profile 12-bit streams", () => {
    // Given a Professional profile, high-tier, 12-bit keyframe
    const keyframe = AV1FrameBuilder.keyframe({
      bitDepth: 12,
      height: 1080,
      level: 13,
      profile: 2,
      tier: 1,
      width: 1920,
    });

    // When its decoder configuration is parsed
    const config = AV1.ParseDecoderConfig(keyframe);

    // Then all mandatory AV1 codec parameters and dimensions are retained
    expect(config).toEqual({ codec: "av01.2.13H.12", codedWidth: 1920, codedHeight: 1080 });
  });

  it("parses conditional timing and operating-point fields", () => {
    // Given a sequence header with decoder timing, initial delay, and two operating points
    const keyframe = AV1FrameBuilder.keyframe({
      decoderModel: true,
      initialDisplayDelay: true,
      operatingPoints: [
        { level: 9, tier: 1 },
        { level: 5, tier: 0 },
      ],
      timingInfo: true,
    });

    // When its decoder configuration is parsed
    const config = AV1.ParseDecoderConfig(keyframe);

    // Then the first operating point controls the codec string and dimensions stay aligned
    expect(config).toEqual({ codec: "av01.0.09H.08", codedWidth: 640, codedHeight: 480 });
  });

  it("supports a final sequence header OBU without an explicit size", () => {
    // Given a final low-overhead OBU whose payload consumes the rest of the message
    const data = new Uint8Array([
      AV1ObuType.SequenceHeader << OBU_TYPE_SHIFT,
      ...AV1FrameBuilder.sequenceHeader(),
    ]);

    // When it is parsed
    const config = AV1.ParseDecoderConfig(data);

    // Then the implicit payload boundary is accepted
    expect(config).toEqual({ codec: "av01.0.05M.08", codedWidth: 640, codedHeight: 480 });
  });

  it("accepts an OBU extension header", () => {
    // Given a sequence header OBU carrying a valid extension header, plus a shown key frame
    const data = new Uint8Array([
      ...AV1FrameBuilder.obu(
        AV1ObuType.SequenceHeader,
        AV1FrameBuilder.sequenceHeader(),
        0b0010_1000,
      ),
      ...AV1FrameBuilder.frame(),
    ]);

    // When it is inspected
    // Then the extension is skipped and the sequence header is parsed normally
    expect(AV1.IsKeyframe(data)).toBe(true);
    expect(AV1.ParseDecoderConfig(data)?.codec).toBe("av01.0.05M.08");
  });

  it("returns no configuration for malformed or truncated OBUs", () => {
    // Given invalid reserved bits, a truncated size, and a truncated payload
    const invalidHeader = new Uint8Array([0x0b, 0x00]);
    const truncatedSize = new Uint8Array([0x0a, 0x80]);
    const truncatedPayload = new Uint8Array([0x0a, 0x05, 0x00]);

    // When each malformed frame is parsed
    // Then it is rejected without throwing
    for (const data of [invalidHeader, truncatedSize, truncatedPayload]) {
      expect(AV1.IsKeyframe(data)).toBe(false);
      expect(AV1.ParseDecoderConfig(data)).toBeUndefined();
    }
  });

  /**
   * Byte-exact temporal units captured from libaom-av1, 64x48 8-bit Main profile:
   *
   *   ffmpeg -f lavfi -i color=size=64x48:rate=10:duration=2:color=gray \
   *     -c:v libaom-av1 -cpu-used 8 -crf 63 -f ivf out.ivf                       # key, delta
   *   ffmpeg -f lavfi -i testsrc=size=64x48:rate=10:duration=2 \
   *     -c:v libaom-av1 -cpu-used 8 -crf 63 -lag-in-frames 19 -auto-alt-ref 1 \
   *     -g 20 -f ivf out.ivf                                       # altRef, showExisting
   *
   * The synthetic builder writes the same bit order this parser reads, so it cannot catch a
   * misreading of the specification. These recorded units can: they pin the OBU framing and the
   * `uncompressed_header()` field order against a conforming encoder, including the alt-ref layout
   * that packs hidden frames ahead of the shown one in a single temporal unit.
   */
  const RECORDED_TEMPORAL_UNITS = {
    /** Temporal delimiter, sequence header, shown key frame. */
    key: "12000a0a00000002aff79b5f2008320b1000c98000028000000988",
    /** Shown inter frame, no sequence header. */
    delta: "120032113003c080000006ff800002c00020009910",
    /** Hidden (alt-ref) inter frame followed by the shown inter frame that references it. */
    altRef: "1200321129035803d42841bec00000b000140093dc321032052407a0e8837fc000016000380098",
    /** Frame header that only re-displays a frame already held in the reference buffer. */
    showExisting: "12001a01c8",
  };

  function recorded(hex: string): Uint8Array {
    return new Uint8Array((hex.match(/../g) ?? []).map((byte) => parseInt(byte, 16)));
  }

  it("detects a recorded libaom keyframe and derives its configuration", () => {
    // Given a temporal unit produced by libaom-av1
    const data = recorded(RECORDED_TEMPORAL_UNITS.key);

    // When it is inspected
    // Then the recorded sequence header and key frame are read exactly as the encoder wrote them
    expect(AV1.IsKeyframe(data)).toBe(true);
    expect(AV1.ParseDecoderConfig(data)).toEqual({
      codec: "av01.0.00M.08",
      codedWidth: 64,
      codedHeight: 48,
    });
  });

  it("rejects recorded libaom temporal units that are not random-access points", () => {
    // Given recorded delta, alt-ref, and re-display temporal units
    const units = [
      RECORDED_TEMPORAL_UNITS.delta,
      RECORDED_TEMPORAL_UNITS.altRef,
      RECORDED_TEMPORAL_UNITS.showExisting,
    ];

    // When each is inspected
    // Then none is treated as a keyframe and none carries a decoder configuration
    for (const hex of units) {
      const data = recorded(hex);
      expect(AV1.IsKeyframe(data)).toBe(false);
      expect(AV1.ParseDecoderConfig(data)).toBeUndefined();
    }
  });
});

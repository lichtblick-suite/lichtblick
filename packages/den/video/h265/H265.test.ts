// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265 } from "./H265";
import { DEFAULT_HEVC_CODEC } from "./constants";
import { H265NaluType, H265SliceType } from "./types";
import H265FrameBuilder from "../../testing/builders/H265FrameBuilder";

describe("H265", () => {
  it("should detect IRAP I slices as keyframes", () => {
    // Given a keyframe-with-parameter-sets fixture
    const frame = H265FrameBuilder.keyframeWithParameterSets();

    // When IsKeyframe is queried
    // Then it reports true
    expect(H265.IsKeyframe(frame)).toBe(true);
  });

  it("should normalize length-prefixed frames to Annex B", () => {
    // Given a length-prefixed NALU sequence
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.lengthPrefixedNalu(H265NaluType.IDR_W_RADL, []),
      H265FrameBuilder.lengthPrefixedNalu(1, []),
    ]);

    // When ToAnnexB normalizes it
    const normalized = H265.ToAnnexB(frame);

    // Then the output matches the equivalent Annex B framing
    expect(normalized).toEqual(
      H265FrameBuilder.frameData([
        H265FrameBuilder.annexBNalu(H265NaluType.IDR_W_RADL, []),
        H265FrameBuilder.annexBNalu(1, []),
      ]),
    );
  });

  it("should return a generic decoder config for supported h265 frames", () => {
    // Given a P-slice frame
    const frame = H265FrameBuilder.frameData([H265FrameBuilder.slice(1, H265SliceType.P)]);

    // When ParseDecoderConfig is called
    // Then it returns the default HEVC codec string
    expect(H265.ParseDecoderConfig(frame)).toEqual({ codec: DEFAULT_HEVC_CODEC });
  });

  it("should extract parameter sets without including the next start code", () => {
    // Given a VPS NALU followed by an IDR NALU
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT, []),
      H265FrameBuilder.annexBNalu(H265NaluType.IDR_W_RADL, []),
    ]);

    // When InspectFrame extracts parameter sets
    const frameInfo = H265.InspectFrame(frame);

    // Then only the VPS bytes are reported, and `hasRequiredParameterSets` stays false
    expect(frameInfo.parameterSets).toEqual(
      new Uint8Array(H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT, [])),
    );
    expect(frameInfo.hasParameterSets).toBe(true);
    expect(frameInfo.hasRequiredParameterSets).toBe(false);
  });

  it("should strip parameter sets", () => {
    // Given a frame with VPS/SPS/PPS plus a P-slice
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      H265FrameBuilder.slice(1, H265SliceType.P),
    ]);

    // When StripParameterSets is called
    // Then only the VCL slice remains
    expect(H265.StripParameterSets(frame)).toEqual(
      new Uint8Array(H265FrameBuilder.slice(1, H265SliceType.P)),
    );
  });

  it("should detect complete VPS SPS PPS parameter sets", () => {
    // Given a frame that includes all three of VPS, SPS, and PPS
    const parameterSets = [
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT, [0x02]),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0x03]),
    ];
    const frame = H265FrameBuilder.frameData([
      ...parameterSets,
      H265FrameBuilder.annexBNalu(H265NaluType.IDR_W_RADL, [0x04]),
    ]);

    // When InspectFrame inspects it
    const frameInfo = H265.InspectFrame(frame);

    // Then it reports the parameter sets and flags them as required-set complete
    expect(frameInfo.hasParameterSets).toBe(true);
    expect(frameInfo.hasRequiredParameterSets).toBe(true);
    expect(frameInfo.parameterSets).toEqual(H265FrameBuilder.frameData(parameterSets));
  });

  it("should detect I, P, and B slice types from slice headers", () => {
    // Given frames of each slice type
    // When InspectFrame parses them
    // Then frameType reflects the slice type
    expect(H265.InspectFrame(H265FrameBuilder.keyframeWithParameterSets()).frameType).toBe("I");
    expect(H265.InspectFrame(H265FrameBuilder.deltaFrameWithPps(H265SliceType.P)).frameType).toBe(
      "P",
    );
    expect(H265.InspectFrame(H265FrameBuilder.deltaFrameWithPps(H265SliceType.B)).frameType).toBe(
      "B",
    );
  });

  it("should mark IRAP P slices as keyframes", () => {
    // Given an IRAP frame whose slice header carries a P slice_type
    // When InspectFrame is called
    const frameInfo = H265.InspectFrame(
      H265FrameBuilder.frameData([
        H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
        H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
        H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
        H265FrameBuilder.slice(H265NaluType.IDR_W_RADL, H265SliceType.P),
      ]),
    );

    // Then frameType is "P" and isKeyframe is still true (IRAP NALU type wins)
    expect(frameInfo.frameType).toBe("P");
    expect(frameInfo.isKeyframe).toBe(true);
  });

  it("should use cached parameter sets to parse slice types", () => {
    // Given a delta-frame with no in-band PPS, but a cached PPS in the parser context
    const frameInfo = H265.InspectFrame(H265FrameBuilder.deltaFrame(H265SliceType.P), {
      parameterSets: H265FrameBuilder.frameData([
        H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      ]),
    });

    // When InspectFrame parses it
    // Then the slice type is recovered from the cached PPS
    expect(frameInfo.frameType).toBe("P");
    expect(frameInfo.hasUnparsedVclSlice).toBe(false);
  });

  it("should mark IRAP frames as keyframes even when PPS is missing", () => {
    // Given an IRAP-only frame without any parameter sets
    const frameInfo = H265.InspectFrame(H265FrameBuilder.keyframeOnly(H265SliceType.I));

    // When InspectFrame parses it
    // Then frameType is "unknown" (cannot parse slice header), but isKeyframe is still true
    expect(frameInfo.frameType).toBe("unknown");
    expect(frameInfo.hasUnparsedVclSlice).toBe(true);
    expect(frameInfo.isKeyframe).toBe(true);
  });

  it("should return undefined for unsupported h265 bitstreams", () => {
    // Given a buffer that is neither Annex B nor length-prefixed
    // When ParseDecoderConfig is called
    // Then it returns undefined
    expect(H265.ParseDecoderConfig(new Uint8Array([0x01, 0x02, 0x03]))).toBeUndefined();
  });

  it("IsKeyframe returns false for unrecognized bitstream formats", () => {
    // Given garbage input
    // When IsKeyframe is called
    // Then it returns false instead of throwing
    expect(H265.IsKeyframe(new Uint8Array([0x01, 0x02, 0x03]))).toBe(false);
  });

  it("IsKeyframe returns false when no random-access NAL unit is present", () => {
    // Given a delta frame
    // When IsKeyframe is called
    // Then it returns false
    expect(H265.IsKeyframe(H265FrameBuilder.deltaFrame())).toBe(false);
  });

  it("StripParameterSets returns undefined for unrecognized bitstream formats", () => {
    // Given garbage input
    // When StripParameterSets is called
    // Then it returns undefined
    expect(H265.StripParameterSets(new Uint8Array([0x01, 0x02, 0x03]))).toBeUndefined();
  });

  it("StripParameterSets returns undefined when only parameter sets are present", () => {
    // Given a frame containing nothing but VPS/SPS/PPS
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
    ]);

    // When StripParameterSets is called
    // Then it returns undefined because no VCL data is left
    expect(H265.StripParameterSets(frame)).toBeUndefined();
  });

  it("InspectFrame ignores unparseable PPS context input", () => {
    // Given a parser context whose parameterSets buffer is not a valid bitstream
    const frame = H265FrameBuilder.frameData([H265FrameBuilder.slice(1, H265SliceType.P)]);

    // When InspectFrame is called
    const frameInfo = H265.InspectFrame(frame, { parameterSets: new Uint8Array([0x42]) });

    // Then it falls back to "unknown" frameType without throwing
    expect(frameInfo.bitstreamFormat).toBe("annex-b");
    expect(frameInfo.frameType).toBe("unknown");
  });

  it("InspectFrame tolerates a PPS NAL unit that is too short to parse", () => {
    // Given a PPS NALU with only the 2-byte header and no body
    const ppsContext = H265FrameBuilder.frameData([
      [0x00, 0x00, 0x00, 0x01, (H265NaluType.PPS_NUT << 1) | 1, 0x01],
    ]);
    const frame = H265FrameBuilder.frameData([H265FrameBuilder.slice(1, H265SliceType.P)]);

    // When InspectFrame is called with that context
    // Then it does not throw
    expect(() => H265.InspectFrame(frame, { parameterSets: ppsContext })).not.toThrow();
  });

  it("ToAnnexB returns undefined when length-prefixed payload reports an invalid NAL length", () => {
    // Given a length-prefixed buffer whose NAL length is zero
    // When ToAnnexB normalizes it
    // Then the result is undefined
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x02]);
    expect(H265.ToAnnexB(data)).toBeUndefined();
  });

  it("ToAnnexB returns undefined when length-prefixed payload runs past its buffer", () => {
    // Given a length-prefixed buffer whose NAL length exceeds the data size
    // When ToAnnexB normalizes it
    // Then the result is undefined
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x10, 0x42, 0x00]);
    expect(H265.ToAnnexB(data)).toBeUndefined();
  });

  it("ToAnnexB returns undefined when length-prefixed payload has no complete NAL units", () => {
    // Given a buffer shorter than the 4-byte length prefix
    // When ToAnnexB normalizes it
    // Then the result is undefined
    expect(H265.ToAnnexB(new Uint8Array([0x00, 0x00, 0x00]))).toBeUndefined();
  });
});

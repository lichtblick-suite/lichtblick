// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265 } from "./H265";
import { H265NaluType, H265SliceType } from "./types";
import H265FrameBuilder from "../../testing/builders/H265FrameBuilder";

describe("H265", () => {
  it("should detect IRAP I slices as keyframes", () => {
    expect(H265.IsKeyframe(H265FrameBuilder.keyframeWithParameterSets())).toBe(true);
  });

  it("should normalize length-prefixed frames to Annex B", () => {
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.lengthPrefixedNalu(H265NaluType.IDR_W_RADL, []),
      H265FrameBuilder.lengthPrefixedNalu(1, []),
    ]);

    expect(H265.ToAnnexB(frame)).toEqual(
      H265FrameBuilder.frameData([
        H265FrameBuilder.annexBNalu(H265NaluType.IDR_W_RADL, []),
        H265FrameBuilder.annexBNalu(1, []),
      ]),
    );
  });

  it("should return a generic decoder config for supported h265 frames", () => {
    const frame = H265FrameBuilder.frameData([H265FrameBuilder.slice(1, H265SliceType.P)]);

    expect(H265.ParseDecoderConfig(frame)).toEqual({ codec: "hvc1.1.6.L93.B0" });
  });

  it("should extract parameter sets without including the next start code", () => {
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT, []),
      H265FrameBuilder.annexBNalu(H265NaluType.IDR_W_RADL, []),
    ]);

    const frameInfo = H265.InspectFrame(frame);
    expect(frameInfo.parameterSets).toEqual(
      new Uint8Array(H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT, [])),
    );
    expect(frameInfo.hasParameterSets).toBe(true);
    expect(frameInfo.hasRequiredParameterSets).toBe(false);
  });

  it("should strip parameter sets", () => {
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      H265FrameBuilder.slice(1, H265SliceType.P),
    ]);

    expect(H265.StripParameterSets(frame)).toEqual(
      new Uint8Array(H265FrameBuilder.slice(1, H265SliceType.P)),
    );
  });

  it("should detect complete VPS SPS PPS parameter sets", () => {
    const parameterSets = [
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT, [0x02]),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0x03]),
    ];
    const frame = H265FrameBuilder.frameData([
      ...parameterSets,
      H265FrameBuilder.annexBNalu(H265NaluType.IDR_W_RADL, [0x04]),
    ]);

    const frameInfo = H265.InspectFrame(frame);
    expect(frameInfo.hasParameterSets).toBe(true);
    expect(frameInfo.hasRequiredParameterSets).toBe(true);
    expect(frameInfo.parameterSets).toEqual(H265FrameBuilder.frameData(parameterSets));
  });

  it("should detect I, P, and B slice types from slice headers", () => {
    expect(H265.InspectFrame(H265FrameBuilder.keyframeWithParameterSets()).frameType).toBe("I");
    expect(H265.InspectFrame(H265FrameBuilder.deltaFrameWithPps(H265SliceType.P)).frameType).toBe(
      "P",
    );
    expect(H265.InspectFrame(H265FrameBuilder.deltaFrameWithPps(H265SliceType.B)).frameType).toBe(
      "B",
    );
  });

  it("should mark IRAP P slices as keyframes", () => {
    const frameInfo = H265.InspectFrame(
      H265FrameBuilder.frameData([
        H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
        H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
        H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
        H265FrameBuilder.slice(H265NaluType.IDR_W_RADL, H265SliceType.P),
      ]),
    );

    expect(frameInfo.frameType).toBe("P");
    expect(frameInfo.isKeyframe).toBe(true);
    expect(frameInfo.isRandomAccess).toBe(true);
  });

  it("should use cached parameter sets to parse slice types", () => {
    const frameInfo = H265.InspectFrame(H265FrameBuilder.deltaFrame(H265SliceType.P), {
      parameterSets: H265FrameBuilder.frameData([
        H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      ]),
    });

    expect(frameInfo.frameType).toBe("P");
    expect(frameInfo.hasUnparsedVclSlice).toBe(false);
  });

  it("should mark IRAP frames as keyframes even when PPS is missing", () => {
    const frameInfo = H265.InspectFrame(H265FrameBuilder.keyframeOnly(H265SliceType.I));

    expect(frameInfo.frameType).toBe("unknown");
    expect(frameInfo.hasUnparsedVclSlice).toBe(true);
    expect(frameInfo.isKeyframe).toBe(true);
  });

  it("should return undefined for unsupported h265 bitstreams", () => {
    expect(H265.ParseDecoderConfig(new Uint8Array([0x01, 0x02, 0x03]))).toBeUndefined();
  });

  it("FindNextStartCodeEnd returns index past the matched start code", () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x42]);
    expect(H265.FindNextStartCodeEnd(data, 0)).toBe(4);
    expect(H265.FindNextStartCodeEnd(new Uint8Array([0xff, 0xff]), 0)).toBe(2);
  });

  it("IsKeyframe returns false for unrecognized bitstream formats", () => {
    expect(H265.IsKeyframe(new Uint8Array([0x01, 0x02, 0x03]))).toBe(false);
  });

  it("IsKeyframe returns false when no random-access NAL unit is present", () => {
    expect(H265.IsKeyframe(H265FrameBuilder.deltaFrame())).toBe(false);
  });

  it("StripParameterSets returns undefined for unrecognized bitstream formats", () => {
    expect(H265.StripParameterSets(new Uint8Array([0x01, 0x02, 0x03]))).toBeUndefined();
  });

  it("StripParameterSets returns undefined when only parameter sets are present", () => {
    const frame = H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
    ]);
    expect(H265.StripParameterSets(frame)).toBeUndefined();
  });

  it("InspectFrame ignores unparseable PPS context input", () => {
    const frame = H265FrameBuilder.frameData([H265FrameBuilder.slice(1, H265SliceType.P)]);
    const frameInfo = H265.InspectFrame(frame, { parameterSets: new Uint8Array([0x42]) });
    expect(frameInfo.bitstreamFormat).toBe("annex-b");
    expect(frameInfo.frameType).toBe("unknown");
  });

  it("InspectFrame tolerates a PPS NAL unit that is too short to parse", () => {
    const ppsContext = H265FrameBuilder.frameData([
      // PPS_NUT NALU header (2 bytes) but no body — triggers ParsePps short-circuit
      [0x00, 0x00, 0x00, 0x01, (H265NaluType.PPS_NUT << 1) | 1, 0x01],
    ]);
    const frame = H265FrameBuilder.frameData([H265FrameBuilder.slice(1, H265SliceType.P)]);
    expect(() => H265.InspectFrame(frame, { parameterSets: ppsContext })).not.toThrow();
  });

  it("ToAnnexB returns undefined when length-prefixed payload reports an invalid NAL length", () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x02]);
    expect(H265.ToAnnexB(data)).toBeUndefined();
  });

  it("ToAnnexB returns undefined when length-prefixed payload runs past its buffer", () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x10, 0x42, 0x00]);
    expect(H265.ToAnnexB(data)).toBeUndefined();
  });

  it("ToAnnexB returns undefined when length-prefixed payload has no complete NAL units", () => {
    expect(H265.ToAnnexB(new Uint8Array([0x00, 0x00, 0x00]))).toBeUndefined();
  });
});

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { H265 } from "./H265";
import { H265NaluType, H265SliceType } from "./types";

function lengthPrefixedNalu(naluType: number, payload: number[] = [0x01]): number[] {
  const naluHeader = (naluType << 1) | 1;
  const naluLength = payload.length + 2;
  return [
    (naluLength >>> 24) & 0xff,
    (naluLength >>> 16) & 0xff,
    (naluLength >>> 8) & 0xff,
    naluLength & 0xff,
    naluHeader,
    0x01,
    ...payload,
  ];
}

function annexBNalu(naluType: number, payload: number[] = [0x01]): number[] {
  const naluHeader = (naluType << 1) | 1;
  return [0x00, 0x00, 0x00, 0x01, naluHeader, 0x01, ...payload];
}

function frameData(nalus: number[][]): Uint8Array {
  return new Uint8Array(nalus.flat());
}

function slicePayload(naluType: number, sliceType: H265SliceType): number[] {
  if (naluType >= H265NaluType.BLA_W_LP && naluType <= H265NaluType.RSV_IRAP_VCL23) {
    return [sliceType === H265SliceType.B ? 0xb0 : sliceType === H265SliceType.P ? 0xa8 : 0xac];
  }
  return [sliceType === H265SliceType.B ? 0xe0 : sliceType === H265SliceType.P ? 0xd0 : 0xd8];
}

function slice(naluType: number, sliceType: H265SliceType): number[] {
  return annexBNalu(naluType, slicePayload(naluType, sliceType));
}

function keyframeWithParameterSets(): Uint8Array {
  return frameData([
    annexBNalu(H265NaluType.VPS_NUT),
    annexBNalu(H265NaluType.SPS_NUT),
    annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
    slice(H265NaluType.IDR_W_RADL, H265SliceType.I),
  ]);
}

function keyframeOnly(sliceType = H265SliceType.I): Uint8Array {
  return frameData([slice(H265NaluType.IDR_W_RADL, sliceType)]);
}

function deltaFrame(sliceType = H265SliceType.P): Uint8Array {
  return frameData([slice(1, sliceType)]);
}

function deltaFrameWithPps(sliceType = H265SliceType.P): Uint8Array {
  return frameData([annexBNalu(H265NaluType.PPS_NUT, [0xc0]), slice(1, sliceType)]);
}

describe("H265", () => {
  it("should detect IRAP I slices as keyframes", () => {
    expect(H265.IsKeyframe(keyframeWithParameterSets())).toBe(true);
  });

  it("should normalize length-prefixed frames to Annex B", () => {
    const frame = frameData([
      lengthPrefixedNalu(H265NaluType.IDR_W_RADL, []),
      lengthPrefixedNalu(1, []),
    ]);

    expect(H265.ToAnnexB(frame)).toEqual(
      frameData([annexBNalu(H265NaluType.IDR_W_RADL, []), annexBNalu(1, [])]),
    );
  });

  it("should return a generic decoder config for supported h265 frames", () => {
    const frame = frameData([slice(1, H265SliceType.P)]);

    expect(H265.ParseDecoderConfig(frame)).toEqual({ codec: "hvc1.1.6.L93.B0" });
  });

  it("should extract parameter sets without including the next start code", () => {
    const frame = frameData([
      annexBNalu(H265NaluType.VPS_NUT, []),
      annexBNalu(H265NaluType.IDR_W_RADL, []),
    ]);

    const frameInfo = H265.InspectFrame(frame);
    expect(frameInfo.parameterSets).toEqual(new Uint8Array(annexBNalu(H265NaluType.VPS_NUT, [])));
    expect(frameInfo.hasParameterSets).toBe(true);
    expect(frameInfo.hasRequiredParameterSets).toBe(false);
  });

  it("should strip parameter sets", () => {
    const frame = frameData([
      annexBNalu(H265NaluType.VPS_NUT),
      annexBNalu(H265NaluType.SPS_NUT),
      annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      slice(1, H265SliceType.P),
    ]);

    expect(H265.StripParameterSets(frame)).toEqual(new Uint8Array(slice(1, H265SliceType.P)));
  });

  it("should detect complete VPS SPS PPS parameter sets", () => {
    const parameterSets = [
      annexBNalu(H265NaluType.VPS_NUT),
      annexBNalu(H265NaluType.SPS_NUT, [0x02]),
      annexBNalu(H265NaluType.PPS_NUT, [0x03]),
    ];
    const frame = frameData([...parameterSets, annexBNalu(H265NaluType.IDR_W_RADL, [0x04])]);

    const frameInfo = H265.InspectFrame(frame);
    expect(frameInfo.hasParameterSets).toBe(true);
    expect(frameInfo.hasRequiredParameterSets).toBe(true);
    expect(frameInfo.parameterSets).toEqual(frameData(parameterSets));
  });

  it("should detect I, P, and B slice types from slice headers", () => {
    expect(H265.InspectFrame(keyframeWithParameterSets()).frameType).toBe("I");
    expect(H265.InspectFrame(deltaFrameWithPps(H265SliceType.P)).frameType).toBe("P");
    expect(H265.InspectFrame(deltaFrameWithPps(H265SliceType.B)).frameType).toBe("B");
  });

  it("should mark IRAP P slices as keyframes", () => {
    const frameInfo = H265.InspectFrame(
      frameData([
        annexBNalu(H265NaluType.VPS_NUT),
        annexBNalu(H265NaluType.SPS_NUT),
        annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
        slice(H265NaluType.IDR_W_RADL, H265SliceType.P),
      ]),
    );

    expect(frameInfo.frameType).toBe("P");
    expect(frameInfo.isKeyframe).toBe(true);
    expect(frameInfo.isRandomAccess).toBe(true);
  });

  it("should use cached parameter sets to parse slice types", () => {
    const frameInfo = H265.InspectFrame(deltaFrame(H265SliceType.P), {
      parameterSets: frameData([annexBNalu(H265NaluType.PPS_NUT, [0xc0])]),
    });

    expect(frameInfo.frameType).toBe("P");
    expect(frameInfo.hasUnparsedVclSlice).toBe(false);
  });

  it("should mark IRAP frames as keyframes even when PPS is missing", () => {
    const frameInfo = H265.InspectFrame(keyframeOnly(H265SliceType.I));

    expect(frameInfo.frameType).toBe("unknown");
    expect(frameInfo.hasUnparsedVclSlice).toBe(true);
    expect(frameInfo.isKeyframe).toBe(true);
  });

  it("should return undefined for unsupported h265 bitstreams", () => {
    expect(H265.ParseDecoderConfig(new Uint8Array([0x01, 0x02, 0x03]))).toBeUndefined();
  });
});

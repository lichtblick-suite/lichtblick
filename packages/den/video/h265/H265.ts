// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DEFAULT_HEVC_CODEC, H265_RANDOM_ACCESS_TYPES } from "./constants";
import {
  H265FrameInfo,
  H265FrameType,
  H265NaluType,
  H265ParserContext,
  H265SliceType,
} from "./types";
import { Bitstream } from "../Bitstream";
import { findNextStartCode } from "../utils";

type H265PpsInfo = {
  ppsId: number;
  spsId: number;
  dependentSliceSegmentsEnabledFlag: boolean;
  outputFlagPresentFlag: boolean;
  numExtraSliceHeaderBits: number;
};

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class H265 {
  public static AnnexBBoxSize(data: Uint8Array): number | undefined {
    if (data.length < 4) {
      return undefined;
    }

    if (data[0] === 0 && data[1] === 0) {
      if (data[2] === 1) {
        return 3;
      }
      if (data[2] === 0 && data[3] === 1) {
        return 4;
      }
    }

    return undefined;
  }

  public static IsKeyframe(data: Uint8Array): boolean {
    const annexBData = H265.ToAnnexB(data);
    if (annexBData == undefined) {
      return false;
    }

    for (const nalu of H265.Nalus(annexBData)) {
      if (H265_RANDOM_ACCESS_TYPES.has(nalu.type)) {
        return true;
      }
    }
    return false;
  }

  public static ParseDecoderConfig(data: Uint8Array): VideoDecoderConfig | undefined {
    return H265.ToAnnexB(data) != undefined ? { codec: DEFAULT_HEVC_CODEC } : undefined;
  }

  public static InspectFrame(data: Uint8Array, context?: H265ParserContext): H265FrameInfo {
    const annexBData = H265.ToAnnexB(data);
    if (annexBData == undefined) {
      return {
        bitstreamFormat: "unknown",
        isKeyframe: false,
        isRandomAccess: false,
        frameType: "unknown",
        sliceTypes: [],
        hasUnparsedVclSlice: false,
        hasParameterSets: false,
        hasRequiredParameterSets: false,
      };
    }

    const ppsById = H265.ParsePpsMap(context?.parameterSets);
    const parameterSetParts: number[] = [];
    const sliceTypes: H265SliceType[] = [];
    let hasRandomAccessNaluType = false;
    let hasUnparsedVclSlice = false;
    let hasVps = false;
    let hasSps = false;
    let hasPps = false;

    for (const nalu of H265.Nalus(annexBData)) {
      if (H265_RANDOM_ACCESS_TYPES.has(nalu.type)) {
        hasRandomAccessNaluType = true;
      }
      if (
        nalu.type === H265NaluType.VPS_NUT ||
        nalu.type === H265NaluType.SPS_NUT ||
        nalu.type === H265NaluType.PPS_NUT
      ) {
        hasVps ||= nalu.type === H265NaluType.VPS_NUT;
        hasSps ||= nalu.type === H265NaluType.SPS_NUT;
        hasPps ||= nalu.type === H265NaluType.PPS_NUT;
        for (let index = nalu.startCodeStart; index < nalu.end; index++) {
          parameterSetParts.push(annexBData[index]!);
        }
        if (nalu.type === H265NaluType.PPS_NUT) {
          const pps = H265.ParsePps(nalu.data);
          if (pps != undefined) {
            ppsById.set(pps.ppsId, pps);
          }
        }
      }
    }

    for (const nalu of H265.Nalus(annexBData)) {
      if (!H265.IsVclNaluType(nalu.type)) {
        continue;
      }
      const sliceType = H265.ParseSliceType(nalu.data, nalu.type, ppsById);
      if (sliceType == undefined) {
        hasUnparsedVclSlice = true;
        continue;
      }
      sliceTypes.push(sliceType);
    }

    const frameType = H265.FrameType(sliceTypes);
    const isRandomAccess = hasRandomAccessNaluType;
    const hasParameterSets = parameterSetParts.length > 0;
    const hasRequiredParameterSets = hasVps && hasSps && hasPps;
    const annexBBoxSize = H265.AnnexBBoxSize(data);

    return {
      bitstreamFormat: annexBBoxSize != undefined ? "annex-b" : "length-prefixed",
      isKeyframe: isRandomAccess,
      isRandomAccess,
      frameType,
      sliceTypes,
      hasUnparsedVclSlice,
      normalizedData: annexBData,
      parameterSets: hasParameterSets ? new Uint8Array(parameterSetParts) : undefined,
      hasParameterSets,
      hasRequiredParameterSets,
    };
  }

  public static ToAnnexB(data: Uint8Array): Uint8Array | undefined {
    if (H265.AnnexBBoxSize(data) != undefined) {
      return data;
    }

    return H265.LengthPrefixedToAnnexB(data);
  }

  public static StripParameterSets(data: Uint8Array): Uint8Array | undefined {
    const annexBData = H265.ToAnnexB(data);
    if (annexBData == undefined) {
      return undefined;
    }

    const parts: number[] = [];
    for (const nalu of H265.Nalus(annexBData)) {
      if (
        nalu.type === H265NaluType.VPS_NUT ||
        nalu.type === H265NaluType.SPS_NUT ||
        nalu.type === H265NaluType.PPS_NUT
      ) {
        continue;
      }
      for (let index = nalu.startCodeStart; index < nalu.end; index++) {
        parts.push(annexBData[index]!);
      }
    }

    return parts.length > 0 ? new Uint8Array(parts) : undefined;
  }

  public static FindNextStartCode(data: Uint8Array, start: number): number {
    return findNextStartCode(data, start);
  }

  public static FindNextStartCodeEnd(data: Uint8Array, start: number): number {
    const nextStartCode = H265.FindNextStartCode(data, start);
    return nextStartCode === data.length
      ? data.length
      : nextStartCode + (H265.AnnexBBoxSize(data.subarray(nextStartCode)) ?? 0);
  }

  private static *Nalus(data: Uint8Array): Generator<{
    type: number;
    data: Uint8Array;
    startCodeStart: number;
    start: number;
    end: number;
  }> {
    let startCodeStart = H265.FindNextStartCode(data, 0);
    while (startCodeStart !== data.length) {
      const startCodeLength = H265.AnnexBBoxSize(data.subarray(startCodeStart)) ?? 0;
      const start = startCodeStart + startCodeLength;
      const nextStartCode = H265.FindNextStartCode(data, start + 1);
      if (start + 2 <= nextStartCode) {
        yield {
          type: (data[start]! >> 1) & 0x3f,
          data: data.subarray(start, nextStartCode),
          startCodeStart,
          start,
          end: nextStartCode,
        };
      }
      startCodeStart = nextStartCode;
    }
  }

  private static ParsePpsMap(data: Uint8Array | undefined): Map<number, H265PpsInfo> {
    const ppsById = new Map<number, H265PpsInfo>();
    if (data == undefined) {
      return ppsById;
    }
    const annexBData = H265.ToAnnexB(data);
    if (annexBData == undefined) {
      return ppsById;
    }
    for (const nalu of H265.Nalus(annexBData)) {
      if (nalu.type !== H265NaluType.PPS_NUT) {
        continue;
      }
      const pps = H265.ParsePps(nalu.data);
      if (pps != undefined) {
        ppsById.set(pps.ppsId, pps);
      }
    }
    return ppsById;
  }

  private static ParsePps(nalu: Uint8Array): H265PpsInfo | undefined {
    if (nalu.length < 3) {
      return undefined;
    }
    try {
      const bitstream = new Bitstream(nalu.subarray(2));
      const ppsId = bitstream.ue_v();
      const spsId = bitstream.ue_v();
      const dependentSliceSegmentsEnabledFlag = bitstream.u_1() === 1;
      const outputFlagPresentFlag = bitstream.u_1() === 1;
      const numExtraSliceHeaderBits = bitstream.u(3);
      return {
        ppsId,
        spsId,
        dependentSliceSegmentsEnabledFlag,
        outputFlagPresentFlag,
        numExtraSliceHeaderBits,
      };
    } catch {
      return undefined;
    }
  }

  private static ParseSliceType(
    nalu: Uint8Array,
    naluType: number,
    ppsById: Map<number, H265PpsInfo>,
  ): H265SliceType | undefined {
    if (nalu.length < 3) {
      return undefined;
    }
    try {
      const bitstream = new Bitstream(nalu.subarray(2));
      const firstSliceSegmentInPicFlag = bitstream.u_1();
      if (H265_RANDOM_ACCESS_TYPES.has(naluType)) {
        bitstream.u_1();
      }
      const ppsId = bitstream.ue_v();
      const pps = ppsById.get(ppsId);
      if (pps == undefined) {
        return undefined;
      }
      if (firstSliceSegmentInPicFlag === 0) {
        return undefined;
      }
      if (pps.outputFlagPresentFlag) {
        bitstream.u_1();
      }
      for (let i = 0; i < pps.numExtraSliceHeaderBits; i++) {
        bitstream.u_1();
      }
      const sliceType = bitstream.ue_v();
      if (
        sliceType !== H265SliceType.B &&
        sliceType !== H265SliceType.P &&
        sliceType !== H265SliceType.I
      ) {
        return undefined;
      }
      return sliceType;
    } catch {
      return undefined;
    }
  }

  private static FrameType(sliceTypes: H265SliceType[]): H265FrameType {
    if (sliceTypes.length === 0) {
      return "unknown";
    }
    if (sliceTypes.every((sliceType) => sliceType === H265SliceType.I)) {
      return "I";
    }
    if (sliceTypes.some((sliceType) => sliceType === H265SliceType.B)) {
      return "B";
    }
    if (sliceTypes.some((sliceType) => sliceType === H265SliceType.P)) {
      return "P";
    }
    return "unknown";
  }

  private static IsVclNaluType(naluType: number): boolean {
    return naluType >= 0 && naluType <= 31;
  }

  private static LengthPrefixedToAnnexB(data: Uint8Array): Uint8Array | undefined {
    if (data.length < 6) {
      return undefined;
    }

    const result = new Uint8Array(data.length);
    let offset = 0;
    let writeOffset = 0;
    let foundNalu = false;

    while (offset + 4 <= data.length) {
      const naluLength =
        (((data[offset]! << 24) >>> 0) |
          (data[offset + 1]! << 16) |
          (data[offset + 2]! << 8) |
          data[offset + 3]!) >>>
        0;
      offset += 4;

      if (naluLength <= 0 || offset + naluLength > data.length) {
        return undefined;
      }

      result[writeOffset++] = 0;
      result[writeOffset++] = 0;
      result[writeOffset++] = 0;
      result[writeOffset++] = 1;
      result.set(data.subarray(offset, offset + naluLength), writeOffset);
      writeOffset += naluLength;

      offset += naluLength;
      foundNalu = true;
    }

    if (!foundNalu || offset !== data.length) {
      return undefined;
    }

    return result;
  }
}

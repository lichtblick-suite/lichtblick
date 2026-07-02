// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SPS } from "./SPS";
import { DEFAULT_HEVC_CODEC, H265_RANDOM_ACCESS_TYPES } from "./constants";
import {
  H265FrameInfo,
  H265FrameType,
  H265NaluType,
  H265ParserContext,
  H265SliceType,
} from "./types";
import { Bitstream } from "../Bitstream";
import { findNextStartCode, findNextStartCodeEnd } from "../utils";

type H265PpsInfo = {
  ppsId: number;
  spsId: number;
  dependentSliceSegmentsEnabledFlag: boolean;
  outputFlagPresentFlag: boolean;
  numExtraSliceHeaderBits: number;
};

type ByteRange = { start: number; end: number };

type InspectFrameState = {
  ppsById: Map<number, H265PpsInfo>;
  parameterSetRanges: ByteRange[];
  parameterSetSize: number;
  keptRanges: ByteRange[];
  keptSize: number;
  sliceTypes: H265SliceType[];
  hasRandomAccessNaluType: boolean;
  hasUnparsedVclSlice: boolean;
  hasVps: boolean;
  hasSps: boolean;
  hasPps: boolean;
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
    const annexBData = H265.ToAnnexB(data);
    if (annexBData == undefined) {
      return undefined;
    }

    // Search for an SPS NAL unit to derive the codec string and coded dimensions. If it is absent
    // or cannot be parsed, fall back to the generic HEVC codec string (no dimensions).
    const spsData = H265.GetFirstNaluOfType(annexBData, H265NaluType.SPS_NUT);
    return buildDecoderConfig(spsData);
  }

  private static GetFirstNaluOfType(
    annexBData: Uint8Array,
    naluType: number,
  ): Uint8Array | undefined {
    for (const nalu of H265.Nalus(annexBData)) {
      if (nalu.type === naluType) {
        return nalu.data;
      }
    }
    return undefined;
  }

  public static InspectFrame(data: Uint8Array, context?: H265ParserContext): H265FrameInfo {
    const annexBData = H265.ToAnnexB(data);
    if (annexBData == undefined) {
      return {
        bitstreamFormat: "unknown",
        isKeyframe: false,
        frameType: "unknown",
        sliceTypes: [],
        hasUnparsedVclSlice: false,
        hasRequiredParameterSets: false,
      };
    }

    const state: InspectFrameState = {
      ppsById: H265.ParsePpsMap(context?.parameterSets),
      parameterSetRanges: [],
      parameterSetSize: 0,
      keptRanges: [],
      keptSize: 0,
      sliceTypes: [],
      hasRandomAccessNaluType: false,
      hasUnparsedVclSlice: false,
      hasVps: false,
      hasSps: false,
      hasPps: false,
    };

    for (const nalu of H265.Nalus(annexBData)) {
      H265.InspectNalu(nalu, state);
    }

    const annexBBoxSize = H265.AnnexBBoxSize(data);
    const isKeyframe = state.hasRandomAccessNaluType;

    // Only materialize a stripped buffer when parameter sets are actually present (rare for delta
    // frames). When nothing is stripped, leave `strippedData` undefined so callers reuse
    // `normalizedData` without an extra per-frame allocation/copy.
    const strippedData =
      state.parameterSetSize > 0 && state.keptSize > 0
        ? H265.AssembleRanges(annexBData, state.keptRanges, state.keptSize)
        : undefined;

    return {
      bitstreamFormat: annexBBoxSize == undefined ? "length-prefixed" : "annex-b",
      isKeyframe,
      frameType: H265.FrameType(state.sliceTypes),
      sliceTypes: state.sliceTypes,
      hasUnparsedVclSlice: state.hasUnparsedVclSlice,
      normalizedData: annexBData,
      strippedData,
      parameterSets:
        state.parameterSetSize > 0
          ? H265.AssembleRanges(annexBData, state.parameterSetRanges, state.parameterSetSize)
          : undefined,
      hasRequiredParameterSets: state.hasVps && state.hasSps && state.hasPps,
    };
  }

  private static InspectNalu(
    nalu: { type: number; data: Uint8Array; startCodeStart: number; end: number },
    state: InspectFrameState,
  ): void {
    if (H265_RANDOM_ACCESS_TYPES.has(nalu.type)) {
      state.hasRandomAccessNaluType = true;
    }

    const rangeSize = nalu.end - nalu.startCodeStart;

    if (H265.IsParameterSetNaluType(nalu.type)) {
      state.hasVps ||= nalu.type === H265NaluType.VPS_NUT;
      state.hasSps ||= nalu.type === H265NaluType.SPS_NUT;
      state.hasPps ||= nalu.type === H265NaluType.PPS_NUT;
      state.parameterSetRanges.push({ start: nalu.startCodeStart, end: nalu.end });
      state.parameterSetSize += rangeSize;
      if (nalu.type === H265NaluType.PPS_NUT) {
        const pps = H265.ParsePps(nalu.data);
        if (pps != undefined) {
          state.ppsById.set(pps.ppsId, pps);
        }
      }
      return;
    }

    state.keptRanges.push({ start: nalu.startCodeStart, end: nalu.end });
    state.keptSize += rangeSize;

    if (H265.IsVclNaluType(nalu.type)) {
      const sliceType = H265.ParseSliceType(nalu.data, nalu.type, state.ppsById);
      if (sliceType == undefined) {
        state.hasUnparsedVclSlice = true;
      } else {
        state.sliceTypes.push(sliceType);
      }
    }
  }

  private static IsParameterSetNaluType(naluType: number): boolean {
    return (
      naluType === H265NaluType.VPS_NUT ||
      naluType === H265NaluType.SPS_NUT ||
      naluType === H265NaluType.PPS_NUT
    );
  }

  public static ToAnnexB(data: Uint8Array): Uint8Array | undefined {
    if (H265.AnnexBBoxSize(data) != undefined) {
      return data;
    }

    return H265.LengthPrefixedToAnnexB(data);
  }

  private static AssembleRanges(
    data: Uint8Array,
    ranges: ReadonlyArray<{ start: number; end: number }>,
    size: number,
  ): Uint8Array {
    const out = new Uint8Array(size);
    let offset = 0;
    for (const { start, end } of ranges) {
      out.set(data.subarray(start, end), offset);
      offset += end - start;
    }
    return out;
  }

  private static *Nalus(data: Uint8Array): Generator<{
    type: number;
    data: Uint8Array;
    startCodeStart: number;
    start: number;
    end: number;
  }> {
    let startCodeStart = findNextStartCode(data, 0);
    while (startCodeStart !== data.length) {
      // `start` is the index of the first byte of the NALU header (immediately after the start
      // code). The H.265 NALU header is 2 bytes per ISO/IEC 23008-2 §7.3.1.2, so a NALU with a
      // body needs at least `start + 2` bytes before the next start code. The high bit of byte 0
      // is `forbidden_zero_bit`; the next 6 bits are `nal_unit_type`, hence `(headerByte >> 1) &
      // 0x3F` extracts the NALU type.
      const start = findNextStartCodeEnd(data, startCodeStart);
      const nextStartCode = findNextStartCode(data, start + 1);
      const headerByte = data[start];
      if (start + 2 <= nextStartCode && headerByte != undefined) {
        yield {
          type: (headerByte >> 1) & 0x3f,
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
    if (sliceTypes.includes(H265SliceType.B)) {
      return "B";
    }
    if (sliceTypes.includes(H265SliceType.P)) {
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
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;
    let writeOffset = 0;
    let foundNalu = false;

    while (offset + 4 <= data.length) {
      const naluLength = view.getUint32(offset);
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

function buildDecoderConfig(spsData: Uint8Array | undefined): VideoDecoderConfig {
  if (spsData == undefined) {
    return { codec: DEFAULT_HEVC_CODEC };
  }

  try {
    const sps = new SPS(spsData);
    return {
      codec: sps.MIME(),
      codedWidth: sps.picWidth,
      codedHeight: sps.picHeight,
    };
  } catch {
    return { codec: DEFAULT_HEVC_CODEC };
  }
}

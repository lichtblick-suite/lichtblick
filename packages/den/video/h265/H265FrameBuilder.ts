// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265NaluType, H265SliceType } from "./types";

/**
 * Synthesizes minimal H.265 NAL units, slice payloads, and full-frame byte sequences for use in
 * unit tests. The output is small enough to be inspected by hand but exercises the same parser
 * paths the production decoder follows for real recordings.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class H265FrameBuilder {
  private static slicePayload(naluType: number, sliceType: H265SliceType): number[] {
    if (naluType >= H265NaluType.BLA_W_LP && naluType <= H265NaluType.RSV_IRAP_VCL23) {
      return [sliceType === H265SliceType.B ? 0xb0 : sliceType === H265SliceType.P ? 0xa8 : 0xac];
    }
    return [sliceType === H265SliceType.B ? 0xe0 : sliceType === H265SliceType.P ? 0xd0 : 0xd8];
  }

  public static lengthPrefixedNalu(naluType: number, payload: number[] = [0x01]): number[] {
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

  public static annexBNalu(naluType: number, payload: number[] = [0x01]): number[] {
    const naluHeader = (naluType << 1) | 1;
    return [0x00, 0x00, 0x00, 0x01, naluHeader, 0x01, ...payload];
  }

  public static frameData(nalus: number[][]): Uint8Array {
    return new Uint8Array(nalus.flat());
  }

  public static slice(naluType: number, sliceType: H265SliceType): number[] {
    return H265FrameBuilder.annexBNalu(
      naluType,
      H265FrameBuilder.slicePayload(naluType, sliceType),
    );
  }

  public static keyframeWithParameterSets(): Uint8Array {
    return H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      H265FrameBuilder.slice(H265NaluType.IDR_W_RADL, H265SliceType.I),
    ]);
  }

  public static lengthPrefixedKeyframeWithParameterSets(): Uint8Array {
    return H265FrameBuilder.frameData([
      H265FrameBuilder.lengthPrefixedNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.lengthPrefixedNalu(H265NaluType.SPS_NUT),
      H265FrameBuilder.lengthPrefixedNalu(H265NaluType.PPS_NUT, [0xc0]),
      H265FrameBuilder.lengthPrefixedNalu(H265NaluType.IDR_W_RADL, [0xac]),
    ]);
  }

  public static keyframeOnly(sliceType = H265SliceType.I): Uint8Array {
    return H265FrameBuilder.frameData([H265FrameBuilder.slice(H265NaluType.IDR_W_RADL, sliceType)]);
  }

  public static deltaFrame(sliceType = H265SliceType.P): Uint8Array {
    return H265FrameBuilder.frameData([H265FrameBuilder.slice(1, sliceType)]);
  }

  public static deltaFrameWithPps(sliceType = H265SliceType.P): Uint8Array {
    return H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      H265FrameBuilder.slice(1, sliceType),
    ]);
  }
}

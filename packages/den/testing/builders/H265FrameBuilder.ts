// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265NaluType, H265SliceType } from "../../video/h265/types";

/**
 * Synthesizes minimal H.265 NAL units, slice payloads, and full-frame byte sequences for use in
 * unit tests. The output is small enough to be inspected by hand but exercises the same parser
 * paths the production decoder follows for real recordings.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class H265FrameBuilder {
  private static slicePayload(naluType: number, sliceType: H265SliceType): number[] {
    if (naluType >= H265NaluType.BLA_W_LP && naluType <= H265NaluType.RSV_IRAP_VCL23) {
      return [H265FrameBuilder.irapSliceFirstByte(sliceType)];
    }
    return [H265FrameBuilder.nonIrapSliceFirstByte(sliceType)];
  }

  /**
   * Returns the first byte of an IRAP slice header (slice_segment_header), encoded
   * such that {@link H265.InspectFrame} extracts the requested slice_type via
   * `bitstream.ue_v()` after stepping past `first_slice_segment_in_pic_flag = 1`
   * and the IRAP-only `no_output_of_prior_pics_flag` bit.
   *
   * The bit layout consumed by the parser is:
   *   1 (first_slice_segment_in_pic_flag)
   * + 1 (no_output_of_prior_pics_flag, IRAP only)
   * + ue_v(slice_pic_parameter_set_id)
   * + ue_v(slice_type)
   *
   * With `slice_pic_parameter_set_id = 0` (encoded as a single 1 bit) and the
   * Exp-Golomb encodings: I = 2 → "011", P = 1 → "010", B = 0 → "1", the resulting
   * bytes are 0xAC (I), 0xA8 (P), 0xB0 (B). Trailing zero bits are RBSP padding.
   */
  private static irapSliceFirstByte(sliceType: H265SliceType): number {
    if (sliceType === H265SliceType.B) {
      return 0xb0;
    }
    if (sliceType === H265SliceType.P) {
      return 0xa8;
    }
    return 0xac;
  }

  /**
   * Non-IRAP variant of {@link irapSliceFirstByte}. The bit layout is the same minus the IRAP-only
   * `no_output_of_prior_pics_flag`, so each value is shifted one bit left compared with the IRAP
   * encoding: 0xD8 (I), 0xD0 (P), 0xE0 (B).
   */
  private static nonIrapSliceFirstByte(sliceType: H265SliceType): number {
    if (sliceType === H265SliceType.B) {
      return 0xe0;
    }
    if (sliceType === H265SliceType.P) {
      return 0xd0;
    }
    return 0xd8;
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

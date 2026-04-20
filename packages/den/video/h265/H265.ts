// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum H265NaluType {
  BLA_W_LP = 16,
  BLA_W_RADL = 17,
  BLA_N_LP = 18,
  IDR_W_RADL = 19,
  IDR_N_LP = 20,
  CRA_NUT = 21,
  VPS_NUT = 32,
  SPS_NUT = 33,
  PPS_NUT = 34,
}

const H265_KEYFRAME_TYPES = new Set<number>([
  H265NaluType.BLA_W_LP,
  H265NaluType.BLA_W_RADL,
  H265NaluType.BLA_N_LP,
  H265NaluType.IDR_W_RADL,
  H265NaluType.IDR_N_LP,
  H265NaluType.CRA_NUT,
]);

const DEFAULT_HEVC_CODEC = "hev1.1.6.L153.B0";

type H265BitstreamFormat = "annex-b" | "length-prefixed" | "unknown";

export type H265FrameInfo = {
  bitstreamFormat: H265BitstreamFormat;
  hasParameterSet: boolean;
  isKeyframe: boolean;
  normalizedData?: Uint8Array;
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
      } else if (data[2] === 0 && data[3] === 1) {
        return 4;
      }
    }

    return undefined;
  }

  public static IsKeyframe(data: Uint8Array): boolean {
    return H265.InspectFrame(data).isKeyframe;
  }

  public static ParseDecoderConfig(data: Uint8Array): VideoDecoderConfig | undefined {
    const info = H265.InspectFrame(data);
    if (!info.hasParameterSet) {
      return undefined;
    }

    // HEVC Annex B streams can be configured without description bytes if the
    // keyframe contains VPS/SPS/PPS. We use a broadly supported Main-profile
    // codec string here so browsers with HEVC-capable WebCodecs can initialize.
    return { codec: DEFAULT_HEVC_CODEC };
  }

  public static InspectFrame(data: Uint8Array): H265FrameInfo {
    const annexBData = H265.ToAnnexB(data);
    if (annexBData == undefined) {
      return {
        bitstreamFormat: "unknown",
        hasParameterSet: false,
        isKeyframe: false,
      };
    }

    let hasParameterSet = false;
    let isKeyframe = false;
    const boxSize = H265.AnnexBBoxSize(annexBData)!;
    let i = boxSize;
    while (i < annexBData.length) {
      const naluType = (annexBData[i]! >> 1) & 0x3f;
      if (
        naluType === H265NaluType.VPS_NUT ||
        naluType === H265NaluType.SPS_NUT ||
        naluType === H265NaluType.PPS_NUT
      ) {
        hasParameterSet = true;
      }
      if (H265_KEYFRAME_TYPES.has(naluType)) {
        isKeyframe = true;
      }

      i = H265.FindNextStartCodeEnd(annexBData, i + 1);
    }

    return {
      bitstreamFormat: H265.AnnexBBoxSize(data) != undefined ? "annex-b" : "length-prefixed",
      hasParameterSet,
      isKeyframe,
      normalizedData: annexBData,
    };
  }

  public static ToAnnexB(data: Uint8Array): Uint8Array | undefined {
    if (H265.AnnexBBoxSize(data) != undefined) {
      return data;
    }

    return H265.LengthPrefixedToAnnexB(data);
  }

  public static FindNextStartCodeEnd(data: Uint8Array, start: number): number {
    let i = start;
    while (i < data.length - 3) {
      const isStartCode3Bytes = data[i + 0] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
      if (isStartCode3Bytes) {
        return i + 3;
      }
      const isStartCode4Bytes =
        i + 3 < data.length &&
        data[i + 0] === 0 &&
        data[i + 1] === 0 &&
        data[i + 2] === 0 &&
        data[i + 3] === 1;
      if (isStartCode4Bytes) {
        return i + 4;
      }
      i++;
    }
    return data.length;
  }

  private static LengthPrefixedToAnnexB(data: Uint8Array): Uint8Array | undefined {
    if (data.length < 6) {
      return undefined;
    }

    const converted: number[] = [];
    let offset = 0;
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

      const naluHeader = data[offset]!;
      const naluType = (naluHeader >> 1) & 0x3f;
      if (naluType > 63) {
        return undefined;
      }

      converted.push(0, 0, 0, 1);
      for (let i = 0; i < naluLength; i++) {
        converted.push(data[offset + i]!);
      }
      offset += naluLength;
      foundNalu = true;
    }

    if (!foundNalu || offset !== data.length) {
      return undefined;
    }

    return new Uint8Array(converted);
  }
}

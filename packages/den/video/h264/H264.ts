// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SPS as SPSNALU } from "./SPS";

export enum H264NaluType {
  NDR = 1,
  IDR = 5,
  SEI = 6,
  SPS = 7,
  PPS = 8,
  AUD = 9,
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class H264 {
  public static IsAnnexB(data: Uint8Array): boolean {
    return H264.AnnexBBoxSize(data) != undefined;
  }

  public static AnnexBBoxSize(data: Uint8Array): number | undefined {
    // Annex B is a byte stream format where each NALU is prefixed with a start code, typically
    // 0x000001 or 0x00000001. The type of the NALU is determined by the 5 least significant bits of
    // the byte that follows the start code.
    //
    // AVCC is a length-prefixed format, where each NALU is prefixed by its length (typically 4
    // bytes). The type of the NALU is determined by the 5 least significant bits of the first byte
    // of the NALU itself.

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
    // Determine what type of encoding is used
    const boxSize = H264.AnnexBBoxSize(data);
    if (boxSize == undefined) {
      return false;
    }

    // Iterate over the NAL units in the H264 Annex B frame, looking for NaluTypes.IDR
    let i = boxSize;
    while (i < data.length) {
      // Annex B NALU type is the 5 least significant bits of the first byte following the start
      // code
      const naluType = data[i]! & 0x1f;
      if (naluType === H264NaluType.IDR) {
        return true;
      }

      // Scan for another start code, signifying the beginning of the next NAL unit
      i = H264.FindNextStartCodeEnd(data, i + 1);
    }

    return false;
  }

  public static GetFirstNALUOfType(
    data: Uint8Array,
    naluType: H264NaluType,
  ): Uint8Array | undefined {
    // Determine what type of encoding is used
    const boxSize = H264.AnnexBBoxSize(data);
    if (boxSize == undefined) {
      return undefined;
    }

    // Iterate over the NAL units in the H264 Annex B frame, looking for the requested naluType
    let i = boxSize;
    while (i < data.length) {
      // Annex B NALU type is the 5 least significant bits of the first byte following the start
      // code
      const curNaluType = data[i]! & 0x1f;
      if (curNaluType === naluType) {
        // Find the end of this NALU
        const end = H264.FindNextStartCode(data, i + 1);

        // Return the NALU
        return data.subarray(i, end);
      }

      // Scan for another start code, signifying the beginning of the next NAL unit
      i = H264.FindNextStartCodeEnd(data, i + 1);
    }

    return undefined;
  }

  public static ParseDecoderConfig(data: Uint8Array): VideoDecoderConfig | undefined {
    // Find the first SPS NALU and extrat MIME, picHeight, and picWidth fields
    const spsData = H264.GetFirstNALUOfType(data, H264NaluType.SPS);
    if (spsData == undefined) {
      return undefined;
    }

    // Extract the SPS fields
    const sps = new SPSNALU(spsData);
    if (sps.nal_unit_type !== H264NaluType.SPS) {
      return undefined;
    }

    const config: VideoDecoderConfig = {
      codec: sps.MIME(),
      codedWidth: sps.picWidth,
      codedHeight: sps.picHeight,
    };

    // If the aspect ratio is specified, use it to calculate the display aspect ratio
    const aspectWidth = sps.sar_width ?? 0;
    const aspectHeight = sps.sar_height ?? 0;
    if (aspectWidth > 1 || aspectHeight > 1) {
      // The Sample Aspect Ratio (SAR) is the ratio of the width to the height of an individual
      // pixel. Display Aspect Ratio (DAR) is the ratio of the width to the height of the video as
      // it should be displayed
      config.displayAspectWidth = Math.round(sps.picWidth * (aspectWidth / aspectHeight));
      config.displayAspectHeight = sps.picHeight;
    }

    return config;
  }

  /**
   * Find the index of the next start code (0x000001 or 0x00000001) in the
   * given buffer, starting at the given offset.
   */
  public static FindNextStartCode(data: Uint8Array, start: number): number {
    let i = start;
    while (i < data.length - 3) {
      const isStartCode3Bytes = data[i + 0] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
      if (isStartCode3Bytes) {
        return i;
      }
      const isStartCode4Bytes =
        i + 3 < data.length &&
        data[i + 0] === 0 &&
        data[i + 1] === 0 &&
        data[i + 2] === 0 &&
        data[i + 3] === 1;
      if (isStartCode4Bytes) {
        return i;
      }
      i++;
    }
    return data.length;
  }

  /**
   * Find the index of the end of the next start code (0x000001 or 0x00000001) in the
   * given buffer, starting at the given offset.
   */
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
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  LEB128_CONTINUATION_FLAG,
  LEB128_PAYLOAD_MASK,
  OBU_EXTENSION_FLAG,
  OBU_HAS_SIZE_FLAG,
  OBU_TYPE_SHIFT,
} from "../../video/av1/constants";
import { AV1FrameType, AV1ObuType } from "../../video/av1/types";

type SequenceHeaderOptions = {
  bitDepth?: 8 | 10 | 12;
  decoderModel?: boolean;
  height?: number;
  initialDisplayDelay?: boolean;
  level?: number;
  operatingPoints?: { level: number; tier?: 0 | 1 }[];
  profile?: 0 | 1 | 2;
  /** Emits `still_picture = 1` and `reduced_still_picture_header = 1`, which omits most fields. */
  reducedStillPicture?: boolean;
  timingInfo?: boolean;
  tier?: 0 | 1;
  width?: number;
};

type FrameOptions = {
  frameType?: AV1FrameType;
  showExistingFrame?: boolean;
  showFrame?: boolean;
};

class BitWriter {
  readonly #bits: number[] = [];

  public write(value: number, width: number): void {
    for (let bit = width - 1; bit >= 0; bit--) {
      this.#bits.push(Math.floor(value / 2 ** bit) & 1);
    }
  }

  public bytes(): number[] {
    const result: number[] = [];
    for (let offset = 0; offset < this.#bits.length; offset += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        byte = (byte << 1) | (this.#bits[offset + bit] ?? 0);
      }
      result.push(byte);
    }
    return result;
  }
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class AV1FrameBuilder {
  public static obu(type: number, payload: number[], extension?: number): number[] {
    const header =
      (type << OBU_TYPE_SHIFT) |
      (extension == undefined ? 0 : OBU_EXTENSION_FLAG) |
      OBU_HAS_SIZE_FLAG;
    return [
      header,
      ...(extension == undefined ? [] : [extension]), // extension should come just after obu_header
      ...encodeLeb128(payload.length),
      ...payload,
    ];
  }

  public static sequenceHeader(options: SequenceHeaderOptions = {}): number[] {
    const {
      bitDepth = 8,
      decoderModel = false,
      height = 480,
      initialDisplayDelay = false,
      level = 5,
      profile = 0,
      reducedStillPicture = false,
      timingInfo = false,
      tier = 0,
      width = 640,
    } = options;
    const operatingPoints = options.operatingPoints ?? [{ level, tier }];
    const bits = new BitWriter();
    bits.write(profile, 3);
    bits.write(reducedStillPicture ? 1 : 0, 1); // still_picture
    bits.write(reducedStillPicture ? 1 : 0, 1); // reduced_still_picture_header
    if (reducedStillPicture) {
      bits.write(level, 5); // seq_level_idx[0]
    } else {
      bits.write(timingInfo ? 1 : 0, 1);
      if (timingInfo) {
        bits.write(1, 32); // num_units_in_display_tick
        bits.write(30, 32); // time_scale
        bits.write(0, 1); // equal_picture_interval
        bits.write(decoderModel ? 1 : 0, 1);
        if (decoderModel) {
          bits.write(3, 5); // buffer_delay_length_minus_1
          bits.write(1, 32); // num_units_in_decoding_tick
          bits.write(3, 5); // buffer_removal_time_length_minus_1
          bits.write(3, 5); // frame_presentation_time_length_minus_1
        }
      }
      bits.write(initialDisplayDelay ? 1 : 0, 1);
      bits.write(operatingPoints.length - 1, 5);
      for (const operatingPoint of operatingPoints) {
        bits.write(0, 12); // operating_point_idc
        bits.write(operatingPoint.level, 5);
        if (operatingPoint.level > 7) {
          bits.write(operatingPoint.tier ?? 0, 1);
        }
        if (decoderModel) {
          bits.write(1, 1); // decoder_model_present_for_this_op
          bits.write(1, 4); // decoder_buffer_delay
          bits.write(1, 4); // encoder_buffer_delay
          bits.write(0, 1); // low_delay_mode_flag
        }
        if (initialDisplayDelay) {
          bits.write(1, 1); // initial_display_delay_present_for_this_op
          bits.write(0, 4); // initial_display_delay_minus_1
        }
      }
    }

    const widthBits = Math.max(1, Math.ceil(Math.log2(width)));
    const heightBits = Math.max(1, Math.ceil(Math.log2(height)));
    bits.write(widthBits - 1, 4);
    bits.write(heightBits - 1, 4);
    bits.write(width - 1, widthBits);
    bits.write(height - 1, heightBits);
    if (!reducedStillPicture) {
      bits.write(0, 1); // frame_id_numbers_present_flag
    }
    bits.write(0, 3); // superblock and intra feature flags
    if (!reducedStillPicture) {
      bits.write(0, 4); // inter-frame feature flags
      bits.write(0, 1); // enable_order_hint
      bits.write(1, 1); // seq_choose_screen_content_tools
      bits.write(1, 1); // seq_choose_integer_mv
    }
    bits.write(0, 3); // superres, CDEF, restoration
    bits.write(bitDepth === 8 ? 0 : 1, 1); // high_bitdepth
    if (profile === 2 && bitDepth !== 8) {
      bits.write(bitDepth === 12 ? 1 : 0, 1); // twelve_bit
    }
    return bits.bytes();
  }

  /**
   * Builds an OBU_FRAME whose payload starts with the only `uncompressed_header()` fields keyframe
   * detection reads: `show_existing_frame` f(1) and, unless the frame is re-displayed, `frame_type`
   * f(2) and `show_frame` f(1). The remaining bits are zero padding standing in for the tile group.
   */
  public static frame(options: FrameOptions = {}): number[] {
    const {
      frameType = AV1FrameType.KeyFrame,
      showExistingFrame = false,
      showFrame = true,
    } = options;
    const bits = new BitWriter();
    bits.write(showExistingFrame ? 1 : 0, 1);
    if (showExistingFrame) {
      bits.write(0, 3); // frame_to_show_map_idx
    } else {
      bits.write(frameType, 2);
      bits.write(showFrame ? 1 : 0, 1);
    }
    return AV1FrameBuilder.obu(AV1ObuType.Frame, bits.bytes());
  }

  /** A sequence header followed by a shown key frame, i.e. a random-access point. */
  public static keyframe(options?: SequenceHeaderOptions): Uint8Array {
    return new Uint8Array([
      ...AV1FrameBuilder.obu(AV1ObuType.SequenceHeader, AV1FrameBuilder.sequenceHeader(options)),
      ...AV1FrameBuilder.frame(),
    ]);
  }

  public static deltaFrame(): Uint8Array {
    return new Uint8Array(AV1FrameBuilder.frame({ frameType: AV1FrameType.InterFrame }));
  }

  /**
   * A delta frame preceded by a repeated Sequence Header OBU. The AV1 specification permits this,
   * so it must not be mistaken for a random-access point.
   */
  public static deltaFrameWithSequenceHeader(options?: SequenceHeaderOptions): Uint8Array {
    return new Uint8Array([
      ...AV1FrameBuilder.obu(AV1ObuType.SequenceHeader, AV1FrameBuilder.sequenceHeader(options)),
      ...AV1FrameBuilder.frame({ frameType: AV1FrameType.InterFrame }),
    ]);
  }
}

function encodeLeb128(value: number): number[] {
  const result: number[] = [];
  let remaining = value;
  do {
    const byte = remaining & LEB128_PAYLOAD_MASK; // Get the lower 7bits
    remaining = Math.floor(remaining / (LEB128_PAYLOAD_MASK + 1));
    result.push(remaining === 0 ? byte : byte | LEB128_CONTINUATION_FLAG);
  } while (remaining !== 0);
  return result;
}

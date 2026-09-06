// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  AV1_CODEC_FIELD_DIGITS,
  AV1_CODEC_PREFIX,
  AV1_HIGH_TIER,
  AV1_MAIN_TIER,
  AV1_PROFILE_PROFESSIONAL,
  LEB128_CONTINUATION_FLAG,
  LEB128_MAX_BYTES,
  LEB128_PAYLOAD_BITS,
  LEB128_PAYLOAD_MASK,
  OBU_EXTENSION_FLAG,
  OBU_EXTENSION_MUST_BE_ZERO_MASK,
  OBU_HAS_SIZE_FLAG,
  OBU_HEADER_MUST_BE_ZERO_MASK,
  OBU_TYPE_MASK,
  OBU_TYPE_SHIFT,
  UVLC_ESCAPE_VALUE,
  UVLC_MAX_LEADING_ZEROS,
} from "./constants";
import { AV1FrameType, AV1ObuType } from "./types";

type AV1Obu = {
  payload: Uint8Array;
  type: number;
};

/**
 * The leading fields of `uncompressed_header()` that identify a frame. `frameType` is undefined for
 * a re-displayed frame, which codes no `frame_type` of its own.
 */
type AV1FrameHeader = {
  frameType: number | undefined;
  showExistingFrame: boolean;
};

type AV1SequenceHeader = {
  bitDepth: number;
  codedHeight: number;
  codedWidth: number;
  level: number;
  profile: number;
  tier: number;
};

class BitReader {
  readonly #data: Uint8Array;
  #offset = 0;

  public constructor(data: Uint8Array) {
    this.#data = data;
  }

  public read(width: number): number {
    if (width < 0 || width > 32 || this.#offset + width > this.#data.byteLength * 8) {
      throw new Error("AV1 bitstream exhausted");
    }

    let value = 0;
    for (let i = 0; i < width; i++) {
      // Read bits most-significant-bit first from each 8-bit byte.
      const byte = this.#data[this.#offset >> 3]!;
      value = value * 2 + ((byte >> (7 - (this.#offset & 7))) & 1);
      this.#offset++;
    }
    return value;
  }

  public skip(width: number): void {
    this.read(width);
  }

  public readUnsignedVariableLength(): number {
    let leadingZeros = 0;
    while (this.read(1) === 0) {
      leadingZeros++;
      if (leadingZeros >= UVLC_MAX_LEADING_ZEROS) {
        return UVLC_ESCAPE_VALUE;
      }
    }
    return 2 ** leadingZeros - 1 + this.read(leadingZeros);
  }
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AV1 {
  /**
   * Returns whether the temporal unit is a random-access point, i.e. whether a decoder can be
   * started from this message alone. That requires both:
   *
   * - a Sequence Header OBU, without which the decoder cannot be configured. Foxglove requires
   *   every AV1 keyframe message to carry one, and
   * - a coded key frame, i.e. a frame header with `show_existing_frame == 0` and
   *   `frame_type == KEY_FRAME` (AV1 specification sections 5.9.2 and 6.8.2). A key frame
   *   refreshes every reference frame slot, so decoding can begin at the temporal unit holding it.
   *
   * `show_frame` is deliberately not part of the condition. A key frame coded with
   * `show_frame == 0` (a "forward key frame", displayed later by a `show_existing_frame` temporal
   * unit) is still an independently decodable start point, which is exactly what both consumers of
   * this predicate need: the WebCodecs chunk type, where `key` means "decoding may start here",
   * and the GOP anchor used by seek backfill and queue filtering.
   *
   * A Sequence Header OBU alone is not sufficient evidence: the specification permits sequence
   * headers to be repeated ahead of delta frames, so keying off their presence would mislabel
   * inter frames as keyframes and submit them to WebCodecs as key chunks.
   */
  public static IsKeyframe(data: Uint8Array): boolean {
    try {
      let hasSequenceHeader = false;
      let reducedStillPictureHeader = false;

      for (const obu of parseObus(data)) {
        if (obu.type === AV1ObuType.SequenceHeader) {
          hasSequenceHeader = true;
          reducedStillPictureHeader = readReducedStillPictureHeader(obu.payload);
          continue;
        }

        // Every frame header in the temporal unit is inspected, not just the first: encoders pack
        // hidden frames ahead of the shown one in a single temporal unit, so the key frame is not
        // necessarily first. Walking the rest of the unit only follows the explicit OBU sizes and
        // reads at most three bits per frame header, so the extra work is negligible.
        // OBU_FRAME embeds a frame header ahead of its tile group, and OBU_REDUNDANT_FRAME_HEADER
        // repeats a preceding one, which cannot change the outcome.
        if (obu.type === AV1ObuType.FrameHeader || obu.type === AV1ObuType.Frame) {
          const header = parseFrameHeader(obu.payload, { reducedStillPictureHeader });
          if (
            hasSequenceHeader &&
            !header.showExistingFrame &&
            header.frameType === AV1FrameType.KeyFrame
          ) {
            return true;
          }
        }
      }
    } catch {
      return false;
    }

    // No sequence header, or no coded key frame: not a point the decoder can be started from.
    return false;
  }

  public static ParseDecoderConfig(data: Uint8Array): VideoDecoderConfig | undefined {
    const sequenceHeader = AV1.GetSequenceHeader(data);
    if (sequenceHeader == undefined) {
      return undefined;
    }

    try {
      const parsed = parseSequenceHeader(sequenceHeader);
      const tier = parsed.tier === 0 ? AV1_MAIN_TIER : AV1_HIGH_TIER;
      const level = parsed.level.toString().padStart(AV1_CODEC_FIELD_DIGITS, "0");
      const bitDepth = parsed.bitDepth.toString().padStart(AV1_CODEC_FIELD_DIGITS, "0");
      return {
        codec: `${AV1_CODEC_PREFIX}.${parsed.profile}.${level}${tier}.${bitDepth}`,
        codedWidth: parsed.codedWidth,
        codedHeight: parsed.codedHeight,
      };
    } catch {
      return undefined;
    }
  }

  private static GetSequenceHeader(data: Uint8Array): Uint8Array | undefined {
    try {
      for (const obu of parseObus(data)) {
        if (obu.type === AV1ObuType.SequenceHeader) {
          return obu.payload;
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}

function* parseObus(data: Uint8Array): Iterable<AV1Obu> {
  let offset = 0;
  while (offset < data.byteLength) {
    const header = data[offset++];
    if (header == undefined || (header & OBU_HEADER_MUST_BE_ZERO_MASK) !== 0) {
      throw new Error("Invalid AV1 OBU header");
    }

    const type = (header >> OBU_TYPE_SHIFT) & OBU_TYPE_MASK;
    const hasExtension = (header & OBU_EXTENSION_FLAG) !== 0;
    const hasSize = (header & OBU_HAS_SIZE_FLAG) !== 0;
    if (hasExtension) {
      const extension = data[offset++];
      if (extension == undefined || (extension & OBU_EXTENSION_MUST_BE_ZERO_MASK) !== 0) {
        throw new Error("Invalid AV1 OBU extension header");
      }
    }

    let payloadSize = data.byteLength - offset;
    if (hasSize) {
      const decoded = readLeb128(data, offset);
      payloadSize = decoded.value;
      offset = decoded.nextOffset;
    }
    if (payloadSize > data.byteLength - offset) {
      throw new Error("Truncated AV1 OBU payload");
    }

    const payloadEnd = offset + payloadSize;
    yield { payload: data.subarray(offset, payloadEnd), type };
    offset = payloadEnd;

    // Without an explicit size, the final OBU consumes the remainder of the temporal unit.
    if (!hasSize) {
      return;
    }
  }
}

function readLeb128(data: Uint8Array, offset: number): { nextOffset: number; value: number } {
  let value = 0;
  let nextOffset = offset;
  for (let byteIndex = 0; byteIndex < LEB128_MAX_BYTES; byteIndex++) {
    const byte = data[nextOffset++];
    if (byte == undefined) {
      throw new Error("Truncated AV1 LEB128 value");
    }
    value += (byte & LEB128_PAYLOAD_MASK) * 2 ** (byteIndex * LEB128_PAYLOAD_BITS);
    if (!Number.isSafeInteger(value)) {
      throw new Error("AV1 OBU size exceeds safe integer range");
    }
    if ((byte & LEB128_CONTINUATION_FLAG) === 0) {
      return { nextOffset, value };
    }
  }
  throw new Error("Invalid AV1 LEB128 value");
}

/**
 * Reads `reduced_still_picture_header` from a Sequence Header OBU (AV1 specification section
 * 5.5.1). Only the three leading fields are decoded, keeping the per-message cost of keyframe
 * detection at a handful of bits instead of a full sequence header parse.
 */
function readReducedStillPictureHeader(data: Uint8Array): boolean {
  const bits = new BitReader(data);
  bits.skip(3); // seq_profile
  bits.skip(1); // still_picture
  return bits.read(1) === 1;
}

/**
 * Parses the leading fields of `uncompressed_header()` (AV1 specification section 5.9.2), which
 * codes `show_existing_frame` f(1) and then, only when it is 0, `frame_type` f(2). Decoding stops
 * there because nothing beyond it identifies the frame.
 *
 * The conditional fields of that syntax structure cannot shift those bits: `temporal_point_info()`
 * and `display_frame_id` — the fields gated on `decoder_model_info_present_flag` and
 * `frame_id_numbers_present_flag` — sit inside the `show_existing_frame == 1` branch, which ends
 * in a `return`, and the branch infers `frame_type` from `RefFrameType[frame_to_show_map_idx]`
 * instead of reading it. On the path this function reads, the two fields are therefore always
 * adjacent, and no sequence header state beyond `reduced_still_picture_header` is needed.
 */
function parseFrameHeader(
  data: Uint8Array,
  { reducedStillPictureHeader }: { reducedStillPictureHeader: boolean },
): AV1FrameHeader {
  // A reduced still picture header codes none of these fields; it implies a single shown key frame.
  if (reducedStillPictureHeader) {
    return { frameType: AV1FrameType.KeyFrame, showExistingFrame: false };
  }

  const bits = new BitReader(data);
  if (bits.read(1) === 1) {
    // A frame re-displayed from the reference buffer codes no frame_type of its own, and it is not
    // independently decodable: the frame it displays was decoded by an earlier temporal unit.
    return { frameType: undefined, showExistingFrame: true };
  }

  return { frameType: bits.read(2), showExistingFrame: false };
}

function parseSequenceHeader(data: Uint8Array): AV1SequenceHeader {
  const bits = new BitReader(data);
  const profile = bits.read(3);
  bits.skip(1); // still_picture
  const reducedStillPictureHeader = bits.read(1) === 1;

  let decoderModelInfoPresent = false;
  let bufferDelayLength = 0;
  let initialDisplayDelayPresent = false;
  let operatingPointsCount = 1;
  let level = 0;
  let tier = 0;

  if (reducedStillPictureHeader) {
    level = bits.read(5);
  } else {
    const timingInfoPresent = bits.read(1) === 1;
    if (timingInfoPresent) {
      bits.skip(32); // num_units_in_display_tick
      bits.skip(32); // time_scale
      const equalPictureInterval = bits.read(1) === 1;
      if (equalPictureInterval) {
        bits.readUnsignedVariableLength();
      }
      decoderModelInfoPresent = bits.read(1) === 1;
      if (decoderModelInfoPresent) {
        bufferDelayLength = bits.read(5) + 1;
        bits.skip(32); // num_units_in_decoding_tick
        bits.skip(5); // buffer_removal_time_length_minus_1
        bits.skip(5); // frame_presentation_time_length_minus_1
      }
    }

    initialDisplayDelayPresent = bits.read(1) === 1;
    operatingPointsCount = bits.read(5) + 1;
    for (let i = 0; i < operatingPointsCount; i++) {
      bits.skip(12); // operating_point_idc
      const operatingPointLevel = bits.read(5);
      const operatingPointTier = operatingPointLevel > 7 ? bits.read(1) : 0;
      if (i === 0) {
        level = operatingPointLevel;
        tier = operatingPointTier;
      }
      if (decoderModelInfoPresent && bits.read(1) === 1) {
        bits.skip(bufferDelayLength); // decoder_buffer_delay
        bits.skip(bufferDelayLength); // encoder_buffer_delay
        bits.skip(1); // low_delay_mode_flag
      }
      if (initialDisplayDelayPresent && bits.read(1) === 1) {
        bits.skip(4); // initial_display_delay_minus_1
      }
    }
  }

  const frameWidthBits = bits.read(4) + 1;
  const frameHeightBits = bits.read(4) + 1;
  const codedWidth = bits.read(frameWidthBits) + 1;
  const codedHeight = bits.read(frameHeightBits) + 1;

  if (!reducedStillPictureHeader && bits.read(1) === 1) {
    bits.skip(4); // delta_frame_id_length_minus_2
    bits.skip(3); // additional_frame_id_length_minus_1
  }

  bits.skip(3); // use_128x128_superblock, enable_filter_intra, enable_intra_edge_filter
  if (reducedStillPictureHeader) {
    // Reduced headers imply the remaining inter-frame feature flags.
  } else {
    bits.skip(4); // interintra, masked compound, warped motion, dual filter
    const enableOrderHint = bits.read(1) === 1;
    if (enableOrderHint) {
      bits.skip(2); // enable_jnt_comp, enable_ref_frame_mvs
    }
    const chooseScreenContentTools = bits.read(1) === 1;
    const forceScreenContentTools = chooseScreenContentTools ? 2 : bits.read(1);
    if (forceScreenContentTools > 0) {
      const chooseIntegerMv = bits.read(1) === 1;
      if (!chooseIntegerMv) {
        bits.skip(1); // seq_force_integer_mv
      }
    }
    if (enableOrderHint) {
      bits.skip(3); // order_hint_bits_minus_1
    }
  }

  bits.skip(3); // enable_superres, enable_cdef, enable_restoration
  const highBitdepth = bits.read(1) === 1;
  let bitDepth = highBitdepth ? 10 : 8;
  if (profile === AV1_PROFILE_PROFESSIONAL && highBitdepth && bits.read(1) === 1) {
    bitDepth = 12;
  }

  return { bitDepth, codedHeight, codedWidth, level, profile, tier };
}

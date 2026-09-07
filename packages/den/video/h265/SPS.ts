// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Bitstream } from "../Bitstream";

// Prefix applied to general_profile_idc in the codec string for each value of
// general_profile_space (ISO/IEC 14496-15 Annex E). A value of 0 produces no prefix.
const HEVC_PROFILE_SPACE_PREFIX = ["", "A", "B", "C"];

// Number of bits in general_profile_compatibility_flags (ISO/IEC 23008-2 §7.3.3).
const PROFILE_COMPATIBILITY_FLAG_COUNT = 32;

// Number of bytes in general_constraint_indicator_flags (48 bits, ISO/IEC 23008-2 §7.3.3).
const CONSTRAINT_INDICATOR_BYTE_COUNT = 6;

/**
 * Parses the subset of an H.265 (HEVC) sequence parameter set (SPS) needed to build a
 * `VideoDecoderConfig`: the coded picture dimensions and the `hvc1` codec string derived from the
 * `profile_tier_level()` structure.
 *
 * The bitstream layout follows the `seq_parameter_set_rbsp()` syntax in ISO/IEC 23008-2 §7.3.2.2.1.
 * Parsing stops after `bit_depth_chroma_minus8`; the remaining SPS fields are not required for
 * decoder configuration.
 */
export class SPS {
  public forbidden_zero_bit: number;
  public nal_unit_type: number;
  public nuh_layer_id: number;
  public nuh_temporal_id_plus1: number;

  public sps_video_parameter_set_id: number;
  public sps_max_sub_layers_minus1: number;
  public sps_temporal_id_nesting_flag: number;

  // profile_tier_level() — general (highest) layer fields
  public general_profile_space: number;
  public general_tier_flag: number;
  public general_profile_idc: number;
  // general_profile_compatibility_flags in reversed bit order, as used in the codec string.
  public general_profile_compatibility_flags: number;
  public general_constraint_indicator_bytes: number[];
  public general_level_idc: number;

  public sps_seq_parameter_set_id: number;
  public chroma_format_idc: number;
  public separate_colour_plane_flag: number;
  public chromaArrayType: number;
  public pic_width_in_luma_samples: number;
  public pic_height_in_luma_samples: number;
  public conformance_window_flag: number;
  public conf_win_left_offset: number;
  public conf_win_right_offset: number;
  public conf_win_top_offset: number;
  public conf_win_bottom_offset: number;
  public bit_depth_luma_minus8: number;
  public bit_depth_chroma_minus8: number;

  public picWidth: number;
  public picHeight: number;
  public cropRect: { x: number; y: number; width: number; height: number };

  public constructor(data: Uint8Array) {
    const bitstream = new Bitstream(data);

    // NAL unit header (ISO/IEC 23008-2 §7.3.1.2) — 2 bytes.
    this.forbidden_zero_bit = bitstream.u_1();
    if (this.forbidden_zero_bit !== 0) {
      throw new Error("NALU error: invalid NALU header");
    }
    this.nal_unit_type = bitstream.u(6);
    if (this.nal_unit_type !== 33) {
      throw new Error("SPS error: not SPS");
    }
    this.nuh_layer_id = bitstream.u(6);
    this.nuh_temporal_id_plus1 = bitstream.u_3();
    if (this.nuh_temporal_id_plus1 === 0) {
      throw new Error("NALU error: invalid NALU header");
    }

    this.sps_video_parameter_set_id = bitstream.u(4);
    this.sps_max_sub_layers_minus1 = bitstream.u_3();
    this.sps_temporal_id_nesting_flag = bitstream.u_1();

    this.general_profile_space = 0;
    this.general_tier_flag = 0;
    this.general_profile_idc = 0;
    this.general_profile_compatibility_flags = 0;
    this.general_constraint_indicator_bytes = [];
    this.general_level_idc = 0;
    this.#parseProfileTierLevel(bitstream, this.sps_max_sub_layers_minus1);

    this.sps_seq_parameter_set_id = bitstream.ue_v();

    this.chroma_format_idc = bitstream.ue_v();
    this.separate_colour_plane_flag = 0;
    if (this.chroma_format_idc === 3) {
      this.separate_colour_plane_flag = bitstream.u_1();
    }
    this.chromaArrayType = this.separate_colour_plane_flag === 1 ? 0 : this.chroma_format_idc;

    this.pic_width_in_luma_samples = bitstream.ue_v();
    this.pic_height_in_luma_samples = bitstream.ue_v();
    this.picWidth = this.pic_width_in_luma_samples;
    this.picHeight = this.pic_height_in_luma_samples;

    this.conformance_window_flag = bitstream.u_1();
    this.conf_win_left_offset = 0;
    this.conf_win_right_offset = 0;
    this.conf_win_top_offset = 0;
    this.conf_win_bottom_offset = 0;
    if (this.conformance_window_flag === 1) {
      this.conf_win_left_offset = bitstream.ue_v();
      this.conf_win_right_offset = bitstream.ue_v();
      this.conf_win_top_offset = bitstream.ue_v();
      this.conf_win_bottom_offset = bitstream.ue_v();
    }

    this.bit_depth_luma_minus8 = bitstream.ue_v();
    this.bit_depth_chroma_minus8 = bitstream.ue_v();

    // Determine the chroma sample to luma sample ratio in each dimension (ISO/IEC 23008-2
    // Table 6-1) to convert the conformance window offsets into a luma-sample crop rectangle.
    let subWidthC = 1;
    let subHeightC = 1;
    if (this.chroma_format_idc === 1) {
      // 4:2:0
      subWidthC = 2;
      subHeightC = 2;
    } else if (this.chroma_format_idc === 2) {
      // 4:2:2
      subWidthC = 2;
    }

    const leftPixelCrop = this.conf_win_left_offset * subWidthC;
    const rightPixelCrop = this.conf_win_right_offset * subWidthC;
    const topPixelCrop = this.conf_win_top_offset * subHeightC;
    const bottomPixelCrop = this.conf_win_bottom_offset * subHeightC;
    this.cropRect = {
      x: leftPixelCrop,
      y: topPixelCrop,
      width: this.picWidth - (leftPixelCrop + rightPixelCrop),
      height: this.picHeight - (topPixelCrop + bottomPixelCrop),
    };
  }

  /**
   * Builds the WebCodecs `hvc1` codec string from the parsed `profile_tier_level()` fields,
   * following the format in ISO/IEC 14496-15 Annex E, e.g. `hvc1.1.6.L93.B0`.
   */
  public MIME(): string {
    const profilePrefix = HEVC_PROFILE_SPACE_PREFIX[this.general_profile_space] ?? "";
    const compatibility = this.general_profile_compatibility_flags.toString(16).toUpperCase();
    const tier = this.general_tier_flag === 1 ? "H" : "L";

    const parts = [
      `hvc1.${profilePrefix}${this.general_profile_idc}`,
      compatibility,
      `${tier}${this.general_level_idc}`,
    ];

    const constraint = formatConstraintBytes(this.general_constraint_indicator_bytes);
    if (constraint.length > 0) {
      parts.push(constraint);
    }

    return parts.join(".");
  }

  /**
   * Parses the `profile_tier_level()` structure (ISO/IEC 23008-2 §7.3.3) for the general layer and
   * skips over any sub-layer profile/level information so the bitstream is positioned at
   * `sps_seq_parameter_set_id` afterwards.
   */
  #parseProfileTierLevel(bitstream: Bitstream, maxNumSubLayersMinus1: number): void {
    this.general_profile_space = bitstream.u_2();
    this.general_tier_flag = bitstream.u_1();
    this.general_profile_idc = bitstream.u(5);
    this.general_profile_compatibility_flags = readReversedCompatibilityFlags(bitstream);

    for (let i = 0; i < CONSTRAINT_INDICATOR_BYTE_COUNT; i++) {
      this.general_constraint_indicator_bytes.push(bitstream.u_8());
    }

    this.general_level_idc = bitstream.u_8();

    // Read per-sub-layer presence flags (ISO/IEC 23008-2 §7.3.3)
    const subLayerProfilePresent: number[] = [];
    const subLayerLevelPresent: number[] = [];
    for (let i = 0; i < maxNumSubLayersMinus1; i++) {
      subLayerProfilePresent.push(bitstream.u_1());
      subLayerLevelPresent.push(bitstream.u_1());
    }

    // Padding: reserved_zero_2bits to align remaining slots up to 8 sub-layers
    if (maxNumSubLayersMinus1 > 0) {
      for (let i = maxNumSubLayersMinus1; i < 8; i++) {
        bitstream.u_2(); // reserved_zero_2bits
      }
    }

    // Skip optional sub-layer profile/level data
    for (let i = 0; i < maxNumSubLayersMinus1; i++) {
      if (subLayerProfilePresent[i] === 1) {
        skipSubLayerProfile(bitstream);
      }
      if (subLayerLevelPresent[i] === 1) {
        bitstream.u_8(); // sub_layer_level_idc
      }
    }
  }
}

/**
 * Reads the 32 `general_profile_compatibility_flag` bits (ISO/IEC 23008-2 §7.3.3) from the
 * bitstream and returns them with reversed bit order, as required for the codec string
 * (ISO/IEC 14496-15 Annex E): flag[i] is read MSB-first but placed at bit position i.
 */
function readReversedCompatibilityFlags(bitstream: Bitstream): number {
  let flags = 0;
  for (let i = 0; i < PROFILE_COMPATIBILITY_FLAG_COUNT; i++) {
    if (bitstream.u_1() === 1) {
      flags |= 1 << i;
    }
  }
  return flags >>> 0;
}

/**
 * Skips all bits belonging to a single sub-layer profile block (ISO/IEC 23008-2 §7.3.3):
 * profile_space, tier_flag, profile_idc, 32 compatibility flags, and 6 constraint bytes.
 */
function skipSubLayerProfile(bitstream: Bitstream): void {
  bitstream.u_2(); // sub_layer_profile_space
  bitstream.u_1(); // sub_layer_tier_flag
  bitstream.u(5); // sub_layer_profile_idc
  for (let i = 0; i < PROFILE_COMPATIBILITY_FLAG_COUNT; i++) {
    bitstream.u_1(); // sub_layer_profile_compatibility_flag
  }
  for (let i = 0; i < CONSTRAINT_INDICATOR_BYTE_COUNT; i++) {
    bitstream.u_8(); // sub_layer_constraint_indicator_flags
  }
}

/**
 * Formats the 6 general_constraint_indicator bytes as the dot-separated hex tail of the codec
 * string, trimming trailing zero bytes (ISO/IEC 14496-15 Annex E).
 */
function formatConstraintBytes(bytes: number[]): string {
  let lastNonZero = -1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) {
      lastNonZero = i;
    }
  }
  if (lastNonZero < 0) {
    return "";
  }

  const hex: string[] = [];
  for (let i = 0; i <= lastNonZero; i++) {
    hex.push(byteToHex(bytes[i]!).toUpperCase());
  }
  return hex.join(".");
}

function byteToHex(val: number): string {
  return ("00" + val.toString(16)).slice(-2);
}

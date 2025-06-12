// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SPS } from "./SPS";

describe("SPS", () => {
  function createValidNALU() {
    return [
      0x67, 0x64, 0x0, 0x1e, 0xac, 0xb2, 0x1, 0x40, 0x5f, 0xf2, 0xe0, 0x2d, 0x40, 0x40, 0x40, 0x50,
      0x0, 0x0, 0x3, 0x0, 0x10, 0x0, 0x0, 0x3, 0x3, 0x20, 0xf1, 0x62, 0xe4, 0x80,
    ];
  }

  it("Parses a simple SPS NALU correctly", () => {
    const NALU = [0x67, 0x42, 0x00, 0x0a, 0xf8, 0x41, 0xa2];
    const sps = new SPS(new Uint8Array(NALU));

    // forbidden_zero_bit	                  u(1)  0  Must be zero
    // nal_ref_idc                          u(2)  3  Means it is “important” (this is an SPS)
    // nal_unit_type                        u(5)  7  Indicates this is a sequence parameter set
    // profile_idc                          u(8)  66 Baseline profile
    // constraint_set0_flag                 u(1)  0  We're not going to honor constraints
    // constraint_set1_flag                 u(1)  0  We're not going to honor constraints
    // constraint_set2_flag                 u(1)  0  We're not going to honor constraints
    // constraint_set3_flag                 u(1)  0  We're not going to honor constraints
    // reserved_zero_4bits                  u(4)  0  Better set them to zero
    // level_idc                            u(8)  10 Level 1, sec A.3.1
    // seq_parameter_set_id                 ue(v) 0  We'll just use id 0
    // log2_max_frame_num_minus4            ue(v) 0  Let's have as few frame numbers as possible
    // pic_order_cnt_type                   ue(v) 0  Keep things simple
    // log2_max_pic_order_cnt_lsb_minus4    ue(v) 0  Fewer is better
    // num_ref_frames                       ue(v) 0  We will only send I slices
    // gaps_in_frame_num_value_allowed_flag u(1)  0  We will have no gaps
    // pic_width_in_mbs_minus_1             ue(v) 7  SQCIF is 8 macroblocks wide
    // pic_height_in_map_units_minus_1      ue(v) 5  SQCIF is 6 macroblocks high
    // frame_mbs_only_flag                  u(1)  1  We will not to field/frame encoding
    // direct_8x8_inference_flag            u(1)  0  Used for B slices. We will not send B slices
    // frame_cropping_flag                  u(1)  0  We will not do frame cropping
    // vui_prameters_present_flag           u(1)  0  We will not send VUI data
    // rbsp_stop_one_bit                    u(1)  1  Stop bit

    expect(sps.nal_ref_id).toBe(3);
    expect(sps.nal_unit_type).toBe(7);
    expect(sps.profile_idc).toBe(66);
    expect(sps.profileName).toBe("BASELINE");
    expect(sps.constraint_set0_flag).toBe(0);
    expect(sps.constraint_set1_flag).toBe(0);
    expect(sps.constraint_set2_flag).toBe(0);
    expect(sps.constraint_set3_flag).toBe(0);
    expect(sps.level_idc).toBe(10);
    expect(sps.seq_parameter_set_id).toBe(0);
    expect(sps.has_no_chroma_format_idc).toBe(true);
    expect(sps.chroma_format_idc).toBeUndefined();
    expect(sps.bit_depth_luma_minus8).toBeUndefined();
    expect(sps.separate_colour_plane_flag).toBeUndefined();
    expect(sps.chromaArrayType).toBeUndefined();
    expect(sps.bitDepthLuma).toBeUndefined();
    expect(sps.bit_depth_chroma_minus8).toBeUndefined();
    expect(sps.lossless_qpprime_flag).toBeUndefined();
    expect(sps.bitDepthChroma).toBeUndefined();
    expect(sps.seq_scaling_matrix_present_flag).toBeUndefined();
    expect(sps.seq_scaling_list_present_flag).toBeUndefined();
    expect(sps.seq_scaling_list).toBeUndefined();
    expect(sps.log2_max_frame_num_minus4).toBe(0);
    expect(sps.maxFrameNum).toBe(16);
    expect(sps.pic_order_cnt_type).toBe(0);
    expect(sps.log2_max_pic_order_cnt_lsb_minus4).toBe(0);
    expect(sps.maxPicOrderCntLsb).toBe(16);
    expect(sps.delta_pic_order_always_zero_flag).toBeUndefined();
    expect(sps.offset_for_non_ref_pic).toBeUndefined();
    expect(sps.offset_for_top_to_bottom_field).toBeUndefined();
    expect(sps.num_ref_frames_in_pic_order_cnt_cycle).toBeUndefined();
    expect(sps.offset_for_ref_frame).toBeUndefined();
    expect(sps.max_num_ref_frames).toBe(0);
    expect(sps.gaps_in_frame_num_value_allowed_flag).toBe(0);
    expect(sps.pic_width_in_mbs_minus_1).toBe(7);
    expect(sps.picWidth).toBe(128);
    expect(sps.pic_height_in_map_units_minus_1).toBe(5);
    expect(sps.frame_mbs_only_flag).toBe(1);
    expect(sps.interlaced).toBe(false);
    expect(sps.mb_adaptive_frame_field_flag).toBeUndefined();
    expect(sps.picHeight).toBe(96);
    expect(sps.direct_8x8_inference_flag).toBe(0);
    expect(sps.frame_cropping_flag).toBe(0);
    expect(sps.frame_cropping_rect_left_offset).toBeUndefined();
    expect(sps.frame_cropping_rect_right_offset).toBeUndefined();
    expect(sps.frame_cropping_rect_top_offset).toBeUndefined();
    expect(sps.frame_cropping_rect_bottom_offset).toBeUndefined();
    expect(sps.cropRect).toEqual({ x: 0, y: 0, width: 128, height: 96 });
    expect(sps.vui_parameters_present_flag).toBe(0);
    expect(sps.aspect_ratio_info_present_flag).toBeUndefined();
    expect(sps.aspect_ratio_idc).toBeUndefined();
    expect(sps.sar_width).toBeUndefined();
    expect(sps.sar_height).toBeUndefined();
    expect(sps.overscan_info_present_flag).toBeUndefined();
    expect(sps.overscan_appropriate_flag).toBeUndefined();
    expect(sps.video_signal_type_present_flag).toBeUndefined();
    expect(sps.video_format).toBeUndefined();
    expect(sps.video_full_range_flag).toBeUndefined();
    expect(sps.color_description_present_flag).toBeUndefined();
    expect(sps.color_primaries).toBeUndefined();
    expect(sps.transfer_characteristics).toBeUndefined();
    expect(sps.matrix_coefficients).toBeUndefined();
    expect(sps.chroma_loc_info_present_flag).toBeUndefined();
    expect(sps.chroma_sample_loc_type_top_field).toBeUndefined();
    expect(sps.chroma_sample_loc_type_bottom_field).toBeUndefined();
    expect(sps.timing_info_present_flag).toBeUndefined();
    expect(sps.num_units_in_tick).toBeUndefined();
    expect(sps.time_scale).toBeUndefined();
    expect(sps.fixed_frame_rate_flag).toBeUndefined();
    expect(sps.framesPerSecond).toBeUndefined();
    expect(sps.nal_hrd_parameters_present_flag).toBeUndefined();

    expect(sps.profileCompatibility()).toBe(0);
    expect(sps.MIME()).toBe("avc1.42000A");
  });

  it("Parses a real-world example SPS", () => {
    const NALU = createValidNALU();
    const sps = new SPS(new Uint8Array(NALU));

    expect(sps.nal_ref_id).toBe(3);
    expect(sps.nal_unit_type).toBe(7);
    expect(sps.profile_idc).toBe(100);
    expect(sps.profileName).toBe("FREXT_HP");
    expect(sps.constraint_set0_flag).toBe(0);
    expect(sps.constraint_set1_flag).toBe(0);
    expect(sps.constraint_set2_flag).toBe(0);
    expect(sps.constraint_set3_flag).toBe(0);
    expect(sps.level_idc).toBe(30);
    expect(sps.seq_parameter_set_id).toBe(0);
    expect(sps.has_no_chroma_format_idc).toBe(false);
    expect(sps.chroma_format_idc).toBe(1);
    expect(sps.bit_depth_luma_minus8).toBe(0);
    expect(sps.separate_colour_plane_flag).toBeUndefined();
    expect(sps.chromaArrayType).toBeUndefined();
    expect(sps.bitDepthLuma).toBe(8);
    expect(sps.bit_depth_chroma_minus8).toBe(0);
    expect(sps.lossless_qpprime_flag).toBe(0);
    expect(sps.bitDepthChroma).toBe(8);
    expect(sps.seq_scaling_matrix_present_flag).toBe(0);
    expect(sps.seq_scaling_list_present_flag).toBeUndefined();
    expect(sps.seq_scaling_list).toBeUndefined();
    expect(sps.log2_max_frame_num_minus4).toBe(0);
    expect(sps.maxFrameNum).toBe(16);
    expect(sps.pic_order_cnt_type).toBe(2);
    expect(sps.log2_max_pic_order_cnt_lsb_minus4).toBeUndefined();
    expect(sps.maxPicOrderCntLsb).toBeUndefined();
    expect(sps.delta_pic_order_always_zero_flag).toBeUndefined();
    expect(sps.offset_for_non_ref_pic).toBeUndefined();
    expect(sps.offset_for_top_to_bottom_field).toBeUndefined();
    expect(sps.num_ref_frames_in_pic_order_cnt_cycle).toBeUndefined();
    expect(sps.offset_for_ref_frame).toBeUndefined();
    expect(sps.max_num_ref_frames).toBe(3);
    expect(sps.gaps_in_frame_num_value_allowed_flag).toBe(0);
    expect(sps.pic_width_in_mbs_minus_1).toBe(39);
    expect(sps.picWidth).toBe(640);
    expect(sps.pic_height_in_map_units_minus_1).toBe(22);
    expect(sps.frame_mbs_only_flag).toBe(1);
    expect(sps.interlaced).toBe(false);
    expect(sps.mb_adaptive_frame_field_flag).toBeUndefined();
    expect(sps.picHeight).toBe(368);
    expect(sps.direct_8x8_inference_flag).toBe(1);
    expect(sps.frame_cropping_flag).toBe(1);
    expect(sps.frame_cropping_rect_left_offset).toBe(0);
    expect(sps.frame_cropping_rect_right_offset).toBe(0);
    expect(sps.frame_cropping_rect_top_offset).toBe(0);
    expect(sps.frame_cropping_rect_bottom_offset).toBe(4);
    expect(sps.cropRect).toEqual({ x: 0, y: 0, width: 640, height: 360 });
    expect(sps.vui_parameters_present_flag).toBe(1);
    expect(sps.aspect_ratio_info_present_flag).toBe(1);
    expect(sps.aspect_ratio_idc).toBe(1);
    expect(sps.sar_width).toBe(1);
    expect(sps.sar_height).toBe(1);
    expect(sps.overscan_info_present_flag).toBe(0);
    expect(sps.overscan_appropriate_flag).toBeUndefined();
    expect(sps.video_signal_type_present_flag).toBe(1);
    expect(sps.video_format).toBe(5);
    expect(sps.video_full_range_flag).toBe(0);
    expect(sps.color_description_present_flag).toBe(1);
    expect(sps.color_primaries).toBe(1);
    expect(sps.transfer_characteristics).toBe(1);
    expect(sps.matrix_coefficients).toBe(1);
    expect(sps.chroma_loc_info_present_flag).toBe(0);
    expect(sps.chroma_sample_loc_type_top_field).toBeUndefined();
    expect(sps.chroma_sample_loc_type_bottom_field).toBeUndefined();
    expect(sps.timing_info_present_flag).toBe(1);
    expect(sps.num_units_in_tick).toBe(1);
    expect(sps.time_scale).toBe(50);
    expect(sps.fixed_frame_rate_flag).toBe(0);
    expect(sps.framesPerSecond).toBe(25);
    expect(sps.nal_hrd_parameters_present_flag).toBe(0);

    expect(sps.profileCompatibility()).toBe(0);
    expect(sps.MIME()).toBe("avc1.64001E");
  });

  describe("SPS > profile_idc parsing", () => {
    it.each([
      [66, "BASELINE"],
      [77, "MAIN"],
      [88, "EXTENDED"],
      [100, "FREXT_HP"],
      [110, "FREXT_Hi10P"],
      [122, "FREXT_Hi422"],
      [244, "FREXT_Hi444"],
      [44, "FREXT_CAVLC444"],
    ])("Parses profile_idc = %i and maps to profileName = %s", (profile_idc, profile_idc_name) => {
      const NALU = createValidNALU();
      NALU[1] = profile_idc;

      const sps = new SPS(new Uint8Array(NALU));
      expect(sps.profile_idc).toBe(profile_idc);
      expect(sps.profileName).toBe(profile_idc_name);
    });
  });

  describe("SPS Constructor Exceptions", () => {
    it("Throws an error for invalid forbidden_zero_bit", () => {
      const NALU = createValidNALU();
      NALU[0] = 0x80; // forbidden_zero_bit is 1 // 0x80 in bytes: 10000000
      expect(() => new SPS(new Uint8Array(NALU))).toThrow("NALU error: invalid NALU header");
    });

    it("Throws an error for invalid nal_unit_type", () => {
      const NALU = createValidNALU();
      NALU[0] = 0x65; // nal_unit_type is not 7 // 0x65 in bytes: 01100101
      expect(() => new SPS(new Uint8Array(NALU))).toThrow("SPS error: not SPS");
    });

    it("Throws an error for invalid profile_idc", () => {
      const NALU = createValidNALU();
      NALU[1] = 0xff; // profile_idc is invalid //
      expect(() => new SPS(new Uint8Array(NALU))).toThrow("SPS error: invalid profile_idc");
    });

    it("Throws an error for non-zero reserved_zero_2bits", () => {
      const NALU = createValidNALU();
      NALU[2] = 0x49; // 01001001: reserved_zero_2bits = 1;
      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: reserved_zero_2bits must be zero",
      );
    });

    it("Throws an error for seq_parameter_set_id greater than 31", () => {
      const NALU = createValidNALU();

      NALU[4] = 0x04; // 00000100
      NALU[5] = 0x20; // 00100000 → Exp-Golomb of 32: 00000100001

      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: seq_parameter_set_id must be 31 or less",
      );
    });

    it("Throws an error if chroma_format_idc is greater than 3", () => {
      const NALU = createValidNALU();
      NALU[4] = 0x85; // 10000101 = seq_parameter_set_id = 0, chroma_format_idc = 4

      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: chroma_format_idc must be 3 or less",
      );
    });

    it("Throws an error if bit_depth_luma_minus8 is greater than 6", () => {
      const NALU = createValidNALU();
      NALU[4] = 0xa0; // seq_parameter_set_id = 0 (1), chroma_format_idc = 1 (010)
      NALU[5] = 0x80; // bit_depth_luma_minus8 = 7 (000001000)

      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: bit_depth_luma_minus8 must be 6 or less",
      );
    });

    it("Throws an error if bit_depth_chroma_minus8 is greater than 6", () => {
      const NALU = createValidNALU();
      NALU[4] = 0xa8; // 10101000: seq_parameter_set_id = 0, chroma_format_idc = 1, bit_depth_luma_minus8 = 0
      NALU[5] = 0x20; // 00100000: bit_depth_chroma_minus8 = 7

      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: bit_depth_chroma_minus8 must be 6 or less",
      );
    });

    it("Throws an error if log2_max_frame_num_minus4 is greater than 12", () => {
      const NALU = createValidNALU();
      NALU[1] = 0x42; // profile_idc = 66 (baseline profile)
      NALU[4] = 0x83; // seq_parameter_set_id = 0 (ue = 1), start of log2_max_frame_num_minus4 = 13
      NALU[5] = 0x80; // continuation of log2_max_frame_num_minus4
      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: log2_max_frame_num_minus4 must be 12 or less",
      );
    });

    it("Throws an error if pic_order_cnt_type is greater than 2", () => {
      const NALU = createValidNALU();
      NALU[1] = 0x42; // profile_idc = 66 (baseline profile)
      NALU[4] = 0xc0; // seq_parameter_set_id = 0, log2_max_frame_num_minus4 = 0 (ue = 1 + 1)
      NALU[5] = 0x80; // pic_order_cnt_type = 3 (ue = 00000100)

      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: pic_order_cnt_type must be 2 or less",
      );
    });

    it("Throws an error if log2_max_pic_order_cnt_lsb_minus4 is greater than 12", () => {
      const NALU = createValidNALU();
      NALU[1] = 0x42; // profile_idc = 66 (baseline profile)
      NALU[4] = 0xe0; // seq_parameter_set_id = 0
      NALU[5] = 0xe0; // log2_max_pic_order_cnt_lsb_minus4 = 13 (000001110)

      expect(() => new SPS(new Uint8Array(NALU))).toThrow(
        "SPS error: log2_max_pic_order_cnt_lsb_minus4 must be 12 or less",
      );
    });
  });
});

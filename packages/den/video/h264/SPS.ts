// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Bitstream } from "./Bitstream";

const H264_PROFILE_NAMES = new Map<number, string>([
  [66, "BASELINE"],
  [77, "MAIN"],
  [88, "EXTENDED"],
  [100, "FREXT_HP"],
  [110, "FREXT_Hi10P"],
  [122, "FREXT_Hi422"],
  [244, "FREXT_Hi444"],
  [44, "FREXT_CAVLC444"],
]);

const ASPECT_RATIO_IDC_VALUES: [number, number][] = [
  [0, 0],
  [1, 1],
  [12, 11],
  [10, 11],
  [16, 11],
  [40, 33],
  [24, 11],
  [20, 11],
  [32, 11],
  [80, 33],
  [18, 11],
  [15, 11],
  [64, 33],
  [160, 99],
  [4, 3],
  [3, 2],
  [2, 1],
];

export class SPS {
  public nal_ref_id: number;
  public nal_unit_type: number | undefined;
  public profile_idc: number;
  public profileName: string;
  public constraint_set0_flag: number;
  public constraint_set1_flag: number;
  public constraint_set2_flag: number;
  public constraint_set3_flag: number;
  public constraint_set4_flag: number;
  public constraint_set5_flag: number;
  public level_idc: number;
  public seq_parameter_set_id: number;
  public has_no_chroma_format_idc: boolean;
  public chroma_format_idc: number | undefined;
  public bit_depth_luma_minus8: number | undefined;
  public separate_colour_plane_flag: number | undefined;
  public chromaArrayType: number | undefined;
  public bitDepthLuma: number | undefined;
  public bit_depth_chroma_minus8: number | undefined;
  public lossless_qpprime_flag: number | undefined;
  public bitDepthChroma: number | undefined;
  public seq_scaling_matrix_present_flag: number | undefined;
  public seq_scaling_list_present_flag: Array<number> | undefined;
  public seq_scaling_list: Array<number[]> | undefined;
  public log2_max_frame_num_minus4: number | undefined;
  public maxFrameNum: number;
  public pic_order_cnt_type: number;
  public log2_max_pic_order_cnt_lsb_minus4: number | undefined;
  public maxPicOrderCntLsb: number | undefined;
  public delta_pic_order_always_zero_flag: number | undefined;
  public offset_for_non_ref_pic: number | undefined;
  public offset_for_top_to_bottom_field: number | undefined;
  public num_ref_frames_in_pic_order_cnt_cycle: number | undefined;
  public offset_for_ref_frame: Array<number> | undefined;
  public max_num_ref_frames: number;
  public gaps_in_frame_num_value_allowed_flag: number;
  public pic_width_in_mbs_minus_1: number;
  public picWidth: number;
  public pic_height_in_map_units_minus_1: number;
  public frame_mbs_only_flag: number;
  public interlaced: boolean;
  public mb_adaptive_frame_field_flag: number | undefined;
  public picHeight: number;
  public direct_8x8_inference_flag: number;
  public frame_cropping_flag: number;
  public frame_cropping_rect_left_offset: number | undefined;
  public frame_cropping_rect_right_offset: number | undefined;
  public frame_cropping_rect_top_offset: number | undefined;
  public frame_cropping_rect_bottom_offset: number | undefined;
  public cropRect: { x: number; y: number; width: number; height: number };
  public vui_parameters_present_flag: number;
  public aspect_ratio_info_present_flag: number | undefined;
  public aspect_ratio_idc: number | undefined;
  public sar_width: number | undefined;
  public sar_height: number | undefined;
  public overscan_info_present_flag: number | undefined;
  public overscan_appropriate_flag: number | undefined;
  public video_signal_type_present_flag: number | undefined;
  public video_format: number | undefined;
  public video_full_range_flag: number | undefined;
  public color_description_present_flag: number | undefined;
  public color_primaries: number | undefined;
  public transfer_characteristics: number | undefined;
  public matrix_coefficients: number | undefined;
  public chroma_loc_info_present_flag: number | undefined;
  public chroma_sample_loc_type_top_field: number | undefined;
  public chroma_sample_loc_type_bottom_field: number | undefined;
  public timing_info_present_flag: number | undefined;
  public num_units_in_tick: number | undefined;
  public time_scale: number | undefined;
  public fixed_frame_rate_flag: number | undefined;
  public framesPerSecond: number | undefined;
  public nal_hrd_parameters_present_flag: number | undefined;

  public constructor(data: Uint8Array) {
    const bitstream = new Bitstream(data);

    const forbidden_zero_bit = bitstream.u_1();
    if (forbidden_zero_bit !== 0) {
      throw new Error("NALU error: invalid NALU header");
    }
    this.nal_ref_id = bitstream.u_2();
    this.nal_unit_type = bitstream.u(5);
    if (this.nal_unit_type !== 7) {
      throw new Error("SPS error: not SPS");
    }

    this.profile_idc = bitstream.u_8()!;
    if (H264_PROFILE_NAMES.has(this.profile_idc)) {
      this.profileName = H264_PROFILE_NAMES.get(this.profile_idc)!;
    } else {
      throw new Error("SPS error: invalid profile_idc");
    }

    this.constraint_set0_flag = bitstream.u_1();
    this.constraint_set1_flag = bitstream.u_1();
    this.constraint_set2_flag = bitstream.u_1();
    this.constraint_set3_flag = bitstream.u_1();
    this.constraint_set4_flag = bitstream.u_1();
    this.constraint_set5_flag = bitstream.u_1();
    const reserved_zero_2bits = bitstream.u_2();
    if (reserved_zero_2bits !== 0) {
      throw new Error("SPS error: reserved_zero_2bits must be zero");
    }

    this.level_idc = bitstream.u_8()!;

    this.seq_parameter_set_id = bitstream.ue_v();
    if (this.seq_parameter_set_id > 31) {
      throw new Error("SPS error: seq_parameter_set_id must be 31 or less");
    }

    this.has_no_chroma_format_idc =
      this.profile_idc === 66 || this.profile_idc === 77 || this.profile_idc === 88;

    if (!this.has_no_chroma_format_idc) {
      this.chroma_format_idc = bitstream.ue_v();
      if (this.chroma_format_idc > 3) {
        throw new Error("SPS error: chroma_format_idc must be 3 or less");
      }
      if (this.chroma_format_idc === 3) {
        /* 3 = YUV444 */
        this.separate_colour_plane_flag = bitstream.u_1();
        this.chromaArrayType = this.separate_colour_plane_flag !== 0 ? 0 : this.chroma_format_idc;
      }
      this.bit_depth_luma_minus8 = bitstream.ue_v();
      if (this.bit_depth_luma_minus8 > 6) {
        throw new Error("SPS error: bit_depth_luma_minus8 must be 6 or less");
      }
      this.bitDepthLuma = this.bit_depth_luma_minus8 + 8;
      this.bit_depth_chroma_minus8 = bitstream.ue_v();
      if (this.bit_depth_chroma_minus8 > 6) {
        throw new Error("SPS error: bit_depth_chroma_minus8 must be 6 or less");
      }
      this.lossless_qpprime_flag = bitstream.u_1();
      this.bitDepthChroma = this.bit_depth_chroma_minus8 + 8;
      this.seq_scaling_matrix_present_flag = bitstream.u_1();
      if (this.seq_scaling_matrix_present_flag !== 0) {
        const n_ScalingList = this.chroma_format_idc !== 3 ? 8 : 12;
        this.seq_scaling_list_present_flag = [];
        this.seq_scaling_list = [];
        for (let i = 0; i < n_ScalingList; i++) {
          const seqScalingListPresentFlag = bitstream.u_1();
          this.seq_scaling_list_present_flag.push(seqScalingListPresentFlag);
          if (seqScalingListPresentFlag !== 0) {
            const sizeOfScalingList = i < 6 ? 16 : 64;
            let nextScale = 8;
            let lastScale = 8;
            const delta_scale = [];
            for (let j = 0; j < sizeOfScalingList; j++) {
              if (nextScale !== 0) {
                const deltaScale = bitstream.se_v();
                delta_scale.push(deltaScale);
                nextScale = (lastScale + deltaScale + 256) % 256;
              }
              lastScale = nextScale === 0 ? lastScale : nextScale;
              this.seq_scaling_list.push(delta_scale);
            }
          }
        }
      }
    }

    this.log2_max_frame_num_minus4 = bitstream.ue_v();
    if (this.log2_max_frame_num_minus4 > 12) {
      throw new Error("SPS error: log2_max_frame_num_minus4 must be 12 or less");
    }
    this.maxFrameNum = 1 << (this.log2_max_frame_num_minus4 + 4);

    this.pic_order_cnt_type = bitstream.ue_v();
    if (this.pic_order_cnt_type > 2) {
      throw new Error("SPS error: pic_order_cnt_type must be 2 or less");
    }

    switch (this.pic_order_cnt_type) {
      case 0:
        this.log2_max_pic_order_cnt_lsb_minus4 = bitstream.ue_v();
        if (this.log2_max_pic_order_cnt_lsb_minus4 > 12) {
          throw new Error("SPS error: log2_max_pic_order_cnt_lsb_minus4 must be 12 or less");
        }
        this.maxPicOrderCntLsb = 1 << (this.log2_max_pic_order_cnt_lsb_minus4 + 4);
        break;
      case 1:
        this.delta_pic_order_always_zero_flag = bitstream.u_1();
        this.offset_for_non_ref_pic = bitstream.se_v();
        this.offset_for_top_to_bottom_field = bitstream.se_v();
        this.num_ref_frames_in_pic_order_cnt_cycle = bitstream.ue_v();
        this.offset_for_ref_frame = [];
        for (let i = 0; i < this.num_ref_frames_in_pic_order_cnt_cycle; i++) {
          const offsetForRefFrame = bitstream.se_v();
          this.offset_for_ref_frame.push(offsetForRefFrame);
        }
        break;
      case 2:
        /* there is nothing for case 2 */
        break;
    }

    this.max_num_ref_frames = bitstream.ue_v();
    this.gaps_in_frame_num_value_allowed_flag = bitstream.u_1();
    this.pic_width_in_mbs_minus_1 = bitstream.ue_v();
    this.picWidth = (this.pic_width_in_mbs_minus_1 + 1) << 4;
    this.pic_height_in_map_units_minus_1 = bitstream.ue_v();
    this.frame_mbs_only_flag = bitstream.u_1();
    this.interlaced = this.frame_mbs_only_flag === 0;
    if (this.frame_mbs_only_flag === 0) {
      /* 1 if frames rather than fields (no interlacing) */
      this.mb_adaptive_frame_field_flag = bitstream.u_1();
    }
    this.picHeight =
      ((2 - this.frame_mbs_only_flag) * (this.pic_height_in_map_units_minus_1 + 1)) << 4;

    this.direct_8x8_inference_flag = bitstream.u_1();
    this.frame_cropping_flag = bitstream.u_1();
    if (this.frame_cropping_flag !== 0) {
      // Determine the chroma sample to luma sample ratio in each dimension
      const chromaFormatIdc = this.chroma_format_idc ?? 1;
      let subWidthC = 1;
      let subHeightC = 1;
      if (chromaFormatIdc === 0) {
        // Monochrome
      } else if (chromaFormatIdc === 1) {
        // 4:2:0
        subWidthC = 2;
        subHeightC = 2;
      } else if (chromaFormatIdc === 2) {
        // 4:2:2
        subWidthC = 2;
        subHeightC = 1;
      } else if (chromaFormatIdc === 3) {
        // 4:4:4
        subWidthC = 1;
        subHeightC = 1;
      }

      this.frame_cropping_rect_left_offset = bitstream.ue_v();
      this.frame_cropping_rect_right_offset = bitstream.ue_v();
      this.frame_cropping_rect_top_offset = bitstream.ue_v();
      this.frame_cropping_rect_bottom_offset = bitstream.ue_v();
      const leftPixelCrop = this.frame_cropping_rect_left_offset * subWidthC;
      const rightPixelCrop = this.frame_cropping_rect_right_offset * subWidthC;
      const topPixelCrop = this.frame_cropping_rect_top_offset * subHeightC;
      const bottomPixelCrop = this.frame_cropping_rect_bottom_offset * subHeightC;
      this.cropRect = {
        x: leftPixelCrop,
        y: topPixelCrop,
        width: this.picWidth - (leftPixelCrop + rightPixelCrop),
        height: this.picHeight - (topPixelCrop + bottomPixelCrop),
      };
    } else {
      this.cropRect = {
        x: 0,
        y: 0,
        width: this.picWidth,
        height: this.picHeight,
      };
    }
    this.vui_parameters_present_flag = bitstream.u_1();
    if (this.vui_parameters_present_flag !== 0) {
      this.aspect_ratio_info_present_flag = bitstream.u_1();
      if (this.aspect_ratio_info_present_flag !== 0) {
        this.aspect_ratio_idc = bitstream.u_8();
        if (this.aspect_ratio_idc === 255) {
          this.sar_width = bitstream.u(16);
          this.sar_height = bitstream.u(16);
        } else if (this.aspect_ratio_idc > 0 && this.aspect_ratio_idc <= 16) {
          const sar = ASPECT_RATIO_IDC_VALUES[this.aspect_ratio_idc]!;
          this.sar_width = sar[0];
          this.sar_height = sar[1];
        }
      }

      this.overscan_info_present_flag = bitstream.u_1();
      if (this.overscan_info_present_flag !== 0) {
        this.overscan_appropriate_flag = bitstream.u_1();
      }
      this.video_signal_type_present_flag = bitstream.u_1();
      if (this.video_signal_type_present_flag !== 0) {
        this.video_format = bitstream.u(3);
        this.video_full_range_flag = bitstream.u_1();
        this.color_description_present_flag = bitstream.u_1();
        if (this.color_description_present_flag !== 0) {
          this.color_primaries = bitstream.u_8();
          this.transfer_characteristics = bitstream.u_8();
          this.matrix_coefficients = bitstream.u_8();
        }
      }
      this.chroma_loc_info_present_flag = bitstream.u_1();
      if (this.chroma_loc_info_present_flag !== 0) {
        this.chroma_sample_loc_type_top_field = bitstream.ue_v();
        this.chroma_sample_loc_type_bottom_field = bitstream.ue_v();
      }
      this.timing_info_present_flag = bitstream.u_1();
      if (this.timing_info_present_flag !== 0) {
        this.num_units_in_tick = bitstream.u(32);
        this.time_scale = bitstream.u(32);
        this.fixed_frame_rate_flag = bitstream.u_1();
        if (this.num_units_in_tick !== 0 && this.time_scale !== 0 && this.num_units_in_tick !== 0) {
          this.framesPerSecond = this.time_scale / (2 * this.num_units_in_tick);
        }
      }
      this.nal_hrd_parameters_present_flag = bitstream.u_1();
    }
  }

  public profileCompatibility(): number {
    let v = this.constraint_set0_flag << 7;
    v |= this.constraint_set1_flag << 6;
    v |= this.constraint_set2_flag << 5;
    v |= this.constraint_set3_flag << 4;
    v |= this.constraint_set4_flag << 3;
    v |= this.constraint_set5_flag << 1;
    return v;
  }

  public MIME(): string {
    const f = [];
    f.push("avc1.");
    f.push(byteToHex(this.profile_idc).toUpperCase());
    f.push(byteToHex(this.profileCompatibility()).toUpperCase());
    f.push(byteToHex(this.level_idc).toUpperCase());
    return f.join("");
  }
}

function byteToHex(val: number): string {
  return ("00" + val.toString(16)).slice(-2);
}

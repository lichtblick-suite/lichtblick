// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265 } from "./H265";
import { SPS } from "./SPS";
import { DEFAULT_HEVC_CODEC } from "./constants";

describe("SPS", () => {
  // A hand-authored, valid HEVC (H.265) Main-profile SPS NAL unit (2-byte NAL header + RBSP
  // payload, no Annex-B start code). It is not captured from a real encoder; the bytes were
  // assembled to match the `seq_parameter_set_rbsp()` field order in ISO/IEC 23008-2 §7.3.2.2.1
  // and encode: nal_unit_type=33 (SPS_NUT), general_profile_idc=1, compatibility flags -> 6,
  // general_tier_flag=0, general_level_idc=93, constraint bytes [0xB0,0,0,0,0,0],
  // chroma_format_idc=1 (4:2:0), pic_width=1920, pic_height=1088, no conformance window, 8-bit
  // depths. It yields picWidth=1920, picHeight=1088 and the codec string "hvc1.1.6.L93.B0".
  function createValidNALU() {
    return [
      0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5d,
      0xa0, 0x03, 0xc0, 0x80, 0x11, 0x05, 0x80,
    ];
  }

  // The same SPS as `createValidNALU`, but with conformance_window_flag=1 and
  // conf_win_bottom_offset=4. That crops 4 * subHeightC (2) = 8 luma rows, reducing the coded
  // height from 1088 to a display height of 1080.
  function createCroppedNALU() {
    return [
      0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5d,
      0xa0, 0x03, 0xc0, 0x80, 0x11, 0x07, 0xcb, 0x80,
    ];
  }

  // The `createValidNALU` bitstream after applying HEVC emulation prevention: a 0x03 byte is
  // inserted wherever two 0x00 bytes are followed by a byte <= 0x03. The parser's Bitstream must
  // transparently strip these bytes and yield the identical parsed result.
  function createEmulatedNALU() {
    return [
      0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x03, 0x00, 0xb0, 0x00, 0x00, 0x03, 0x00, 0x00,
      0x03, 0x00, 0x5d, 0xa0, 0x03, 0xc0, 0x80, 0x11, 0x05, 0x80,
    ];
  }

  it("Parses a valid HEVC SPS NALU correctly", () => {
    // Given a valid HEVC Main-profile SPS NAL unit
    const NALU = createValidNALU();

    // When it is parsed
    const sps = new SPS(new Uint8Array(NALU));

    // Then every parsed field matches the encoded SPS
    expect(sps.forbidden_zero_bit).toBe(0);
    expect(sps.nal_unit_type).toBe(33);
    expect(sps.nuh_layer_id).toBe(0);
    expect(sps.nuh_temporal_id_plus1).toBe(1);
    expect(sps.sps_video_parameter_set_id).toBe(0);
    expect(sps.sps_max_sub_layers_minus1).toBe(0);
    expect(sps.sps_temporal_id_nesting_flag).toBe(1);
    expect(sps.general_profile_space).toBe(0);
    expect(sps.general_tier_flag).toBe(0);
    expect(sps.general_profile_idc).toBe(1);
    expect(sps.general_profile_compatibility_flags).toBe(6);
    expect(sps.general_constraint_indicator_bytes).toEqual([0xb0, 0, 0, 0, 0, 0]);
    expect(sps.general_level_idc).toBe(93);
    expect(sps.sps_seq_parameter_set_id).toBe(0);
    expect(sps.chroma_format_idc).toBe(1);
    expect(sps.separate_colour_plane_flag).toBe(0);
    expect(sps.chromaArrayType).toBe(1);
    expect(sps.pic_width_in_luma_samples).toBe(1920);
    expect(sps.pic_height_in_luma_samples).toBe(1088);
    expect(sps.conformance_window_flag).toBe(0);
    expect(sps.conf_win_left_offset).toBe(0);
    expect(sps.conf_win_right_offset).toBe(0);
    expect(sps.conf_win_top_offset).toBe(0);
    expect(sps.conf_win_bottom_offset).toBe(0);
    expect(sps.bit_depth_luma_minus8).toBe(0);
    expect(sps.bit_depth_chroma_minus8).toBe(0);
    expect(sps.picWidth).toBe(1920);
    expect(sps.picHeight).toBe(1088);
    expect(sps.cropRect).toEqual({ x: 0, y: 0, width: 1920, height: 1088 });
    expect(sps.MIME()).toBe("hvc1.1.6.L93.B0");
    expect(sps.MIME()).toBe(DEFAULT_HEVC_CODEC);
  });

  it("Applies the conformance window offsets to the crop rect", () => {
    // Given an SPS whose conformance window crops 4 chroma rows from the bottom
    const NALU = createCroppedNALU();

    // When it is parsed
    const sps = new SPS(new Uint8Array(NALU));

    // Then the crop rect height is reduced by 4 * subHeightC (2) = 8 luma samples
    expect(sps.conformance_window_flag).toBe(1);
    expect(sps.conf_win_bottom_offset).toBe(4);
    expect(sps.picWidth).toBe(1920);
    expect(sps.picHeight).toBe(1088);
    expect(sps.cropRect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("Decodes identically through the emulation-prevention path", () => {
    // Given the same SPS carrying emulation-prevention 0x03 bytes
    const NALU = createEmulatedNALU();

    // When it is parsed
    const sps = new SPS(new Uint8Array(NALU));

    // Then the deemulated result matches the non-emulated fixture
    expect(sps.picWidth).toBe(1920);
    expect(sps.picHeight).toBe(1088);
    expect(sps.MIME()).toBe("hvc1.1.6.L93.B0");
  });

  it("Parses the SPS end-to-end via H265.ParseDecoderConfig", () => {
    // Given an Annex-B frame containing only the SPS NAL unit
    const frame = new Uint8Array([0x00, 0x00, 0x00, 0x01, ...createValidNALU()]);

    // When the decoder config is derived from the frame
    const config = H265.ParseDecoderConfig(frame);

    // Then it reports the codec string and coded dimensions from the SPS
    expect(config).toEqual({
      codec: "hvc1.1.6.L93.B0",
      codedWidth: 1920,
      codedHeight: 1088,
    });
  });

  describe("SPS Constructor Exceptions", () => {
    it("Throws an error for invalid forbidden_zero_bit", () => {
      // Given a NALU whose forbidden_zero_bit is set
      const NALU = createValidNALU();
      NALU[0] = 0xc2; // 0x42 | 0x80: forbidden_zero_bit = 1

      // When it is parsed / Then it throws
      expect(() => new SPS(new Uint8Array(NALU))).toThrow("NALU error: invalid NALU header");
    });

    it("Throws an error when the NAL unit is not an SPS", () => {
      // Given a NALU header whose nal_unit_type is 32 (VPS_NUT) instead of 33 (SPS_NUT)
      const NALU = createValidNALU();
      NALU[0] = 0x40; // 0100 0000: forbidden_zero_bit = 0, nal_unit_type = 32

      // When it is parsed / Then it throws
      expect(() => new SPS(new Uint8Array(NALU))).toThrow("SPS error: not SPS");
    });
  });
});

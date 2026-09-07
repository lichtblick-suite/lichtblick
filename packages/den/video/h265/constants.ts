// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265NaluType } from "./types";

export const DEFAULT_HEVC_CODEC = "hvc1.1.6.L93.B0";

export const H265_RANDOM_ACCESS_TYPES = new Set<number>([
  H265NaluType.BLA_W_LP,
  H265NaluType.BLA_W_RADL,
  H265NaluType.BLA_N_LP,
  H265NaluType.IDR_W_RADL,
  H265NaluType.IDR_N_LP,
  H265NaluType.CRA_NUT,
  H265NaluType.RSV_IRAP_VCL22,
  H265NaluType.RSV_IRAP_VCL23,
]);

/**
 * H.265 (HEVC) decoders, especially when running through the software fallback, can stall for
 * hundreds of milliseconds before producing output and may need to consume an entire GOP before
 * emitting the target frame. The 2000 ms ceiling reflects the worst case observed on real-world
 * recordings; lowering it causes seek-to-P-frame playback to surface as decode timeouts instead
 * of correct frames. The "target wait" is equal to the overall max because HEVC decoders rarely
 * produce an intermediate frame within the H.264 budget.
 */
export const H265_MAX_DECODE_WAIT_MS = 2000;
export const H265_TARGET_FRAME_WAIT_MS = H265_MAX_DECODE_WAIT_MS;

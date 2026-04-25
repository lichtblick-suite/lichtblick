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

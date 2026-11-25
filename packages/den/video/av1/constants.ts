// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Bit layout of the OBU header byte (AV1 specification section 5.3.2):
 * `obu_forbidden_bit` f(1), `obu_type` f(4), `obu_extension_flag` f(1), `obu_has_size_field` f(1),
 * `obu_reserved_1bit` f(1).
 */
export const OBU_HEADER_MUST_BE_ZERO_MASK = 0x81;
export const OBU_TYPE_SHIFT = 3;
export const OBU_TYPE_MASK = 0x0f;
export const OBU_EXTENSION_FLAG = 0x04;
export const OBU_HAS_SIZE_FLAG = 0x02;

/** Reserved bits of `obu_extension_header()` (AV1 specification section 5.3.3). */
export const OBU_EXTENSION_MUST_BE_ZERO_MASK = 0x07;

/** `leb128()` encodes at most eight bytes, seven payload bits each (section 4.10.5). */
export const LEB128_MAX_BYTES = 8;
export const LEB128_CONTINUATION_FLAG = 0x80;
export const LEB128_PAYLOAD_MASK = 0x7f;
export const LEB128_PAYLOAD_BITS = 7;

/**
 * `uvlc()` returns `(1 << 32) - 1` once it has read 32 leading zeros, rather than continuing to
 * read a value that cannot be represented (section 4.10.3).
 */
export const UVLC_MAX_LEADING_ZEROS = 32;
export const UVLC_ESCAPE_VALUE = 0xffffffff;

/**
 * Pieces of the WebCodecs AV1 codec string `av01.<profile>.<level><tier>.<bitDepth>`, whose level
 * and bit depth fields are two digits each.
 */
export const AV1_CODEC_PREFIX = "av01";
export const AV1_CODEC_FIELD_DIGITS = 2;
export const AV1_MAIN_TIER = "M";
export const AV1_HIGH_TIER = "H";

/** `seq_profile` value of the Professional profile, the only one that can code 12-bit streams. */
export const AV1_PROFILE_PROFESSIONAL = 2;

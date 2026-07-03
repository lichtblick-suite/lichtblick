// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum H265NaluType {
  BLA_W_LP = 16,
  BLA_W_RADL = 17,
  BLA_N_LP = 18,
  IDR_W_RADL = 19,
  IDR_N_LP = 20,
  CRA_NUT = 21,
  RSV_IRAP_VCL22 = 22,
  RSV_IRAP_VCL23 = 23,
  VPS_NUT = 32,
  SPS_NUT = 33,
  PPS_NUT = 34,
}

export enum H265SliceType {
  B = 0,
  P = 1,
  I = 2,
}

export type H265FrameType = "B" | "P" | "I" | "unknown";
export type H265BitstreamFormat = "annex-b" | "length-prefixed" | "unknown";

export type H265ParserContext = {
  parameterSets?: Uint8Array;
};

export type H265FrameInfo = {
  bitstreamFormat: H265BitstreamFormat;
  /**
   * True when the frame contains a NAL unit whose type is in
   * `H265_RANDOM_ACCESS_TYPES` (IDR/CRA/BLA/reserved IRAP). For H.265, IRAP
   * pictures are the only points where decoding can start without dependencies,
   * so they are exactly what the WebCodecs VideoDecoder treats as "key" chunks.
   */
  isKeyframe: boolean;
  frameType: H265FrameType;
  sliceTypes: H265SliceType[];
  hasUnparsedVclSlice: boolean;
  normalizedData?: Uint8Array;
  /** `normalizedData` with VPS/SPS/PPS NAL units removed, or undefined if none were present. */
  strippedData?: Uint8Array;
  parameterSets?: Uint8Array;
  hasRequiredParameterSets: boolean;
  diagnostics?: string;
};

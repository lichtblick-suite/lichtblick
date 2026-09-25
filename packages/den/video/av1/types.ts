// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * `obu_type` values of the AV1 Open Bitstream Unit header (AV1 specification section 6.2.2).
 */
export enum AV1ObuType {
  SequenceHeader = 1,
  TemporalDelimiter = 2,
  FrameHeader = 3,
  TileGroup = 4,
  Metadata = 5,
  Frame = 6,
  RedundantFrameHeader = 7,
  TileList = 8,
  Padding = 15,
}

/**
 * `frame_type` values of the AV1 uncompressed header (AV1 specification section 6.8.2). Only
 * `KeyFrame` resets every reference frame slot and is therefore a random-access point.
 */
export enum AV1FrameType {
  KeyFrame = 0,
  InterFrame = 1,
  IntraOnlyFrame = 2,
  SwitchFrame = 3,
}

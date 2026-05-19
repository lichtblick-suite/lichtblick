// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Find the index of the next Annex B start code (0x000001 or 0x00000001) in
 * the given buffer, starting at the given offset. Shared between H.264 and
 * H.265 since both formats use the same Annex B framing.
 *
 * Returns `data.length` if no start code is found.
 */
export function findNextStartCode(data: Uint8Array, start: number): number {
  let i = start;
  while (i < data.length - 3) {
    const isStartCode3Bytes = data[i + 0] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
    if (isStartCode3Bytes) {
      return i;
    }
    const isStartCode4Bytes =
      i + 3 < data.length &&
      data[i + 0] === 0 &&
      data[i + 1] === 0 &&
      data[i + 2] === 0 &&
      data[i + 3] === 1;
    if (isStartCode4Bytes) {
      return i;
    }
    i++;
  }
  return data.length;
}

/**
 * Find the index immediately after the next Annex B start code, i.e. the index
 * of the first byte of the NAL unit that follows. Returns `data.length` if no
 * start code is found.
 */
export function findNextStartCodeEnd(data: Uint8Array, start: number): number {
  const startCodeStart = findNextStartCode(data, start);
  if (startCodeStart === data.length) {
    return data.length;
  }
  // 4-byte start code is 0x00000001; otherwise it must be the 3-byte 0x000001.
  const is4Byte =
    startCodeStart + 3 < data.length &&
    data[startCodeStart] === 0 &&
    data[startCodeStart + 1] === 0 &&
    data[startCodeStart + 2] === 0 &&
    data[startCodeStart + 3] === 1;
  return startCodeStart + (is4Byte ? 4 : 3);
}

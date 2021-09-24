// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum RecordType {
  MIN = 0x01,
  CHANNEL_INFO = 0x01,
  MESSAGE = 0x02,
  CHUNK = 0x03,
  INDEX_DATA = 0x04,
  CHUNK_INFO = 0x05,
  FOOTER = 0x06,
  MAX = 0x06,
}

/** Array.from("\x89MCAP\r\n\n", (c) => c.charCodeAt(0)) */
export const MCAP_MAGIC = Object.freeze([137, 77, 67, 65, 80, 13, 10, 10]);

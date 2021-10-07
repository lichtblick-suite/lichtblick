// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type McapMagic = {
  type: "Magic";
  formatVersion: 1;
};
export type ChannelInfo = {
  type: "ChannelInfo";
  id: number;
  topic: string;
  encoding: string;
  schemaName: string;
  schema: string;
  data: ArrayBuffer;
};
export type Message = {
  type: "Message";
  channelInfo: ChannelInfo;
  timestamp: bigint;
  data: ArrayBuffer;
};
export type Chunk = {
  type: "Chunk";
  compression: string;
  decompressedSize: bigint;
  decompressedCrc: number;
  data: ArrayBuffer;
};
export type IndexData = {
  type: "IndexData";
};
export type ChunkInfo = {
  type: "ChunkInfo";
};
export type Footer = {
  type: "Footer";
  indexPos: bigint;
  indexCrc: number;
};

export type McapRecord = ChannelInfo | Message | Chunk | IndexData | ChunkInfo | Footer;

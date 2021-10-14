// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual } from "lodash";

import { MCAP_MAGIC, RecordType } from "./constants";
import { McapMagic, McapRecord, ChannelInfo } from "./types";

// DataView.getBigUint64 was added to relatively recent versions of Safari. It's pretty easy to
// maintain this fallback code.
//
// eslint-disable-next-line @foxglove/no-boolean-parameters
const getBigUint64: (this: DataView, offset: number, littleEndian?: boolean) => bigint =
  typeof DataView.prototype.getBigUint64 === "function"
    ? DataView.prototype.getBigUint64 // eslint-disable-line @typescript-eslint/unbound-method
    : function (this: DataView, offset, littleEndian): bigint {
        const lo =
          littleEndian === true
            ? this.getUint32(offset, littleEndian)
            : this.getUint32(offset + 4, littleEndian);
        const hi =
          littleEndian === true
            ? this.getUint32(offset + 4, littleEndian)
            : this.getUint32(offset, littleEndian);
        return (BigInt(hi) << 32n) | BigInt(lo);
      };

/**
 * Parse a MCAP magic string and format version at `startOffset` in `view`.
 */
export function parseMagic(
  view: DataView,
  startOffset: number,
): { magic: McapMagic; usedBytes: number } | { magic?: undefined; usedBytes: 0 } {
  if (startOffset + MCAP_MAGIC.length + 1 > view.byteLength) {
    return { usedBytes: 0 };
  }
  if (!MCAP_MAGIC.every((val, i) => val === view.getUint8(startOffset + i))) {
    throw new Error(
      `Expected MCAP magic '${MCAP_MAGIC.map((val) => val.toString(16).padStart(2, "0")).join(
        " ",
      )}', found '${Array.from(MCAP_MAGIC, (_, i) =>
        view.getUint8(i).toString(16).padStart(2, "0"),
      ).join(" ")}'`,
    );
  }
  const formatVersion = view.getUint8(startOffset + MCAP_MAGIC.length);
  if (formatVersion !== 1) {
    throw new Error(`Unsupported format version ${formatVersion}`);
  }
  return {
    magic: { type: "Magic", formatVersion },
    usedBytes: MCAP_MAGIC.length + 1,
  };
}

/**
 * Parse a MCAP record beginning at `startOffset` in `view`.
 *
 * @param channelInfosById Used to track ChannelInfo objects across calls to `parseRecord` and
 * associate them with newly parsed Message records.
 * @param channelInfosSeenInThisChunk Used to validate that messages are preceded by a corresponding
 * ChannelInfo within the same chunk.
 */
export function parseRecord(
  view: DataView,
  startOffset: number,
  channelInfosById: Map<number, ChannelInfo>,
  channelInfosSeenInThisChunk: Set<number>,
): { record: McapRecord; usedBytes: number } | { record?: undefined; usedBytes: 0 } {
  if (startOffset + 5 >= view.byteLength) {
    return { usedBytes: 0 };
  }
  let offset = startOffset;

  const typeByte = view.getUint8(offset);
  offset += 1;
  if (typeByte < RecordType.MIN || typeByte > RecordType.MAX) {
    throw new Error(`Invalid record type ${typeByte}`);
  }
  const type = typeByte as RecordType;

  // Footer doesn't have an encoded length because it's always a fixed length.
  if (type === RecordType.FOOTER) {
    if (offset + 12 > view.byteLength) {
      return { usedBytes: 0 };
    }
    const indexPos = getBigUint64.call(view, offset, true);
    offset += 8;
    const indexCrc = view.getUint32(offset, true);
    offset += 4;

    const record: McapRecord = { type: "Footer", indexPos, indexCrc };
    return { record, usedBytes: offset - startOffset };
  }

  const recordLength = view.getUint32(offset, true);
  offset += 4;
  const recordEndOffset = offset + recordLength;
  if (recordEndOffset > view.byteLength) {
    return { usedBytes: 0 };
  }

  switch (type) {
    case RecordType.CHANNEL_INFO: {
      const id = view.getUint32(offset, true);
      offset += 4;
      const topicLength = view.getUint32(offset, true);
      offset += 4;
      const topic = new TextDecoder().decode(
        new DataView(view.buffer, view.byteOffset + offset, topicLength),
      );
      offset += topicLength;
      const encodingLen = view.getUint32(offset, true);
      offset += 4;
      const encoding = new TextDecoder().decode(
        new DataView(view.buffer, view.byteOffset + offset, encodingLen),
      );
      offset += encodingLen;
      const schemaNameLen = view.getUint32(offset, true);
      offset += 4;
      const schemaName = new TextDecoder().decode(
        new DataView(view.buffer, view.byteOffset + offset, schemaNameLen),
      );
      offset += schemaNameLen;
      const schemaLen = view.getUint32(offset, true);
      offset += 4;
      const schema = new TextDecoder().decode(
        new DataView(view.buffer, view.byteOffset + offset, schemaLen),
      );
      offset += schemaLen;
      const data = view.buffer.slice(view.byteOffset + offset, view.byteOffset + recordEndOffset);

      const record: McapRecord = {
        type: "ChannelInfo",
        id,
        topic,
        encoding,
        schemaName,
        schema,
        data,
      };
      channelInfosSeenInThisChunk.add(id);
      const existingInfo = channelInfosById.get(id);
      if (existingInfo) {
        if (!isEqual(existingInfo, record)) {
          throw new Error(`differing channel infos for ${record.id}`);
        }
        return { record: existingInfo, usedBytes: recordEndOffset - startOffset };
      } else {
        channelInfosById.set(id, record);
        return { record, usedBytes: recordEndOffset - startOffset };
      }
    }

    case RecordType.MESSAGE: {
      const channelId = view.getUint32(offset, true);
      offset += 4;
      const channelInfo = channelInfosById.get(channelId);
      if (!channelInfo) {
        throw new Error(`Encountered message on channel ${channelId} without prior channel info`);
      }
      if (!channelInfosSeenInThisChunk.has(channelId)) {
        throw new Error(
          `Encountered message on channel ${channelId} without prior channel info in this chunk; channel info must be repeated within each chunk where the channel is used`,
        );
      }
      const timestamp = getBigUint64.call(view, offset, true);
      offset += 8;
      const data = view.buffer.slice(view.byteOffset + offset, view.byteOffset + recordEndOffset);

      const record: McapRecord = { type: "Message", channelInfo, timestamp, data };
      return { record, usedBytes: recordEndOffset - startOffset };
    }

    case RecordType.CHUNK: {
      const decompressedSize = getBigUint64.call(view, offset, true);
      offset += 8;
      const decompressedCrc = view.getUint32(offset, true);
      offset += 4;
      const compressionLen = view.getUint32(offset, true);
      offset += 4;
      const compression = new TextDecoder().decode(
        new DataView(view.buffer, view.byteOffset + offset, compressionLen),
      );
      offset += compressionLen;
      const data = view.buffer.slice(view.byteOffset + offset, view.byteOffset + recordEndOffset);

      const record: McapRecord = {
        type: "Chunk",
        compression,
        decompressedSize,
        decompressedCrc,
        data,
      };
      channelInfosSeenInThisChunk.clear();
      return { record, usedBytes: recordEndOffset - startOffset };
    }

    case RecordType.INDEX_DATA:
      throw new Error("Not yet implemented");

    case RecordType.CHUNK_INFO:
      throw new Error("Not yet implemented");
  }
}

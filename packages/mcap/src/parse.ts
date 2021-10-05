// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MCAP_MAGIC, RecordType } from "./constants";
import { McapMagic, McapRecord } from "./types";

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
 */
export function parseRecord(
  view: DataView,
  startOffset: number,
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
    const indexPos = view.getBigUint64(offset, true);
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
      return { record, usedBytes: recordEndOffset - startOffset };
    }

    case RecordType.MESSAGE: {
      const channelId = view.getUint32(offset, true);
      offset += 4;
      const timestamp = view.getBigUint64(offset, true);
      offset += 8;
      const data = view.buffer.slice(view.byteOffset + offset, view.byteOffset + recordEndOffset);

      const record: McapRecord = { type: "Message", channelId, timestamp, data };
      return { record, usedBytes: recordEndOffset - startOffset };
    }

    case RecordType.CHUNK: {
      const decompressedSize = view.getBigUint64(offset, true);
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
      return { record, usedBytes: recordEndOffset - startOffset };
    }

    case RecordType.INDEX_DATA:
      throw new Error("Not yet implemented");

    case RecordType.CHUNK_INFO:
      throw new Error("Not yet implemented");
  }
}

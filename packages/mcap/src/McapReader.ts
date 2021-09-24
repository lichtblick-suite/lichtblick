// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { crc32 } from "@foxglove/crc";

import StreamBuffer from "./StreamBuffer";
import { MCAP_MAGIC } from "./constants";
import { parseMagic, parseRecord } from "./parse";
import { McapRecord } from "./types";

type McapReaderOptions = {
  /**
   * When set to true, Chunk records will be returned from `nextRecord()`. Chunk contents will still
   * be processed after each chunk record itself.
   */
  includeChunks?: boolean;

  /**
   * When a compressed chunk is encountered, the entry in `decompressHandlers` corresponding to the
   * compression will be called to decompress the chunk data.
   */
  decompressHandlers?: {
    [compression: string]: (buffer: DataView, decompressedSize: bigint) => DataView;
  };
};

/**
 * A streaming reader for Message Capture files.
 */
export default class McapReader {
  private buffer = new StreamBuffer(MCAP_MAGIC.length * 2);
  private decompressHandlers;
  private includeChunks;
  private doneReading = false;
  private generator = this.read();

  constructor({ includeChunks = false, decompressHandlers = {} }: McapReaderOptions = {}) {
    this.includeChunks = includeChunks;
    this.decompressHandlers = decompressHandlers;
  }

  done(): boolean {
    return this.doneReading;
  }

  bytesRemaining(): number {
    return this.buffer.bytesRemaining();
  }

  append(data: Uint8Array): void {
    if (this.doneReading) {
      throw new Error("Already done reading");
    }
    this.buffer.append(data);
  }

  nextRecord(): McapRecord | undefined {
    if (this.doneReading) {
      return undefined;
    }
    const result = this.generator.next();
    if (result.done === true) {
      this.doneReading = true;
    }
    return result.value;
  }

  private *read(): Generator<McapRecord | undefined, McapRecord | undefined, void> {
    {
      let magic, usedBytes;
      while ((({ magic, usedBytes } = parseMagic(this.buffer.view, 0)), !magic)) {
        yield;
      }
      this.buffer.consume(usedBytes);
    }

    for (;;) {
      let record;
      {
        let usedBytes;
        while ((({ record, usedBytes } = parseRecord(this.buffer.view, 0)), !record)) {
          yield;
        }
        this.buffer.consume(usedBytes);
      }
      switch (record.type) {
        case "ChannelInfo":
        case "Message":
        case "IndexData":
        case "ChunkInfo":
          yield record;
          break;

        case "Chunk": {
          if (this.includeChunks) {
            yield record;
          }
          let buffer = new DataView(record.data);
          if (record.compression !== "") {
            const decompress = this.decompressHandlers[record.compression];
            if (!decompress) {
              throw new Error(`Unsupported compression ${record.compression}`);
            }
            buffer = decompress(buffer, record.decompressedSize);
          }
          const chunkCrc = crc32(
            new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
          );
          if (chunkCrc !== record.decompressedCrc) {
            throw new Error(`Incorrect chunk CRC ${chunkCrc} (expected ${record.decompressedCrc})`);
          }
          let chunkOffset = 0;
          for (
            let chunkResult;
            (chunkResult = parseRecord(buffer, chunkOffset)), chunkResult.record;
            chunkOffset += chunkResult.usedBytes
          ) {
            switch (chunkResult.record.type) {
              case "Chunk":
              case "IndexData":
              case "ChunkInfo":
              case "Footer":
                throw new Error(`${chunkResult.record.type} record not allowed inside a chunk`);
              case "ChannelInfo":
              case "Message":
                yield chunkResult.record;
            }
          }
          if (chunkOffset !== buffer.byteLength) {
            throw new Error(`${buffer.byteLength - chunkOffset} bytes remaining in chunk`);
          }
          break;
        }
        case "Footer":
          {
            let magic, usedBytes;
            while ((({ magic, usedBytes } = parseMagic(this.buffer.view, 0)), !magic)) {
              yield;
            }
            this.buffer.consume(usedBytes);
          }
          if (this.buffer.bytesRemaining() !== 0) {
            throw new Error(
              `${this.buffer.bytesRemaining()} bytes remaining after MCAP footer and trailing magic`,
            );
          }
          return record;
      }
    }
  }
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { crc32 } from "@foxglove/crc";

import StreamBuffer from "./StreamBuffer";
import { MCAP_MAGIC } from "./constants";
import { parseMagic, parseRecord } from "./parse";
import { ChannelInfo, McapRecord } from "./types";

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
    [compression: string]: (buffer: Uint8Array, decompressedSize: bigint) => Uint8Array;
  };

  /**
   * When set to true (the default), chunk CRCs will be validated. Set to false to improve performance.
   */
  validateChunkCrcs?: boolean;
};

/**
 * A streaming reader for Message Capture files.
 *
 * Usage example:
 * ```
 * const reader = new McapReader();
 * stream.on("data", (data) => {
 *   try {
 *     reader.append(data);
 *     for (let record; (record = reader.nextRecord()); ) {
 *       // process available records
 *     }
 *   } catch (e) {
 *     // handle errors
 *   }
 * });
 * ```
 */
export default class McapReader {
  private buffer = new StreamBuffer(MCAP_MAGIC.length * 2);
  private decompressHandlers;
  private includeChunks;
  private validateChunkCrcs;
  private doneReading = false;
  private generator = this.read();

  constructor({
    includeChunks = false,
    decompressHandlers = {},
    validateChunkCrcs = true,
  }: McapReaderOptions = {}) {
    this.includeChunks = includeChunks;
    this.decompressHandlers = decompressHandlers;
    this.validateChunkCrcs = validateChunkCrcs;
  }

  /** @returns True if a valid, complete mcap file has been parsed. */
  done(): boolean {
    return this.doneReading;
  }

  /** @returns The number of bytes that have been received by `append()` but not yet parsed. */
  bytesRemaining(): number {
    return this.buffer.bytesRemaining();
  }

  /**
   * Provide the reader with newly received bytes for it to process. After calling this function,
   * call `nextRecord()` again to parse any records that are now available.
   */
  append(data: Uint8Array): void {
    if (this.doneReading) {
      throw new Error("Already done reading");
    }
    this.buffer.append(data);
  }

  /**
   * Read the next record from the stream if possible. If not enough data is available to parse a
   * complete record, or if the reading has terminated with a valid footer, returns undefined.
   *
   * This function may throw any errors encountered during parsing. If an error is thrown, the
   * reader is in an unspecified state and should no longer be used.
   */
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
    const channelInfosById = new Map<number, ChannelInfo>();
    const channelInfosSeenInThisChunk = new Set<number>();
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
        while (
          (({ record, usedBytes } = parseRecord(
            this.buffer.view,
            0,
            channelInfosById,
            channelInfosSeenInThisChunk,
          )),
          !record)
        ) {
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
          let buffer = new Uint8Array(record.data);
          if (record.compression !== "" && record.data.byteLength > 0) {
            const decompress = this.decompressHandlers[record.compression];
            if (!decompress) {
              throw new Error(`Unsupported compression ${record.compression}`);
            }
            buffer = decompress(buffer, record.decompressedSize);
          }
          if (this.validateChunkCrcs) {
            const chunkCrc = crc32(buffer);
            if (chunkCrc !== record.decompressedCrc) {
              throw new Error(
                `Incorrect chunk CRC ${chunkCrc} (expected ${record.decompressedCrc})`,
              );
            }
          }
          const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
          let chunkOffset = 0;
          for (
            let chunkResult;
            (chunkResult = parseRecord(
              view,
              chunkOffset,
              channelInfosById,
              channelInfosSeenInThisChunk,
            )),
              chunkResult.record;
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

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { detectVersion, DETECT_VERSION_BYTES_REQUIRED, Mcap0IndexedReader } from "@foxglove/mcap";
import { loadDecompressHandlers } from "@foxglove/mcap-support";
import { Time } from "@foxglove/rostime";
import {
  RandomAccessDataProvider,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
} from "@foxglove/studio-base/randomAccessDataProviders/types";

import Mcap0IndexedDataProvider from "./Mcap0IndexedDataProvider";
import Mcap0StreamedDataProvider from "./Mcap0StreamedDataProvider";
import McapPre0DataProvider from "./McapPre0DataProvider";

type Options = { file: File };

class FileReadable {
  constructor(private file: File) {}
  async size(): Promise<bigint> {
    return BigInt(this.file.size);
  }
  async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    if (offset + size > this.file.size) {
      throw new Error(
        `Read of ${size} bytes at offset ${offset} exceeds file size ${this.file.size}`,
      );
    }
    return new Uint8Array(
      await this.file.slice(Number(offset), Number(offset + size)).arrayBuffer(),
    );
  }
}

async function tryCreateIndexedReader(file: File) {
  const readable = new FileReadable(file);
  const decompressHandlers = await loadDecompressHandlers();
  const reader = await Mcap0IndexedReader.Initialize({ readable, decompressHandlers });

  let hasMissingSchemas = false;
  for (const channel of reader.channelsById.values()) {
    if (channel.schemaId !== 0 && !reader.schemasById.has(channel.schemaId)) {
      hasMissingSchemas = true;
      break;
    }
  }
  if (reader.chunkIndexes.length === 0 || reader.channelsById.size === 0 || hasMissingSchemas) {
    throw new Error("Summary does not contain chunk indexes, schemas, and channels");
  }
  return reader;
}

/**
 * Detect the version of an mcap file and delegate to the corresponding provider version.
 */
export default class McapDataProvider implements RandomAccessDataProvider {
  private options: Options;
  private provider?: RandomAccessDataProvider;
  constructor(options: Options) {
    this.options = options;
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const { file } = this.options;
    const prefix = await file.slice(0, DETECT_VERSION_BYTES_REQUIRED).arrayBuffer();

    switch (detectVersion(new DataView(prefix))) {
      case undefined:
        throw new Error(
          `File is not valid MCAP. Prefix bytes: <${Array.from(new Uint8Array(prefix), (byte) =>
            byte.toString().padStart(2, "0"),
          ).join(" ")}>`,
        );
      case "pre0":
        this.provider = new McapPre0DataProvider(this.options);
        return await this.provider.initialize(extensionPoint);
      case "0": {
        let reader: Mcap0IndexedReader;
        try {
          reader = await tryCreateIndexedReader(file);
        } catch (error) {
          // Fall back to unindexed (streamed) reading
          this.provider = new Mcap0StreamedDataProvider(this.options);
          const result = await this.provider.initialize(extensionPoint);
          return {
            ...result,
            problems: [
              ...result.problems,
              {
                message: "MCAP file is unindexed, falling back to streamed reading",
                severity: "warn",
                error,
              },
            ],
          };
        }
        this.provider = new Mcap0IndexedDataProvider(reader);
        return await this.provider.initialize(extensionPoint);
      }
    }
  }

  async getMessages(
    start: Time,
    end: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    if (!this.provider) {
      throw new Error("Data provider has not been initialized");
    }
    return await this.provider.getMessages(start, end, subscriptions);
  }

  async close(): Promise<void> {
    if (!this.provider) {
      throw new Error("Data provider has not been initialized");
    }
    await this.provider.close();
  }
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Mcap0StreamReader,
  McapPre0Reader,
  detectVersion,
  DETECT_VERSION_BYTES_REQUIRED,
} from "@mcap/core";

import Logger from "@foxglove/log";
import { loadDecompressHandlers } from "@foxglove/mcap-support";

import getIndexedMcapInfo from "./getIndexedMcapInfo";
import getStreamedMcapInfo, {
  processMcap0Record,
  processMcapPre0Record,
} from "./getStreamedMcapInfo";
import { FileInfo } from "./types";

const log = Logger.getLogger(__filename);

export async function getMcapInfo(file: File): Promise<FileInfo> {
  const mcapVersion = detectVersion(
    new DataView(await file.slice(0, DETECT_VERSION_BYTES_REQUIRED).arrayBuffer()),
  );

  const decompressHandlers = await loadDecompressHandlers();
  switch (mcapVersion) {
    case undefined:
      throw new Error("Not a valid MCAP file");
    case "0":
      // Try indexed read
      try {
        return await getIndexedMcapInfo(file, decompressHandlers);
      } catch (error) {
        log.info("Failed to read MCAP file as indexed:", error);
      }

      return {
        fileType: "MCAP v0, unindexed",
        loadMoreInfo: async (reportProgress) =>
          await getStreamedMcapInfo(
            file,
            new Mcap0StreamReader({ includeChunks: true, decompressHandlers, validateCrcs: true }),
            processMcap0Record,
            "MCAP v0, unindexed",
            reportProgress,
          ),
      };

    case "pre0":
      return {
        fileType: "MCAP pre-v0",
        loadMoreInfo: async (reportProgress) =>
          await getStreamedMcapInfo(
            file,
            new McapPre0Reader({
              includeChunks: true,
              validateChunkCrcs: false,
              decompressHandlers,
            }),
            processMcapPre0Record,
            "MCAP pre-v0",
            reportProgress,
          ),
      };
  }
}

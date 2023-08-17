// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapStreamReader, hasMcapPrefix, McapConstants } from "@mcap/core";

import Logger from "@foxglove/log";
import { loadDecompressHandlers } from "@foxglove/mcap-support";

import getIndexedMcapInfo from "./getIndexedMcapInfo";
import getStreamedMcapInfo, { processMcapRecord } from "./getStreamedMcapInfo";
import { FileInfo } from "./types";

const log = Logger.getLogger(__filename);

export async function getMcapInfo(file: Blob): Promise<FileInfo> {
  const isValidMcap = hasMcapPrefix(
    new DataView(await file.slice(0, McapConstants.MCAP_MAGIC.length).arrayBuffer()),
  );

  if (!isValidMcap) {
    throw new Error("Not a valid MCAP file");
  }

  const decompressHandlers = await loadDecompressHandlers();
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
        new McapStreamReader({ includeChunks: true, decompressHandlers, validateCrcs: true }),
        processMcapRecord,
        "MCAP v0, unindexed",
        reportProgress,
      ),
  };
}

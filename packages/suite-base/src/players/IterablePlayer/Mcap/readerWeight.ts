// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader } from "@mcap/core";

// Heuristic per-reader resident-memory weights (bytes) used by the pool's byte budget. Absolute
// values are approximate; the RELATIVE weighting (heavier index/more channels => evicted sooner)
// is what matters. Calibrate against real datasets before loosening pool defaults.
export const READER_BASE_BYTES = 2 * 1024 * 1024; // fixed reader/deserializer overhead
// Fixed scalar fields of one ChunkIndex entry (offsets, lengths, times, compression string).
const BYTES_PER_CHUNK_INDEX_BASE = 128;
// One entry in a ChunkIndex's `messageIndexOffsets: Map<number, bigint>` — one entry per channel
// PRESENT IN THAT CHUNK. This dominates real resident memory far more than a chunk index's own
// fixed fields: total cost scales with chunkCount × channelsPerChunk, not chunk count alone. A
// prior flat per-chunk-index estimate ignored this entirely, which was the single largest known
// contributor to underestimating real per-file memory (an internal report observed ~150 MiB
// resident for a ~611-channel file against a ~26-30 MiB estimate from the old formula).
const BYTES_PER_MESSAGE_INDEX_ENTRY = 64;
const BYTES_PER_CHANNEL = 16 * 1024; // parsed schema + per-channel deserializer

export function estimateReaderWeightBytes(reader: McapIndexedReader): number {
  let messageIndexEntries = 0;
  for (const chunkIndex of reader.chunkIndexes) {
    messageIndexEntries += chunkIndex.messageIndexOffsets.size;
  }
  return (
    READER_BASE_BYTES +
    reader.chunkIndexes.length * BYTES_PER_CHUNK_INDEX_BASE +
    messageIndexEntries * BYTES_PER_MESSAGE_INDEX_ENTRY +
    reader.channelsById.size * BYTES_PER_CHANNEL
  );
}

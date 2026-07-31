// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader } from "@mcap/core";

// Heuristic per-reader resident-memory weights (bytes) used by the pool's byte budget. Absolute
// values are approximate; the RELATIVE weighting (heavier index/more channels => evicted sooner)
// is what matters. Calibrate against real datasets before loosening pool defaults.
export const READER_BASE_BYTES = 2 * 1024 * 1024; // fixed reader/deserializer overhead
const BYTES_PER_CHUNK_INDEX = 512; // per chunk-index entry retained by McapIndexedReader
const BYTES_PER_CHANNEL = 16 * 1024; // parsed schema + per-channel deserializer

export function estimateReaderWeightBytes(reader: McapIndexedReader, cacheBytes: number): number {
  return (
    READER_BASE_BYTES +
    reader.chunkIndexes.length * BYTES_PER_CHUNK_INDEX +
    reader.channelsById.size * BYTES_PER_CHANNEL +
    cacheBytes
  );
}

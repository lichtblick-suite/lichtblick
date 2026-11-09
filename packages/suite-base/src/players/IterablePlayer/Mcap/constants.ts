// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** Default CachedFilelike cache size for RemoteFileReadable. */
export const DEFAULT_CACHE_SIZE_BYTES = 1024 * 1024 * 500; // 500MiB

// Telemetry for RemoteFileReadable (scope "pipeline", no labels: the URL is neither
// bounded nor safe to export). Counted once per read issued to the cached remote reader, i.e.
// after BatchingReadable coalesced same-tick MCAP reads; `bytesRead` counts the bytes those reads
// returned. Reads may be served by CachedFilelike's cache without a new HTTP range request.
export const READ_REQUESTS_METRIC = "pipeline.remote.readRequests";
export const BYTES_READ_METRIC = "pipeline.remote.bytesRead";

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import type {
  FileReader,
  FileStream,
  PrefetchedRange,
} from "@lichtblick/suite-base/util/CachedFilelike.types";
import FetchReader from "@lichtblick/suite-base/util/FetchReader";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

const CONTENT_RANGE_PATTERN = /^bytes (\d+)-(\d+)\/(\d+)$/;
// Covers the MCAP header, footer and small summaries in one round trip each.
const EDGE_PREFETCH_BYTES = 64 * 1024;

type OpenResult = { size: number; identifier?: string; prefetched?: PrefetchedRange[] };
type RangeResult = { size: number; identifier?: string; chunk: PrefetchedRange };

// A file reader that reads from a remote HTTP URL, for usage in the browser (not for node.js).
export default class BrowserHttpReader implements FileReader {
  #url: string;

  public constructor(url: string) {
    this.#url = url;
  }

  public async open(): Promise<OpenResult> {
    // Suffix ranges (`bytes=-N`) aren't CORS-safelisted; use them only when no preflight applies.
    if (isSameOrigin(this.#url)) {
      const edgeResult = await this.#tryOpenViaEdgeRanges();
      if (edgeResult) {
        return edgeResult;
      }
    }

    // A `bytes=0-0` probe avoids the server streaming the whole file, but needs `Content-Range`
    // exposed via CORS. When it isn't (or on any error, e.g. 403/404), we fall back to the full
    // GET below, costing one extra round trip.
    const probe = await this.#fetchRange("bytes=0-0");
    if (probe) {
      return { size: probe.size, identifier: probe.identifier };
    }

    let response: Response;
    try {
      // Make a GET request and then immediately cancel it. This is more robust than a HEAD request,
      // since the server might not accept HEAD requests (e.g. when using S3 presigned URLs that
      // only work for one particular method like GET).
      // Note that we cannot use `range: "bytes=0-1"` or so, because then we can't get the actual
      // file size without making Content-Range a CORS header, therefore making all this a bit less
      // robust.
      // "no-store" forces an unconditional remote request. When the browser's cache is populated,
      // it may add a `range` header to the request, which causes some servers to omit the
      // `accept-ranges` header in the response.
      const controller = new AbortController();
      response = await fetch(this.#url, { signal: controller.signal, cache: "no-store" });
      controller.abort();
    } catch (error) {
      let errMsg = `Fetching remote file failed. ${error}`;

      if (!isDesktopApp()) {
        errMsg +=
          "\n\nSometimes this is due to a CORS configuration error on the server. Make sure CORS is enabled.";
      }

      throw new Error(errMsg);
    }
    if (!response.ok) {
      throw new Error(
        `Fetching remote file failed. <${this.#url}> Status code: ${response.status}.`,
      );
    }
    if (response.headers.get("accept-ranges") !== "bytes") {
      let errMsg =
        "Support for HTTP Range requests was not detected on the remote file.\n\nConfirm the resource has an 'Accept-Ranges: bytes' header.";

      if (!isDesktopApp()) {
        errMsg +=
          "\n\nSometimes this is due to a CORS configuration error on the server. Make sure CORS is enabled with Access-Control-Allow-Origin, and that Access-Control-Expose-Headers includes Accept-Ranges.";
      }

      throw new Error(errMsg);
    }
    const size = response.headers.get("content-length");
    if (size == undefined) {
      throw new Error(`Remote file is missing file size. <${this.#url}>`);
    }
    return {
      size: parseInt(size),
      identifier:
        response.headers.get("etag") ?? response.headers.get("last-modified") ?? undefined,
    };
  }

  public fetch(offset: number, length: number): FileStream {
    const headers = new Headers({ range: `bytes=${offset}-${offset + (length - 1)}` });
    const reader = new FetchReader(this.#url, { headers });
    reader.read();
    return reader;
  }

  // Fetches the file's tail (size, MCAP footer and small summaries) and head in parallel.
  async #tryOpenViaEdgeRanges(): Promise<OpenResult | undefined> {
    const [tail, head] = await Promise.all([
      this.#fetchRange(`bytes=-${EDGE_PREFETCH_BYTES}`),
      this.#fetchRange(`bytes=0-${EDGE_PREFETCH_BYTES - 1}`),
    ]);
    if (!tail) {
      return undefined;
    }
    const prefetched = [tail.chunk];
    if (head?.size === tail.size && head.identifier === tail.identifier) {
      prefetched.push(head.chunk);
    }
    return { size: tail.size, identifier: tail.identifier, prefetched };
  }

  // Never throws; returns undefined unless the server answers with a complete, parsable 206.
  async #fetchRange(range: string): Promise<RangeResult | undefined> {
    let response: Response;
    try {
      response = await fetch(this.#url, { headers: { range }, cache: "no-store" });
    } catch {
      return undefined;
    }

    const match =
      response.status === 206
        ? CONTENT_RANGE_PATTERN.exec(response.headers.get("content-range") ?? "")
        : null;
    if (!match) {
      await response.body?.cancel();
      return undefined;
    }

    let data: Uint8Array;
    try {
      data = new Uint8Array(await response.arrayBuffer());
    } catch {
      return undefined;
    }
    const start = parseInt(match[1]!, 10);
    const end = parseInt(match[2]!, 10);
    const size = parseInt(match[3]!, 10);
    if (data.byteLength !== end - start + 1 || end >= size) {
      return undefined;
    }
    return {
      size,
      identifier:
        response.headers.get("etag") ?? response.headers.get("last-modified") ?? undefined,
      chunk: { offset: start, data },
    };
  }
}

function isSameOrigin(url: string): boolean {
  // `location` is undefined outside browsers/workers (e.g. in node).
  const origin = (globalThis as { location?: Location }).location?.origin;
  if (origin == undefined || origin === "null") {
    return false;
  }
  try {
    return new URL(url, origin).origin === origin;
  } catch {
    return false;
  }
}

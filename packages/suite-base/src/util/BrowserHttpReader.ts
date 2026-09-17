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

import type { FileReader, FileStream } from "@lichtblick/suite-base/util/CachedFilelike.types";
import FetchReader from "@lichtblick/suite-base/util/FetchReader";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

// Matches a single-range `Content-Range: bytes <start>-<end>/<total>` response header and
// extracts the total resource size. Deliberately does not match the unsatisfiable-range form
// (`bytes */<total>`) since that only occurs for out-of-bounds requests, which `bytes=0-0` never is.
const CONTENT_RANGE_TOTAL_PATTERN = /^bytes \d+-\d+\/(\d+)$/;

// A file reader that reads from a remote HTTP URL, for usage in the browser (not for node.js).
export default class BrowserHttpReader implements FileReader {
  #url: string;

  public constructor(url: string) {
    this.#url = url;
  }

  public async open(): Promise<{ size: number; identifier?: string }> {
    // Opportunistic fast path: a tiny `Range: bytes=0-0` probe can reveal the total file size via
    // `Content-Range` without the server (and any proxy in front of it) starting to stream the
    // entire object, unlike the full-GET-then-abort probe below. This only works when the
    // response exposes `Content-Range` (not guaranteed for arbitrary third-party servers, e.g. as
    // a CORS-exposed header), so any failure/ambiguity here silently falls back to the original
    // behavior. See ORIONINIT-211029 / docs/performance/README.md for the full rationale.
    const rangedProbeResult = await this.#tryOpenViaRangedProbe();
    if (rangedProbeResult) {
      return rangedProbeResult;
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

  /**
   * Attempts to resolve the file size via a single-byte ranged GET (`Range: bytes=0-0`) instead of
   * the full-GET-then-abort probe. Returns `undefined` (never throws) whenever the ranged request
   * fails, is ignored by the server (any status other than 206), or the response doesn't carry a
   * parsable `Content-Range` total -- in all of those cases `open()` falls back to the original,
   * more broadly compatible probe.
   */
  async #tryOpenViaRangedProbe(): Promise<{ size: number; identifier?: string } | undefined> {
    let response: Response;
    try {
      // "no-store" forces an unconditional remote request, same rationale as the full-GET probe.
      response = await fetch(this.#url, {
        headers: { range: "bytes=0-0" },
        cache: "no-store",
      });
    } catch {
      return undefined;
    }

    if (response.status !== 206) {
      // Server ignored the Range header (full 200 response) or otherwise doesn't support ranges.
      await response.body?.cancel();
      return undefined;
    }

    const size = parseTotalSizeFromContentRange(response.headers.get("content-range"));
    if (size == undefined) {
      await response.body?.cancel();
      return undefined;
    }

    await response.body?.cancel();
    return {
      size,
      identifier:
        response.headers.get("etag") ?? response.headers.get("last-modified") ?? undefined,
    };
  }
}

/** Parses the total resource size out of a `Content-Range: bytes <start>-<end>/<total>` header. */
function parseTotalSizeFromContentRange(contentRange: string | null): number | undefined {
  if (contentRange == undefined) {
    return undefined;
  }
  const match = CONTENT_RANGE_TOTAL_PATTERN.exec(contentRange);
  if (!match) {
    return undefined;
  }
  const size = parseInt(match[1]!, 10);
  return Number.isFinite(size) ? size : undefined;
}

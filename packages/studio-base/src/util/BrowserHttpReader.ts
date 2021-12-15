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

import { FileReader, FileStream } from "@foxglove/studio-base/util/CachedFilelike";
import FetchReader from "@foxglove/studio-base/util/FetchReader";

// A file reader that reads from a remote HTTP URL, for usage in the browser (not for node.js).
export default class BrowserHttpReader implements FileReader {
  private _url: string;

  constructor(url: string) {
    this._url = url;
  }

  async open(): Promise<{ size: number; identifier?: string }> {
    let response;
    try {
      // Make a GET request and then immediately cancel it. This is more robust than a HEAD request,
      // since the server might not accept HEAD requests (e.g. when using S3 presigned URLs that
      // only work for one particular method like GET).
      // Note that we cannot use `range: "bytes=0-1"` or so, because then we can't get the actual
      // file size without making Content-Range a CORS header, therefore making all this a bit less
      // robust.
      const controller = new AbortController();
      response = await fetch(this._url, { signal: controller.signal });
      controller.abort();
    } catch (error) {
      throw new Error(`Fetching remote file failed. <${this._url}> ${error}`);
    }
    if (!response.ok) {
      throw new Error(
        `Fetching remote file failed. <${this._url}> Status code: ${response.status}.`,
      );
    }
    if (response.headers.get("accept-ranges") !== "bytes") {
      throw new Error(`Remote file does not support HTTP Range Requests. <${this._url}>`);
    }
    const size = response.headers.get("content-length");
    if (size == undefined) {
      throw new Error(`Remote file is missing file size. <${this._url}>`);
    }
    return {
      size: parseInt(size),
      identifier:
        response.headers.get("etag") ?? response.headers.get("last-modified") ?? undefined,
    };
  }

  fetch(offset: number, length: number): FileStream {
    const headers = new Headers({ range: `bytes=${offset}-${offset + (length - 1)}` });
    return new FetchReader(this._url, { headers }) as FileStream;
  }
}

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
import { Readable } from "stream";

// A node.js-style readable stream wrapper for the Streams API:
// https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
export default class FetchReader extends Readable {
  private _response: Promise<Response>;
  private _reader?: ReadableStreamReader<Uint8Array>;
  private _controller: AbortController;
  private _aborted: boolean = false;
  private _url: string;

  constructor(url: string, options?: RequestInit) {
    super();
    this._url = url;
    this._controller = new AbortController();
    this._response = fetch(url, { ...options, signal: this._controller.signal });
  }

  // you can only call getReader once on a response body
  // so keep a local copy of the reader and return it after the first call to get a reader
  private async _getReader(): Promise<ReadableStreamReader<Uint8Array> | undefined> {
    if (this._reader) {
      return this._reader;
    }
    let data: Response;
    try {
      data = await this._response;
    } catch (err) {
      setImmediate(() => {
        this.emit("error", new Error(`Request failed, fetch failed: ${this._url}`));
      });
      return undefined;
    }
    if (!`${data.status}`.startsWith("2")) {
      setImmediate(() => {
        const requestId = data.headers.get("x-request-id");
        this.emit(
          "error",
          new Error(
            `Bad response status code (${data.status}): ${this._url}. x-request-id: ${requestId}`,
          ),
        );
      });
      return undefined;
    }

    if (!data.body) {
      setImmediate(() => {
        this.emit(
          "error",
          new Error(`Request succeeded, but failed to return a body: ${this._url}`),
        );
      });
      return undefined;
    }

    // The fetch succeeded, but there might still be an error streaming.
    try {
      // When a stream is closed or errors, any reader it is locked to is released.
      // If the getReader method is called on an already locked stream, an exception will be thrown.
      // This is caused by server-side errors, but we should catch it anyway.
      this._reader = data.body.getReader();
    } catch (err) {
      setImmediate(() => {
        this.emit("error", new Error(`Request succeeded, but failed to stream: ${this._url}`));
      });
      return undefined;
    }

    return this._reader;
  }

  override _read(): void {
    this._getReader()
      .then((reader) => {
        // if no reader is returned then we've encountered an error
        if (!reader) {
          return;
        }
        reader
          .read()
          .then(({ done, value }) => {
            // no more to read, signal stream is finished
            if (done) {
              // Null has a special meaning for streams
              // eslint-disable-next-line no-restricted-syntax
              this.push(null);
              return;
            }
            // TypeScript doesn't know that value is only undefined when value done is true
            if (value != undefined) {
              this.push(Buffer.from(value.buffer));
            }
          })
          .catch((err) => {
            // canceling the xhr request causes the promise to reject
            if (this._aborted) {
              // Null has a special meaning for streams
              // eslint-disable-next-line no-restricted-syntax
              this.push(null);
              return;
            }
            this.emit("error", err);
          });
      })
      .catch((err) => {
        this.emit("error", err);
      });
  }

  // aborts the xhr request if user calls stream.destroy()
  override _destroy(): void {
    this._aborted = true;
    this._controller.abort();
  }
}

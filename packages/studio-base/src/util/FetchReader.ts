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
import { EventEmitter } from "eventemitter3";

type EventTypes = {
  data: (chunk: Uint8Array) => void;
  end: () => void;
  error: (err: Error) => void;
};

// An event-emitting wrapper for the Streams API:
// https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
export default class FetchReader extends EventEmitter<EventTypes> {
  #response: Promise<Response>;
  #reader?: ReadableStreamDefaultReader<Uint8Array>;
  #controller: AbortController;
  #aborted: boolean = false;
  #url: string;

  public constructor(url: string, options?: RequestInit) {
    super();
    this.#url = url;
    this.#controller = new AbortController();
    this.#response = fetch(url, { ...options, signal: this.#controller.signal });
  }

  // you can only call getReader once on a response body
  // so keep a local copy of the reader and return it after the first call to get a reader
  async #getReader(): Promise<ReadableStreamDefaultReader<Uint8Array> | undefined> {
    if (this.#reader) {
      return this.#reader;
    }
    let data: Response;
    try {
      data = await this.#response;
    } catch (err) {
      this.emit("error", new Error(`GET <${this.#url}> failed: ${err}`));
      return undefined;
    }
    if (!data.ok) {
      const errMsg = data.statusText;
      this.emit(
        "error",
        new Error(
          `GET <$${this.#url}> failed with status ${data.status}${errMsg ? ` (${errMsg})` : ``}`,
        ),
      );
      return undefined;
    }

    if (!data.body) {
      this.emit("error", new Error(`GET <${this.#url}> succeeded, but returned no data`));
      return undefined;
    }

    // The fetch succeeded, but there might still be an error streaming.
    try {
      // When a stream is closed or errors, any reader it is locked to is released.
      // If the getReader method is called on an already locked stream, an exception will be thrown.
      // This is caused by server-side errors, but we should catch it anyway.
      this.#reader = data.body.getReader();
    } catch (err) {
      this.emit("error", new Error(`GET <${this.#url}> succeeded, but failed to stream`));
      return undefined;
    }

    return this.#reader;
  }

  public read(): void {
    this.#getReader()
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
              this.emit("end");
              return;
            }
            this.emit("data", value);
            this.read();
          })
          .catch((unk) => {
            // canceling the xhr request causes the promise to reject
            if (this.#aborted) {
              this.emit("end");
              return;
            }
            const err = unk instanceof Error ? unk : new Error(unk as string);
            this.emit("error", err);
          });
      })
      .catch((unk) => {
        const err = unk instanceof Error ? unk : new Error(unk as string);
        this.emit("error", err);
      });
  }

  public destroy(): void {
    this.#aborted = true;
    this.#controller.abort();
  }
}

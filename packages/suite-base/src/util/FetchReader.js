// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
import { EventEmitter } from "eventemitter3";
import Log from "@lichtblick/log";
const log = Log.getLogger(__filename);
// An event-emitting wrapper for the Streams API:
// https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
export default class FetchReader extends EventEmitter {
    #response;
    #reader;
    #controller;
    #aborted = false;
    #url;
    constructor(url, options) {
        super();
        this.#url = url;
        this.#controller = new AbortController();
        this.#response = fetch(url, { ...options, signal: this.#controller.signal });
    }
    // you can only call getReader once on a response body
    // so keep a local copy of the reader and return it after the first call to get a reader
    async #getReader() {
        if (this.#reader) {
            return this.#reader;
        }
        let data;
        try {
            data = await this.#response;
        }
        catch (err) {
            this.emit("error", new Error(`GET <${this.#url}> failed: ${err}`));
            return undefined;
        }
        if (!data.ok) {
            const errMsg = data.statusText;
            this.emit("error", new Error(`GET <$${this.#url}> failed with status ${data.status}${errMsg ? ` (${errMsg})` : ``}`));
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
        }
        catch (err) {
            log.error(`Failed to get reader for <${this.#url}>`, err);
            this.emit("error", new Error(`GET <${this.#url}> succeeded, but failed to stream`));
            return undefined;
        }
        return this.#reader;
    }
    read() {
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
                const err = unk instanceof Error ? unk : new Error(unk);
                this.emit("error", err);
            });
        })
            .catch((unk) => {
            const err = unk instanceof Error ? unk : new Error(unk);
            this.emit("error", err);
        });
    }
    destroy() {
        this.#aborted = true;
        this.#controller.abort();
    }
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "node:events";

import * as Comlink from "@lichtblick/comlink";

type ComlinkWorkerConstructor = new () => Comlink.Endpoint;

/**
 * makeComlinkWorkerMock provides a way to mock the global Worker class to _expose_ the worker
 * side of a comlink connection. The instance can be passed to a `Comlink.wrap()` call to
 * invoke methods on the underling class.
 *
 * ```
 * Object.defineProperty(global, "Worker", {
 *   writable: true,
 *   value: makeComlinkWorkerMock(() => new SomeClassThatYouExpose())
 * });
 * ```
 */
export function makeComlinkWorkerMock(makeInstance: () => unknown): ComlinkWorkerConstructor {
  class WorkerEndpoint extends EventEmitter {
    #client: WorkerClient;

    public constructor(client: WorkerClient) {
      super();
      this.#client = client;
    }

    public postMessage(msg: unknown): void {
      this.#client.emit("message", {
        data: msg,
      });
    }

    public addEventListener(event: string, fn: () => void): void {
      this.on(event, fn);
    }

    public removeEventListener(event: string, fn: () => void): void {
      this.off(event, fn);
    }
  }

  class WorkerClient extends EventEmitter implements Comlink.Endpoint {
    #server: WorkerEndpoint;
    public constructor() {
      super();

      this.#server = new WorkerEndpoint(this);
      Comlink.expose(makeInstance(), this.#server);
    }

    public postMessage(msg: unknown): void {
      this.#server.emit("message", {
        data: msg,
      });
    }

    public addEventListener(event: string, fn: () => void): void {
      this.on(event, fn);
    }

    public removeEventListener(event: string, fn: () => void): void {
      this.off(event, fn);
    }

    public terminate(): void {
      // no-op
    }
  }

  return WorkerClient;
}

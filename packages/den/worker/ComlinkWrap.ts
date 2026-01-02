// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";

/**
 * Wraps an instantiated `Worker` and exposes its API in the same way that `Comlink.wrap` does
 * but it also provides a `dispose` function to terminate the worker and release the comlink proxy.
 * This can help prevent memory leaks when the comlink proxy is unable to garbage collect itself due to
 * unresolved promises which can occur if the worker is terminated while processing a request.
 * This should be used instead of `Comlink.wrap` where possible.
 *
 * @param worker - worker to be wrapped by comlink
 * @returns remote - API for worker wrapped by comlink. What is normally received from Comlink.wrap
 * @returns dispose - function to release the comlink proxy and to terminate the worker
 */
export function ComlinkWrap<T>(worker: Worker): { remote: Comlink.Remote<T>; dispose: () => void } {
  const remote = Comlink.wrap<T>(worker);

  const dispose = () => {
    remote[Comlink.releaseProxy]();
    worker.terminate();
  };
  return { remote, dispose };
}

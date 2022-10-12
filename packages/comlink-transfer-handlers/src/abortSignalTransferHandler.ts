// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { transferHandlers, proxy, TransferHandler } from "comlink";

const isAbortSignal = (val: unknown): val is AbortSignal => val instanceof AbortSignal;

const proxyTransferHandler = transferHandlers.get("proxy") as
  | undefined
  | TransferHandler<object, MessagePort>;
if (!proxyTransferHandler) {
  throw new Error("Invariant: comlink should have a proxy transfer handler");
}

/**
 * abortSignalTransferHandler implements a Comlink TransferHandler for AbortSignal instances
 *
 * Serialize creates a proxyAbort object to proxy an onabort handler and calls this handler
 * when the actual abort signal fires.
 *
 * Deserialize creates a new abort controller and aborts it when the proxy onabort fires.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 */
const abortSignalTransferHandler: TransferHandler<AbortSignal, MessagePort> = {
  canHandle: isAbortSignal,
  deserialize: (msgPort) => {
    const controller = new AbortController();
    const abortSignal = controller.signal;

    const abortSignalProxy = proxyTransferHandler.deserialize(msgPort) as { onabort?: () => void };
    abortSignalProxy.onabort = proxy(() => {
      controller.abort();
    });

    return abortSignal;
  },
  serialize: (abortSignal) => {
    const proxyAbort: { onabort?: () => void } = {
      onabort: undefined,
    };

    abortSignal.addEventListener("abort", () => {
      proxyAbort.onabort?.();
    });

    return proxyTransferHandler.serialize(proxy(proxyAbort));
  },
};

export { abortSignalTransferHandler };

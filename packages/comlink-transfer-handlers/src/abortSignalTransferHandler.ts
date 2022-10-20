// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TransferHandler } from "comlink";

const isAbortSignal = (val: unknown): val is AbortSignal => val instanceof AbortSignal;

/**
 * abortSignalTransferHandler implements a Comlink TransferHandler for AbortSignal instances
 *
 * Serialize creates an array with a boolean for whether the signal is already aborted and a message
 * port to send an abort signal.
 *
 * Deserialize creates a new abort controller and aborts it when the abort message is sent over the
 * message port.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 */
const abortSignalTransferHandler: TransferHandler<AbortSignal, [boolean, MessagePort]> = {
  canHandle: isAbortSignal,
  deserialize: ([aborted, msgPort]) => {
    const controller = new AbortController();

    if (aborted) {
      controller.abort();
    } else {
      msgPort.onmessage = () => {
        controller.abort();
      };
    }

    return controller.signal;
  },
  serialize: (abortSignal) => {
    const { port1, port2 } = new MessageChannel();
    abortSignal.addEventListener("abort", () => {
      port1.postMessage("aborted");
    });

    return [[abortSignal.aborted, port2], [port2]];
  },
};

export { abortSignalTransferHandler };

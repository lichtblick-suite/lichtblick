// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { transferHandlers, proxy, TransferHandler } from "comlink";
import { isObject } from "lodash";

const isAsyncIterable = (val: unknown): val is AsyncIterable<unknown> =>
  isObject(val) && !Array.isArray(val) && Symbol.asyncIterator in val;

const proxyTransferHandler = transferHandlers.get("proxy") as
  | undefined
  | TransferHandler<object, MessagePort>;
if (!proxyTransferHandler) {
  throw new Error("Invariant: comlink should have a proxy transfer handler");
}

/**
 * iterableTransferHandler implements a Comlink TransferHandler for objects
 * which contain Symbol.asyncIterator
 *
 * The object is serialized as a _proxy_ via the proxyTransferHandler and deserialized
 * back into a proxy. Special handling is added to re-hydrate the Symbol.asyncIterator.
 *
 * Reference: https://github.com/GoogleChromeLabs/comlink/issues/435
 */
const iterableTransferHandler: TransferHandler<object, MessagePort> = {
  canHandle: isAsyncIterable,
  deserialize: (msgPort) => {
    return new Proxy(proxyTransferHandler.deserialize(msgPort), {
      get: (target, prop, ...rest: unknown[]) => {
        if (prop === Symbol.asyncIterator) {
          const gen = async function* () {
            for (;;) {
              const nextObj = await (target as AsyncIterator<unknown>).next();
              if (nextObj.done === true) {
                return nextObj.value;
              }
              yield nextObj.value;
            }
          };
          return gen;
        } else {
          return Reflect.get(target, prop, ...rest);
        }
      },
      has: (target, prop) => {
        if (prop === Symbol.asyncIterator) {
          return true;
        } else {
          return prop in target;
        }
      },
    });
  },
  serialize: (obj) => {
    return proxyTransferHandler.serialize(proxy(obj));
  },
};

export { iterableTransferHandler };

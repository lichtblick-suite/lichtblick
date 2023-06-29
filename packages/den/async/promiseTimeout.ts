// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/** Error for promise timeouts from `promiseTimeout()` */
class PromiseTimeoutError extends Error {
  public override name = "PromiseTimeoutError";
}

/**
 * Executes a promise with a timeout.
 *
 * If the promise takes longer than the specified timeout duration (in milliseconds), it will be
 * rejected with a timeout error.
 *
 * Note: Make sure the input promise resolves, rejects, or otherwise go out of scope. A long-lived
 * promise that never resolves holds onto its resolution callbacks.
 *
 * @param promise The promise to execute
 * @param ms The timeout duration in milliseconds.
 * @returns A promise that resolves with the result of the input promise or rejects with a
 * PromiseTimeoutError.
 */
async function promiseTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // We avoid using Promise.race here since it is susceptible to memory leaks for unresolved promises
  // https://github.com/nodejs/node/issues/17469
  //
  // With Promise.race you might be tempted to race the input promise against a promise that resolve
  // after a timeout. However, if you clear the timeout when the input promise resolves, you'll be
  // left with a promise that never resolves passed as a contender to `Promise.race`.
  return await new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new PromiseTimeoutError(`Promise timed out after ${ms}ms`));
    }, ms);
    promise.then(resolve, reject).finally(() => {
      clearTimeout(id);
    });
  });
}

export { promiseTimeout, PromiseTimeoutError };

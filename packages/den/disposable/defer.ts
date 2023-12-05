// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Ensure Symbol.dispose and Symbol.asyncDispose are defined
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Symbol as any).dispose ??= Symbol("Symbol.dispose");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Symbol as any).asyncDispose ??= Symbol("Symbol.asyncDispose");

/**
 * defer runs a function when returned disposable is disposed
 *
 * ```
 * {
 *   const resource = Resource.open();
 *   using def = defer(() => resource.close());
 *
 *   // do some other stuff //
 *
 *   // end of scope, the deferred function will run
 * }
 * ```
 *
 * See also: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html
 *
 * @param fn The function to run when the returned disposable is disposed
 * @returns a disposable
 */
export function defer(fn: () => void): Disposable {
  return {
    [Symbol.dispose]() {
      fn();
    },
  };
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useState } from "react";

type Fn<A extends unknown[], R> = (...args: A) => R;

/**
 * React error boundaries do not catch errors from user event handlers (clicks, etc).
 * This hook wraps a function which may throw, and re-throws the error within a render context.
 * This allows react error boundaries to capture the error.
 *
 * see: https://github.com/facebook/react/issues/11409
 * @param fn function to wrap in a try/catch
 * @returns wrapped fn with the same signature as fn
 */
export default function useRethrow<Args extends unknown[], Ret>(
  fn: Fn<Args, Ret>,
): Fn<Args, Ret | void> {
  const [_, setError] = useState(undefined);
  return useCallback(
    (...args: Args): Ret | void => {
      try {
        return fn(...args);
      } catch (err) {
        // throwing within a setError happens within a react render context
        setError(() => {
          throw err;
        });
      }
    },
    [fn],
  );
}

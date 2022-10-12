// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Registers and unregisters mounted state during useLayoutEffect instead of useEffect.
 *
 * If you're using useLayoutEffect in your component and want to track your component's
 * mounted state you need to use this instead of useMountedState.
 */
export function useSynchronousMountedState(): () => boolean {
  const mountedRef = useRef<boolean>(false);
  const get = useCallback(() => {
    return mountedRef.current;
  }, []);

  useLayoutEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return get;
}

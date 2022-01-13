// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useCallback, useContext, useRef } from "react";

type ReadySignal = () => void;

const ReadySignalContext = createContext<ReadySignal | undefined>(undefined);
ReadySignalContext.displayName = "ReadySignalContext";

/**
 * useReadySignal returns a function that can be called to indicate a story is ready to be captured
 * for a screenshot test. To use this, the story must have the `useReadySignal` parameter set, i.e.
 * `Story.parameters = { useReadySignal: true }`.
 *
 * An optional `count` can be set to require multiple calls to the returned function before the
 * story will be marked as ready.
 */
function useReadySignal({ count }: { count: number } = { count: 1 }): ReadySignal {
  const readySignal = useContext(ReadySignalContext);
  if (!readySignal) {
    throw new Error("Add a signal to the story screenshot parameters");
  }
  const countRef = useRef(count);
  return useCallback(() => {
    --countRef.current;
    if (countRef.current === 0) {
      readySignal();
    } else if (countRef.current < 0) {
      console.warn(`useReadySignal called ${-countRef.current} more times than expected`);
    }
  }, [readySignal]);
}

export { useReadySignal };
export default ReadySignalContext;

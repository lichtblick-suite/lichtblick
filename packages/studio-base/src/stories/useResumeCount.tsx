// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useRef } from "react";

import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";

export default function useResumeCount(count: number): (_: string) => () => void {
  const countRef = useRef(0);
  const readySignal = useReadySignal();

  const pauseFrame = useCallback(() => {
    return () => {
      countRef.current += 1;
      if (countRef.current === count) {
        readySignal();
      }
    };
  }, [count, readySignal]);

  return pauseFrame;
}

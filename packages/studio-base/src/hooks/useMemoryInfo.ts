// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

type MemoryInfo = {
  /// Maximum heap size in bytes
  jsHeapSizeLimit: number;
  /// current size in bytes of the JS heap including free space not occupied by any JS objects
  totalJSHeapSize: number;
  /// total amount of memory in bytes being used by JS objects including V8 internal objects
  usedJSHeapSize: number;
};

// Our DOM types don't have types for performance.memory since this is a chrome feature
// We make our own version of Performance which optionally has MemoryInfo
interface Performance {
  memory?: MemoryInfo;
}

type UseMemoryInfoOptions = {
  refreshIntervalMs: number;
};

const performance = window.performance as Performance;

export function useMemoryInfo(opt: UseMemoryInfoOptions): MemoryInfo | undefined {
  const { refreshIntervalMs } = opt;
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | undefined>(performance.memory);

  useEffect(() => {
    if (!performance.memory) {
      log.info("No memory information available");
      return;
    }

    const interval = setInterval(() => {
      setMemoryInfo(performance.memory);
    }, refreshIntervalMs);
    return () => {
      clearInterval(interval);
    };
  }, [refreshIntervalMs]);

  return memoryInfo;
}

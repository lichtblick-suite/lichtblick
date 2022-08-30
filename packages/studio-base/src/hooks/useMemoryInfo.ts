// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

type UseMemoryInfoOptions = {
  refreshIntervalMs: number;
};

const performance = window.performance;

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

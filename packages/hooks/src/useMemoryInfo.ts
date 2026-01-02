// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// foxglove-depcheck-used: @types/foxglove__web

import { useEffect, useState } from "react";

import Logger from "@lichtblick/log";

const log = Logger.getLogger(__filename);

type UseMemoryInfoOptions = {
  refreshIntervalMs: number;
};

export function useMemoryInfo(opt: UseMemoryInfoOptions): MemoryInfo | undefined {
  const { refreshIntervalMs } = opt;
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | undefined>(window.performance.memory);

  useEffect(() => {
    if (!window.performance.memory) {
      log.info("No memory information available");
      return;
    }

    const interval = setInterval(() => {
      setMemoryInfo(window.performance.memory);
    }, refreshIntervalMs);
    return () => {
      clearInterval(interval);
    };
  }, [refreshIntervalMs]);

  return memoryInfo;
}

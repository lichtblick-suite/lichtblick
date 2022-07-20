// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useMemo } from "react";

import { useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import { MessageEvent } from "@foxglove/studio-base/players/types";

import { DiagnosticStatusArrayMsg, DiagnosticsById, computeDiagnosticInfo } from "./util";

type UseDiagnosticsResult = Map<string, DiagnosticsById>;

// Exported for tests
export function addMessages(
  prevResult: UseDiagnosticsResult,
  msgEvents: readonly MessageEvent<unknown>[],
): UseDiagnosticsResult {
  // Mutates the previous value since there might be many diagnostic messages
  let modified = false;
  for (const msgEvent of msgEvents as MessageEvent<DiagnosticStatusArrayMsg>[]) {
    const { header, status: statusArray }: DiagnosticStatusArrayMsg = msgEvent.message;

    for (const status of statusArray) {
      const info = computeDiagnosticInfo(status, header.stamp);
      const hardwareId = status.hardware_id;
      const hardwareDiagnosticsByName = prevResult.get(hardwareId);
      if (hardwareDiagnosticsByName == undefined) {
        modified = true;
        prevResult.set(hardwareId, new Map([[status.name, info]]));
      } else {
        modified = true;
        hardwareDiagnosticsByName.set(status.name, info);
      }
    }
  }
  // We shallow-copy the buffer when it changes to help users know when to rerender.
  return modified ? new Map(prevResult) : prevResult;
}

const EmptyMap = () => new Map();

export default function useDiagnostics(topic?: string): UseDiagnosticsResult {
  const topics = useMemo(() => {
    if (topic) {
      return [topic];
    }
    return [];
  }, [topic]);

  return useMessageReducer<UseDiagnosticsResult>({
    topics,
    restore: EmptyMap,
    addMessages,
  });
}

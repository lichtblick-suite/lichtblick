// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

import { DiagnosticStatusArrayMsg } from "./util";

type DiagnosticNameSet = Set<string>;
type UseAvailableDiagnosticResult = Map<string, DiagnosticNameSet>;

function addMessages(
  previousAvailableDiagnostics: UseAvailableDiagnosticResult,
  messages: readonly MessageEvent<unknown>[],
): UseAvailableDiagnosticResult {
  // If we detect new hardware ids or names we need to create a new instance of available diagnostics
  // so downstream consumers know it changed by observing the object reference changing
  let modified = false;

  for (const message of messages as MessageEvent<DiagnosticStatusArrayMsg>[]) {
    const { status: statusArray }: DiagnosticStatusArrayMsg = message.message;
    if (statusArray.length === 0) {
      continue;
    }

    for (const status of statusArray) {
      const hardwareId = mightActuallyBePartial(status).hardware_id ?? "";
      const name = status.name;

      const nameSet = previousAvailableDiagnostics.get(hardwareId);
      if (!nameSet) {
        modified = true;
        previousAvailableDiagnostics.set(hardwareId, new Set<string>([name]));
      } else if (!nameSet.has(name) && name) {
        modified = true;
        nameSet.add(name);
      }
    }
  }

  return modified ? new Map(previousAvailableDiagnostics) : previousAvailableDiagnostics;
}

const EmptyMap = () => new Map();

export default function useAvailableDiagnostics(topic?: string): UseAvailableDiagnosticResult {
  const topics = useMemo(() => {
    if (topic) {
      return [topic];
    }
    return [];
  }, [topic]);

  return useMessageReducer<UseAvailableDiagnosticResult>({
    topics,
    restore: EmptyMap,
    addMessages,
  });
}

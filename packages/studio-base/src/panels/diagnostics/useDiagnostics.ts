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

import { sortedIndexBy } from "lodash";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { MessageEvent } from "@foxglove/studio-base/players/types";

import {
  DiagnosticStatusArrayMsg,
  DiagnosticsById,
  DiagnosticId,
  computeDiagnosticInfo,
  getDiagnosticId,
  trimHardwareId,
} from "./util";

export type DiagnosticAutocompleteEntry = {
  name?: string; // undefined for "combined hardware_id" entries for showing diagnostics with any name.
  hardware_id: string;
  id: DiagnosticId;
  displayName: string;
  sortKey: string;
};

export type DiagnosticsBuffer = {
  diagnosticsByNameByTrimmedHardwareId: Map<string, DiagnosticsById>;
  sortedAutocompleteEntries: DiagnosticAutocompleteEntry[];
};

// Returns whether the buffer has been modified
function maybeAddMessageToBuffer(
  buffer: DiagnosticsBuffer,
  message: MessageEvent<DiagnosticStatusArrayMsg>,
): boolean {
  const { header, status: statusArray }: DiagnosticStatusArrayMsg = message.message;
  if (statusArray.length === 0) {
    return false;
  }

  for (const status of statusArray) {
    const info = computeDiagnosticInfo(status, header.stamp);
    let newHardwareId = false;
    let newDiagnostic = false;
    const trimmedHardwareId = trimHardwareId(status.hardware_id);
    const hardwareDiagnosticsByName =
      buffer.diagnosticsByNameByTrimmedHardwareId.get(trimmedHardwareId);
    if (hardwareDiagnosticsByName == undefined) {
      newHardwareId = true;
      newDiagnostic = true;
      buffer.diagnosticsByNameByTrimmedHardwareId.set(
        trimmedHardwareId,
        new Map([[status.name, info]]),
      );
    } else {
      const previousNumberOfDiagnostics = hardwareDiagnosticsByName.size;
      hardwareDiagnosticsByName.set(status.name, info);
      newDiagnostic = hardwareDiagnosticsByName.size > previousNumberOfDiagnostics;
    }

    // add to sortedAutocompleteEntries if we haven't seen this id before
    if (newDiagnostic) {
      const newEntry = {
        hardware_id: status.hardware_id,
        name: status.name,
        id: info.id,
        displayName: info.displayName,
        sortKey: info.displayName.replace(/^\//, "").toLowerCase(),
      };
      const index = sortedIndexBy(buffer.sortedAutocompleteEntries, newEntry, "displayName");
      buffer.sortedAutocompleteEntries.splice(index, 0, newEntry);

      if (newHardwareId) {
        const newHardwareEntry = {
          hardware_id: info.status.hardware_id,
          id: getDiagnosticId(status.hardware_id),
          name: undefined,
          displayName: info.status.hardware_id,
          sortKey: info.status.hardware_id.replace(/^\//, "").toLowerCase(),
        };
        const hardwareIdx = sortedIndexBy(
          buffer.sortedAutocompleteEntries,
          newHardwareEntry,
          "displayName",
        );
        buffer.sortedAutocompleteEntries.splice(hardwareIdx, 0, newHardwareEntry);
      }
    }
  }
  return true;
}

// Exported for tests
export function addMessages(
  buffer: DiagnosticsBuffer,
  messages: readonly MessageEvent<unknown>[],
): DiagnosticsBuffer {
  // maybeAddMessageToBuffer mutates the buffer instead of doing an immutable update for performance
  // reasons. There are large numbers of diagnostics messages, and often many diagnostics panels in
  // a layout.
  let modified = false;
  for (const message of messages) {
    modified =
      maybeAddMessageToBuffer(buffer, message as MessageEvent<DiagnosticStatusArrayMsg>) ||
      modified;
  }
  // We shallow-copy the buffer when it changes to help users know when to rerender.
  return modified ? { ...buffer } : buffer;
}

// Exported for tests
export function defaultDiagnosticsBuffer(): DiagnosticsBuffer {
  return {
    diagnosticsByNameByTrimmedHardwareId: new Map(),
    sortedAutocompleteEntries: [],
  };
}

export default function useDiagnostics(topic: string): DiagnosticsBuffer {
  return PanelAPI.useMessageReducer<DiagnosticsBuffer>({
    topics: [topic],
    restore: defaultDiagnosticsBuffer,
    addMessages,
  });
}

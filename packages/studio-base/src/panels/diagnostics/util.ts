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

import { sortBy, truncate } from "lodash";

import { Time } from "@foxglove/rostime";
import { Header } from "@foxglove/studio-base/types/Messages";
import fuzzyFilter from "@foxglove/studio-base/util/fuzzyFilter";

import { DiagnosticsBuffer } from "./useDiagnostics";

// Trim the message if it's too long. We sometimes get crazy massive messages here that can
// otherwise crash our entire UI. I looked at a bunch of messages manually and they are typically
// way smaller than 5KB, so this is a very generous maximum. But feel free to increase it more if
// necessary. Exported for tests.
export const MAX_STRING_LENGTH = 5000; // 5KB

// ts-prune-ignore-next
export const LEVELS: { OK: 0; WARN: 1; ERROR: 2; STALE: 3 } = {
  OK: 0,
  WARN: 1,
  ERROR: 2,
  STALE: 3,
};

export const LEVEL_NAMES: { [key: number]: string } = {
  0: "ok",
  1: "warn",
  2: "error",
  3: "stale",
};

export const KNOWN_LEVELS = [0, 1, 2, 3];

interface ToString {
  toString(): string;
}

export type DiagnosticId = string & ToString;

export type KeyValue = { key: string; value: string };

// diagnostic_msgs/DiagnosticStatus
export type DiagnosticStatusMessage = {
  name: string;
  hardware_id: string;
  level: number;
  message: string;
  values: KeyValue[];
};

export type DiagnosticInfo = {
  status: DiagnosticStatusMessage;
  stamp: Time;
  id: DiagnosticId;
  displayName: string;
};

export type DiagnosticStatusArrayMsg = {
  header: Header;
  status: DiagnosticStatusMessage[];
};

export type DiagnosticsById = Map<DiagnosticId, DiagnosticInfo>;

// Remove leading slash from hardware_id if present.
export function trimHardwareId(hardwareId: string): string {
  return hardwareId.startsWith("/") ? hardwareId.slice(1) : hardwareId;
}

export function getDiagnosticId(hardwareId: string, name?: string): DiagnosticId {
  const trimmedHardwareId = trimHardwareId(hardwareId);
  return name != undefined ? `|${trimmedHardwareId}|${name}|` : `|${trimmedHardwareId}|`;
}

export function getDisplayName(hardwareId: string, name: string): string {
  if (name.indexOf(hardwareId) === 0) {
    return name;
  }
  return name.length > 0 ? `${hardwareId}: ${name}` : hardwareId;
}

// ensures the diagnostic status message's name consists of both the hardware id and the name
export function computeDiagnosticInfo(
  status: DiagnosticStatusMessage,
  stamp: Time,
): DiagnosticInfo {
  const displayName = getDisplayName(status.hardware_id, status.name);
  let validatedStatus = status;
  if (status.values?.some(({ value }) => value.length > MAX_STRING_LENGTH)) {
    validatedStatus = {
      ...status,
      values: status.values?.map((kv) =>
        kv.value.length > MAX_STRING_LENGTH
          ? { key: kv.key, value: truncate(kv.value, { length: MAX_STRING_LENGTH }) }
          : kv,
      ),
    };
  }
  return {
    status: validatedStatus,
    stamp,
    id: getDiagnosticId(status.hardware_id, status.name),
    displayName,
  };
}

export function getDiagnosticsByLevel(buffer: DiagnosticsBuffer): Map<number, DiagnosticInfo[]> {
  const ret = new Map<number, DiagnosticInfo[]>();
  for (const diagnosticsByName of buffer.diagnosticsByNameByTrimmedHardwareId.values()) {
    for (const diagnostic of diagnosticsByName.values()) {
      const statuses = ret.get(diagnostic.status.level);
      if (statuses) {
        statuses.push(diagnostic);
      } else {
        ret.set(diagnostic.status.level, [diagnostic]);
      }
    }
  }
  return ret;
}

export const filterAndSortDiagnostics = (
  nodes: DiagnosticInfo[],
  hardwareIdFilter: string,
  pinnedIds: DiagnosticId[],
): DiagnosticInfo[] => {
  const unpinnedNodes = nodes.filter(({ id }) => !pinnedIds.includes(id));
  if (hardwareIdFilter.length === 0) {
    return sortBy(unpinnedNodes, (info) => info.displayName.replace(/^\//, ""));
  }
  // fuzzyFilter sorts by match accuracy.
  return fuzzyFilter({
    options: unpinnedNodes,
    filter: hardwareIdFilter,
    getText: ({ displayName }) => displayName,
  });
};

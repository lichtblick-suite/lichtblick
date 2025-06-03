// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import * as _ from "lodash-es";

import { Time } from "@lichtblick/rostime";
import {
  DiagnosticId,
  DiagnosticInfo,
  DiagnosticStatusMessage,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { getDisplayName } from "@lichtblick/suite-base/panels/DiagnosticStatus/utils/getDisplayName";
import { MAX_STRING_LENGTH } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import { DiagnosticsById } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";
import fuzzyFilter from "@lichtblick/suite-base/util/fuzzyFilter";

export function getDiagnosticId(hardwareId: string, name?: string): DiagnosticId {
  const trimmedHardwareId = hardwareId.startsWith("/") ? hardwareId.slice(1) : hardwareId;
  return name != undefined ? `|${trimmedHardwareId}|${name}|` : `|${trimmedHardwareId}|`;
}

// ensures the diagnostic status message's name consists of both the hardware id and the name
export function computeDiagnosticInfo(
  status: DiagnosticStatusMessage,
  stamp: Time,
): DiagnosticInfo {
  const displayName = getDisplayName(status.hardware_id, status.name);
  let validatedStatus = status;
  if (status.values.some(({ value }) => value.length > MAX_STRING_LENGTH)) {
    validatedStatus = {
      ...status,
      values: status.values.map((kv) =>
        kv.value.length > MAX_STRING_LENGTH
          ? { key: kv.key, value: _.truncate(kv.value, { length: MAX_STRING_LENGTH }) }
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

export function getDiagnosticsByLevel(
  diagnosticsByHardwareId: Map<string, DiagnosticsById>,
): Map<number, DiagnosticInfo[]> {
  const ret = new Map<number, DiagnosticInfo[]>();
  for (const diagnosticsByName of diagnosticsByHardwareId.values()) {
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
    return _.sortBy(unpinnedNodes, (info) => info.displayName.replace(/^\//, ""));
  }
  // fuzzyFilter sorts by match accuracy.
  return fuzzyFilter({
    options: unpinnedNodes,
    filter: hardwareIdFilter,
    getText: ({ displayName }) => displayName,
  });
};

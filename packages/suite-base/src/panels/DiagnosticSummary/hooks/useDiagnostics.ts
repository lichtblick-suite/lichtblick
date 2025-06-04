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

import { useMemo } from "react";

import { useMessageReducer } from "@lichtblick/suite-base/PanelAPI";
import { DiagnosticStatusArrayMsg } from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { DiagnosticsById } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

import { computeDiagnosticInfo } from "../utils/util";

export type UseDiagnosticsResult = Map<string, DiagnosticsById>;

export function addMessages(
  prev: UseDiagnosticsResult,
  messageEvents: readonly MessageEvent[],
): UseDiagnosticsResult {
  // Mutates the previous value since there might be many diagnostic messages
  let modified = false;
  const next = new Map(prev);

  for (const event of messageEvents as MessageEvent<DiagnosticStatusArrayMsg>[]) {
    const { header, status: statusArray }: DiagnosticStatusArrayMsg = event.message;

    for (const status of statusArray) {
      const info = computeDiagnosticInfo(status, header.stamp);
      const diagnosticsByName = next.get(status.hardware_id);

      if (!diagnosticsByName) {
        next.set(status.hardware_id, new Map([[status.name, info]]));
        modified = true;
      } else {
        diagnosticsByName.set(status.name, info);
        modified = true;
      }
    }
  }

  // We shallow-copy the buffer when it changes to help users know when to rerender.
  return modified ? next : prev;
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

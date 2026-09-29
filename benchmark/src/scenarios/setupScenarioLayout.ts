// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import {
  ILayoutStorage,
  ISO8601Timestamp,
  Layout,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { migratePanelsState } from "@lichtblick/suite-base/services/migrateLayout";

// Mirrors `LayoutManager.LOCAL_STORAGE_NAMESPACE`, which isn't exported for reuse.
const LOCAL_STORAGE_NAMESPACE = "local";

/** Name under which a scenario's layout is displayed, matched by `Root.tsx`'s `appParameters.defaultLayout`. */
export function scenarioLayoutName(scenarioId: string): string {
  return `scenario:${scenarioId}`;
}

// A fixed id (rather than `LayoutManager.saveNewLayout`'s random uuid) so calling this more than
// once — e.g. across page reloads sharing the same IndexedDB — always overwrites the same record
// instead of racing a find-by-name-then-create check that can produce duplicates when two
// callers both run before either commits.
function scenarioLayoutId(scenarioId: string): LayoutID {
  return `scenario-layout:${scenarioId}` as LayoutID;
}

/**
 * Persists the layout for a scenario, creating or overwriting it in place. Safe to call
 * repeatedly/concurrently without accumulating duplicates, since it always upserts the same
 * deterministic id rather than checking for an existing record before deciding whether to write.
 */
export async function setupScenarioLayout(
  storage: Pick<ILayoutStorage, "put">,
  scenarioId: string,
  data: LayoutData,
): Promise<Layout> {
  const layout: Layout = {
    id: scenarioLayoutId(scenarioId),
    name: scenarioLayoutName(scenarioId),
    permission: "CREATOR_WRITE",
    baseline: {
      data: migratePanelsState(data),
      savedAt: new Date().toISOString() as ISO8601Timestamp,
    },
    working: undefined,
    syncInfo: undefined,
  };
  return await storage.put(LOCAL_STORAGE_NAMESPACE, layout);
}

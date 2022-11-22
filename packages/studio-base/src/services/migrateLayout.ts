// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MarkOptional } from "ts-essentials";

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

import { Layout, ISO8601Timestamp } from "./ILayoutStorage";
import { migrateLegacyToNew3DPanels } from "./migrateLegacyToNew3DPanels";

/**
 * Perform any necessary migrations on old layout data.
 */
export function migratePanelsState(data: MarkOptional<PanelsState, "configById">): PanelsState {
  let result: PanelsState = { ...data, configById: data.configById ?? data.savedProps ?? {} };
  delete result.savedProps;

  result = migrateLegacyToNew3DPanels(result);

  return result;
}

/**
 * Import a layout from storage, transferring old properties to the current expected format.
 *
 * Layouts created before we stored both working/baseline copies were stored with a "data" field;
 * migrate this to a baseline layout.
 */

export function migrateLayout(value: unknown): Layout {
  if (typeof value !== "object" || value == undefined) {
    throw new Error("Invariant violation - layout item is not an object");
  }
  const layout = value as Partial<Layout>;
  if (!("id" in layout) || !layout.id) {
    throw new Error("Invariant violation - layout item is missing an id");
  }

  const now = new Date().toISOString() as ISO8601Timestamp;

  let baseline = layout.baseline;
  if (!baseline) {
    if (layout.working) {
      baseline = layout.working;
    } else if (layout.data) {
      baseline = { data: layout.data, savedAt: now };
    } else if (layout.state) {
      baseline = { data: layout.state, savedAt: now };
    } else {
      throw new Error("Invariant violation - layout item is missing data");
    }
  }

  return {
    id: layout.id,
    name: layout.name ?? `Unnamed (${now})`,
    permission: layout.permission?.toUpperCase() ?? "CREATOR_WRITE",
    working: layout.working
      ? { ...layout.working, data: migratePanelsState(layout.working.data) }
      : undefined,
    baseline: { ...baseline, data: migratePanelsState(baseline.data) },
    syncInfo: layout.syncInfo,
  };
}

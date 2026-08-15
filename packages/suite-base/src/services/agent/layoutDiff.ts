// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { MosaicNode, getLeaves } from "react-mosaic-component";

import { Immutable } from "@lichtblick/suite";
import type { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import type { Topic } from "@lichtblick/suite-base/players/types";
import {
  type AgentSafeLayoutData,
  validateLayoutProposalData,
} from "@lichtblick/suite-base/services/agent/layoutSchema";
import type { CatalogSnapshot } from "@lichtblick/suite-base/services/agent/local/types";
import { sanitizePlotPaths } from "@lichtblick/suite-base/services/agent/sanitizePlotPaths";
import type {
  LayoutProposal,
  LayoutProposalMode,
} from "@lichtblick/suite-base/services/agent/types";
import type { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import type { PanelConfig } from "@lichtblick/suite-base/types/panels";

/**
 * Result of planning a strict incremental apply: the atomic payload for the ADD_PANELS_ATOMIC
 * reducer action. `layout` is the complete proposal mosaic tree (the current layout's tree is
 * preserved as a subtree inside it) and `newPanelConfigs` holds configById entries only for the
 * newly added panels.
 */
export type IncrementalApplyPlan = {
  kind: "incremental";
  newPanelConfigs: Record<string, PanelConfig>;
  layout: MosaicNode<string>;
};

export type IncrementalApplyInput = {
  /** Baseline captured when the proposal was generated (over the sanitized layout data). */
  baseLayoutId?: string;
  baseFingerprint?: string;
  /** The currently selected layout at apply time. */
  currentLayoutId?: string;
  /** Sanitized (validate + sanitizePlotPaths) data of the currently selected layout. */
  currentLayoutData?: LayoutData;
  /** The final sanitized proposal data (after validate + sanitizePlotPaths). */
  proposalData: LayoutData;
};

/**
 * Top-level LayoutData fields that are not panel state. Any change to these between the base
 * layout and the proposal forces the full path (a layout that only "adds panels" must not also
 * change global variables, user scripts, playback settings, savedProps, or the version).
 */
const NON_PANEL_TOP_LEVEL_FIELDS = [
  "globalVariables",
  "playbackConfig",
  "savedProps",
  "userNodes",
  "version",
] as const;

/**
 * Deterministic serialization of a value with sorted object keys. Non-JSON values (bigint,
 * TypedArray/ArrayBuffer, functions, undefined, cycles) are mapped to stable markers so the
 * fingerprint never throws on pathological runtime data.
 */
function canonicalSerialize(value: unknown, ancestors: Set<object>): string {
  if (value == null) {
    return "null";
  }
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      // JSON.stringify(NaN/Infinity) is "null" — deterministic, which is all we need.
      return JSON.stringify(value) ?? "";
    case "bigint":
      return JSON.stringify(String(value)) ?? "";
    case "undefined":
      return "undefined";
    case "function":
      return "<function>";
    case "symbol":
      return "<symbol>";
    case "object": {
      if (value instanceof ArrayBuffer) {
        return `"<arraybuffer ${value.byteLength} bytes>"`;
      }
      if (ArrayBuffer.isView(value)) {
        return `"<typedarray ${value.byteLength} bytes>"`;
      }
      if (ancestors.has(value)) {
        return "<circular>";
      }
      ancestors.add(value);
      let result: string;
      if (Array.isArray(value)) {
        result = `[${value.map((item) => canonicalSerialize(item, ancestors)).join(",")}]`;
      } else {
        const record = value as Record<string, unknown>;
        result = `{${Object.keys(record)
          .sort()
          .map(
            (key) => `${JSON.stringify(key)}:${canonicalSerialize(record[key], ancestors)}`,
          )
          .join(",")}}`;
      }
      ancestors.delete(value);
      return result;
    }
    default:
      return "<unknown>";
  }
}

/**
 * Validates and sanitizes layout data the same way the apply path does (validate + Plot-path
 * sanitization against the loaded catalog). Returns undefined when the data is not a valid
 * AgentSafeLayoutData (e.g. a runtime layout containing extension panels outside the static
 * allowlist) — callers then treat the layout as non-incrementable.
 *
 * CatalogSnapshot carries the same runtime shapes as the sanitizer inputs: the workspace tools
 * type the catalog as `unknown[]`/`ReadonlyMap` while the real values are `Topic[]`/`RosDatatypes`.
 */
export function sanitizeLayoutData(
  data: unknown,
  catalog: CatalogSnapshot,
): AgentSafeLayoutData | undefined {
  try {
    const validated = validateLayoutProposalData(data);
    return sanitizePlotPaths(
      validated,
      catalog.topics as readonly Topic[],
      catalog.datatypes as Immutable<RosDatatypes>,
    ).data;
  } catch {
    return undefined;
  }
}

/**
 * Stable fingerprint of a layout's data, used to detect at apply time whether the layout the
 * agent based its proposal on is still the one selected.
 *
 * Callers fingerprint the **validate + sanitize** pipeline output (`sanitizeLayoutData`), not the
 * raw data: sanitization drops Plot paths that are invalid against the loaded catalog, so a base
 * layout with stale paths and a proposal that sanitized the same paths away compare equal. Both
 * proposal-time (collectLayoutBaseline) and apply-time (planIncrementalApply) use the same
 * pipeline, so the fingerprint is reproducible as long as the catalog is unchanged; a changed
 * catalog produces a mismatch and falls back to the full path.
 *
 * The hash is FNV-1a 32-bit: non-cryptographic, deterministic. It is only a fast equality
 * pre-filter; the structural diff below is the actual gate, so collisions cannot admit an unsafe
 * apply.
 */
export function computeLayoutFingerprint(data: unknown): string {
  const canonical = canonicalSerialize(data, new Set());
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index++) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getLeafIds(layout: MosaicNode<string> | undefined): string[] {
  if (layout == undefined) {
    return [];
  }
  return getLeaves(layout).filter(
    (leaf): leaf is string => typeof leaf === "string" && leaf.length > 0,
  );
}

/**
 * Counts how many times `target` appears as a subtree of `node`. Mosaic leaf ids are unique
 * within a valid tree, so for valid inputs the answer is 0 or 1; a count other than 1 means the
 * old tree was deleted, duplicated, or reordered and the caller must take the full path.
 */
function countSubtreeOccurrences(
  node: MosaicNode<string>,
  target: MosaicNode<string>,
): number {
  let count = _.isEqual(node, target) ? 1 : 0;
  if (typeof node !== "string") {
    count += countSubtreeOccurrences(node.first, target);
    count += countSubtreeOccurrences(node.second, target);
  }
  return count;
}

/**
 * Structural half of the strict incremental check: compares the base layout data against the
 * final sanitized proposal. Returns the atomic plan when the proposal is exactly "the current
 * layout plus new panels" and undefined otherwise (caller falls back to the full path).
 *
 * Strictness (any violation → undefined):
 * - Every existing panel's config is deep-equal in the proposal (no modification, no removal).
 * - Non-panel top-level fields (globalVariables, playbackConfig, savedProps, userNodes, version)
 *   are deep-equal (userNodes changes — including script additions/edits — force a new layout).
 * - The old mosaic tree appears in the proposal tree exactly once as a complete subtree (no
 *   deletion, no duplication, no reordering).
 * - New configById entries and new mosaic leaves correspond one-to-one; every new leaf appears
 *   exactly once.
 *
 * Fallback semantics: when this returns undefined the apply takes the full path (save a new
 * layout and switch). The only way back from an applied incremental edit is the whole-layout
 * Revert; there is no fine-grained undo.
 */
export function planIncrementalApplyData(
  base: LayoutData,
  proposal: LayoutData,
): IncrementalApplyPlan | undefined {
  for (const field of NON_PANEL_TOP_LEVEL_FIELDS) {
    if (!_.isEqual(base[field], proposal[field])) {
      return undefined;
    }
  }

  const baseIds = Object.keys(base.configById);
  const proposalIds = Object.keys(proposal.configById);
  for (const id of baseIds) {
    if (!_.isEqual(base.configById[id], proposal.configById[id])) {
      return undefined;
    }
  }
  const newIds = proposalIds.filter((id) => !baseIds.includes(id));
  if (newIds.length === 0) {
    // Nothing to add — treat as "not incremental" so the caller saves a new layout.
    return undefined;
  }

  const baseLayout = base.layout;
  if (baseLayout != undefined) {
    if (proposal.layout == undefined) {
      return undefined;
    }
    if (countSubtreeOccurrences(proposal.layout, baseLayout) !== 1) {
      return undefined;
    }
  }
  if (proposal.layout == undefined) {
    return undefined;
  }

  const baseLeafIds = new Set(getLeafIds(baseLayout));
  const newLeaves = getLeafIds(proposal.layout).filter((leaf) => !baseLeafIds.has(leaf));
  if (newLeaves.length !== newIds.length || new Set(newLeaves).size !== newLeaves.length) {
    return undefined;
  }
  for (const id of newIds) {
    if (!newLeaves.includes(id)) {
      return undefined;
    }
  }

  const newPanelConfigs: Record<string, PanelConfig> = {};
  for (const id of newIds) {
    newPanelConfigs[id] = proposal.configById[id]!;
  }
  return { kind: "incremental", newPanelConfigs, layout: proposal.layout };
}

/**
 * Full strict incremental gate for the apply path: the proposal must carry a baseline (id +
 * fingerprint over the sanitized data, captured when it was generated), the same layout must
 * still be selected, and its sanitized data fingerprint must still match. Only then is the
 * structural comparison allowed to decide.
 */
export function planIncrementalApply(
  input: IncrementalApplyInput,
): IncrementalApplyPlan | undefined {
  const {
    baseFingerprint,
    baseLayoutId,
    currentLayoutData,
    currentLayoutId,
    proposalData,
  } = input;
  if (baseLayoutId == undefined || baseFingerprint == undefined) {
    return undefined;
  }
  if (currentLayoutId == undefined || currentLayoutData == undefined) {
    return undefined;
  }
  if (currentLayoutId !== baseLayoutId) {
    return undefined;
  }
  if (computeLayoutFingerprint(currentLayoutData) !== baseFingerprint) {
    return undefined;
  }
  return planIncrementalApplyData(currentLayoutData, proposalData);
}

/**
 * Captures the layout baseline at proposal-generation time (orchestrator side). Any failure —
 * no current layout, no catalog, or data that cannot be validated+sanitized — yields no
 * baseline, which makes the apply take the full path.
 */
export function collectLayoutBaseline(
  getCurrentLayout: (() => unknown) | undefined,
  getCurrentLayoutId: (() => string | undefined) | undefined,
  getCatalog: (() => CatalogSnapshot) | undefined,
): { baseLayoutId?: string; baseFingerprint?: string } {
  try {
    const data = getCurrentLayout?.();
    const id = getCurrentLayoutId?.();
    const catalog = getCatalog?.();
    if (data == undefined || id == undefined || catalog == undefined) {
      return {};
    }
    const sanitized = sanitizeLayoutData(data, catalog);
    if (sanitized == undefined) {
      return {};
    }
    return { baseLayoutId: id, baseFingerprint: computeLayoutFingerprint(sanitized) };
  } catch {
    return {};
  }
}

/**
 * Display mode for a layout proposal card. Reuses the exact same strict incremental decision as
 * the apply path (`planIncrementalApply` — baseline id + fingerprint + structural diff incl.
 * userNodes and non-panel top-level data), so the label can never disagree with what applying
 * will do: a proposal that would fall back to a new layout (scripts added, layout edited since
 * the baseline, catalog changed) is displayed as "create a new layout".
 */
export function computeProposalMode(
  proposal: LayoutProposal,
  currentLayoutState: { id?: string; data?: unknown } | undefined,
  catalog: CatalogSnapshot | undefined,
): LayoutProposalMode {
  if (proposal.baseLayoutId == undefined || proposal.baseFingerprint == undefined) {
    return { kind: "new" };
  }
  if (catalog == undefined || currentLayoutState?.data == undefined) {
    // Without the current layout and catalog the apply would fall back too.
    return { kind: "new" };
  }
  const proposalData = sanitizeLayoutData(proposal.data, catalog);
  if (proposalData == undefined) {
    return { kind: "new" };
  }
  const plan = planIncrementalApply({
    baseLayoutId: proposal.baseLayoutId,
    baseFingerprint: proposal.baseFingerprint,
    currentLayoutId: currentLayoutState.id,
    currentLayoutData: sanitizeLayoutData(currentLayoutState.data, catalog),
    proposalData,
  });
  if (plan == undefined) {
    return { kind: "new" };
  }
  return {
    kind: "incremental",
    newPanelCount: Object.keys(plan.newPanelConfigs).length,
  };
}

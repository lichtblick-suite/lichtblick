// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { MosaicNode } from "react-mosaic-component";

import type { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";

import type { LayoutProposal } from "./types";

/**
 * Static baseline of panel types the Agent may propose even when no runtime inventory is available.
 *
 * An extension panel's type is `<qualifiedName>.<registeredName>`, where qualifiedName is the
 * extension's displayName. validateLayoutProposal may additionally accept types from a runtime
 * installed-panel set derived from PanelCatalog. That trusted host-provided set is the second layer
 * of the security boundary; it must never be populated from model output.
 */
export const ALLOWED_PANEL_TYPES = [
  "3D",
  "Plot",
  "Image",
  "RawMessages",
  "RawMessagesVirtual",
  "Table",
  "Gauge",
  "map",
  "StateTransitions",
  "Indicator",
  "PieChart",
  "SourceInfo",
  "RosOut",
] as const;

export type AllowedPanelType = (typeof ALLOWED_PANEL_TYPES)[number];

declare const agentSafeLayoutDataBrand: unique symbol;

/**
 * Opaque LayoutData proven safe for the deliberately restricted untrusted-Agent input boundary.
 *
 * This is not the set of every LayoutData accepted by the application: runtime validation enforces
 * the panel allowlist, JSON-only values, graph/Mosaic budgets, and config-to-leaf correspondence.
 * The brand is type-only and is produced by validateLayoutProposalData without mutating the input.
 */
export type AgentSafeLayoutData = LayoutData & {
  readonly [agentSafeLayoutDataBrand]: true;
};
export type ValidatedLayoutProposal = Omit<LayoutProposal, "data"> & {
  data: AgentSafeLayoutData;
};
export type ValidateLayoutProposalOptions = {
  installedPanelTypes?: ReadonlySet<string>;
};

const allowedPanelTypes = new Set<string>(ALLOWED_PANEL_TYPES);
export const AGENT_SAFE_LAYOUT_MAX_COLLECTION_ENTRIES = 4096;
export const AGENT_SAFE_LAYOUT_MAX_CONFIG_BY_ID_ENTRIES = 256;
export const AGENT_SAFE_LAYOUT_MAX_GRAPH_DEPTH = 64;
export const AGENT_SAFE_LAYOUT_MAX_GRAPH_NODES = 10_000;
export const AGENT_SAFE_LAYOUT_MAX_STRING_BYTES = 256 * 1024;
export const AGENT_SAFE_LAYOUT_MAX_MOSAIC_DEPTH = 64;
const allowedLayoutFields = new Set([
  "configById",
  "globalVariables",
  "layout",
  "playbackConfig",
  "savedProps",
  "userNodes",
  "version",
]);
const allowedMosaicBranchFields = new Set(["direction", "first", "second", "splitPercentage"]);
const indicatorOperators = new Set(["=", "<", "<=", ">", ">="]);
const textEncoder = new TextEncoder();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function getPanelType(panelId: string): string | undefined {
  // The application derives a panel's type by splitting its id on the first "!", so the type may
  // contain spaces and dots — extension panel types do. Only the suffix is shape-restricted here;
  // the type itself is checked against the exact allowlist by the caller, so widening what may
  // appear before the separator cannot admit an unlisted panel.
  const separator = panelId.indexOf("!");
  if (separator <= 0) {
    return undefined;
  }
  const suffix = panelId.slice(separator + 1);
  if (suffix.length === 0 || /[!\s]/u.test(suffix)) {
    return undefined;
  }
  return panelId.slice(0, separator);
}

/**
 * Agent-authored user scripts must be exactly `{ name, sourceCode }` per node — nothing else.
 * Scripts execute through `new Function` in a SharedWorker (see UserScriptPlayer), so shape
 * strictness here is part of the trust boundary: an unknown field would be silently carried
 * into the player.
 */
function validateUserNodes(userNodes: Record<string, unknown>): void {
  for (const [nodeId, node] of Object.entries(userNodes)) {
    if (!isPlainObject(node)) {
      throw new Error(`LayoutProposal.data.userNodes["${nodeId}"] must be an object`);
    }
    const keys = Object.keys(node);
    if (keys.length !== 2 || !hasOwn(node, "name") || !hasOwn(node, "sourceCode")) {
      throw new Error(
        `LayoutProposal.data.userNodes["${nodeId}"] must contain exactly name and sourceCode`,
      );
    }
    if (
      typeof node.name !== "string" ||
      node.name.length === 0 ||
      typeof node.sourceCode !== "string" ||
      node.sourceCode.length === 0
    ) {
      throw new Error(
        `LayoutProposal.data.userNodes["${nodeId}"].name and .sourceCode must be non-empty strings`,
      );
    }
  }
}

function validatePanelId(
  panelId: string,
  location: string,
  installedPanelTypes?: ReadonlySet<string>,
): void {
  const panelType = getPanelType(panelId);
  if (panelType == undefined) {
    throw new Error(`${location} must match "<type>!<suffix>"`);
  }
  if (
    !allowedPanelTypes.has(panelType) &&
    installedPanelTypes?.has(panelType) !== true
  ) {
    throw new Error(`${location} uses unsupported panel type "${panelType}"`);
  }
}

function validatePanelConfig(
  panelId: string,
  config: Record<string, unknown>,
): void {
  const panelType = getPanelType(panelId);
  if (panelType == undefined || !allowedPanelTypes.has(panelType)) {
    // Runtime-installed extension panels have no per-type schema here. Their configs have already
    // crossed the generic plain-object and JSON graph validation boundary.
    return;
  }
  const requiredArrayFields: Partial<Record<AllowedPanelType, readonly string[]>> = {
    Plot: ["paths"],
    StateTransitions: ["paths"],
    Indicator: ["rules"],
    Gauge: ["gradient"],
  };
  for (const field of requiredArrayFields[panelType as AllowedPanelType] ?? []) {
    if (typeof config[field] !== "undefined" && !Array.isArray(config[field])) {
      throw new Error(`configById["${panelId}"].${field} must be an array`);
    }
  }
  if (
    (panelType === "Plot" || panelType === "StateTransitions") &&
    Array.isArray(config.paths)
  ) {
    for (const [index, path] of config.paths.entries()) {
      if (!isPlainObject(path) || typeof path.value !== "string") {
        throw new Error(
          `configById["${panelId}"].paths[${index}] must be an object with a string value`,
        );
      }
    }
  }
  if (panelType === "Indicator" && Array.isArray(config.rules)) {
    for (const [index, rule] of config.rules.entries()) {
      if (
        !isPlainObject(rule) ||
        typeof rule.color !== "string" ||
        typeof rule.label !== "string" ||
        typeof rule.rawValue !== "string" ||
        typeof rule.operator !== "string" ||
        !indicatorOperators.has(rule.operator)
      ) {
        throw new Error(
          `configById["${panelId}"].rules[${index}] must contain valid color, label, rawValue, and operator strings`,
        );
      }
    }
  }
  if (
    panelType === "Gauge" &&
    Array.isArray(config.gradient) &&
    (config.gradient.length !== 2 ||
      !config.gradient.every((color) => typeof color === "string"))
  ) {
    throw new Error(`configById["${panelId}"].gradient must contain two strings`);
  }
}

type JsonGraphBudget = { nodes: number };

function validateJsonGraph(
  value: unknown,
  location: string,
  budget: JsonGraphBudget,
): void {
  type StackEntry =
    | { type: "enter"; value: unknown; location: string; depth: number }
    | { type: "exit"; value: object };

  const ancestors = new Set<object>();
  const stack: StackEntry[] = [{ type: "enter", value, location, depth: 0 }];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry == undefined) {
      break;
    }
    if (entry.type === "exit") {
      ancestors.delete(entry.value);
      continue;
    }

    if (
      Object.is(entry.value, null) ||
      typeof entry.value === "boolean" ||
      (typeof entry.value === "number" && Number.isFinite(entry.value))
    ) {
      budget.nodes++;
    } else if (typeof entry.value === "string") {
      budget.nodes++;
      if (
        textEncoder.encode(entry.value).byteLength >
        AGENT_SAFE_LAYOUT_MAX_STRING_BYTES
      ) {
        throw new Error(`${entry.location} exceeds the string size limit`);
      }
    } else if (Array.isArray(entry.value) || isPlainObject(entry.value)) {
      if (entry.depth > AGENT_SAFE_LAYOUT_MAX_GRAPH_DEPTH) {
        throw new Error(`${entry.location} exceeds the maximum nesting depth`);
      }
      if (ancestors.has(entry.value)) {
        throw new Error(`${entry.location} contains a cyclic value`);
      }
      const childEntries = Array.isArray(entry.value)
        ? entry.value.map((child, index) => [String(index), child] as const)
        : Object.entries(entry.value);
      if (childEntries.length > AGENT_SAFE_LAYOUT_MAX_COLLECTION_ENTRIES) {
        throw new Error(`${entry.location} contains too many entries`);
      }

      budget.nodes++;
      ancestors.add(entry.value);
      stack.push({ type: "exit", value: entry.value });
      for (let index = childEntries.length - 1; index >= 0; index--) {
        const childEntry = childEntries[index];
        if (childEntry == undefined) {
          continue;
        }
        const [key, child] = childEntry;
        if (textEncoder.encode(key).byteLength > AGENT_SAFE_LAYOUT_MAX_STRING_BYTES) {
          throw new Error(`${entry.location} contains an oversized key`);
        }
        stack.push({
          type: "enter",
          value: child,
          location: `${entry.location}.${key}`,
          depth: entry.depth + 1,
        });
      }
    } else {
      throw new Error(`${entry.location} must contain only JSON-compatible values`);
    }

    if (budget.nodes > AGENT_SAFE_LAYOUT_MAX_GRAPH_NODES) {
      throw new Error("LayoutProposal.data contains too many values");
    }
  }
}

function validateMosaicNode(
  node: unknown,
  configById: Record<string, unknown>,
  panelIds: Set<string>,
  ancestors: Set<object>,
  location: string,
  installedPanelTypes?: ReadonlySet<string>,
  depth = 0,
): asserts node is MosaicNode<string> {
  if (typeof node === "string") {
    validatePanelId(node, location, installedPanelTypes);
    if (panelIds.has(node)) {
      throw new Error(`duplicate panel id "${node}" in layout`);
    }
    if (!hasOwn(configById, node)) {
      throw new Error(`layout panel "${node}" is missing a configById entry`);
    }
    panelIds.add(node);
    return;
  }

  if (!isPlainObject(node)) {
    throw new Error(`${location} must be a panel id or Mosaic branch`);
  }
  if (depth >= AGENT_SAFE_LAYOUT_MAX_MOSAIC_DEPTH) {
    throw new Error(
      `layout exceeds the maximum Mosaic depth of ${AGENT_SAFE_LAYOUT_MAX_MOSAIC_DEPTH}`,
    );
  }
  if (ancestors.has(node)) {
    throw new Error(`${location} contains a cyclic Mosaic branch`);
  }
  if (node.direction !== "row" && node.direction !== "column") {
    throw new Error(`${location}.direction must be "row" or "column"`);
  }
  if (!hasOwn(node, "first") || !hasOwn(node, "second")) {
    throw new Error(`${location} must contain both first and second`);
  }
  for (const key of Object.keys(node)) {
    if (!allowedMosaicBranchFields.has(key)) {
      throw new Error(`${location} contains unknown field "${key}"`);
    }
  }
  if (
    typeof node.splitPercentage !== "undefined" &&
    (typeof node.splitPercentage !== "number" ||
      !Number.isFinite(node.splitPercentage) ||
      node.splitPercentage < 0 ||
      node.splitPercentage > 100)
  ) {
    throw new Error(`${location}.splitPercentage must be a number from 0 to 100`);
  }

  ancestors.add(node);
  validateMosaicNode(
    node.first,
    configById,
    panelIds,
    ancestors,
    `${location}.first`,
    installedPanelTypes,
    depth + 1,
  );
  validateMosaicNode(
    node.second,
    configById,
    panelIds,
    ancestors,
    `${location}.second`,
    installedPanelTypes,
    depth + 1,
  );
  ancestors.delete(node);
}

/**
 * Validates and brands the Agent-safe LayoutData subset. This intentionally rejects some otherwise
 * valid application LayoutData, including unsupported panels and values outside the exported
 * resource budgets.
 */
function validateLayoutProposalDataWithOptions(
  data: unknown,
  options?: ValidateLayoutProposalOptions,
): AgentSafeLayoutData {
  if (!isPlainObject(data)) {
    throw new Error("LayoutProposal.data must be an object");
  }
  validateJsonGraph(data, "LayoutProposal.data", { nodes: 0 });
  for (const key of Object.keys(data)) {
    if (!allowedLayoutFields.has(key)) {
      throw new Error(`LayoutProposal.data contains unknown field "${key}"`);
    }
  }

  const configById = data.configById;
  if (!isPlainObject(configById)) {
    throw new Error("LayoutProposal.data.configById must be an object");
  }
  const configEntries = Object.entries(configById);
  if (configEntries.length > AGENT_SAFE_LAYOUT_MAX_CONFIG_BY_ID_ENTRIES) {
    throw new Error(
      `LayoutProposal.data.configById exceeds the ${AGENT_SAFE_LAYOUT_MAX_CONFIG_BY_ID_ENTRIES} panel limit`,
    );
  }
  for (const field of ["globalVariables", "userNodes"] as const) {
    if (!isPlainObject(data[field])) {
      throw new Error(`LayoutProposal.data.${field} must be an object`);
    }
  }
  validateUserNodes(data.userNodes as Record<string, unknown>);
  if (
    !isPlainObject(data.playbackConfig) ||
    typeof data.playbackConfig.speed !== "number" ||
    !Number.isFinite(data.playbackConfig.speed)
  ) {
    throw new Error("LayoutProposal.data.playbackConfig.speed must be a finite number");
  }
  if (
    typeof data.version !== "undefined" &&
    (typeof data.version !== "number" || !Number.isFinite(data.version))
  ) {
    throw new Error("LayoutProposal.data.version must be a finite number");
  }
  if (typeof data.savedProps !== "undefined" && !isPlainObject(data.savedProps)) {
    throw new Error("LayoutProposal.data.savedProps must be an object");
  }

  for (const [panelId, config] of configEntries) {
    validatePanelId(
      panelId,
      `configById key "${panelId}"`,
      options?.installedPanelTypes,
    );
    if (!isPlainObject(config)) {
      throw new Error(`configById["${panelId}"] must be an object`);
    }
    validatePanelConfig(panelId, config);
  }

  const panelIds = new Set<string>();
  if (typeof data.layout !== "undefined") {
    validateMosaicNode(
      data.layout,
      configById,
      panelIds,
      new Set(),
      "layout",
      options?.installedPanelTypes,
    );
  }
  for (const [panelId] of configEntries) {
    if (!panelIds.has(panelId)) {
      throw new Error(`configById contains orphan panel config "${panelId}"`);
    }
  }

  return data as AgentSafeLayoutData;
}

export function validateLayoutProposalData(
  data: unknown,
  options?: ValidateLayoutProposalOptions,
): AgentSafeLayoutData {
  return validateLayoutProposalDataWithOptions(data, options);
}


export function validateLayoutProposal(
  proposal: LayoutProposal,
  options?: ValidateLayoutProposalOptions,
): ValidatedLayoutProposal {
  // typeof-based: `!= undefined` under loose equality treats null as absent and would accept it,
  // which the wire-boundary validation must not (typeof null is "object" and is rejected).
  if (
    typeof proposal.baseLayoutId !== "undefined" &&
    typeof proposal.baseLayoutId !== "string"
  ) {
    throw new Error("LayoutProposal.baseLayoutId must be a string");
  }
  if (
    typeof proposal.baseFingerprint !== "undefined" &&
    typeof proposal.baseFingerprint !== "string"
  ) {
    throw new Error("LayoutProposal.baseFingerprint must be a string");
  }
  return {
    ...proposal,
    data: validateLayoutProposalDataWithOptions(proposal.data, options),
  };
}

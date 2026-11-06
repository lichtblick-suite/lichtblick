// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Reads overhead A/B report files of the current schema (3, ABBA toggle quartets) as
// `OverheadReportV3`; any other schema or shape is skipped. An incomplete `toggleWithoutUaProbe`,
// `toggleFrameProbe` or `directAttribution` section is dropped. Free of DOM/Playwright/Node imports
// (used by the HTML report and the CI summary).

import { isRecord } from "./schemaV1";
import type { Verdict } from "./stats.types";
import type { OverheadReportV3 } from "../runner/overhead.types";

const VERDICTS: readonly Verdict[] = ["within", "inconclusive", "exceeds"];

function isVerdict(value: unknown): value is Verdict {
  return (VERDICTS as readonly unknown[]).includes(value);
}

function isOptionalVerdict(value: unknown): boolean {
  return value == undefined || isVerdict(value);
}

/** Verdicts the renderers look up: `cpu` and `overall` required, `memory` optional. */
function isVerdictRecord(verdicts: unknown): boolean {
  return (
    isRecord(verdicts) &&
    isVerdict(verdicts.cpu) &&
    isVerdict(verdicts.overall) &&
    isOptionalVerdict(verdicts.memory)
  );
}

/** Shallow shape check of the relaunch A/B fields the report and scorecard read. */
function hasRelaunchFields(json: Record<string, unknown>): boolean {
  return (
    Array.isArray(json.runs) &&
    Array.isArray(json.pairs) &&
    isRecord(json.metrics) &&
    isVerdictRecord(json.verdicts) &&
    isRecord(json.targets) &&
    isRecord(json.config) &&
    Array.isArray(json.config.arms) &&
    (json.relaunchVerdicts == undefined || isVerdictRecord(json.relaunchVerdicts)) &&
    (json.withoutUaProbe == undefined ||
      (isRecord(json.withoutUaProbe) && isVerdictRecord(json.withoutUaProbe.verdicts)))
  );
}

/** Shallow shape check of the schema-3 fields besides the toggle section. */
function hasV3Fields(json: Record<string, unknown>): boolean {
  return (
    json.schemaVersion === 3 &&
    hasRelaunchFields(json) &&
    typeof json.method === "string" &&
    typeof json.cpuVerdictSource === "string" &&
    typeof json.memVerdictSource === "string"
  );
}

/** Shallow shape check of a complete (quartet) toggle section. */
function isToggleSection(toggle: unknown): boolean {
  return (
    isRecord(toggle) &&
    isRecord(toggle.metrics) &&
    Array.isArray(toggle.blocks) &&
    Array.isArray(toggle.quartets) &&
    isOptionalVerdict(toggle.verdict)
  );
}

/** Shallow shape check of a schema-3 report (a toggle section, when present, must be complete). */
function isReportV3(json: Record<string, unknown>): boolean {
  return hasV3Fields(json) && (json.toggle == undefined || isToggleSection(json.toggle));
}

/** Shallow shape check of a direct CPU attribution section (`unsupported` or `measured`). */
function isDirectAttributionSection(section: unknown): boolean {
  if (!isRecord(section) || !isRecord(section.config)) {
    return false;
  }
  if (section.status === "unsupported") {
    return typeof section.reason === "string";
  }
  return (
    section.status === "measured" &&
    typeof section.telemetryMsPerSec === "number" &&
    typeof section.jsMsPerSec === "number" &&
    isVerdict(section.verdict) &&
    Array.isArray(section.topFunctions)
  );
}

/**
 * A schema-3 report without an incomplete `toggleWithoutUaProbe`, `toggleFrameProbe` or
 * `directAttribution` (all informational next to the toggle verdict, so a malformed one is dropped
 * instead of rejecting the report).
 */
function withValidToggleVariant(json: Record<string, unknown>): OverheadReportV3 {
  const {
    toggleWithoutUaProbe,
    toggleFrameProbe,
    directAttribution,
    ...report
  }: Record<string, unknown> = json;
  return {
    ...report,
    ...(toggleWithoutUaProbe != undefined &&
      isToggleSection(toggleWithoutUaProbe) && { toggleWithoutUaProbe }),
    ...(toggleFrameProbe != undefined && isToggleSection(toggleFrameProbe) && { toggleFrameProbe }),
    ...(directAttribution != undefined &&
      isDirectAttributionSection(directAttribution) && { directAttribution }),
  } as unknown as OverheadReportV3;
}

/**
 * A parsed overhead report file of schema 3 (ABBA toggle quartets); undefined for anything else
 * (not an overhead report, another schema version or shape, missing fields).
 */
export function normalizeOverheadReport(json: unknown): OverheadReportV3 | undefined {
  if (!isRecord(json) || json.kind !== "overhead" || typeof json.scenarioId !== "string") {
    return undefined;
  }
  return isReportV3(json) ? withValidToggleVariant(json) : undefined;
}

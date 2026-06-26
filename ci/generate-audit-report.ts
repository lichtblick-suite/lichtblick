// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import fs from "fs";
import path from "path";

import {
  Advisory,
  Severity,
  SEVERITY_ORDER,
  countBySeverity,
  renderHtml,
} from "./audit-report-template";

const INPUT_PATH = process.env.AUDIT_JSON ?? "audit.json";
const OUTPUT_PATH = process.env.AUDIT_HTML ?? "audit-report.html";

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Yarn Berry's `yarn npm audit --json` emits newline-delimited JSON (NDJSON) with one record
 * per line of the shape `{ value: "<module>", children: { ID, Issue, Severity, ... } }`. Older
 * npm-style output uses a single `{ advisories: { [id]: advisory } }` object. This parser
 * handles both shapes and normalizes them into a flat list of advisories.
 */
function parseAuditFile(raw: string): Advisory[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const advisories: Advisory[] = [];

  const ingestYarnRecord = (moduleName: string, children: unknown): void => {
    if (typeof children !== "object" || children == undefined) {
      return;
    }
    const value = children as Record<string, unknown>;
    const dependents = Array.isArray(value.Dependents)
      ? value.Dependents.filter((dep): dep is string => typeof dep === "string")
      : undefined;
    advisories.push({
      module: moduleName,
      severity: normalizeSeverity(value.Severity),
      id: asString(value.ID) ?? moduleName,
      issue: asString(value.Issue) ?? "Unknown advisory",
      vulnerableVersions: asString(value["Vulnerable Versions"]),
      dependents,
    });
  };

  const ingestNpmAdvisory = (key: string, record: unknown): void => {
    if (typeof record !== "object" || record == undefined) {
      return;
    }
    const value = record as Record<string, unknown>;
    advisories.push({
      module: asString(value.module_name) ?? key,
      severity: normalizeSeverity(value.severity),
      id: asString(value.url) ?? key,
      issue: asString(value.title) ?? "Unknown advisory",
      vulnerableVersions: asString(value.vulnerable_versions),
      dependents: undefined,
    });
  };

  const ingestObject = (parsed: unknown): void => {
    if (typeof parsed !== "object" || parsed == undefined) {
      return;
    }
    const obj = parsed as Record<string, unknown>;

    // NPM-style summary object: { advisories: { [id]: advisory } }
    if (typeof obj.advisories === "object" && obj.advisories != undefined) {
      for (const [key, advisory] of Object.entries(obj.advisories as Record<string, unknown>)) {
        ingestNpmAdvisory(key, advisory);
      }
      return;
    }

    // Yarn NDJSON-style line: { value: "<module>", children: { ... } }
    if (typeof obj.value === "string" && typeof obj.children === "object") {
      ingestYarnRecord(obj.value, obj.children);
    }
  };

  // Try a single JSON document first; fall back to NDJSON line-by-line.
  try {
    ingestObject(JSON.parse(trimmed));
  } catch {
    for (const line of trimmed.split("\n")) {
      const lineText = line.trim();
      if (lineText.length === 0) {
        continue;
      }
      try {
        ingestObject(JSON.parse(lineText));
      } catch {
        // Ignore malformed lines.
      }
    }
  }

  return advisories;
}

function normalizeSeverity(value: unknown): Severity {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  return (SEVERITY_ORDER as readonly string[]).includes(text) ? (text as Severity) : "info";
}

function main(): void {
  const inputPath = path.resolve(INPUT_PATH);
  let raw = "";
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (err) {
    console.error(`Failed to read audit JSON at ${inputPath}:`, err);
    process.exit(1);
  }

  const advisories = parseAuditFile(raw);
  const html = renderHtml(advisories);
  fs.writeFileSync(path.resolve(OUTPUT_PATH), html, "utf8");

  const counts = countBySeverity(advisories);
  console.info(
    `Audit report written to ${OUTPUT_PATH} — ${advisories.length} advisories ` +
      `(critical: ${counts.critical}, high: ${counts.high}, moderate: ${counts.moderate}, ` +
      `low: ${counts.low}, info: ${counts.info}).`,
  );
}

main();

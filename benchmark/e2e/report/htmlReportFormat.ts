// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Escaping, number formatting and table helpers shared by the HTML viewer modules
// (`htmlReport.ts`, `htmlReportScorecard.ts`, `htmlReportExercises.ts`).

import { MIB } from "./constants";
import { Cell } from "./htmlReport.types";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function fmtNumber(value: number | undefined, digits = 0): string {
  return value == undefined || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

export function fmtMiB(bytes: number | undefined, digits = 1): string {
  return bytes == undefined ? "—" : fmtNumber(bytes / MIB, digits);
}

export function fmtMs(ms: number | undefined): string {
  return ms == undefined ? "—" : fmtNumber(ms, 0);
}

export function fmtRatio(ratio: number | undefined): string {
  return ratio == undefined ? "—" : `${fmtNumber(ratio * 100, 1)} %`;
}

export function cell(text: string, extra: Omit<Cell, "html"> = {}): Cell {
  return { html: escapeHtml(text), ...extra };
}

export function num(text: string, extra: Omit<Cell, "html" | "numeric"> = {}): Cell {
  return { html: escapeHtml(text), numeric: true, ...extra };
}

function renderCell(entry: Cell): string {
  const classes = [entry.numeric === true ? "num" : "", entry.tone ?? ""].filter(Boolean);
  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const titleAttr = entry.title == undefined ? "" : ` title="${escapeHtml(entry.title)}"`;
  return `<td${classAttr}${titleAttr}>${entry.html}</td>`;
}

/** `<tr>` attributes from name -> unescaped value. */
function rowAttributes(attributes: Readonly<Record<string, string>> | undefined): string {
  return Object.entries(attributes ?? {})
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join("");
}

/**
 * A table (optionally captioned by an `<h3>`). `rowAttrs[i]` adds attributes (escaped here) to the
 * `i`-th row, e.g. the `data-tags` of the report filter.
 */
export function renderTable(
  headers: readonly string[],
  rows: readonly Cell[][],
  caption?: string,
  rowAttrs?: ReadonlyArray<Readonly<Record<string, string>> | undefined>,
): string {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map(
      (row, index) => `<tr${rowAttributes(rowAttrs?.[index])}>${row.map(renderCell).join("")}</tr>`,
    )
    .join("\n");
  const captionHtml = caption == undefined ? "" : `<h3>${escapeHtml(caption)}</h3>`;
  return `${captionHtml}<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}

export function keyValueTable(caption: string, entries: readonly [string, string][]): string {
  return renderTable(
    ["Field", "Value"],
    entries.map(([key, value]) => [cell(key), cell(value)]),
    caption,
  );
}

/** Id of the `<details>` section of the `index`-th run shown. */
export function runAnchor(index: number): string {
  return `run-${index}`;
}

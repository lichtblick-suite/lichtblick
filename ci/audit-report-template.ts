// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const SEVERITY_ORDER = ["critical", "high", "moderate", "low", "info"] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

export type Advisory = {
  module: string;
  severity: Severity;
  id: string;
  issue: string;
  vulnerableVersions?: string;
  dependents?: string[];
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#b71c1c",
  high: "#e53935",
  moderate: "#fb8c00",
  low: "#fdd835",
  info: "#1e88e5",
};

export function countBySeverity(advisories: Advisory[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    info: 0,
  };
  for (const advisory of advisories) {
    counts[advisory.severity] += 1;
  }
  return counts;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHtml(advisories: Advisory[]): string {
  const counts = countBySeverity(advisories);
  const total = advisories.length;
  const generatedAt = new Date().toISOString();
  const repository = process.env.GITHUB_REPOSITORY ?? "local";

  const summaryCells = SEVERITY_ORDER.map(
    (severity) => `
        <td style="text-align:center;padding:8px 16px;">
          <div style="font-size:24px;font-weight:700;color:${SEVERITY_COLORS[severity]};">${counts[severity]}</div>
          <div style="font-size:12px;text-transform:uppercase;color:#555;">${severity}</div>
        </td>`,
  ).join("");

  const sorted = [...advisories].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const rows =
    sorted.length === 0
      ? `<tr><td colspan="4" style="padding:16px;text-align:center;color:#2e7d32;">No vulnerabilities found. 🎉</td></tr>`
      : sorted
          .map((advisory) => {
            const dependents =
              advisory.dependents && advisory.dependents.length > 0
                ? advisory.dependents.map((dep) => escapeHtml(dep)).join("<br />")
                : "—";
            return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap;">
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;color:#fff;font-size:12px;background:${SEVERITY_COLORS[advisory.severity]};">${advisory.severity}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">${escapeHtml(advisory.module)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(advisory.issue)}<div style="font-size:12px;color:#777;">${escapeHtml(advisory.id)}${advisory.vulnerableVersions ? ` • ${escapeHtml(advisory.vulnerableVersions)}` : ""}</div></td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px;">${dependents}</td>
        </tr>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dependency Audit Report</title>
</head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:880px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
    <div style="background:#0d1b2a;color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;">Dependency Audit Report</h1>
      <div style="font-size:13px;opacity:0.8;margin-top:4px;">${escapeHtml(repository)} • ${escapeHtml(generatedAt)}</div>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#fafafa;border-radius:6px;">
        <tr>
          <td style="text-align:center;padding:8px 16px;">
            <div style="font-size:24px;font-weight:700;">${total}</div>
            <div style="font-size:12px;text-transform:uppercase;color:#555;">total</div>
          </td>
          ${summaryCells}
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;background:#f0f0f0;">
            <th style="padding:8px 12px;">Severity</th>
            <th style="padding:8px 12px;">Package</th>
            <th style="padding:8px 12px;">Advisory</th>
            <th style="padding:8px 12px;">Dependents</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 24px;background:#f0f0f0;font-size:12px;color:#777;">
      Generated by <code>yarn npm audit</code> • This is an automated report.
    </div>
  </div>
</body>
</html>
`;
}

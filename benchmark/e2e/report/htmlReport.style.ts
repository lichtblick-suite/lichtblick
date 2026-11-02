// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Static CSS of the interim HTML viewer (`htmlReport.ts`), inlined into the generated page. The
// report is a Node-generated static HTML string, so tss-react does not apply here.

export const REPORT_CSS = `
:root {
  color-scheme: light dark;
  --bg: #f7f7f8; --panel: #ffffff; --fg: #1f2328; --muted: #656d76; --border: #d0d7de;
  --grid: rgba(110, 118, 129, 0.2); --marker: #8250df; --link: #0969da;
  --good-bg: #dafbe1; --good-fg: #116329; --warn-bg: #fff8c5; --warn-fg: #7d4e00;
  --bad-bg: #ffebe9; --bad-fg: #a40e26;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --panel: #161b22; --fg: #e6edf3; --muted: #8d96a0; --border: #30363d;
    --grid: rgba(139, 148, 158, 0.2); --marker: #bc8cff; --link: #4493f8;
    --good-bg: #12261e; --good-fg: #3fb950; --warn-bg: #272115; --warn-fg: #d29922;
    --bad-bg: #2d1214; --bad-fg: #f85149;
  }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: var(--bg); color: var(--fg);
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
a { color: var(--link); }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 28px 0 8px; }
h3 { font-size: 15px; margin: 18px 0 6px; }
.meta { color: var(--muted); margin: 0 0 16px; }
.meta span + span::before { content: " · "; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; background: var(--panel); margin: 4px 0 12px; }
th, td { border: 1px solid var(--border); padding: 4px 8px; text-align: left; vertical-align: top; }
th { font-weight: 600; vertical-align: bottom; }
td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.good { background: var(--good-bg); color: var(--good-fg); }
.warn { background: var(--warn-bg); color: var(--warn-fg); }
.bad { background: var(--bad-bg); color: var(--bad-fg); }
details.run { background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
  margin: 12px 0; padding: 0 16px; }
details.run > summary { cursor: pointer; padding: 12px 0; font-weight: 600; font-size: 15px; }
details.run > summary .sub { color: var(--muted); font-weight: 400; }
.charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: 12px; }
.chart { position: relative; height: 280px; border: 1px solid var(--border); border-radius: 4px; padding: 6px; }
.tables { display: flex; flex-wrap: wrap; gap: 0 24px; }
.shots { display: flex; flex-wrap: wrap; gap: 12px; }
.shots figure { margin: 0; }
.shots img { width: 320px; max-width: 100%; border: 1px solid var(--border); border-radius: 4px; }
.shots figcaption { color: var(--muted); font-size: 12px; }
.muted { color: var(--muted); }
.nowrap { white-space: nowrap; }
.stale { border: 1px solid var(--border); border-radius: 3px; padding: 0 4px; font-size: 11px;
  color: var(--muted); font-style: italic; cursor: help; }
.markers span + span::before { content: " · "; }
.error { color: var(--bad-fg); }
footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid var(--border); color: var(--muted); }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
`;

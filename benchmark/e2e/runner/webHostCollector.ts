// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Browser, CDPSession } from "@playwright/test";
import { execFile } from "node:child_process";
import { performance } from "node:perf_hooks";

import { KB, PS_MAX_BUFFER_BYTES } from "./constants";
import type {
  CdpProcessInfo,
  HostMetricsSnapshot,
  HostProcessSample,
  PsTreeRow,
  WebHostCollectorOptions,
} from "./types";
import type { LegacyProcessMetric } from "../types";

// Host (OS-level) process metrics for the web platform, collected on the
// Node side of Playwright:
// - process list + cumulative CPU time: CDP `SystemInfo.getProcessInfo` on a browser session;
// - resident set size (RSS) per pid: `ps -o pid=,rss= -p <pids>` (Linux/macOS);
// - fallback when CDP is unavailable: the browser's process tree from `ps -A`, rooted at the
//   browser process launched with a unique marker flag (`--lichtblick-benchmark-run=<id>`).
// On Windows (no `ps`) memory is omitted (CPU from CDP still reported) and a warning logged once.

/** Normalizes CDP process types: `GPU` → gpu, service processes (network, storage, audio…) → utility. */
export function mapCdpProcessType(type: string): string {
  const lower = type.toLowerCase();
  if (lower === "browser" || lower === "renderer" || lower === "gpu") {
    return lower;
  }
  if (
    lower === "utility" ||
    lower.includes(".") ||
    lower.includes("network") ||
    lower.includes("storage") ||
    lower.includes("audio")
  ) {
    return "utility";
  }
  return lower;
}

/** Normalizes the Chromium `--type=` command line switch of a child process. */
export function mapChromiumTypeSwitch(args: string): string {
  const match = /--type=([\w-]+)/.exec(args);
  if (match == undefined) {
    return "browser";
  }
  switch (match[1]) {
    case "gpu-process":
      return "gpu";
    case "renderer":
      return "renderer";
    case "utility":
      return "utility";
    default:
      return match[1]!;
  }
}

/** Parses `ps -o pid=,rss=` output into pid → RSS (KB). Malformed lines are ignored. */
export function parsePsOutput(stdout: string): Map<number, number> {
  const result = new Map<number, number>();
  for (const line of stdout.split("\n")) {
    const [pid, rss] = line.trim().split(/\s+/);
    const pidNumber = Number(pid);
    const rssNumber = Number(rss);
    if (pid && rss && Number.isInteger(pidNumber) && Number.isFinite(rssNumber)) {
      result.set(pidNumber, rssNumber);
    }
  }
  return result;
}

/** Parses `ps -A -o pid=,ppid=,rss=,pcpu=,args=` output. Malformed lines are ignored. */
export function parsePsTreeOutput(stdout: string): PsTreeRow[] {
  const rows: PsTreeRow[] = [];
  for (const line of stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/.exec(line);
    if (match == undefined) {
      continue;
    }
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      rssKb: Number(match[3]),
      cpuPercent: Number(match[4]),
      args: match[5]!,
    });
  }
  return rows;
}

/**
 * Returns the browser process (args contain `marker`, no `--type=` switch) and all its
 * descendants, or an empty list if the root isn't found.
 */
export function selectProcessTree(rows: readonly PsTreeRow[], marker: string): PsTreeRow[] {
  const root = rows.find((row) => row.args.includes(marker) && !row.args.includes("--type="));
  if (root == undefined) {
    return [];
  }
  const childrenByParent = new Map<number, PsTreeRow[]>();
  for (const row of rows) {
    const siblings = childrenByParent.get(row.ppid) ?? [];
    siblings.push(row);
    childrenByParent.set(row.ppid, siblings);
  }
  const result: PsTreeRow[] = [];
  const stack = [root];
  const seen = new Set<number>();
  while (stack.length > 0) {
    const row = stack.pop()!;
    if (seen.has(row.pid)) {
      continue;
    }
    seen.add(row.pid);
    result.push(row);
    stack.push(...(childrenByParent.get(row.pid) ?? []));
  }
  return result.sort((a, b) => a.pid - b.pid);
}

/**
 * CPU usage in percent of one core between two cumulative CPU-time readings (seconds) taken
 * `elapsedMs` apart. Undefined for the first reading or a non-positive interval; clamped at 0
 * (pid reuse / counter reset).
 */
export function computeCpuPercent(
  previousCpuTimeSec: number | undefined,
  currentCpuTimeSec: number,
  elapsedMs: number,
): number | undefined {
  if (previousCpuTimeSec == undefined || !(elapsedMs > 0)) {
    return undefined;
  }
  return Math.max(0, ((currentCpuTimeSec - previousCpuTimeSec) * 1000 * 100) / elapsedMs);
}

/** Legacy artifact entry (memory in KB; 0 when unavailable). */
export function toLegacyProcessMetric(sample: HostProcessSample): LegacyProcessMetric {
  return {
    pid: sample.pid,
    type: sample.processType,
    memory: {
      workingSetSize: Math.round((sample.workingSetBytes ?? 0) / KB),
      peakWorkingSetSize: Math.round((sample.peakWorkingSetBytes ?? 0) / KB),
    },
    cpu: { percentCPUUsage: sample.cpuPercent ?? 0 },
  };
}

/** Runs `ps` without a shell; tolerates a non-zero exit (e.g. a pid exited) when stdout exists. */
async function runPs(args: readonly string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    execFile("ps", args, { maxBuffer: PS_MAX_BUFFER_BYTES }, (error, stdout) => {
      if (error != undefined && stdout.length === 0) {
        reject(new Error(`ps ${args.join(" ")} failed: ${error.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export class WebHostCollector {
  readonly #browser: Browser;
  readonly #marker: string;
  readonly #memorySupported = process.platform !== "win32";
  #session: CDPSession | undefined;
  #cdpUnavailable = false;
  #warned = new Set<string>();
  #previousCpu = new Map<number, number>();
  #previousAtMs: number | undefined;
  #peakRssBytes = new Map<number, number>();

  public constructor(options: WebHostCollectorOptions) {
    this.#browser = options.browser;
    this.#marker = options.marker;
  }

  public async collect(monotonicTs: number): Promise<HostMetricsSnapshot> {
    const processes = await this.#getCdpProcessInfo();
    const samples =
      processes != undefined
        ? await this.#collectFromCdp(processes, monotonicTs)
        : await this.#collectFromPsTree(monotonicTs);
    return { samples, legacyMetrics: samples.map(toLegacyProcessMetric) };
  }

  public async dispose(): Promise<void> {
    const session = this.#session;
    this.#session = undefined;
    await session?.detach().catch(() => undefined);
  }

  #warnOnce(key: string, message: string): void {
    if (!this.#warned.has(key)) {
      this.#warned.add(key);
      console.warn(`[WebHostCollector] ${message}`);
    }
  }

  async #getCdpProcessInfo(): Promise<CdpProcessInfo[] | undefined> {
    if (this.#cdpUnavailable) {
      return undefined;
    }
    try {
      this.#session ??= await this.#browser.newBrowserCDPSession();
      const result = await this.#session.send("SystemInfo.getProcessInfo");
      return result.processInfo;
    } catch (error) {
      this.#cdpUnavailable = true;
      this.#warnOnce(
        "cdp",
        `CDP SystemInfo.getProcessInfo unavailable (${String(error)}); falling back to the ps process tree.`,
      );
      return undefined;
    }
  }

  #elapsedMs(): number | undefined {
    const now = performance.now();
    const elapsed = this.#previousAtMs == undefined ? undefined : now - this.#previousAtMs;
    this.#previousAtMs = now;
    return elapsed;
  }

  #withMemory(sample: HostProcessSample, rssKb: number | undefined): HostProcessSample {
    if (rssKb == undefined) {
      return sample;
    }
    const bytes = rssKb * KB;
    const peak = Math.max(bytes, this.#peakRssBytes.get(sample.pid) ?? 0);
    this.#peakRssBytes.set(sample.pid, peak);
    sample.workingSetBytes = bytes;
    sample.peakWorkingSetBytes = peak;
    return sample;
  }

  async #collectFromCdp(
    processes: readonly CdpProcessInfo[],
    monotonicTs: number,
  ): Promise<HostProcessSample[]> {
    const elapsedMs = this.#elapsedMs();
    let rssByPid = new Map<number, number>();
    if (!this.#memorySupported) {
      this.#warnOnce("windows", "Process memory is not collected on Windows (no `ps`).");
    } else if (processes.length > 0) {
      try {
        rssByPid = parsePsOutput(
          await runPs(["-o", "pid=,rss=", "-p", processes.map((p) => p.id).join(",")]),
        );
      } catch (error) {
        this.#warnOnce("ps", `ps failed (${String(error)}); process memory omitted.`);
      }
    }

    const nextCpu = new Map<number, number>();
    const samples: HostProcessSample[] = [];
    for (const info of processes) {
      nextCpu.set(info.id, info.cpuTime);
      const sample: HostProcessSample = {
        monotonicTs,
        pid: info.id,
        processType: mapCdpProcessType(info.type),
      };
      const cpuPercent = computeCpuPercent(
        this.#previousCpu.get(info.id),
        info.cpuTime,
        elapsedMs ?? 0,
      );
      if (cpuPercent != undefined) {
        sample.cpuPercent = cpuPercent;
      }
      samples.push(this.#withMemory(sample, rssByPid.get(info.id)));
    }
    this.#previousCpu = nextCpu;
    return samples;
  }

  async #collectFromPsTree(monotonicTs: number): Promise<HostProcessSample[]> {
    if (!this.#memorySupported) {
      this.#warnOnce("windows", "No host process metrics on Windows without CDP.");
      return [];
    }
    let rows: PsTreeRow[];
    try {
      rows = selectProcessTree(
        parsePsTreeOutput(await runPs(["-A", "-o", "pid=,ppid=,rss=,pcpu=,args="])),
        this.#marker,
      );
    } catch (error) {
      this.#warnOnce("ps-tree", `ps failed (${String(error)}); no host process metrics.`);
      return [];
    }
    // `pcpu` is ps' own average (lifetime on Linux, decaying on macOS): coarser than CDP deltas.
    return rows.map((row) =>
      this.#withMemory(
        {
          monotonicTs,
          pid: row.pid,
          processType: mapChromiumTypeSwitch(row.args),
          cpuPercent: row.cpuPercent,
        },
        row.rssKb,
      ),
    );
  }
}

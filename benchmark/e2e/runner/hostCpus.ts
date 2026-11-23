// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import os from "node:os";

/**
 * Logical CPUs available to processes on this host (`run.environment.logicalCpus`). The runner and
 * the benchmark Electron app run on the same host, so this is also the divisor Electron applies to
 * `ProcessMetric.cpu.percentCPUUsage` (`base::SysInfo::NumberOfProcessors()`): both count the CPUs
 * of the process affinity mask on Linux and the logical CPUs on macOS.
 */
export function logicalCpuCount(): number {
  return os.availableParallelism();
}

/**
 * Converts Electron's `percentCPUUsage` to the per-core-sum scale of the web collector (100 % = one
 * full core, so a process can exceed 100 %). Electron divides the per-core-sum usage by the number
 * of logical CPUs (`electron_api_app.cc`: `usagePercent / processor_count`); this undoes it.
 */
export function toPerCoreSumPercent(percentOfAllCpus: number, logicalCpus: number): number {
  return percentOfAllCpus * logicalCpus;
}

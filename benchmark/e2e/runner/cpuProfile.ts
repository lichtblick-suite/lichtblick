// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Profiled period of the direct CPU attribution: a CDP `Profiler` sampling profile of the
// renderer main thread (the page's own CDP session; on Electron the window's, when Playwright
// supports it). Any CDP failure yields `unsupported` with the reason instead of failing the run.

import type { CDPSession, Page } from "@playwright/test";

import type { SamplingClock } from "./steadyWindow.types";
import type { MainThreadProfileCapture } from "../result/directAttribution.types";

export type MainThreadProfileOptions = {
  durationMs: number;
  /** CDP `Profiler.setSamplingInterval`, µs. */
  samplingIntervalUs: number;
  clock: SamplingClock;
};

/** Profiles the main thread of `page` for `durationMs` (see the file comment). */
export async function captureMainThreadProfile(
  page: Page,
  options: MainThreadProfileOptions,
): Promise<MainThreadProfileCapture> {
  let session: CDPSession;
  try {
    session = await page.context().newCDPSession(page);
  } catch (error) {
    return { status: "unsupported", reason: `No CDP session for the page: ${String(error)}` };
  }
  try {
    await session.send("Profiler.enable");
    await session.send("Profiler.setSamplingInterval", { interval: options.samplingIntervalUs });
    await session.send("Profiler.start");
    await options.clock.sleep(options.durationMs);
    // Bounded by the test timeout (`overheadTestTimeoutMs` budgets the profiled period).
    const { profile } = await session.send("Profiler.stop");
    return { status: "captured", profile };
  } catch (error) {
    return { status: "unsupported", reason: `CDP Profiler failed: ${String(error)}` };
  } finally {
    await session.send("Profiler.disable").catch(() => undefined);
    await session.detach().catch(() => undefined);
  }
}

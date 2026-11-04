// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import { MAIN_THREAD_PROBE_KEY } from "./constants";
import type { MainThreadProbeWindow } from "./types";
import type { MainThreadProbeReading } from "../result/steadyWindow.types";

/**
 * Runs in the page before any page script (init script, so it must be self-contained): sums
 * `longtask` durations and counts animation frames from document start, exposed as
 * `window[key].read()`. Top-level document only.
 */
function installProbeInPage(key: string): void {
  if (window !== window.top) {
    return;
  }
  let longTaskMs = 0;
  let frames = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskMs += entry.duration;
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // `longtask` unsupported: the probe then reports 0 long-task ms.
  }
  const onFrame = (): void => {
    frames += 1;
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);
  (window as unknown as MainThreadProbeWindow)[key] = {
    read: () => ({ longTaskMs, frames, nowMs: performance.now() }),
  };
}

/**
 * Installs the main-thread probe for every later navigation of `page` (`page.addInitScript`, also
 * on the Electron window page). Overhead A/B runs install it in every arm (telemetry off and on), so
 * it measures the same thing everywhere and its own small cost cancels out.
 */
export async function installMainThreadProbe(page: Page): Promise<void> {
  await page.addInitScript(installProbeInPage, MAIN_THREAD_PROBE_KEY);
}

/** Reads the probe; undefined when it is not installed or the page call fails. */
export async function readMainThreadProbe(page: Page): Promise<MainThreadProbeReading | undefined> {
  return await page
    .evaluate(
      (key) => (window as unknown as MainThreadProbeWindow)[key]?.read(),
      MAIN_THREAD_PROBE_KEY,
    )
    .catch(() => undefined);
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_SCREENSHOT_TIMINGS,
  SCREENSHOTS_DISABLING_ENV_VALUES,
  SCREENSHOTS_ENV_VAR,
} from "./constants";
import type {
  ScenarioScreenshotterOptions,
  ScreenshotArtifact,
  ScreenshotCheckpoint,
  ScreenshotMode,
  ScreenshotTimings,
} from "./types";
import type { BenchmarkPlatform } from "../result/schemaV1";
import type { ScenarioUnderTest } from "../types";

// Checkpoint screenshots of a scenario run, so a reviewer can see what the app showed. Which
// checkpoints a run captures depends on the mode (`resolveScreenshotMode`): by default only `end`
// (outside the sampling window) on every platform; `BENCHMARK_SCREENSHOTS=all` adds `loaded` and
// `mid` for visual debugging.
//
// - `loaded`: once the scenario is up — the runner has drained the scenario's "loaded" event
//   (`datasource.firstMessage` for real pipelines, `app.ready` for synthetic ones, which have no
//   data source events), or after a fallback timeout — plus a short paint delay.
// - `mid`: halfway through the sampling window.
// - `end`: taken by the runner after all measurement is done (sampling window, pause/close, final
//   telemetry drain), right before the result is returned and the app is closed. It therefore
//   never shows up in any metric of the run's artifacts.
//
// `loaded` and `mid` (mode `all` only) run as background tasks next to the 1 Hz sampling loop and
// never block it: the loop keeps its own `Date.now()` deadline, so the sampling window has the
// same length with or without screenshots. They only observe the records the loop already drains
// (no extra `drain()`, which would steal records from the loop). A `loaded`/`mid` capture that
// would *start* after the sampling window deadline is skipped (logged with console.debug): on a
// saturated renderer (web 3D scenarios under SwiftShader, ~1-3 fps) a single `page.screenshot()`
// takes ~5 s, because Playwright makes several page round trips per capture, and queued captures
// would otherwise spill into the post-window teardown. A capture already in flight at the
// deadline completes (bounded by the screenshot timeout); the runner waits for it before teardown.
//
// Captures are serialized (one `page.screenshot()` at a time) and every failure is caught and
// logged: a screenshot never fails a test.

/**
 * Screenshots are opt-in per run (`requested === true`); the env cannot enable them for a run
 * that opted out (e.g. the overhead A/B). For an opted-in run, `BENCHMARK_SCREENSHOTS`
 * (case-insensitive, trimmed) selects, the same on every platform:
 * - unset or any other value → `end`: no capture inside the sampling window, so no metric is
 *   affected;
 * - `all` → `loaded` + `mid` + `end`, for visual debugging only. It distorts metrics: a capture
 *   on a saturated renderer (3D scenarios: web under SwiftShader, Electron `pointcloud`) blocks it
 *   for ~4-7 s inside the window;
 * - `0`/`false`/`off`/`no` → `none`.
 */
export function resolveScreenshotMode({
  requested,
  env = process.env,
}: {
  requested: boolean | undefined;
  env?: NodeJS.ProcessEnv;
}): ScreenshotMode {
  if (requested !== true) {
    return "none";
  }
  const value = env[SCREENSHOTS_ENV_VAR]?.trim().toLowerCase();
  if (value != undefined && SCREENSHOTS_DISABLING_ENV_VALUES.has(value)) {
    return "none";
  }
  return value === "all" ? "all" : "end";
}

/** `<scenarioId>-<platform>[-telemetry-off]-<ts>-<checkpoint>.png` */
export function screenshotFileName({
  scenarioId,
  platform,
  telemetryEnabled,
  timestamp,
  checkpoint,
}: {
  scenarioId: string;
  platform: BenchmarkPlatform;
  telemetryEnabled: boolean;
  timestamp: number;
  checkpoint: ScreenshotCheckpoint;
}): string {
  const off = telemetryEnabled ? "" : "-telemetry-off";
  return `${scenarioId}-${platform}${off}-${timestamp}-${checkpoint}.png`;
}

/** Instant event after which a scenario counts as loaded for the `loaded` screenshot. */
export function loadedEventName(
  pipeline: ScenarioUnderTest["pipeline"],
): "datasource.firstMessage" | "app.ready" {
  return pipeline === "real" ? "datasource.firstMessage" : "app.ready";
}

/**
 * Sleeps on the global `setTimeout` rather than `node:timers/promises`, which Jest's fake timers do
 * not replace: the unit tests drive the wall-clock deadlines with a fake clock.
 */
async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Polls `predicate` every `pollIntervalMs` until it holds (true) or the wall-clock `deadlineMs`
 * passes (false).
 */
export async function waitUntil(
  predicate: () => boolean,
  deadlineMs: number,
  pollIntervalMs: number,
): Promise<boolean> {
  if (predicate()) {
    return true;
  }
  const remaining = deadlineMs - Date.now();
  if (remaining <= 0) {
    return false;
  }
  await delay(Math.min(pollIntervalMs, remaining));
  // Polls are strictly sequential (each after the previous delay): recurse instead of looping.
  return await waitUntil(predicate, deadlineMs, pollIntervalMs);
}

/** Captures the checkpoint screenshots of one scenario run. No method ever rejects. */
export class ScenarioScreenshotter {
  readonly #options: ScenarioScreenshotterOptions;
  readonly #timings: ScreenshotTimings;
  readonly #captured: ScreenshotArtifact[] = [];
  readonly #background: Promise<void>[] = [];
  #queue: Promise<void> = Promise.resolve();

  public constructor(options: ScenarioScreenshotterOptions) {
    this.#options = options;
    this.#timings = { ...DEFAULT_SCREENSHOT_TIMINGS, ...options.timings };
  }

  /**
   * Captures `checkpoint` after any capture in progress. Resolves undefined on failure, or when
   * the capture would start after the wall-clock `notAfterMs` (skipped).
   */
  public async capture(
    checkpoint: ScreenshotCheckpoint,
    { notAfterMs }: { notAfterMs?: number } = {},
  ): Promise<ScreenshotArtifact | undefined> {
    const run = this.#queue.then(async () => {
      const lateByMs = notAfterMs == undefined ? 0 : Date.now() - notAfterMs;
      if (lateByMs > 0) {
        console.debug(
          `[screenshots] ${this.#label()}: skipping "${checkpoint}", it would start ${lateByMs} ms after the sampling window deadline`,
        );
        return undefined;
      }
      return await this.#captureNow(checkpoint);
    });
    this.#queue = run.then(() => undefined);
    return await run;
  }

  /**
   * Starts the background `loaded` and `mid` captures for a sampling window starting at the
   * wall-clock `windowStartMs`; returns immediately. `isLoaded` must be a cheap in-memory check.
   * The `loaded` wait is capped so that the capture is scheduled inside the window; either capture
   * is skipped if it would start after the window deadline (e.g. queued behind a slow capture).
   */
  public startWindowCheckpoints({
    windowStartMs,
    durationMs,
    isLoaded,
  }: {
    windowStartMs: number;
    durationMs: number;
    isLoaded: () => boolean;
  }): void {
    const { loadedFallbackMs, paintDelayMs, pollIntervalMs } = this.#timings;
    const windowEndMs = windowStartMs + durationMs;
    const loadedDeadline = Math.min(windowStartMs + loadedFallbackMs, windowEndMs - paintDelayMs);
    this.#background.push(
      (async () => {
        if (!(await waitUntil(isLoaded, loadedDeadline, pollIntervalMs))) {
          console.debug(
            `[screenshots] ${this.#label()}: loaded event not observed, capturing "loaded" after the fallback`,
          );
        }
        await delay(paintDelayMs);
        await this.capture("loaded", { notAfterMs: windowEndMs });
      })(),
      (async () => {
        await delay(Math.max(0, windowStartMs + durationMs / 2 - Date.now()));
        await this.capture("mid", { notAfterMs: windowEndMs });
      })(),
    );
  }

  /** Waits for the background captures (at most one in flight, bounded by the screenshot timeout). */
  public async settle(): Promise<void> {
    await Promise.all(this.#background.splice(0));
  }

  public captured(): readonly ScreenshotArtifact[] {
    return [...this.#captured];
  }

  #label(): string {
    return `${this.#options.platform}/${this.#options.scenarioId}`;
  }

  async #captureNow(checkpoint: ScreenshotCheckpoint): Promise<ScreenshotArtifact | undefined> {
    const { page, dir, scenarioId, platform, telemetryEnabled, timestamp, attacher } =
      this.#options;
    const filePath = path.join(
      dir,
      screenshotFileName({
        scenarioId,
        platform,
        telemetryEnabled,
        timestamp,
        checkpoint,
      }),
    );
    const startedAt = Date.now();
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await page.screenshot({ path: filePath, timeout: this.#timings.timeoutMs, caret: "initial" });
      console.debug(
        `[screenshots] ${this.#label()}: "${checkpoint}" took ${Date.now() - startedAt} ms`,
      );
    } catch (error) {
      console.warn(`[screenshots] ${this.#label()}: "${checkpoint}" capture failed`, error);
      return undefined;
    }
    const artifact: ScreenshotArtifact = { checkpoint, path: filePath };
    this.#captured.push(artifact);
    if (attacher != undefined) {
      try {
        await attacher.attach(path.basename(filePath), {
          path: filePath,
          contentType: "image/png",
        });
      } catch (error) {
        console.warn(`[screenshots] ${this.#label()}: attaching "${checkpoint}" failed`, error);
      }
    }
    return artifact;
  }
}

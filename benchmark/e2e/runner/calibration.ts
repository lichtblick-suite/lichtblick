// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Render calibration of a run: measured on a blank page in the same browser / Electron window right
// before the scenario loads, so the numbers describe the display and GPU path the scenario gets,
// without any app code running.

import type { Page } from "@playwright/test";

import type {
  AnimationFrameMeasurement,
  DebugRendererInfo,
  LoseContext,
  MeasureAnimationFramesArgs,
} from "./calibration.types";
import {
  CALIBRATION_PAGE_URL,
  FPS_CALIBRATION_DURATION_MS,
  FPS_CALIBRATION_TIMEOUT_MS,
  GL_RENDERER_UNAVAILABLE,
  MIN_PLAUSIBLE_FPS_CEILING,
} from "./constants";
import {
  LATE_FRAME_BUDGET_MULTIPLIER,
  LATE_FRAME_THRESHOLD_MS,
} from "../../src/telemetry/collectors/constants";
import type { RenderCalibrationV1 } from "../result/schemaV1";

/**
 * In-page (passed to `page.evaluate`; must stay self-contained): counts `requestAnimationFrame`
 * callbacks for `durationMs` of rAF time. Resolves early with what it has after `timeoutMs` (e.g. a
 * page that does not paint).
 */
// Not `async`: the source is serialized into the page, so it must not depend on transpiler helpers.
// eslint-disable-next-line @typescript-eslint/promise-function-async
export function measureAnimationFrames({
  durationMs,
  timeoutMs,
}: MeasureAnimationFramesArgs): Promise<AnimationFrameMeasurement> {
  return new Promise((resolve) => {
    let firstTs = -1;
    let lastTs = -1;
    let frames = 0;
    const finish = () => {
      resolve({ frames, elapsedMs: firstTs < 0 ? 0 : lastTs - firstTs });
    };
    const timer = setTimeout(finish, timeoutMs);
    const onFrame = (timestamp: number) => {
      if (firstTs < 0) {
        firstTs = timestamp;
      } else {
        frames++;
      }
      lastTs = timestamp;
      if (timestamp - firstTs >= durationMs) {
        clearTimeout(timer);
        finish();
        return;
      }
      requestAnimationFrame(onFrame);
    };
    requestAnimationFrame(onFrame);
  });
}

/**
 * In-page (passed to `page.evaluate`; must stay self-contained): the WebGL renderer string of a
 * throwaway canvas (WebGL2, else WebGL1): `UNMASKED_RENDERER_WEBGL` via `WEBGL_debug_renderer_info`
 * when exposed, else `RENDERER`. Returns `unavailable` when no context can be created.
 */
export function readWebGlRenderer(unavailable: string): string {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (gl == undefined) {
    return unavailable;
  }
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info") as DebugRendererInfo | null;
    const renderer: unknown = gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
    return typeof renderer === "string" && renderer !== "" ? renderer : unavailable;
  } finally {
    (gl.getExtension("WEBGL_lose_context") as LoseContext | null)?.loseContext();
  }
}

/** Frames per second of a measurement, rounded to 0.1; 0 when no frame interval was observed. */
export function computeFpsCeiling({ frames, elapsedMs }: AnimationFrameMeasurement): number {
  if (frames <= 0 || elapsedMs <= 0) {
    return 0;
  }
  return Math.round((frames * 1000 * 10) / elapsedMs) / 10;
}

/**
 * Late-frame threshold for a measured refresh ceiling: `LATE_FRAME_BUDGET_MULTIPLIER` (1.5) real
 * frame intervals, rounded to 0.01 ms. Falls back to `LATE_FRAME_THRESHOLD_MS` (1.5 × 60 Hz) when
 * the ceiling is unknown or implausible (< `MIN_PLAUSIBLE_FPS_CEILING`).
 */
export function lateFrameThresholdForFpsCeiling(fpsCeiling: number): number {
  if (!Number.isFinite(fpsCeiling) || fpsCeiling < MIN_PLAUSIBLE_FPS_CEILING) {
    return LATE_FRAME_THRESHOLD_MS;
  }
  return Math.round((LATE_FRAME_BUDGET_MULTIPLIER * 100_000) / fpsCeiling) / 100;
}

/**
 * Navigates `page` to a blank document, measures the animation frame rate for
 * `FPS_CALIBRATION_DURATION_MS` and reads the WebGL renderer. Run before the scenario navigation
 * (and before crash detection, which would otherwise see the extra navigation).
 */
export async function calibrateRendering(page: Page): Promise<RenderCalibrationV1> {
  await page.goto(CALIBRATION_PAGE_URL);
  const measurement = await page.evaluate(measureAnimationFrames, {
    durationMs: FPS_CALIBRATION_DURATION_MS,
    timeoutMs: FPS_CALIBRATION_TIMEOUT_MS,
  });
  const glRenderer = await page.evaluate(readWebGlRenderer, GL_RENDERER_UNAVAILABLE);
  const fpsCeiling = computeFpsCeiling(measurement);
  return {
    fpsCeiling,
    glRenderer,
    lateFrameThresholdMs: lateFrameThresholdForFpsCeiling(fpsCeiling),
  };
}

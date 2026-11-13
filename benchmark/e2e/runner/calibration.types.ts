// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** Result of counting animation frames in the page (see `measureAnimationFrames`). */
export type AnimationFrameMeasurement = {
  /** Frame intervals observed (frames after the first one). */
  frames: number;
  /** Time between the first and the last observed frame (rAF timestamps), ms. */
  elapsedMs: number;
};

export type MeasureAnimationFramesArgs = { durationMs: number; timeoutMs: number };

/** Structural subset of the `WEBGL_debug_renderer_info` extension. */
export type DebugRendererInfo = { readonly UNMASKED_RENDERER_WEBGL: number };

/** Structural subset of the `WEBGL_lose_context` extension. */
export type LoseContext = { loseContext(): void };

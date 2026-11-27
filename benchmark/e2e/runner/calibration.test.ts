// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  computeFpsCeiling,
  lateFrameThresholdForFpsCeiling,
  measureAnimationFrames,
  readWebGlRenderer,
} from "./calibration";
import { LATE_FRAME_THRESHOLD_MS } from "../../src/telemetry/collectors/constants";

describe("computeFpsCeiling", () => {
  it.each([
    [{ frames: 120, elapsedMs: 2000 }, 60],
    [{ frames: 239, elapsedMs: 1991.7 }, 120],
    [{ frames: 119, elapsedMs: 2001 }, 59.5],
  ])("should round %p to 0.1 fps (%p)", (measurement, expected) => {
    // Given / When
    const fps = computeFpsCeiling(measurement);

    // Then
    expect(fps).toBe(expected);
  });

  it.each([
    { frames: 0, elapsedMs: 0 },
    { frames: 0, elapsedMs: 100 },
    { frames: 5, elapsedMs: 0 },
  ])("should return 0 without an observed frame interval (%p)", (measurement) => {
    // Given / When / Then
    expect(computeFpsCeiling(measurement)).toBe(0);
  });
});

describe("lateFrameThresholdForFpsCeiling", () => {
  it.each([
    [60, 25],
    [120, 12.5],
    [144, 10.42],
    [59.9, 25.04],
  ])("should be 1.5 frame intervals at %p fps (%p ms)", (fps, expected) => {
    // Given / When
    const threshold = lateFrameThresholdForFpsCeiling(fps);

    // Then
    expect(threshold).toBe(expected);
  });

  it.each([
    0,
    10,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("should fall back to the 60 Hz default for the implausible ceiling %p", (fps) => {
    // Given / When / Then
    expect(lateFrameThresholdForFpsCeiling(fps)).toBe(LATE_FRAME_THRESHOLD_MS);
  });
});

describe("measureAnimationFrames", () => {
  let callbacks: Array<(timestamp: number) => void>;

  beforeEach(() => {
    jest.useFakeTimers();
    callbacks = [];
    globalThis.requestAnimationFrame = (callback: (timestamp: number) => void) => {
      callbacks.push(callback);
      return callbacks.length;
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  });

  function fireFrame(timestamp: number): void {
    callbacks.shift()?.(timestamp);
  }

  it("should count frame intervals until the duration elapsed", async () => {
    // Given
    const measurement = measureAnimationFrames({ durationMs: 50, timeoutMs: 1000 });

    // When: frames every 10 ms from t=100 to t=150
    for (let ts = 100; ts <= 150; ts += 10) {
      fireFrame(ts);
    }

    // Then
    await expect(measurement).resolves.toEqual({ frames: 5, elapsedMs: 50 });
    expect(callbacks).toHaveLength(0);
  });

  it("should resolve with what it has at the timeout", async () => {
    // Given
    const measurement = measureAnimationFrames({ durationMs: 2000, timeoutMs: 500 });
    fireFrame(0);
    fireFrame(16);

    // When
    jest.advanceTimersByTime(500);

    // Then
    await expect(measurement).resolves.toEqual({ frames: 1, elapsedMs: 16 });
  });

  it("should report no frames when the page never paints", async () => {
    // Given
    const measurement = measureAnimationFrames({ durationMs: 2000, timeoutMs: 500 });

    // When
    jest.advanceTimersByTime(500);

    // Then
    await expect(measurement).resolves.toEqual({ frames: 0, elapsedMs: 0 });
  });
});

describe("readWebGlRenderer", () => {
  const RENDERER = 0x1f01;
  const UNMASKED_RENDERER_WEBGL = 0x9246;

  function stubDocument(contexts: Record<string, unknown>): void {
    globalThis.document = {
      createElement: () => ({ getContext: (type: string) => contexts[type] ?? null }),
    } as unknown as Document;
  }

  function fakeGl(extensions: Record<string, unknown>, parameters: Record<number, unknown>) {
    return {
      RENDERER,
      getExtension: (name: string) => extensions[name] ?? null,
      getParameter: (parameter: number) => parameters[parameter],
    };
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("should read the unmasked renderer of a WebGL2 context and release the context", () => {
    // Given
    const loseContext = jest.fn();
    stubDocument({
      webgl2: fakeGl(
        {
          WEBGL_debug_renderer_info: { UNMASKED_RENDERER_WEBGL },
          WEBGL_lose_context: { loseContext },
        },
        { [UNMASKED_RENDERER_WEBGL]: "ANGLE (Apple, Apple M2, OpenGL 4.1)", [RENDERER]: "WebKit" },
      ),
    });

    // When
    const renderer = readWebGlRenderer("unavailable");

    // Then
    expect(renderer).toBe("ANGLE (Apple, Apple M2, OpenGL 4.1)");
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("should fall back to WebGL1 and RENDERER without the debug extension", () => {
    // Given
    stubDocument({ webgl: fakeGl({}, { [RENDERER]: "SwiftShader" }) });

    // When
    const renderer = readWebGlRenderer("unavailable");

    // Then
    expect(renderer).toBe("SwiftShader");
  });

  it.each([
    ["no WebGL context", {}],
    ["an empty renderer string", { webgl2: fakeGl({}, { [RENDERER]: "" }) }],
  ])("should return the fallback with %s", (_label, contexts) => {
    // Given
    stubDocument(contexts);

    // When / Then
    expect(readWebGlRenderer("unavailable")).toBe("unavailable");
  });
});

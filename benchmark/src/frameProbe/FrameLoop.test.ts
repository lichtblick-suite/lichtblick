// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FrameLoop } from "./FrameLoop";
import { FakeAnimationFrames } from "../telemetry/collectors/builders/RendererCollectorsEnvBuilder";

function setup(): { frames: FakeAnimationFrames; onFrame: jest.Mock; loop: FrameLoop } {
  const frames = new FakeAnimationFrames();
  const onFrame = jest.fn();
  const loop = new FrameLoop(
    {
      requestAnimationFrame: frames.requestAnimationFrame,
      cancelAnimationFrame: frames.cancelAnimationFrame,
    },
    onFrame,
  );
  return { frames, onFrame, loop };
}

describe("FrameLoop", () => {
  it("should call onFrame on every frame and keep one frame pending while running", () => {
    // Given
    const { frames, onFrame, loop } = setup();

    // When
    loop.start();
    loop.start();
    frames.fireFrame(16);
    frames.fireFrame(32);

    // Then
    expect(loop.isRunning()).toBe(true);
    expect(onFrame.mock.calls).toEqual([[16], [32]]);
    expect(frames.requestAnimationFrame).toHaveBeenCalledTimes(3);
    expect(frames.hasPending()).toBe(true);
  });

  it("should cancel the pending frame on stop and restart on start", () => {
    // Given
    const { frames, onFrame, loop } = setup();
    loop.start();

    // When
    loop.stop();
    loop.stop();
    const pendingAfterStop = frames.hasPending();
    loop.start();
    frames.fireFrame(48);

    // Then
    expect(pendingAfterStop).toBe(false);
    expect(frames.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls).toEqual([[48]]);
    expect(frames.hasPending()).toBe(true);
  });

  it("should keep looping when onFrame throws", () => {
    // Given
    const { frames, onFrame, loop } = setup();
    onFrame.mockImplementationOnce(() => {
      throw new Error("frame");
    });
    loop.start();

    // When
    const fire = (): void => {
      frames.fireFrame(16);
    };

    // Then
    expect(fire).toThrow("frame");
    expect(frames.hasPending()).toBe(true);
  });

  it("should be a no-op without requestAnimationFrame", () => {
    // Given
    const loop = new FrameLoop({}, jest.fn());

    // When
    loop.start();

    // Then
    expect(loop.isSupported()).toBe(false);
    expect(loop.isRunning()).toBe(false);
  });
});

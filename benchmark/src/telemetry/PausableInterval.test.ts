// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PausableInterval } from "./PausableInterval";

function buildTimer(): { timer: PausableInterval; handler: jest.Mock } {
  const timer = new PausableInterval(
    (handler, intervalMs) => setInterval(handler, intervalMs),
    (handle) => {
      clearInterval(handle as ReturnType<typeof setInterval>);
    },
  );
  return { timer, handler: jest.fn() };
}

describe("PausableInterval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should run the handler at the interval once set", () => {
    // Given
    const { timer, handler } = buildTimer();

    // When
    timer.set(handler, 1000);
    jest.advanceTimersByTime(3000);

    // Then
    expect(handler).toHaveBeenCalledTimes(3);
    expect(timer.isScheduled()).toBe(true);
  });

  it("should clear the underlying timer while paused and reschedule on resume", () => {
    // Given
    const { timer, handler } = buildTimer();
    timer.set(handler, 1000);

    // When
    timer.pause();
    jest.advanceTimersByTime(5000);
    const callsWhilePaused = handler.mock.calls.length;
    const timersWhilePaused = jest.getTimerCount();
    timer.resume();
    jest.advanceTimersByTime(1000);

    // Then
    expect(callsWhilePaused).toBe(0);
    expect(timersWhilePaused).toBe(0);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should defer a timer set while paused until resume", () => {
    // Given
    const { timer, handler } = buildTimer();
    timer.pause();

    // When
    const token = timer.set(handler, 1000);
    jest.advanceTimersByTime(2000);
    timer.resume();
    jest.advanceTimersByTime(1000);
    timer.clear(token);
    jest.advanceTimersByTime(5000);

    // Then
    expect(handler).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should not reschedule a cleared timer on resume", () => {
    // Given
    const { timer, handler } = buildTimer();
    const token = timer.set(handler, 1000);
    timer.pause();

    // When
    timer.clear(token);
    timer.resume();

    // Then
    expect(timer.isScheduled()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { createSerialQueue, repeatWhile, runSequentially } from "./sequential";

/** Resolves on a later macrotask, so overlapping steps would interleave. */
async function tick(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe("runSequentially", () => {
  it("runs every step in index order without overlap", async () => {
    // Given
    const log: string[] = [];

    // When
    await runSequentially(3, async (index) => {
      log.push(`start ${index}`);
      await tick();
      log.push(`end ${index}`);
    });

    // Then
    expect(log).toEqual(["start 0", "end 0", "start 1", "end 1", "start 2", "end 2"]);
  });

  it("does nothing for a zero count", async () => {
    // Given
    const step = jest.fn(async () => {});

    // When
    await runSequentially(0, step);

    // Then
    expect(step).not.toHaveBeenCalled();
  });

  it("rejects with the first failure and skips the remaining steps", async () => {
    // Given
    const started: number[] = [];

    // When
    const run = runSequentially(3, async (index) => {
      started.push(index);
      if (index === 1) {
        throw new Error("step 1 failed");
      }
    });

    // Then
    await expect(run).rejects.toThrow("step 1 failed");
    expect(started).toEqual([0, 1]);
  });
});

describe("repeatWhile", () => {
  it("runs the body until the condition no longer holds", async () => {
    // Given
    let runs = 0;

    // When
    await repeatWhile(
      () => runs < 3,
      async () => {
        await tick();
        runs += 1;
      },
    );

    // Then
    expect(runs).toBe(3);
  });

  it("never runs the body when the condition fails up front", async () => {
    // Given
    const body = jest.fn(async () => {});

    // When
    await repeatWhile(() => false, body);

    // Then
    expect(body).not.toHaveBeenCalled();
  });

  it("rejects with the body's failure and stops repeating", async () => {
    // Given
    const body = jest.fn(async () => {
      throw new Error("body failed");
    });

    // When
    const run = repeatWhile(() => true, body);

    // Then
    await expect(run).rejects.toThrow("body failed");
    expect(body).toHaveBeenCalledTimes(1);
  });
});

describe("createSerialQueue", () => {
  it("runs concurrently submitted tasks one after another in call order", async () => {
    // Given
    const queue = createSerialQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`start ${name}`);
      await tick();
      log.push(`end ${name}`);
      return name;
    };

    // When
    const results = await Promise.all([queue.run(task("a")), queue.run(task("b"))]);

    // Then
    expect(results).toEqual(["a", "b"]);
    expect(log).toEqual(["start a", "end a", "start b", "end b"]);
  });

  it("rejects only the failed task and keeps running later ones", async () => {
    // Given
    const queue = createSerialQueue();

    // When
    const failed = queue.run(async () => {
      throw new Error("task failed");
    });
    const later = queue.run(async () => "later");

    // Then
    await expect(failed).rejects.toThrow("task failed");
    await expect(later).resolves.toBe("later");
  });
});

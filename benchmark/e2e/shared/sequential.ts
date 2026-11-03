// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Helpers for async work that must run strictly one step after another (timed sampling ticks,
// polling, ordered writes). They keep the `await` out of loop bodies without running steps in
// parallel. Free of DOM/Playwright/Node imports.

/**
 * Runs `step(0)`, `step(1)`, …, `step(count - 1)` one after another: each step starts once the
 * previous one resolved. Rejects with the first failure; later steps are then not started.
 */
export async function runSequentially(
  count: number,
  step: (index: number) => Promise<void>,
): Promise<void> {
  let chain = Promise.resolve();
  for (let index = 0; index < count; index++) {
    chain = chain.then(async () => {
      await step(index);
    });
  }
  await chain;
}

/**
 * A queue that runs the async tasks passed to `run` one after another (in call order), even when
 * `run` is called while an earlier task is still pending. A rejected task does not block later ones.
 */
export function createSerialQueue(): { run<T>(task: () => Promise<T>): Promise<T> } {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: async <T>(task: () => Promise<T>): Promise<T> => {
      const next = tail.then(task);
      tail = next.catch(() => undefined);
      return await next;
    },
  };
}

/**
 * Runs `body` repeatedly while `shouldContinue()` holds, checked before every run (so `body` may
 * never run). Each run starts once the previous one resolved; rejects with the first failure.
 */
export async function repeatWhile(
  shouldContinue: () => boolean,
  body: () => Promise<void>,
): Promise<void> {
  if (!shouldContinue()) {
    return;
  }
  await body();
  await repeatWhile(shouldContinue, body);
}

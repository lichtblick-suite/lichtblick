// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import { readMainThreadProbe } from "./mainThreadProbe";

function pageEvaluating(evaluate: () => Promise<unknown>): Page {
  return { evaluate } as unknown as Page;
}

describe("readMainThreadProbe", () => {
  it("should return the probe reading when the page call succeeds", async () => {
    // Given
    const reading = { longTaskMs: 12, frames: 600, nowMs: 10_000 };
    const page = pageEvaluating(async () => reading);

    // When
    const result = await readMainThreadProbe(page);

    // Then
    expect(result).toEqual(reading);
  });

  it("should warn and return undefined when the page call fails", async () => {
    // Given
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const page = pageEvaluating(async () => {
      throw new Error("Target closed");
    });

    // When
    const result = await readMainThreadProbe(page);

    // Then
    expect(result).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Target closed"));
  });
});

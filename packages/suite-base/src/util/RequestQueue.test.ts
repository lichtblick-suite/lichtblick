// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { RequestQueue } from "./RequestQueue";

function createMocksWithPromises(count: number): Array<{
  mock: jest.Mock<Promise<void>>;
  resolve: () => void;
  promise: Promise<void>;
}> {
  return Array.from({ length: count }, () => {
    let resolve: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    const mock = jest.fn(async () => {
      await promise;
    });

    return { mock, resolve: resolve!, promise };
  });
}

describe("RequestQueue", () => {
  it("runs a single request immediately", async () => {
    // Given
    const value = BasicBuilder.string();
    const queue = new RequestQueue(2);
    const mockFn = jest.fn(async () => value);

    // When
    const result = await queue.run(mockFn);

    // Then
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(value);
  });

  it("runs multiple requests up to max concurrent limit", async () => {
    // Given
    const maxConcurrent = 3;
    const totalRequests = 4;
    const queue = new RequestQueue(maxConcurrent);
    const mocks = createMocksWithPromises(totalRequests);

    // When
    const results = mocks.map(async ({ mock }) => {
      await queue.run(mock);
    });

    // Then - only 0 to maxConcurrent started
    mocks.slice(0, maxConcurrent).forEach(({ mock }) => {
      expect(mock).toHaveBeenCalledTimes(1);
    });
    // The rest should not have started yet
    mocks.slice(maxConcurrent).forEach(({ mock }) => {
      expect(mock).toHaveBeenCalledTimes(0);
    });

    // Complete first request
    mocks[0]!.resolve();
    await results[0];

    // Now next one in line should have started ((maxConcurrent-1) + 1)
    expect(mocks[maxConcurrent]!.mock).toHaveBeenCalledTimes(1);

    // Complete remaining requests
    mocks.slice(1).forEach(({ resolve }) => {
      resolve();
    });
    await Promise.all(results.slice(1));
  });
});

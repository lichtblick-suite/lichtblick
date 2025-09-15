// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import EventEmitter from "eventemitter3";

import { emitBusyStatus, LayoutManagerContext } from "./emitBusyStatus.decorator";

describe("emitBusyStatus decorator", () => {
  describe("when executing a decorated method", () => {
    let mockContext: LayoutManagerContext;
    let decoratedMethod: () => Promise<string>;
    let busyChangeEvents: number[];

    beforeEach(() => {
      // Given
      mockContext = {
        busyCount: 0,
        emitter: new EventEmitter(),
      };

      busyChangeEvents = [];
      mockContext.emitter.on("busychange", () => {
        busyChangeEvents.push(mockContext.busyCount);
      });

      const originalMethod = async function (this: typeof mockContext) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "success";
      };

      const descriptor: TypedPropertyDescriptor<() => Promise<string>> = {
        value: originalMethod,
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      emitBusyStatus({} as any, "testMethod", descriptor);
      decoratedMethod = descriptor.value!.bind(mockContext);
    });

    it("should increment busy count before execution and decrement after completion", async () => {
      // Given
      expect(mockContext.busyCount).toBe(0);

      // When
      const resultPromise = decoratedMethod();

      // Then - busy count should be incremented immediately
      expect(mockContext.busyCount).toBe(1);

      const result = await resultPromise;

      // Then - operation should complete successfully and busy count should be reset
      expect(result).toBe("success");
      expect(mockContext.busyCount).toBe(0);
    });

    it("should emit busychange events when operation starts and completes", async () => {
      // When
      await decoratedMethod();

      // Then
      expect(busyChangeEvents).toEqual([1, 0]);
    });
  });
});

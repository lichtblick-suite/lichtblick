// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import EventEmitter from "eventemitter3";

import type LayoutManager from "../LayoutManager";

export type LayoutManagerContext = {
  busyCount: number;
  emitter: EventEmitter;
};

/**
 * A decorator to emit busy events before and after an async operation so the UI can show that the
 * operation is in progress.
 */
export function emitBusyStatus<Args extends unknown[], Ret>(
  _prototype: LayoutManager,
  _propertyKey: string,
  descriptor: TypedPropertyDescriptor<(this: LayoutManager, ...args: Args) => Promise<Ret>>,
): void {
  const method = descriptor.value!;
  descriptor.value = async function (...args) {
    try {
      // Access via prototype to avoid property access issues
      (this as unknown as LayoutManagerContext).busyCount++;
      (this as unknown as LayoutManagerContext).emitter.emit("busychange");
      return await method.apply(this, args);
    } finally {
      (this as unknown as LayoutManagerContext).busyCount--;
      (this as unknown as LayoutManagerContext).emitter.emit("busychange");
    }
  };
}

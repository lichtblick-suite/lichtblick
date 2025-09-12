// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

/**
 * A decorator to emit busy events before and after an async operation so the UI can show that the
 * operation is in progress. This decorator expects the class to have `busyCount` and `emitter` properties.
 */
export function emitBusyStatus<Args extends unknown[], Ret>(
  _prototype: unknown,
  _propertyKey: string,
  descriptor: TypedPropertyDescriptor<(...args: Args) => Promise<Ret>>,
): void {
  const method = descriptor.value!;
  descriptor.value = async function (...args) {
    const instance = this as unknown as { busyCount: number; emitter: EventEmitter };
    try {
      instance.busyCount++;
      instance.emitter.emit("busychange");
      return await method.apply(this, args);
    } finally {
      instance.busyCount--;
      instance.emitter.emit("busychange");
    }
  };
}

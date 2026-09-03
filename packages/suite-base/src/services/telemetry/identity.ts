// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_STORAGE_KEY = "lichtblick.telemetry.deviceId";

export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): IdentityStorage | undefined {
  try {
    return (globalThis as { localStorage?: IdentityStorage }).localStorage;
  } catch {
    return undefined;
  }
}

let memoizedDeviceId: string | undefined;

export function getDeviceId(storage: IdentityStorage | undefined = getDefaultStorage()): string {
  if (storage) {
    try {
      const existing = storage.getItem(DEVICE_ID_STORAGE_KEY);
      if (existing != undefined && existing !== "") {
        return existing;
      }

      const generated = uuidv4();
      storage.setItem(DEVICE_ID_STORAGE_KEY, generated);
      return generated;
    } catch {
      // Fall back to an in-process identifier when storage is unavailable or throws.
    }
  }

  memoizedDeviceId ??= uuidv4();
  return memoizedDeviceId;
}

export const sessionId: string = uuidv4();

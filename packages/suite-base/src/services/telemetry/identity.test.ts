// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getDeviceId, IdentityStorage, sessionId } from "./identity";

function makeMemoryStorage(): IdentityStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("identity", () => {
  it("returns a stable device id across repeated calls with the same storage", () => {
    // Given
    const storage = makeMemoryStorage();

    // When
    const first = getDeviceId(storage);
    const second = getDeviceId(storage);

    // Then
    expect(first).toEqual(second);
    expect(storage.getItem("lichtblick.telemetry.deviceId")).toEqual(first);
  });

  it("returns different device ids for independent storages", () => {
    // Given
    const firstStorage = makeMemoryStorage();
    const secondStorage = makeMemoryStorage();

    // When
    const first = getDeviceId(firstStorage);
    const second = getDeviceId(secondStorage);

    // Then
    expect(first).not.toEqual(second);
  });

  it("falls back to a stable in-process id when storage is unavailable", () => {
    // When
    const first = getDeviceId(undefined);
    const second = getDeviceId(undefined);

    // Then
    expect(first).toEqual(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/iu);
  });

  it("exposes a session id that looks like a uuid", () => {
    // Then
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/iu);
  });
});

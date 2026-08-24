// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getDeviceId, IdentityStorage, sessionId } from "./identity";

function makeMemoryStorage(): IdentityStorage {
  const backing = new Map<string, string>();
  return {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => {
      backing.set(key, value);
    },
  };
}

describe("identity", () => {
  it("returns a stable device id across calls sharing the same storage (simulated reload)", () => {
    // Given: an empty storage
    const storage = makeMemoryStorage();

    // When: getDeviceId is called twice, as would happen on two separate page loads
    const first = getDeviceId(storage);
    const second = getDeviceId(storage);

    // Then: both calls return the same id, and it was persisted
    expect(first).toEqual(second);
    expect(storage.getItem("lichtblick.telemetry.deviceId")).toEqual(first);
  });

  it("generates a new device id when storage is empty (simulated new install)", () => {
    // Given: two independent, empty storages (e.g. two separate installs)
    const storageA = makeMemoryStorage();
    const storageB = makeMemoryStorage();

    // When: a device id is requested from each
    const idA = getDeviceId(storageA);
    const idB = getDeviceId(storageB);

    // Then: they are different
    expect(idA).not.toEqual(idB);
  });

  it("falls back gracefully when no storage is available", () => {
    // Given/When: no storage is passed
    const id = getDeviceId(undefined);

    // Then: an id is still returned (just not persisted)
    expect(id).toEqual(expect.any(String));
    expect(id.length).toBeGreaterThan(0);
  });

  it("keeps the same id across calls when there is no storage (Electron main process)", () => {
    // Given: the main process has no localStorage to persist into
    // When: an id is requested repeatedly, as happens on every logEvent()
    // Then: it stays stable, otherwise each crash event would look like a different device
    expect(getDeviceId(undefined)).toEqual(getDeviceId(undefined));
  });

  it("exposes a session id that looks like a uuid", () => {
    // Then: the module-level session id is a well-formed string, generated once per execution
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

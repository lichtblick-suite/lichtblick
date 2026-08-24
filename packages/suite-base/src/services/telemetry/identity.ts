// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_STORAGE_KEY = "lichtblick.telemetry.deviceId";

/** Minimal key/value storage contract, satisfied by `localStorage` and by test doubles. */
export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): IdentityStorage | undefined {
  try {
    // Accessed defensively (not `globalThis.localStorage`) so this file still type-checks when
    // pulled into a Node-only compilation context (e.g. the desktop main process via OtelTelemetry).
    return (globalThis as { localStorage?: IdentityStorage }).localStorage;
  } catch {
    // localStorage can throw in some embedded/sandboxed webviews.
    return undefined;
  }
}

/** Only used when there is no storage to persist into — see `getDeviceId`. */
let memoizedDeviceId: string | undefined;

/**
 * Anonymous identifier for this app installation. Stable across reloads/restarts (persisted),
 * new on every fresh install/storage clear. Never derived from user, host, e-mail or file path —
 * see docs/telemetry/poc-opentelemetry-plano.md section 6.
 */
export function getDeviceId(storage: IdentityStorage | undefined = getDefaultStorage()): string {
  const existing = storage?.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing != undefined && existing !== "") {
    return existing;
  }
  if (!storage) {
    // Nothing to persist into (the Electron main process has no localStorage), so the id is
    // memoized for the lifetime of the process: without this, every logEvent() from the main
    // process would mint a fresh id and inflate distinct-device counts.
    memoizedDeviceId ??= uuidv4();
    return memoizedDeviceId;
  }
  const generated = uuidv4();
  storage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

/** Anonymous identifier for the current app execution. Generated once per module load, never persisted. */
export const sessionId: string = uuidv4();

/**
 * Start of the current app execution, paired with `sessionId`. Session duration is derived from
 * this (reported on every heartbeat) rather than from an end-of-session event, which is unreliable:
 * a kill, OOM or power loss never fires one. See plan section 6.
 */
export const sessionStartedAt: number = Date.now();

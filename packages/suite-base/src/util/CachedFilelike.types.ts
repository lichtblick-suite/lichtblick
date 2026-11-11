// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type FileStream = {
  on<T>(event: "data", listener: (chunk: T) => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  on(event: "end", listener: () => void): void;
  destroy: () => void;
};

export type PrefetchedRange = { offset: number; data: Uint8Array };

export interface FileReader {
  // `prefetched` ranges, if any, are seeded into the cache so reads of them need no request.
  open(): Promise<{ size: number; prefetched?: PrefetchedRange[] }>;
  fetch(offset: number, length: number): FileStream;
}

export interface ILogger {
  debug(..._args: unknown[]): void;
  info(..._args: unknown[]): void;
  warn(..._args: unknown[]): void;
  error(..._args: unknown[]): void;
}

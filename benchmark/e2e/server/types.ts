// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type StaticServerOptions = {
  /** URL prefix (must start and end with "/") -> directory. */
  routes: Readonly<Record<string, string>>;
  /** Defaults to 127.0.0.1. */
  host?: string;
  /** Defaults to 0 (random free port). */
  port?: number;
};

export type StaticServer = {
  /** e.g. `http://127.0.0.1:53211` (no trailing slash). */
  origin: string;
  close(): Promise<void>;
};

/** Inclusive byte range of a `Range` request. */
export type ByteRange = { start: number; end: number };

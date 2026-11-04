// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { McapFixtureOptions } from "./types";

export type ResolvedOptions = Required<McapFixtureOptions>;

export type FixtureManifest = {
  hash: string;
  files: { name: string; size: number }[];
};

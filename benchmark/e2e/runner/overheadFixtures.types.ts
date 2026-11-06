// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { McapFixtureOptions } from "../fixtures/types";

/** Overhead MCAP fixtures of one steady-window length (`overheadFixtureSet`). */
export type OverheadFixtureSet = {
  options: McapFixtureOptions;
  /** Cache directory (`.artifacts/fixtures/overhead/<seconds>s/`). */
  dir: string;
  /** URL path the files are served under (`/fixtures/overhead/<seconds>s`, no trailing slash). */
  urlPath: string;
};

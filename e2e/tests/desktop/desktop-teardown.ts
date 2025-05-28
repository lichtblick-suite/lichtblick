// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
/* eslint-disable filenames/match-exported */

import clearStorage from "../../fixtures/clear-storage";

async function desktopTeardown(): Promise<void> {
  console.debug("Running desktop teardown...");
  await clearStorage();
}

export default desktopTeardown;

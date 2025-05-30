// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
/* eslint-disable filenames/match-exported */
import { STORAGE_STATE } from "./playwright.config";
import { deleteFile } from "../../fixtures/delete-file";

async function webTeardown(): Promise<void> {
  console.debug("Running web teardown...");

  await deleteFile(STORAGE_STATE);
}

export default webTeardown;

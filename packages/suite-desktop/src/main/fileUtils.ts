// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "fs";

import Logger from "@lichtblick/log";

const log = Logger.getLogger(__filename);

/**
 * Check if the argument is a file that can be opened.
 *
 * Note: in dev we launch electron with `electron .webpack` so we need to filter out things that are not files
 */
export const isFileToOpen = (arg: string): boolean => {
  // Anything that isn't a file or directory will throw, we filter those out too
  try {
    return fs.statSync(arg).isFile();
  } catch (err: unknown) {
    log.error(err);
    // ignore
  }
  return false;
};

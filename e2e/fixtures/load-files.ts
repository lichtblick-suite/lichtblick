// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { join } from "path";
import { Page } from "playwright";

export type LoadFilesProps = {
  mainWindow: Page;
  filenames: string | string[];
};

const PUPPETEER_FILE_UPLOAD_SELECTOR = "[data-puppeteer-file-upload]";

export const loadFiles = async ({ filenames, mainWindow }: LoadFilesProps): Promise<void> => {
  // Normalize to array for consistent path resolution
  const files = Array.isArray(filenames) ? filenames : [filenames];
  const absoluteFilePaths = files.map((f) => join(__dirname, `./assets/${f}`));

  console.debug(`Loading file(s): ${absoluteFilePaths.join(", ")}`);

  const fileInput = mainWindow.locator(PUPPETEER_FILE_UPLOAD_SELECTOR);
  // Playwright's setInputFiles handles both single string and array
  await fileInput.setInputFiles(absoluteFilePaths);
};

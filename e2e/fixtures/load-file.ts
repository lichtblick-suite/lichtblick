// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { join } from "path";
import { Page } from "playwright";

export type LoadFileProps = {
  mainWindow: Page;
  filename: string;
};

const PUPPETER_FILE_UPLOAD_SELECTOR = "[data-puppeteer-file-upload]";

export const loadFile = async ({ filename, mainWindow }: LoadFileProps): Promise<void> => {
  const absoluteFilePath = join(__dirname, `./assets/${filename}`);
  console.debug(`Loading file: ${absoluteFilePath}`);

  const fileInput = mainWindow.locator(PUPPETER_FILE_UPLOAD_SELECTOR);
  await fileInput.setInputFiles(absoluteFilePath);
};

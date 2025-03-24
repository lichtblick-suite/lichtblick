// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";

import { AppType } from "../launchApp";

export const loadFile = async (app: AppType, filePath: string): Promise<void> => {
  // Adjust file path
  const filePathAdjusted = path.resolve(__dirname, filePath);

  // Select the file input
  const fileInput = app.renderer.locator("[data-puppeteer-file-upload]");

  // Drag and drop the file
  await fileInput.setInputFiles(filePathAdjusted);
};

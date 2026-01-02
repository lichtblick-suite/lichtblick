// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import JSZip from "jszip";

import { ALLOWED_FILES } from "@lichtblick/suite-base/services/extension/types";

export default async function extractFoxeFileContent(
  zip: JSZip,
  file: ALLOWED_FILES,
): Promise<string | undefined> {
  const fileEntry = zip.file(file);
  if (!fileEntry) {
    return undefined;
  }
  return await fileEntry.async("string");
}

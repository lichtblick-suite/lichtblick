// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import JSZip from "jszip";

import { ALLOWED_FILES } from "@lichtblick/suite-base/services/extension/types";

export default async function getFileContent(
  foxeFileData: Uint8Array,
  allowedFile: ALLOWED_FILES,
): Promise<string | undefined> {
  const zip = new JSZip();
  const content = await zip.loadAsync(foxeFileData);
  const extractedContent = await content.file(allowedFile)?.async("string");

  return extractedContent;
}

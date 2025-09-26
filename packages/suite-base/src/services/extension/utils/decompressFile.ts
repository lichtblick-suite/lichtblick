// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import JSZip from "jszip";

export default async function decompressFile(foxeFileData: Uint8Array): Promise<JSZip> {
  const zip = new JSZip();
  return await zip.loadAsync(foxeFileData);
}

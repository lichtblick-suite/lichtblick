// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

export interface IExtensionAPI {
  createOrUpdate(extension: ExtensionInfoSlug, file: File): Promise<StoredExtension>;
  get(id: string): Promise<StoredExtension | undefined>;
  loadContent(fileId: string): Promise<Uint8Array | undefined>;
  list(): Promise<ExtensionInfo[]>;
  remove(id: string): Promise<boolean>;
  readonly slug: string;
}

export type ExtensionInfoSlug = Pick<StoredExtension, "info" | "slug">;

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

export type LoadedExtension = {
  buffer?: Uint8Array;
  raw: string;
};

export type TypeExtensionLoader = "browser" | "server" | "filesystem";

export type InstallExtensionProps = {
  foxeFileData: Uint8Array;
  file?: File;
  externalId?: string;
};

/**
 * An extension loader is an object used by studio to list, install, and uninstall extensions
 * from a particular namespace.
 */
export interface IExtensionLoader {
  readonly namespace: Namespace;
  readonly type: TypeExtensionLoader;

  // get extension by id
  getExtension(id: string): Promise<ExtensionInfo | undefined>;

  // get a list of installed extensions
  getExtensions(): Promise<ExtensionInfo[]>;

  // load the source code for a specific extension
  loadExtension(id: string): Promise<LoadedExtension>;

  // install extension contained within the file data
  installExtension(data: InstallExtensionProps): Promise<ExtensionInfo>;

  // uninstall extension with id
  uninstallExtension(id: string): Promise<void>;
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ExtensionInfo, ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

/**
 * An extension loader is an object used by studio to list, install, and uninstall extensions
 * from a particular namespace.
 */
export interface ExtensionLoader {
  readonly namespace: ExtensionNamespace;

  // get extension by id
  getExtension(id: string): Promise<ExtensionInfo | undefined>;

  // get a list of installed extensions
  getExtensions(): Promise<ExtensionInfo[]>;

  // load the source code for a specific extension
  loadExtension(id: string): Promise<string>;

  // install extension contained within the file data
  installExtension(foxeFileData: Uint8Array): Promise<ExtensionInfo>;

  // uninstall extension with id
  uninstallExtension(id: string): Promise<void>;
}

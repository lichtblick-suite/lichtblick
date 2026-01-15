// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

export type StoredExtension = {
  info: ExtensionInfo;
  content: Uint8Array;
  workspace?: string;
  fileId?: string;
  externalId?: string;
};

export interface IExtensionStorage {
  readonly namespace: string;
  list(): Promise<ExtensionInfo[]>;
  get(id: string): Promise<undefined | StoredExtension>;
  put(extension: StoredExtension): Promise<StoredExtension>;
  delete(id: string): Promise<void>;
}

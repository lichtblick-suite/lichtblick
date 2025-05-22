// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type ExtensionNamespace =
  | "local" // Local extensions installed manually by the user.
  | "org"; // Extensions managed remotely and provisioned by the organization.

/**
 * Metadata describing an extension.
 */
export type ExtensionInfo = {
  id: string;
  description: string;
  displayName: string;
  homepage: string;
  keywords: string[];
  license: string;
  name: string;
  namespace?: ExtensionNamespace;
  publisher: string;
  qualifiedName: string;
  version: string;
  readme?: string;
  changelog?: string;
};

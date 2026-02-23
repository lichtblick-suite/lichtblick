// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

export function canInstallExtension(extension: ExtensionMarketplaceDetail): boolean {
  return extension.foxe != undefined;
}

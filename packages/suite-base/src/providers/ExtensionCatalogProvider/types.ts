// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ContributionPoints } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { TypeExtensionLoader } from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

export type SingleLoaderInstallResult =
  | {
      loaderType: TypeExtensionLoader;
      success: true;
      info: ExtensionInfo;
      contributionPoints: ContributionPoints;
      externalId: string | undefined;
    }
  | {
      loaderType: TypeExtensionLoader;
      success: false;
      error: Error;
    };

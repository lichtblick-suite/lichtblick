// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionActionButton } from "@lichtblick/suite-base/components/ExtensionsSettings/components/ExtensionActionButton/ExtensionActionButton";
import { ExtensionActionButtonProps } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { canInstallExtension } from "@lichtblick/suite-base/util/canInstallExtension";

/**
 * Install button component for extensions.
 * Only renders if the extension can be installed (has a foxe URL).
 */
export function InstallButton(
  props: Readonly<ExtensionActionButtonProps>,
): React.ReactElement | undefined {
  if (!canInstallExtension(props.extension as ExtensionMarketplaceDetail)) {
    return undefined;
  }

  return <ExtensionActionButton {...props} />;
}

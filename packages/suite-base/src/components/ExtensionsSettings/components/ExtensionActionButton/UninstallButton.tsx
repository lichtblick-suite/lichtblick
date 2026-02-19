// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionActionButton } from "@lichtblick/suite-base/components/ExtensionsSettings/components/ExtensionActionButton/ExtensionActionButton";
import { ExtensionActionButtonProps } from "@lichtblick/suite-base/components/ExtensionsSettings/types";

/**
 * Uninstall button component for extensions.
 */
export function UninstallButton(
  props: Readonly<ExtensionActionButtonProps>,
): React.ReactElement | undefined {
  return <ExtensionActionButton {...props} color="inherit" />;
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Button } from "@mui/material";

import { ExtensionActionButtonProps } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { OperationStatus } from "@lichtblick/suite-base/components/types";

/**
 * Uninstall button component for extensions.
 */
export function UninstallButton({
  extension,
  onAction,
  isOperating,
  operationStatus,
  className,
  stopPropagation = false,
  color = "inherit",
  variant = "outlined",
}: Readonly<ExtensionActionButtonProps>): React.ReactElement {
  return (
    <Button
      className={className}
      size="small"
      color={color}
      variant={variant}
      onClick={async (event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        await onAction(extension);
      }}
      disabled={isOperating}
    >
      {isOperating && operationStatus === OperationStatus.UNINSTALLING
        ? "Uninstalling..."
        : "Uninstall"}
    </Button>
  );
}

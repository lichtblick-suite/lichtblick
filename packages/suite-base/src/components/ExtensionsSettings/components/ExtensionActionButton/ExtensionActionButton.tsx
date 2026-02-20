// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Button } from "@mui/material";

import { ExtensionActionButtonProps } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { OperationStatus } from "@lichtblick/suite-base/components/types";

/**
 * Action button component for extensions.
 * Only renders if the extension can be installed (has a foxe URL).
 */
export function ExtensionActionButton({
  extension,
  onAction,
  isOperating,
  operationStatus,
  className,
  stopPropagation = false,
  color = "primary",
  variant = "contained",
  label,
  loadingLabel,
}: Readonly<ExtensionActionButtonProps>): React.ReactElement | undefined {
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
      {isOperating && operationStatus !== OperationStatus.IDLE ? loadingLabel : label}
    </Button>
  );
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PopoverPosition, PopoverReference } from "@mui/material";
import { MouseEventHandler, ReactNode } from "react";

/**
 * Represents an item in the app bar menus.
 */
export type AppBarMenuItem =
  | {
      type: "item";
      label: ReactNode;
      key: string;
      disabled?: boolean;
      shortcut?: string;
      onClick?: MouseEventHandler<HTMLElement>;
      external?: boolean;
      icon?: ReactNode;
      dataTestId?: string;
    }
  | { type: "subheader"; label: ReactNode; key: string }
  | { type: "divider" };

export type AppMenuProps = {
  handleClose: () => void;
  anchorEl?: HTMLElement;
  anchorReference?: PopoverReference;
  anchorPosition?: PopoverPosition;
  disablePortal?: boolean;
  open: boolean;
};

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MenuItemProps } from "@mui/material";
import { ReactNode } from "react";

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
      onClick?: MenuItemProps["onClick"];
      external?: boolean;
    }
  | { type: "divider" };

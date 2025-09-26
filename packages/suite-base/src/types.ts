// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AppBarProps } from "@lichtblick/suite-base/components/AppBar";
import { CustomWindowControlsProps } from "@lichtblick/suite-base/components/AppBar/CustomWindowControls";
import { SidebarItem } from "@lichtblick/suite-base/components/Sidebars/types";
import { SidebarItemKey } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";

export type InjectedSidebarItem = [SidebarItemKey, SidebarItem];

export type WorkspaceProps = CustomWindowControlsProps & {
  deepLinks?: readonly string[];
  appBarLeftInset?: number;
  onAppBarDoubleClick?: () => void;

  disablePersistenceForStorybook?: boolean;
  AppBarComponent?: (props: AppBarProps) => React.JSX.Element;
};

export type DropHandler = {
  files?: File[];
  handles?: FileSystemFileHandle[];
  namespace?: Namespace;
  isSource?: boolean;
};

export type Namespace = "local" | "org";

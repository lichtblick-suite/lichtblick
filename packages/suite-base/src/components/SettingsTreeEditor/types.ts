// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { Immutable } from "immer";

import {
  SettingsTree,
  SettingsTreeAction,
  SettingsTreeField,
  SettingsTreeNode,
  SettingsTreeNodeAction,
} from "@lichtblick/suite";

export type NodeActionsMenuProps = {
  actions: readonly SettingsTreeNodeAction[];
  onSelectAction: (actionId: string) => void;
};

export type NodeEditorProps = {
  actionHandler: (action: SettingsTreeAction) => void;
  defaultOpen?: boolean;
  filter?: string;
  focusedPath?: readonly string[];
  path: readonly string[];
  settings?: Immutable<SettingsTreeNode>;
};

export type SelectVisibilityFilterValue = "all" | "visible" | "invisible";

export type FieldEditorProps = {
  actionHandler: (action: SettingsTreeAction) => void;
  field: Immutable<SettingsTreeField>;
  path: readonly string[];
};

export type SettingsTreeEditorProps = {
  variant: "panel" | "log";
  settings: Immutable<SettingsTree>;
};

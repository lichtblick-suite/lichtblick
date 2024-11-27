// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { SettingsTreeNodeAction } from "@lichtblick/suite";

export type NodeActionsMenuProps = {
  actions: readonly SettingsTreeNodeAction[];
  onSelectAction: (actionId: string) => void;
};

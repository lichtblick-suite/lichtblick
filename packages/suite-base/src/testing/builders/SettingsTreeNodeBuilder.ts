// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  SETTINGS_ICONS,
  SettingsIcon,
  SettingsTreeNode,
  SettingsTreeNodeAction,
  SettingsTreeNodeActionDivider,
  SettingsTreeNodeActionItem,
} from "@lichtblick/suite";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";

export default class SettingsTreeNodeBuilder {
  public static nodeAction(
    props: Partial<SettingsTreeNodeActionItem> = {},
  ): SettingsTreeNodeActionItem {
    return defaults<SettingsTreeNodeActionItem>(props, {
      id: BasicBuilder.string(),
      label: BasicBuilder.string(),
      type: "action",
      display: BasicBuilder.sample(["menu", "inline"]),
      icon: BasicBuilder.sample(SETTINGS_ICONS as unknown as SettingsIcon[]),
    });
  }

  public static nodeActions(count = 3): SettingsTreeNodeAction[] {
    return BasicBuilder.multiple(SettingsTreeNodeBuilder.nodeAction, count);
  }

  public static nodeDivider(
    props: Partial<SettingsTreeNodeActionDivider> = {},
  ): SettingsTreeNodeActionDivider {
    return defaults<SettingsTreeNodeActionDivider>(props, {
      type: "divider",
    });
  }

  public static settingsTreeNode(props: Partial<SettingsTreeNode> = {}): SettingsTreeNode {
    return defaults<SettingsTreeNode>(props, {
      actions: SettingsTreeNodeBuilder.nodeActions(),
      children: BasicBuilder.genericDictionary(SettingsTreeNodeBuilder.settingsTreeNodeNoChildren),
      defaultExpansionState: BasicBuilder.sample(["collapsed", "expanded"]),
      enableVisibilityFilter: BasicBuilder.boolean(),
      error: undefined,
      fields: undefined,
      icon: BasicBuilder.sample(SETTINGS_ICONS as unknown as SettingsIcon[]),
      label: BasicBuilder.string(),
      order: undefined,
      renamable: BasicBuilder.boolean(),
      visible: BasicBuilder.boolean(),
    });
  }

  public static settingsTreeNodeNoChildren(
    props: Partial<SettingsTreeNode> = {},
  ): SettingsTreeNode {
    return defaults<SettingsTreeNode>(props, {
      ...SettingsTreeNodeBuilder.settingsTreeNode(),
      children: undefined,
    });
  }
}

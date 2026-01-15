// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CUSTOM_METHOD } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { RawMessagesVirtualPanelConfig } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

export const RAW_MESSAGES_VIRTUAL_DEFAULT_CONFIG: RawMessagesVirtualPanelConfig = {
  diffEnabled: false,
  diffMethod: CUSTOM_METHOD,
  diffTopicPath: "",
  showFullMessageForDiff: false,
  topicPath: "",
  fontSize: undefined,
};

export const EXPANDED_ICON = "▶";

export const COLLAPSED_ICON = "▼";

export const ROW_HEIGHT = 24;
export const TREE_NODE_INDENTATION = 16;
export const SCROLLL_OVERSCAN = 5;
export const DEFAULT_FONT_SIZE = 12;

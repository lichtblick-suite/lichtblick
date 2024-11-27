// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SvgIconProps } from "@mui/material";

import { PanelSettings } from "@lichtblick/suite";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline";
import { PanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";

export type BuildSettingsTreeProps = {
  config: Record<string, unknown> | undefined;
  extensionSettings: Record<string, Record<string, PanelSettings<unknown>>>;
  messagePipelineState: () => MessagePipelineContext;
  panelType: string | undefined;
  selectedPanelId: string | undefined;
} & Pick<PanelStateStore, "settingsTrees">;

export type ActionMenuProps = {
  allowShare: boolean;
  onReset: () => void;
  onShare: () => void;
  fontSize?: SvgIconProps["fontSize"];
};

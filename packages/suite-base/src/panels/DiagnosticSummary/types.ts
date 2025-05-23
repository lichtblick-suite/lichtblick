// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DiagnosticId, DiagnosticInfo } from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

export type DiagnosticSummaryConfig = {
  minLevel: number;
  pinnedIds: DiagnosticId[];
  topicToRender: string;
  hardwareIdFilter: string;
  sortByLevel?: boolean;
  secondsUntilStale?: number;
};

export type DiagnosticsById = Map<DiagnosticId, DiagnosticInfo>;

export type NodeRowProps = {
  info: DiagnosticInfo;
  isPinned: boolean;
  onClick: (info: DiagnosticInfo) => void;
  onClickPin: (info: DiagnosticInfo) => void;
};

export type DiagnosticSummaryProps = {
  config: DiagnosticSummaryConfig;
  saveConfig: SaveConfig<DiagnosticSummaryConfig>;
};

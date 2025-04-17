// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import { Header } from "@lichtblick/suite-base/types/Messages";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

export interface ToString {
  toString(): string;
}

export type DiagnosticStatusConfig = {
  selectedHardwareId?: string;
  selectedName?: string;
  splitFraction?: number;
  topicToRender: string;
  numericPrecision?: number;
  secondsUntilStale?: number;
};

export type DiagnosticSummaryConfig = {
  minLevel: number;
  pinnedIds: DiagnosticId[];
  topicToRender: string;
  hardwareIdFilter: string;
  sortByLevel?: boolean;
  secondsUntilStale?: number;
};

export type DiagnosticId = string & ToString;

export type KeyValue = { key: string; value: string };

// diagnostic_msgs/DiagnosticStatus
export type DiagnosticStatusMessage = {
  name: string;
  hardware_id: string;
  level: number;
  message: string;
  values: KeyValue[];
};

export type DiagnosticInfo = {
  status: DiagnosticStatusMessage;
  stamp: Time;
  id: DiagnosticId;
  displayName: string;
};

export type DiagnosticStatusArrayMsg = {
  header: Header;
  status: DiagnosticStatusMessage[];
};

export type DiagnosticsById = Map<DiagnosticId, DiagnosticInfo>;

export type DiagnosticStatusPanelProps = {
  config: DiagnosticStatusConfig;
  saveConfig: SaveConfig<DiagnosticStatusConfig>;
};

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

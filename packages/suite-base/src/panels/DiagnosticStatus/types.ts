// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { Time } from "@lichtblick/rostime";
import { Header } from "@lichtblick/suite-base/types/Messages";
import { OpenSiblingPanel, SaveConfig } from "@lichtblick/suite-base/types/panels";

export type DiagnosticStatusConfig = {
  selectedHardwareId?: string;
  selectedName?: string;
  splitFraction?: number;
  topicToRender: string;
  numericPrecision?: number;
  secondsUntilStale?: number;
};

export type DiagnosticStatusPanelProps = {
  config: DiagnosticStatusConfig;
  saveConfig: SaveConfig<DiagnosticStatusConfig>;
};

export interface ToString {
  toString(): string;
}

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

export type DiagnosticStatusProps = {
  info: DiagnosticInfo;
  numericPrecision: number | undefined;
  onChangeSplitFraction: (arg0: number) => void;
  openSiblingPanel: OpenSiblingPanel;
  splitFraction: number | undefined;
  topicToRender: string;
};

export type FormattedKeyValue = {
  key: string;
  keyHtml: { __html: string } | undefined;
  value: string;
  valueHtml: { __html: string } | undefined;
};

type DiagnosticNameSet = Set<string>;

export type UseAvailableDiagnosticResult = Map<string, DiagnosticNameSet>;

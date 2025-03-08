// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SaveConfig } from "@lichtblick/suite-base/types/panels";

export type ActiveNodeData = {
  node_name: string;
  pid: string;
};

export type ActiveLaunchData = {
  pid: number;
  package: string;
  launch_file: string;
  command: string;
};

export type NodesMonitorConfig = {
  activeNodeSource: string;
  activeLaunchSource: string;
  killLaunchTopic: string;
  startLaunchTopic: string;
};

export type Props = {
  config: NodesMonitorConfig;
  saveConfig: SaveConfig<NodesMonitorConfig>;
};

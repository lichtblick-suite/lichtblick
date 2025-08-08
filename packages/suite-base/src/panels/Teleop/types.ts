// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PanelExtensionContext } from "@lichtblick/suite";

export type TeleopPanelProps = {
  context: PanelExtensionContext;
};

export type Config = {
  topic: undefined | string;
  publishRate: number;
  upButton: { field: string; value: number };
  downButton: { field: string; value: number };
  leftButton: { field: string; value: number };
  rightButton: { field: string; value: number };
};

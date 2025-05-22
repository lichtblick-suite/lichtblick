// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PanelExtensionContext } from "@lichtblick/suite";

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type IndicatorOperator = "=" | "<" | "<=" | ">" | ">=";

export type IndicatorStyle = "bulb" | "background";

export type IndicatorRule = {
  color: string;
  label: string;
  operator: IndicatorOperator;
  rawValue: string;
};

export type RawValueIndicator =
  | undefined
  | boolean
  | bigint
  | number
  | string
  | { data?: boolean | bigint | number | string };

export type IndicatorConfig = {
  fallbackColor: string;
  fallbackLabel: string;
  path: string;
  rules: IndicatorRule[];
  style: IndicatorStyle;
};

export type IndicatorProps = {
  context: PanelExtensionContext;
};

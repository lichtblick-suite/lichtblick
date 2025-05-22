// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import * as _ from "lodash-es";

import { SettingsActionReducerProps, GaugeConfig } from "./types";

export function settingsActionReducer({
  prevConfig,
  action,
}: SettingsActionReducerProps): GaugeConfig {
  const { action: settingsTreeAction, payload } = action;

  return produce(prevConfig, (draft) => {
    switch (settingsTreeAction) {
      case "perform-node-action":
        throw new Error(`Unhandled node action: ${payload.id}`);
      case "update":
        if (payload.path[0] === "general") {
          _.set(draft, [payload.path[1]!], payload.value);
        } else {
          throw new Error(`Unexpected payload.path[0]: ${payload.path[0]}`);
        }
        break;
    }
  });
}

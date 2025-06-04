// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StateTransitionConfig } from "@lichtblick/suite-base/panels/StateTransitions/types";
import { OpenSiblingPanel, PanelConfig } from "@lichtblick/suite-base/types/panels";

export function openSiblingStateTransitionsPanel(
  openSiblingPanel: OpenSiblingPanel,
  topicName: string,
): void {
  openSiblingPanel({
    panelType: "StateTransitions",
    updateIfExists: true,
    siblingConfigCreator: (config: PanelConfig) => {
      const existingPath = (config as StateTransitionConfig).paths.find(
        (path) => path.value === topicName,
      );
      if (existingPath) {
        return config;
      }
      return {
        ...config,
        paths: [
          ...(config as StateTransitionConfig).paths,
          { value: topicName, timestampMethod: "receiveTime" },
        ],
      };
    },
  });
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SettingsTreeNodes } from "@foxglove/studio";

import { RawMessagesPanelConfig } from "./types";

export function buildSettingsTree(config: RawMessagesPanelConfig): SettingsTreeNodes {
  return {
    general: {
      label: "General",
      icon: "Settings",
      fields: {
        expansionMode: {
          label: "Auto Expand",
          input: "select",
          value: config.autoExpandMode,
          options: [
            { label: "Auto", value: "auto" },
            { label: "Off", value: "off" },
            { label: "All", value: "all" },
          ],
        },
      },
    },
  };
}

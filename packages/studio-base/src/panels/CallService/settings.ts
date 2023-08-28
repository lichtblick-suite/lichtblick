// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import { set } from "lodash";
import { useMemo } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";

import { Config } from "./types";

export const defaultConfig: Config = {
  requestPayload: "{}",
  layout: "vertical",
};

function serviceError(serviceName?: string) {
  if (!serviceName) {
    return "Service cannot be empty";
  }
  return undefined;
}

export function settingsActionReducer(prevConfig: Config, action: SettingsTreeAction): Config {
  return produce(prevConfig, (draft) => {
    if (action.action === "update") {
      const { path, value } = action.payload;
      set(draft, path.slice(1), value);
    }
  });
}

export function useSettingsTree(config: Config): SettingsTreeNodes {
  const settings = useMemo(
    (): SettingsTreeNodes => ({
      general: {
        fields: {
          serviceName: {
            label: "Service name",
            input: "string",
            error: serviceError(config.serviceName),
            value: config.serviceName ?? "",
          },
          layout: {
            label: "Layout",
            input: "toggle",
            options: [
              { label: "Vertical", value: "vertical" },
              { label: "Horizontal", value: "horizontal" },
            ],
            value: config.layout ?? defaultConfig.layout,
          },
        },
      },
      button: {
        label: "Button",
        fields: {
          buttonText: {
            label: "Title",
            input: "string",
            value: config.buttonText,
            placeholder: `Call service ${config.serviceName ?? ""}`,
          },
          buttonTooltip: { label: "Tooltip", input: "string", value: config.buttonTooltip },
          buttonColor: { label: "Color", input: "rgb", value: config.buttonColor },
        },
      },
    }),
    [config],
  );
  return useShallowMemo(settings);
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StateTransitionConfig } from "@lichtblick/studio-base/panels/StateTransitions/types";
import { OpenSiblingPanel, PanelConfig } from "@lichtblick/studio-base/types/panels";
import * as _ from "lodash-es";

export const transitionableRosTypes = [
  "bool",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "string",
];

export function openSiblingStateTransitionsPanel(
  openSiblingPanel: OpenSiblingPanel,
  topicName: string,
): void {
  openSiblingPanel({
    panelType: "StateTransitions",
    updateIfExists: true,
    siblingConfigCreator: (config: PanelConfig) => {
      return {
        ...config,
        paths: _.uniq(
          (config as StateTransitionConfig).paths.concat([
            { value: topicName, timestampMethod: "receiveTime" },
          ]),
        ),
      };
    },
  });
}

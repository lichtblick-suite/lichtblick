// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { OpenSiblingPanel, PanelConfig } from "@lichtblick/studio-base/types/panels";
import * as _ from "lodash-es";

import type { PlotConfig } from "./config";

export function openSiblingPlotPanel(openSiblingPanel: OpenSiblingPanel, topicName: string): void {
  openSiblingPanel({
    panelType: "Plot",
    updateIfExists: true,
    siblingConfigCreator: (config: PanelConfig) => ({
      ...config,
      paths: _.uniq(
        (config as PlotConfig).paths
          .concat([{ value: topicName, enabled: true, timestampMethod: "receiveTime" }])
          .filter(({ value }) => value),
      ),
    }),
  });
}

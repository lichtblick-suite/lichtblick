// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import GlobalVariableSlider from "@foxglove-studio/app/components/GlobalVariableSlider";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import { SliderProps } from "@foxglove-studio/app/components/SliderWithTicks";
import { PanelConfigSchema } from "@foxglove-studio/app/types/panels";

export type GlobalVariableSliderConfig = {
  sliderProps: SliderProps;
  globalVariableName: string;
};

type Props = {
  config: GlobalVariableSliderConfig;
};

function GlobalVariableSliderPanel(props: Props): React.ReactElement {
  const { config } = props;
  const { sliderProps, globalVariableName } = config;

  return (
    <div style={{ padding: "25px 4px 4px" }}>
      <PanelToolbar floating />
      <GlobalVariableSlider sliderProps={sliderProps} globalVariableName={globalVariableName} />
    </div>
  );
}

const configSchema: PanelConfigSchema<GlobalVariableSliderConfig> = [
  { key: "globalVariableName", type: "text", title: "Variable name" },
  { key: "sliderProps.min", type: "number", title: "Min" },
  { key: "sliderProps.max", type: "number", title: "Max" },
  { key: "sliderProps.step", type: "number", title: "Step", validate: (x) => (x <= 0 ? 1 : x) },
];

export default Panel(
  Object.assign(GlobalVariableSliderPanel, {
    panelType: "GlobalVariableSliderPanel",
    defaultConfig: {
      sliderProps: { min: 0, max: 10, step: 1 },
      globalVariableName: "globalVariable",
    },
    supportsStrictMode: false,
    configSchema,
  }),
);

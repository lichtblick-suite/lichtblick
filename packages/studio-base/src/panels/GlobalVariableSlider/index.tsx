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

import { Slider } from "@fluentui/react";

import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PanelConfigSchema } from "@foxglove/studio-base/types/panels";

import helpContent from "./index.help.md";

type SliderProps = {
  min: number;
  max: number;
  step: number;
};

export type GlobalVariableSliderConfig = {
  sliderProps: SliderProps;
  globalVariableName: string;
};

type Props = {
  config: GlobalVariableSliderConfig;
};

function GlobalVariableSliderPanel(props: Props): React.ReactElement {
  const { sliderProps, globalVariableName } = props.config;
  const { globalVariables, setGlobalVariables } = useGlobalVariables();

  const globalVariableValue = globalVariables[globalVariableName];

  const sliderOnChange = (value: number) => {
    if (value !== globalVariableValue) {
      setGlobalVariables({ [globalVariableName]: value });
    }
  };

  return (
    <div style={{ padding: "25px 4px 4px" }}>
      <PanelToolbar helpContent={helpContent} floating />
      <Slider
        min={sliderProps.min}
        max={sliderProps.max}
        step={sliderProps.step}
        showValue
        snapToStep
        value={typeof globalVariableValue === "number" ? globalVariableValue : 0}
        onChange={sliderOnChange}
        styles={{
          // render min/max labels under the slider
          slideBox: {
            "::after": {
              position: "absolute",
              bottom: "-60%",
              left: 0,
              paddingLeft: "8px",
              fontSize: "0.75em",
              width: "100%",
              mixBlendMode: "difference",
              content: `'${sliderProps.min}'`,
            },
            "::before": {
              position: "absolute",
              bottom: "-60%",
              left: 0,
              fontSize: "0.75em",
              paddingRight: "8px",
              textAlign: "right",
              width: "100%",
              mixBlendMode: "difference",
              content: `'${sliderProps.max}'`,
            },
          },
        }}
      />
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

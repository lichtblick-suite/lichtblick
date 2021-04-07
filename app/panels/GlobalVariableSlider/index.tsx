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

import { useCallback, useMemo } from "react";

import GlobalVariableSlider from "@foxglove-studio/app/components/GlobalVariableSlider";
import Item from "@foxglove-studio/app/components/Menu/Item";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import { SliderProps } from "@foxglove-studio/app/components/SliderWithTicks";
import TextField from "@foxglove-studio/app/components/TextField";
import useGlobalVariables from "@foxglove-studio/app/hooks/useGlobalVariables";

export type GlobalVariableSliderConfig = {
  sliderProps: SliderProps;
  globalVariableName: string;
};

type Props = {
  config: GlobalVariableSliderConfig;
  saveConfig: (arg0: Partial<GlobalVariableSliderConfig>) => void;
};

type MenuProps = {
  config: GlobalVariableSliderConfig;
  updateConfig: (config: Partial<GlobalVariableSliderConfig>) => void;
};

// Validation helper functions for the SliderSettingsMenu
const minMaxValidatorFn = (str: string) =>
  isNaN(parseFloat(str)) ? "Must be valid number" : undefined;
const stepValidatorFn = (str: string) => {
  const result = minMaxValidatorFn(str);
  if (result) {
    return result;
  }
  const number = parseFloat(str);
  if (number <= 0) {
    return "Must be >= 0";
  }
  return undefined;
};

function SliderSettingsMenu(props: MenuProps) {
  const { updateConfig, config } = props;
  const { sliderProps, globalVariableName } = config;

  const updateSliderProps = useCallback(
    (partial: Partial<SliderProps>) => {
      updateConfig({
        ...config,
        sliderProps: { ...sliderProps, ...partial },
      });
    },
    [config, sliderProps, updateConfig],
  );

  const onChangeVariableName = useCallback(
    (newGlobalVariableName) =>
      updateConfig({
        ...config,
        globalVariableName: newGlobalVariableName,
      }),
    [config, updateConfig],
  );

  const onChangeMin = useCallback((min) => updateSliderProps({ min: parseFloat(min) }), [
    updateSliderProps,
  ]);
  const onChangeMax = useCallback((max) => updateSliderProps({ max: parseFloat(max) }), [
    updateSliderProps,
  ]);
  const onChangeStep = useCallback((step) => updateSliderProps({ step: parseFloat(step) }), [
    updateSliderProps,
  ]);
  return (
    <>
      <Item>
        <TextField
          value={globalVariableName}
          onChange={onChangeVariableName}
          label="Global variable name"
          validateOnBlur
        />
      </Item>
      <Item>
        <TextField
          value={`${sliderProps.min}`}
          onChange={onChangeMin}
          placeholder="Min"
          label="Min"
          validator={minMaxValidatorFn}
        />
      </Item>
      <Item>
        <TextField
          value={`${sliderProps.max}`}
          onChange={onChangeMax}
          placeholder="Max"
          label="Max"
          validator={minMaxValidatorFn}
        />
      </Item>
      <Item>
        <TextField
          value={`${sliderProps.step}`}
          onChange={onChangeStep}
          placeholder="Step"
          label="Step"
          validator={stepValidatorFn}
        />
      </Item>
    </>
  );
}

function GlobalVariableSliderPanel(props: Props): React.ReactElement {
  const { config, saveConfig } = props;
  const { sliderProps, globalVariableName } = config;
  const { globalVariables, setGlobalVariables } = useGlobalVariables();

  const globalVariableValue = globalVariables[globalVariableName];
  const saveSliderProps = useCallback(
    (updatedConfig) => {
      // If the name of the global variable changes, immediately set its value.
      // Without this, the variable won't be set until the slider is moved.
      if (updatedConfig.globalVariableName !== config.globalVariableName) {
        setGlobalVariables({ [updatedConfig.globalVariableName]: globalVariableValue });
      }
      saveConfig(updatedConfig);
    },
    [config.globalVariableName, globalVariableValue, saveConfig, setGlobalVariables],
  );

  const menuContent = useMemo(
    () => <SliderSettingsMenu config={config} updateConfig={saveSliderProps} />,
    [config, saveSliderProps],
  );
  return (
    <div style={{ padding: "25px 4px 4px" }}>
      <PanelToolbar floating menuContent={menuContent} />
      <GlobalVariableSlider sliderProps={sliderProps} globalVariableName={globalVariableName} />
    </div>
  );
}

GlobalVariableSliderPanel.panelType = "GlobalVariableSliderPanel";
GlobalVariableSliderPanel.defaultConfig = {
  sliderProps: { min: 0, max: 10, step: 1 },
  globalVariableName: "globalVariable",
};

export default Panel(GlobalVariableSliderPanel);

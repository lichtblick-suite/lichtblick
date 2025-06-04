// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { Slider, Typography, useTheme } from "@mui/material";
import { useCallback, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { useVariableSliderSettings } from "./settings";
import { VariableSliderConfig } from "./types";

type Props = {
  config: VariableSliderConfig;
  saveConfig: SaveConfig<VariableSliderConfig>;
};

function VariableSliderPanel(props: Props): React.JSX.Element {
  const { config, saveConfig } = props;
  const { sliderProps, globalVariableName } = config;
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const { min = 0, max = 10, step = 1 } = sliderProps;
  const globalVariableValue = globalVariables[globalVariableName];
  const theme = useTheme();
  const [sliderValue, setSliderValue] = useState<number | number[]>(
    typeof globalVariableValue === "number" ? globalVariableValue : 0,
  );

  useVariableSliderSettings(config, saveConfig);

  const updateVariable = useCallback(
    (value: number | number[]) => {
      if (value !== globalVariableValue) {
        setGlobalVariables({ [globalVariableName]: value });
      }
    },
    [globalVariableName, globalVariableValue, setGlobalVariables],
  );
  const updateVariableDebounced = useDebouncedCallback(updateVariable, 250);
  const sliderOnChange = useCallback(
    (_event: Event, value: number | number[]) => {
      setSliderValue(value);
      updateVariableDebounced(value);
    },
    [setSliderValue, updateVariableDebounced],
  );

  const marks = [
    { value: min, label: String(min) },
    { value: max, label: String(max) },
  ];

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack
        flex="auto"
        alignItems="center"
        justifyContent="center"
        fullHeight
        gap={2}
        paddingY={2}
        paddingX={3}
      >
        <Slider
          min={min}
          max={max}
          step={step}
          marks={marks}
          value={sliderValue}
          onChange={sliderOnChange}
        />
        <Typography variant="h5" style={{ marginTop: theme.spacing(-2.5) }}>
          {sliderValue}
        </Typography>
      </Stack>
    </Stack>
  );
}

const defaultConfig: VariableSliderConfig = {
  sliderProps: {
    min: 0,
    max: 10,
    step: 1,
  },
  globalVariableName: "globalVariable",
};

export default Panel(
  Object.assign(VariableSliderPanel, {
    panelType: "GlobalVariableSliderPanel",
    defaultConfig,
  }),
);

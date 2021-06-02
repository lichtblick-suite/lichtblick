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
import { ReactElement, useCallback } from "react";

import { SliderWithTicks, SliderProps } from "@foxglove/studio-base/components/SliderWithTicks";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";

type Props = {
  sliderProps: SliderProps;
  globalVariableName: string;
};

// A slider that controls the value of a global variable
export default function GlobalVariableSlider(props: Props): ReactElement {
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const globalVariableValue = globalVariables[props.globalVariableName];

  const onChange = useCallback(
    (newValue) => {
      if (newValue !== globalVariableValue) {
        setGlobalVariables({ [props.globalVariableName]: newValue });
      }
    },
    [props.globalVariableName, globalVariableValue, setGlobalVariables],
  );
  return (
    <SliderWithTicks
      value={globalVariableValue}
      sliderProps={props.sliderProps}
      onChange={onChange}
    />
  );
}

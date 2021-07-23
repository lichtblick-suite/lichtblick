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

import { upperFirst } from "lodash";

import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import Dropdown from "@foxglove/studio-base/components/Dropdown/index";
import Flex from "@foxglove/studio-base/components/Flex";

import { SLabel, SInput } from "./common";

export default function CommonPointSettings({
  defaultPointSize,
  defaultPointShape = "circle",
  settings,
  onFieldChange,
}: {
  defaultPointSize: number;
  defaultPointShape?: string;
  settings: {
    pointSize?: number;
    pointShape?: string;
  };
  onFieldChange: (name: string, value: unknown) => void;
}): JSX.Element {
  const pointSizeVal = settings.pointSize == undefined ? "" : settings.pointSize;

  const pointShape = settings.pointShape;
  const pointShapeVal = pointShape ?? defaultPointShape;
  const pointShapeOpts = ["circle", "square"].map((field) => (
    <DropdownItem key={field} value={field}>
      {upperFirst(field)}
    </DropdownItem>
  ));

  return (
    <Flex col>
      <SLabel>Point size</SLabel>
      <SInput
        data-test="point-size-input"
        type="number"
        placeholder={defaultPointSize.toString()}
        value={pointSizeVal}
        min={1}
        max={50}
        step={1}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("pointSize", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />

      <SLabel>Point shape</SLabel>
      <Dropdown
        text={upperFirst(pointShapeVal)}
        value={pointShapeVal}
        onChange={(value) => onFieldChange("pointShape", value)}
        btnStyle={{
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {pointShapeOpts}
      </Dropdown>
    </Flex>
  );
}

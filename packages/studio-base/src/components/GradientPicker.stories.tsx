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

import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { Color } from "@foxglove/regl-worldview";

import GradientPicker from "./GradientPicker";

function Story({
  initialMinColor,
  initialMaxColor,
}: {
  initialMinColor?: Color;
  initialMaxColor?: Color;
}) {
  const [minColor, setMinColor] = useState(initialMinColor ?? { r: 0, g: 0, b: 0, a: 0 });
  const [maxColor, setMaxColor] = useState(initialMaxColor ?? { r: 0, g: 0, b: 0, a: 0 });

  return (
    <div style={{ width: "400px", padding: "100px" }}>
      <GradientPicker
        minColor={minColor}
        maxColor={maxColor}
        onChange={({ minColor: newMinColor, maxColor: newMaxColor }) => {
          setMinColor(newMinColor);
          setMaxColor(newMaxColor);
        }}
      />
    </div>
  );
}

export default {
  title: "components/GradientPicker",
  component: GradientPicker,
};

export function Basic(): JSX.Element {
  return (
    <Story
      initialMinColor={{ r: 255, g: 0, b: 0, a: 1 }}
      initialMaxColor={{ r: 0, g: 0, b: 255, a: 1 }}
    />
  );
}

export function ChangeMinColor(): JSX.Element {
  return (
    <Story
      initialMinColor={{ r: 255, g: 0, b: 0, a: 1 }}
      initialMaxColor={{ r: 0, g: 0, b: 255, a: 1 }}
    />
  );
}
ChangeMinColor.parameters = {
  colorScheme: "light",
};
ChangeMinColor.play = async () => {
  const user = userEvent.setup();
  const triggers = await screen.findAllByTestId("color-picker-button");
  await user.click(triggers[0]!);
  const input = await screen.findByRole("input");
  await user.type(input, "00bbaa");
};

export function ChangeMaxColor(): JSX.Element {
  return (
    <Story
      initialMinColor={{ r: 255, g: 0, b: 0, a: 1 }}
      initialMaxColor={{ r: 0, g: 0, b: 255, a: 1 }}
    />
  );
}
ChangeMaxColor.parameters = {
  colorScheme: "light",
};
ChangeMaxColor.play = async () => {
  const user = userEvent.setup();
  const triggers = await screen.findAllByTestId("color-picker-button");
  await user.click(triggers[1]!);
  const input = await screen.findByRole("input");
  await user.type(input, "aabb00");
};

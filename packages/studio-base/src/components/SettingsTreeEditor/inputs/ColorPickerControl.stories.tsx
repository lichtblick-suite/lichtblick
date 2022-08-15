// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ColorPickerControl } from "./ColorPickerControl";

export default {
  title: "components/ColorPickerControl",
  component: ColorPickerControl,
};

export function Default(): JSX.Element {
  const [color, setColor] = useState("#ffaa00");

  return <ColorPickerControl alphaType="none" value={color} onChange={setColor} />;
}

export function WithAlpha(): JSX.Element {
  const [color, setColor] = useState("#ffaa0088");

  return <ColorPickerControl alphaType="alpha" value={color} onChange={setColor} />;
}

export function TextEntry(): JSX.Element {
  const [color, setColor] = useState("");

  return <ColorPickerControl alphaType="none" value={color} onChange={setColor} />;
}
TextEntry.play = async () => {
  const user = userEvent.setup();
  const inputs = await screen.findAllByPlaceholderText("RRGGBB");
  for (const input of inputs) {
    await user.click(input);
    await user.type(input, "aabbcc");
  }
};

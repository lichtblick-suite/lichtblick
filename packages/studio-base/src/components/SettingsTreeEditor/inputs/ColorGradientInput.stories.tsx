// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useState } from "react";

import { ColorGradientInput } from "./ColorGradientInput";

export default {
  title: "components/ColorGradientInput",
  component: ColorGradientInput,
};

export function Default(): JSX.Element {
  const [colors, setColors] = useState<[string, string]>(["#ffaa00", "#0026ff"]);

  return <ColorGradientInput colors={colors} onChange={setColors} />;
}

export function Disabled(): JSX.Element {
  const [colors, setColors] = useState<[string, string]>(["#ffaa00", "#0026ff"]);

  return <ColorGradientInput disabled colors={colors} onChange={setColors} />;
}

export function ReadOnly(): JSX.Element {
  const [colors, setColors] = useState<[string, string]>(["#ffaa00", "#0026ff"]);

  return <ColorGradientInput readOnly colors={colors} onChange={setColors} />;
}

export function WithAlpha(): JSX.Element {
  const [colors, setColors] = useState<[string, string]>(["#ffaa0088", "#0026ffcc"]);

  return <ColorGradientInput colors={colors} onChange={setColors} />;
}

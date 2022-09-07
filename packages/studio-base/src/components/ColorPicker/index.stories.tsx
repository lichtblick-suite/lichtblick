// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import Stack from "@foxglove/studio-base/components/Stack";

export default {
  title: "components/ColorPicker",
  component: ColorPicker,
};

export function Default(): JSX.Element {
  return (
    <Stack direction="row" padding={2} gap={2}>
      <ColorPicker color={{ r: 0, g: 255, b: 255, a: 0.5 }} onChange={() => {}} />
      <ColorPicker color={{ r: 0, g: 0, b: 255, a: 1 }} onChange={() => {}} />
      <ColorPicker color={{ r: 0, g: 255, b: 0, a: 1 }} onChange={() => {}} />
      <ColorPicker color={{ r: 255, g: 0, b: 0, a: 1 }} onChange={() => {}} />
    </Stack>
  );
}

export function Circle(): JSX.Element {
  return (
    <Stack direction="row" padding={2} gap={2}>
      <ColorPicker
        buttonShape="circle"
        circleSize={192}
        alphaType="alpha"
        color={{ r: 0, g: 255, b: 255, a: 0.5 }}
        onChange={() => {}}
      />
      <ColorPicker
        buttonShape="circle"
        circleSize={96}
        color={{ r: 0, g: 0, b: 255, a: 1 }}
        onChange={() => {}}
      />
      <ColorPicker
        buttonShape="circle"
        circleSize={48}
        color={{ r: 0, g: 255, b: 0, a: 1 }}
        onChange={() => {}}
      />
      <ColorPicker buttonShape="circle" color={{ r: 255, g: 0, b: 0, a: 1 }} onChange={() => {}} />
    </Stack>
  );
}

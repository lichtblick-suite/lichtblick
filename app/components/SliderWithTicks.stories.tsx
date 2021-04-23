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

import { storiesOf } from "@storybook/react";
import { noop } from "lodash";

import { SliderWithTicks } from "@foxglove-studio/app/components/SliderWithTicks";

storiesOf("components/SliderWithTicks", module).add("examples", () => {
  return (
    <div style={{ width: 300 }}>
      <SliderWithTicks sliderProps={{ min: 0, max: 10, step: 1 }} value={3} onChange={noop} />
      <SliderWithTicks sliderProps={{ min: 0, max: 1, step: 0.1 }} value={0.1} onChange={noop} />
      <SliderWithTicks
        sliderProps={{ min: 0, max: 10000, step: 2000 }}
        value={590}
        onChange={noop}
      />
    </div>
  );
});

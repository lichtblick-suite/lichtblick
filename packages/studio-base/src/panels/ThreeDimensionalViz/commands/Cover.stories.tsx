// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { storiesOf } from "@storybook/react";
import { noop } from "lodash";
import styled from "styled-components";

import { Worldview } from "@foxglove/regl-worldview";

import Cover from "./Cover";

const SExpectedResult = styled.div`
  position: fixed;
  top: 25px;
  left: 0;
  color: lightgreen;
  margin: 16px;
  z-index: 1000;
`;

storiesOf("panels/ThreeDimensionalViz/Commands/Cover", module)
  .addParameters({ colorScheme: "dark" })
  .add("renders with blending", () => {
    const transparentRed = [1, 0, 0, 0.5];
    const transparentBlue = [0, 0, 1, 0.5];
    return (
      <div style={{ width: 1001, height: 745 }}>
        <Worldview
          onClick={noop}
          onCameraStateChange={noop}
          cameraState={{ target: [-627, -608, -17], perspective: true }}
          onDoubleClick={noop}
          onMouseDown={noop}
          onMouseMove={noop}
          onMouseUp={noop}
        >
          <Cover color={transparentRed as any} layerIndex={0} />
          <Cover color={transparentBlue as any} layerIndex={1} />
        </Worldview>
        <SExpectedResult>The whole viewport should be purple</SExpectedResult>
      </div>
    );
  });

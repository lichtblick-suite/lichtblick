// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Story } from "@storybook/react";
import { useState } from "react";
import styled from "styled-components";

import Slider from "./Slider";

const StyledRange = styled.div<{ width?: number }>`
  position: absolute;
  top: 40%;
  left: 0;
  background-color: #b3ecf9bd;
  height: 20%;
  width: ${(props) => (props.width ?? 0) * 100}%;
  border-radius: 2px;
`;

const StyledMarker = styled.div<{ width?: number }>`
  background-color: white;
  position: absolute;
  height: 150%;
  border: 1px solid rgba(0, 0, 0, 0.3);
  width: 6px;
  top: -25%;
  left: ${(props) => (props.width ?? 0) * 100}%;
`;

export default {
  title: "components/PlaybackControls/Slider",
};

export const Examples: Story = () => {
  const [value, setValue] = useState(50);
  const [draggableValue, setDraggableValue] = useState(25);
  return (
    <div style={{ margin: 50 }}>
      <p>standard (clickable)</p>
      <div style={{ backgroundColor: "pink", height: 30, width: 300 }}>
        <Slider min={10} max={200} onChange={(v) => setValue(v)} value={value} />
      </div>
      <p>disabled (not clickable)</p>
      <div style={{ backgroundColor: "pink", height: 30, width: 300 }}>
        <Slider disabled min={10} max={200} onChange={(v) => setValue(v)} value={value} />
      </div>
      <p>no value</p>
      <div style={{ backgroundColor: "pink", height: 30, width: 300 }}>
        <Slider
          min={10}
          max={200}
          onChange={() => {
            // no-op
          }}
          value={undefined}
        />
      </div>
      <p>draggable</p>
      <div style={{ backgroundColor: "cornflowerblue", height: 20, width: 500 }}>
        <Slider
          draggable
          min={10}
          max={200}
          onChange={(v) => setDraggableValue(v)}
          value={draggableValue}
        />
      </div>
    </div>
  );
};

export const CustomRenderer: Story = () => {
  const [draggableValue, setDraggableValue] = useState(25);

  return (
    <div style={{ margin: 50 }}>
      <p>Customize slider UI using renderSlider</p>
      <div style={{ backgroundColor: "cornflowerblue", height: 20, width: 500 }}>
        <Slider
          draggable
          min={10}
          max={200}
          onChange={(v) => setDraggableValue(v)}
          value={draggableValue}
          renderSlider={(width) => (
            <div>
              <StyledRange width={width} />
              <StyledMarker width={width} />
            </div>
          )}
        />
      </div>
    </div>
  );
};

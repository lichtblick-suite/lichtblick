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

import { storiesOf } from "@storybook/react";
import { useState, useEffect } from "react";

import AutoSizingCanvas from ".";

function Example({
  changeSize = false,
  changePixelRatio = false,
  devicePixelRatio,
}: {
  changeSize?: boolean;
  changePixelRatio?: boolean;
  devicePixelRatio?: number;
}) {
  const [width, setWidth] = useState(300);
  const [pixelRatio, setPixelRatio] = useState(devicePixelRatio);
  useEffect(() => {
    setTimeout(() => {
      if (changeSize) {
        setWidth(150);
      }
      if (changePixelRatio) {
        setPixelRatio(2);
      }
    }, 10);
  }, [changePixelRatio, changeSize]);

  return (
    <div style={{ width, height: 100, backgroundColor: "green" }}>
      <AutoSizingCanvas
        overrideDevicePixelRatioForTest={pixelRatio}
        draw={(ctx, drawWidth, drawHeight) => {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, drawWidth, drawHeight);
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.font = "24px Arial";
          ctx.strokeRect(0, 0, drawWidth, drawHeight);

          const text = `hello ${ctx.getTransform().a}`;
          const size = ctx.measureText(text);
          ctx.fillStyle = "black";
          ctx.textBaseline = "middle";
          ctx.fillText(text, drawWidth / 2 - size.width / 2, drawHeight / 2);
        }}
      />
    </div>
  );
}

storiesOf("components/AutoSizingCanvas", module)
  .add("static", () => <Example />)
  .add("changing size", () => <Example changeSize />)
  .add("pixel ratio 2", () => <Example devicePixelRatio={2} />)
  .add("changing pixel ratio", () => <Example changePixelRatio />);

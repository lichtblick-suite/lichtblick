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

import { CSSProperties, PropsWithChildren } from "react";

export const SCREENSHOT_VIEWPORT = {
  width: 1001,
  height: 745,
};

export const ScreenshotSizedContainer = (props: {
  children: React.ReactNode;
}): React.ReactElement => <div style={SCREENSHOT_VIEWPORT}>{props.children}</div>;

type ExpectedResultProps = {
  top?: CSSProperties["top"];
  left?: CSSProperties["left"];
};

export function ExpectedResult(props: PropsWithChildren<ExpectedResultProps>): React.ReactElement {
  const { children, top = 25, left = 0 } = props;
  return (
    <div style={{ position: "fixed", top, left, color: "lightgreen", margin: 16, zIndex: 1000 }}>
      {children}
    </div>
  );
}

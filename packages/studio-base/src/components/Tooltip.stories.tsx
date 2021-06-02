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

import styled from "styled-components";

import Tooltip from "@foxglove/studio-base/components/Tooltip";

const Spacer = styled.div`
  width: 10px;
`;

export default {
  title: "components/Tooltip",
  component: Tooltip,
};

export function BasicExamples(): React.ReactElement {
  const containerStyle = {
    padding: "100px",
    display: "flex",
    width: "400px",
    height: "300px",
  } as const;
  const style = {
    width: "50px",
    height: "50px",
    backgroundColor: "gray",
  } as const;
  return (
    <div style={containerStyle}>
      <Tooltip contents="Top" placement="top" shown>
        <div style={style} />
      </Tooltip>
      <Spacer />
      <Tooltip contents="Left" placement="left" shown>
        <div style={style} />
      </Tooltip>
      <Spacer />
      <Tooltip contents="Right" placement="right" shown>
        <div style={style} />
      </Tooltip>
      <Spacer />
      <Tooltip contents="Bottom" placement="bottom" shown>
        <div style={style} />
      </Tooltip>
    </div>
  );
}

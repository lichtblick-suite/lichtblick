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

import { Box } from "@mui/material";

import Tooltip from "@foxglove/studio-base/components/Tooltip";

export default {
  title: "components/Tooltip",
  component: Tooltip,
};

export function BasicExamples(): React.ReactElement {
  const style = {
    width: 50,
    height: 50,
    backgroundColor: "gray",
  } as const;

  return (
    <div style={{ padding: 100, display: "flex", width: 400, height: 300 }}>
      <Tooltip contents="Top" placement="top" shown>
        <div style={style} />
      </Tooltip>
      <Box width={10} />
      <Tooltip contents="Left" placement="left" shown>
        <div style={style} />
      </Tooltip>
      <Box width={10} />
      <Tooltip contents="Right" placement="right" shown>
        <div style={style} />
      </Tooltip>
      <Box width={10} />
      <Tooltip contents="Bottom" placement="bottom" shown>
        <div style={style} />
      </Tooltip>
    </div>
  );
}

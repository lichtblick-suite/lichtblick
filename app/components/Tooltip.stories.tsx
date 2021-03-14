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

import Tooltip from "@foxglove-studio/app/components/Tooltip";

storiesOf("<Tooltip>", module).add("basic examples", () => {
  const containerStyle = {
    margin: "50px",
    display: "flex",
    flexWrap: "wrap",
  };
  const style = {
    width: "50px",
    height: "50px",
    margin: "10px",
    backgroundColor: "gray",
  };
  return (
    <div style={containerStyle as any}>
      <Tooltip contents="Top" placement="top" defaultShown>
        <div style={style} />
      </Tooltip>
      <Tooltip contents="Left" placement="left" defaultShown>
        <div style={style} />
      </Tooltip>
      <Tooltip contents="Right" placement="right" defaultShown>
        <div style={style} />
      </Tooltip>
      <Tooltip contents="Bottom" placement="bottom" defaultShown>
        <div style={style} />
      </Tooltip>
    </div>
  );
});

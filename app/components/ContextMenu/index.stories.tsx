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

import ContextMenu from "@foxglove-studio/app/components/ContextMenu";
import Menu, { Item } from "@foxglove-studio/app/components/Menu";

storiesOf("<ContextMenu>", module).add("standard", () => {
  const onContextMenu = (e: any) => {
    e.stopPropagation();
    e.preventDefault();
    const menu = (
      <Menu>
        <Item>foo</Item>
        <Item>bar</Item>
        <Item>baz</Item>
      </Menu>
    );
    ContextMenu.show(e.clientX, e.clientY, menu);
  };
  return (
    <div style={{ margin: 20 }}>
      <div
        onContextMenu={onContextMenu}
        style={{ margin: 20, padding: 20, backgroundColor: "pink" }}
      >
        right click on me
      </div>
    </div>
  );
});

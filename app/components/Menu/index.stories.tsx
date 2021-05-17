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
import ReactDOM from "react-dom";

import Menu, { Item, SubMenu } from "@foxglove/studio-base/components/Menu";

storiesOf("components/Menu", module)
  .add("standard", () => {
    return (
      <div style={{ margin: 20 }}>
        <Menu>
          <div>howdy</div>
          <div>how are you?</div>
        </Menu>
      </div>
    );
  })
  .add("nested", () => {
    function openSubMenu(component: SubMenu | ReactNull) {
      if (component) {
        // eslint-disable-next-line react/no-find-dom-node
        (ReactDOM.findDOMNode(component) as Element).querySelector("svg")?.parentElement?.click();
      }
    }
    return (
      <div style={{ margin: 20, width: 150 }}>
        <Menu>
          <Item>howdy</Item>
          <SubMenu text="sub 1" ref={openSubMenu}>
            <Item>Foo</Item>
            <Item>bar</Item>
            <SubMenu text="sub 2" ref={openSubMenu}>
              <Item>baz</Item>
              <Item>blah</Item>
              <SubMenu text="sub 3" ref={openSubMenu}>
                <Item>even more</Item>
              </SubMenu>
            </SubMenu>
          </SubMenu>
          <Item>Some other item</Item>
        </Menu>
      </div>
    );
  });

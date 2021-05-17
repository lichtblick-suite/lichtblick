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

import GridIcon from "@mdi/svg/svg/grid.svg";
import MapMarkerIcon from "@mdi/svg/svg/map-marker.svg";
import { storiesOf } from "@storybook/react";
import { useState } from "react";

import Menu from "@foxglove/studio-base/components/Menu";
import Tree from "@foxglove/studio-base/components/Tree";
import { Node } from "@foxglove/studio-base/components/Tree/Node";

function getInitialState() {
  const root: Node = {
    text: "foo",
    id: "root",
    visible: true,
    expanded: true,
    checked: false,
    children: [
      {
        id: "branch-1",
        text: "this is the name of a very long branch",
        expanded: true,
        checked: false,
        visible: true,
        children: [
          {
            id: "sub-branch-1",
            text: "sub branch 1",
            icon: <MapMarkerIcon />,
            checked: false,
            visible: true,
            expanded: true,
            children: [
              {
                id: "leaf-1",
                text: "this is the name of a very long leaf node 1",
                checked: false,
                visible: true,
                icon: <MapMarkerIcon />,
                children: [],
              },
              {
                id: "leaf-2",
                text: "this is the name of another very long leaf node 2",
                checked: false,
                visible: true,
                icon: <GridIcon />,
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: "branch-2",
        text: "branch 2",
        checked: false,
        visible: true,
        children: [
          {
            id: "child-1",
            text: "child 1",
            checked: false,
            visible: true,
            children: [],
          },
          {
            id: "invisible",
            text: "invisible",
            checked: false,
            visible: false,
            children: [],
          },
        ],
      },
      {
        id: "branch-3",
        text: "branch 3",
        checked: false,
        visible: true,
        expanded: true,
        children: [
          {
            id: "foobar",
            text: "foo bar baz",
            checked: false,
            visible: true,
            expanded: true,
            disabled: true,
            children: [
              {
                id: "foobar child",
                text: "child of foo bar baz",
                checked: false,
                visible: true,
                expanded: true,
                disabled: true,
                children: [
                  {
                    id: "far child",
                    text: "At the bottom of everything",
                    checked: false,
                    visible: true,
                    disabled: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  return {
    root,
  };
}

function Example({ hideRoot }: { hideRoot?: boolean }) {
  const [state, setState] = useState(() => getInitialState());
  const { root } = state;
  const onNodeCheck = (node: Node) => {
    node.checked = !node.checked;
    setState({ ...state, root });
  };
  const onNodeExpand = (node: Node) => {
    node.expanded = !(node.expanded ?? false);
    setState({ ...state, root });
  };

  return (
    <div style={{ backgroundColor: "pink", padding: 20, maxWidth: 350 }}>
      <Menu>
        <Tree
          hideRoot={hideRoot}
          onToggleCheck={onNodeCheck}
          onToggleExpand={onNodeExpand}
          root={root}
        />
      </Menu>
    </div>
  );
}

storiesOf("components/Tree", module)
  .add("standard hideRoot_true", () => <Example hideRoot />)
  .add("standard hideRoot_false", () => <Example />);

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

import React, { PureComponent } from "react";

import { Node } from "./Node";
import TreeNode from "./TreeNode";

// export the node flow type
export { Node } from "./Node";

type Props = {
  disableCheckbox?: boolean;
  enableVisibilityToggle?: boolean;
  hideRoot?: boolean;
  onEditClick: (e: React.MouseEvent<HTMLElement>, node: Node) => void;
  onRemoveNode?: (node: Node) => void;
  onToggleCheck: (node: Node) => void;
  onToggleExpand: (node: Node) => void;
  onToggleVisibility?: (node: Node) => void;
  root: Node;
};

export default class Tree extends PureComponent<Props> {
  // make onEditClick optional. A no-op if not supplied
  static defaultProps = {
    onEditClick: () => {
      // no-op
    },
  };

  renderNode = (node: Node) => {
    const {
      disableCheckbox,
      enableVisibilityToggle,
      onEditClick,
      onRemoveNode,
      onToggleCheck,
      onToggleExpand,
      onToggleVisibility,
    } = this.props;
    return (
      <TreeNode
        depth={0}
        disableCheckbox={disableCheckbox}
        enableVisibilityToggle={enableVisibilityToggle}
        key={node.id}
        node={node}
        onEditClick={onEditClick}
        onRemoveNode={onRemoveNode as any}
        onToggleCheck={onToggleCheck}
        onToggleExpand={onToggleExpand}
        onToggleVisibility={onToggleVisibility}
      />
    );
  };
  render() {
    const { root, hideRoot } = this.props;
    const children = root.children || [];
    if (hideRoot && !children.some((treeNode: Node) => treeNode.visible)) {
      return <div style={{ padding: "8px 12px", color: "#666" }}>None</div>;
    }
    return hideRoot ? children.map(this.renderNode) : this.renderNode(root);
  }
}

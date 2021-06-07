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

import CrosshairsGpsIcon from "@mdi/svg/svg/crosshairs-gps.svg";
import MenuDownIcon from "@mdi/svg/svg/menu-down.svg";
import MenuLeftIcon from "@mdi/svg/svg/menu-left.svg";
import CompassOutlineIcon from "@mdi/svg/svg/navigation.svg";
import { sortBy, debounce } from "lodash";
import React, { memo, createRef, useCallback, useState } from "react";
import shallowequal from "shallowequal";
import styled from "styled-components";

import Autocomplete from "@foxglove/studio-base/components/Autocomplete";
import Button from "@foxglove/studio-base/components/Button";
import Icon from "@foxglove/studio-base/components/Icon";
import colors from "@foxglove/studio-base/styles/colors.module.scss";
import { isNonEmptyOrUndefined } from "@foxglove/studio-base/util/emptyOrUndefined";

import Transforms, { Transform } from "./Transforms";

type TfTreeNode = {
  tf: Transform;
  children: TfTreeNode[];
  depth: number;
};

type TfTree = {
  roots: TfTreeNode[];
  nodes: {
    [key: string]: TfTreeNode;
  };
};

const treeNodeToTfId = (node: TfTreeNode) => node.tf.id;

const buildTfTree = (transforms: Transform[]): TfTree => {
  const tree: TfTree = {
    roots: [],
    nodes: {},
  };
  // Create treeNodes for all tfs.
  for (const tf of transforms) {
    if (tree.nodes[tf.id]) {
      continue;
    }
    tree.nodes[tf.id] = {
      tf,
      children: [],
      depth: 0,
    };
  }

  // Now add children to their parents treenode.
  for (const tf of transforms) {
    const node = tree.nodes[tf.id] as TfTreeNode;
    if (tf.parent) {
      tree.nodes[tf.parent.id]?.children.push(node);
    } else {
      tree.roots.push(node);
    }
  }

  // Do a final pass sorting all the children lists.
  for (const node of Object.values(tree.nodes)) {
    node.children = sortBy(node.children, treeNodeToTfId);
  }
  tree.roots = sortBy(tree.roots, treeNodeToTfId);

  // Calculate depths
  const setDepth = (node: TfTreeNode, depth: number) => {
    node.depth = depth;
    node.children.forEach((child) => setDepth(child, depth + 1));
  };
  tree.roots.forEach((root) => setDepth(root, 0));

  return tree;
};

type Props = {
  transforms: Transforms;
  tfToFollow?: string;
  followOrientation: boolean;
  onFollowChange: (tfId?: string | false, followOrientation?: boolean) => void;
};

function* getDescendants(nodes: TfTreeNode[]): Iterable<TfTreeNode> {
  for (const node of nodes) {
    yield node;
    yield* getDescendants(node.children);
  }
}

function getItemText(node: TfTreeNode | { tf: { id: string }; depth: number }) {
  return "".padEnd(node.depth * 4) + node.tf.id;
}

const Container = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  position: relative;
`;

const arePropsEqual = (prevProps: Props, nextProps: Props) => {
  if (!isNonEmptyOrUndefined(nextProps.tfToFollow)) {
    const tfTree = buildTfTree(nextProps.transforms.values());
    const allNodes = Array.from(getDescendants(tfTree.roots));
    // As a result of various refactors this code does not make sense anymore and is in need of
    // cleanup. An original version can be found at
    // https://github.com/cruise-automation/webviz/blob/7407ef1687e19615a43194c003aec6608c4f7c51/packages/webviz-core/src/panels/ThreeDimensionalViz/FollowTFControl.js#L113
    const nodesWithoutDefaultFollowTfFrame = allNodes?.length;
    if (nodesWithoutDefaultFollowTfFrame !== 0) {
      return false;
    }
  }
  return shallowequal(prevProps, nextProps);
};

const FollowTFControl = memo<Props>((props: Props) => {
  const { transforms, tfToFollow, followOrientation, onFollowChange } = props;
  const [forceShowFrameList, setForceShowFrameList] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [lastSelectedFrame, setLastSelectedFrame] = useState<string | undefined>(undefined);

  const tfTree = buildTfTree(transforms.values());
  const allNodes = Array.from(getDescendants(tfTree.roots));
  // As a result of various refactors this code does not make sense anymore and is in need of
  // cleanup. An original version can be found at
  // https://github.com/cruise-automation/webviz/blob/7407ef1687e19615a43194c003aec6608c4f7c51/packages/webviz-core/src/panels/ThreeDimensionalViz/FollowTFControl.js#L113
  const nodesWithoutDefaultFollowTfFrame = allNodes?.length;
  const newFollowTfFrame = allNodes?.[0]?.tf?.id;

  const autocomplete = createRef<Autocomplete<TfTreeNode>>();

  const getDefaultFollowTransformFrame = useCallback(() => {
    return nodesWithoutDefaultFollowTfFrame !== 0 ? newFollowTfFrame : undefined;
  }, [nodesWithoutDefaultFollowTfFrame, newFollowTfFrame]);

  const getFollowButtonTooltip = useCallback(() => {
    if (!isNonEmptyOrUndefined(tfToFollow)) {
      if (isNonEmptyOrUndefined(lastSelectedFrame)) {
        return `Follow ${lastSelectedFrame}`;
      }
      return `Follow ${getDefaultFollowTransformFrame()}`;
    } else if (!followOrientation) {
      return "Follow Orientation";
    }
    return "Unfollow";
  }, [tfToFollow, followOrientation, lastSelectedFrame, getDefaultFollowTransformFrame]);

  const onClickFollowButton = useCallback(() => {
    if (!isNonEmptyOrUndefined(tfToFollow)) {
      if (isNonEmptyOrUndefined(lastSelectedFrame)) {
        return onFollowChange(lastSelectedFrame);
      }
      return onFollowChange(getDefaultFollowTransformFrame());
    } else if (!followOrientation) {
      return onFollowChange(tfToFollow, true);
    }
    return onFollowChange(false);
  }, [
    tfToFollow,
    lastSelectedFrame,
    onFollowChange,
    getDefaultFollowTransformFrame,
    followOrientation,
  ]);

  const onSelectFrame = useCallback(
    (id: string, _item: unknown, autocompleteNode: Autocomplete<TfTreeNode>) => {
      setLastSelectedFrame(id === getDefaultFollowTransformFrame() ? undefined : id);
      onFollowChange(id, followOrientation);
      autocompleteNode.blur();
    },
    [setLastSelectedFrame, getDefaultFollowTransformFrame, onFollowChange, followOrientation],
  );

  const openFrameList = useCallback(
    (event: React.SyntheticEvent<Element>) => {
      event.preventDefault();
      setForceShowFrameList(true);
      if (autocomplete.current) {
        autocomplete.current.focus();
      }
    },
    [setForceShowFrameList, autocomplete],
  );

  // slight delay to prevent the arrow from disappearing when you're trying to click it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onMouseLeaveDebounced = useCallback(
    debounce(() => {
      setHovering(false);
    }, 200),
    [setHovering],
  );

  const onMouseEnter = useCallback(() => {
    onMouseLeaveDebounced.cancel();
    setHovering(true);
  }, [onMouseLeaveDebounced, setHovering]);

  const followingCustomFrame =
    isNonEmptyOrUndefined(tfToFollow) && tfToFollow !== getDefaultFollowTransformFrame();
  const showFrameList =
    lastSelectedFrame != undefined || forceShowFrameList || followingCustomFrame;
  const selectedFrameId = tfToFollow ?? lastSelectedFrame;
  const selectedItem: TfTreeNode | undefined = isNonEmptyOrUndefined(selectedFrameId)
    ? { tf: new Transform(selectedFrameId), children: [], depth: 0 }
    : undefined;

  return (
    <Container
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeaveDebounced}
      style={{ color: isNonEmptyOrUndefined(tfToFollow) ? undefined : colors.textMuted }}
    >
      {showFrameList && (
        <Autocomplete
          ref={autocomplete}
          items={allNodes}
          getItemValue={treeNodeToTfId}
          getItemText={getItemText}
          selectedItem={selectedItem}
          placeholder={selectedItem ? getItemText(selectedItem) : "choose a target frame"}
          onSelect={onSelectFrame}
          sortWhenFiltering={false}
          minWidth={0}
          clearOnFocus
          autoSize
          menuStyle={{
            // bump the menu down to reduce likelihood of it appearing while the mouse is
            // already over it, which causes onMouseEnter not to be delivered correctly and
            // breaks selection
            marginTop: 4,
          }}
          onBlur={() => {
            setForceShowFrameList(false);
            setHovering(false);
          }}
        />
      )}
      {showFrameList ? (
        <Icon onClick={openFrameList}>
          <MenuDownIcon />
        </Icon>
      ) : hovering ? (
        <Icon
          tooltip={"Select Another Frame\u2026"}
          onClick={openFrameList}
          tooltipProps={{ placement: "top" }}
          style={{ color: "white" }}
        >
          <MenuLeftIcon />
        </Icon>
      ) : undefined}
      <Button
        tooltipProps={{ placement: "top" }}
        onClick={onClickFollowButton}
        tooltip={getFollowButtonTooltip()}
      >
        <Icon style={{ color: isNonEmptyOrUndefined(tfToFollow) ? colors.accent : "white" }}>
          {followOrientation ? <CompassOutlineIcon /> : <CrosshairsGpsIcon />}
        </Icon>
      </Button>
    </Container>
  );
}, arePropsEqual);
export default FollowTFControl;

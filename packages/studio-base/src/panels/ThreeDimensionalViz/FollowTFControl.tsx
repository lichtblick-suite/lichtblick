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

import { IButtonStyles, IconButton, Stack, useTheme } from "@fluentui/react";
import { sortBy, debounce } from "lodash";
import { memo, createRef, useCallback, useState, useMemo } from "react";
import shallowequal from "shallowequal";

import Autocomplete, { IAutocomplete } from "@foxglove/studio-base/components/Autocomplete";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

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
  // eslint-disable-next-line @foxglove/no-boolean-parameters
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

const arePropsEqual = (prevProps: Props, nextProps: Props) => {
  if (!nextProps.tfToFollow) {
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
  const theme = useTheme();

  const iconButtonStyles = useMemo(
    (): Partial<IButtonStyles> => ({
      rootHovered: { backgroundColor: "transparent" },
      rootPressed: { backgroundColor: "transparent" },
      rootDisabled: { backgroundColor: "transparent" },
      rootChecked: { backgroundColor: "transparent" },
      rootCheckedHovered: { backgroundColor: "transparent" },
      rootCheckedPressed: { backgroundColor: "transparent" },
      iconChecked: { color: colors.HIGHLIGHT },
      icon: {
        color: theme.semanticColors.bodyText,

        svg: {
          fill: "currentColor",
          height: "1em",
          width: "1em",
        },
      },
    }),
    [theme],
  );

  const tfTree = buildTfTree(transforms.values());
  const allNodes = Array.from(getDescendants(tfTree.roots));
  // As a result of various refactors this code does not make sense anymore and is in need of
  // cleanup. An original version can be found at
  // https://github.com/cruise-automation/webviz/blob/7407ef1687e19615a43194c003aec6608c4f7c51/packages/webviz-core/src/panels/ThreeDimensionalViz/FollowTFControl.js#L113
  const nodesWithoutDefaultFollowTfFrame = allNodes?.length;
  const newFollowTfFrame = allNodes?.[0]?.tf?.id;

  const autocomplete = createRef<IAutocomplete>();

  const getDefaultFollowTransformFrame = useCallback(() => {
    return nodesWithoutDefaultFollowTfFrame !== 0 ? newFollowTfFrame : undefined;
  }, [nodesWithoutDefaultFollowTfFrame, newFollowTfFrame]);

  const getFollowButtonTooltip = useCallback(() => {
    if (!tfToFollow) {
      if (lastSelectedFrame) {
        return `Follow ${lastSelectedFrame}`;
      }
      return `Follow ${getDefaultFollowTransformFrame()}`;
    } else if (!followOrientation) {
      return "Follow Orientation";
    }
    return "Unfollow";
  }, [tfToFollow, followOrientation, lastSelectedFrame, getDefaultFollowTransformFrame]);

  const onClickFollowButton = useCallback(() => {
    if (!tfToFollow) {
      if (lastSelectedFrame) {
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
    (id: string, _item: unknown, autocompleteNode: IAutocomplete) => {
      setLastSelectedFrame(id === getDefaultFollowTransformFrame() ? undefined : id);
      onFollowChange(id, followOrientation);
      autocompleteNode.blur();
    },
    [setLastSelectedFrame, getDefaultFollowTransformFrame, onFollowChange, followOrientation],
  );

  const openFrameList = useCallback(() => {
    setForceShowFrameList(true);
    if (autocomplete.current) {
      autocomplete.current.focus();
    }
  }, [setForceShowFrameList, autocomplete]);

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

  const followingCustomFrame = !!tfToFollow && tfToFollow !== getDefaultFollowTransformFrame();
  const showFrameList =
    lastSelectedFrame != undefined || forceShowFrameList || followingCustomFrame;
  const selectedFrameId = tfToFollow ?? lastSelectedFrame;
  const selectedItem: TfTreeNode | undefined = selectedFrameId
    ? { tf: new Transform(selectedFrameId), children: [], depth: 0 }
    : undefined;

  const followButton = useTooltip({ contents: getFollowButtonTooltip() });
  const frameListButton = useTooltip({ contents: "Select a frame to follow…" });

  return (
    <Stack
      horizontal
      grow={1}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeaveDebounced}
      verticalAlign="center"
      styles={{
        root: {
          // see also ExpandingToolbar styles
          backgroundColor: theme.semanticColors.buttonBackgroundHovered,
          borderRadius: theme.effects.roundedCorner2,
          pointerEvents: "auto",
          color: tfToFollow ? undefined : theme.semanticColors.disabledText,
          position: "relative",
        },
      }}
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
      {(hovering || showFrameList) && (
        <>
          {frameListButton.tooltip}
          <IconButton
            elementRef={frameListButton.ref}
            onClick={openFrameList}
            iconProps={{ iconName: showFrameList ? "MenuDown" : "MenuLeft" }}
            styles={{
              ...iconButtonStyles,
              root: { width: 16 },
            }}
          />
        </>
      )}
      {followButton.tooltip}
      <IconButton
        checked={tfToFollow != undefined}
        elementRef={followButton.ref}
        onClick={onClickFollowButton}
        iconProps={{ iconName: followOrientation ? "CompassOutline" : "CrosshairsGps" }}
        styles={iconButtonStyles}
      />
    </Stack>
  );
}, arePropsEqual);

export default FollowTFControl;

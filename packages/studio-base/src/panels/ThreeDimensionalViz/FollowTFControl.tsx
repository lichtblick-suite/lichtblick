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

import { IButtonStyles, IconButton, useTheme } from "@fluentui/react";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import NavigationIcon from "@mui/icons-material/Navigation";
import { Paper, IconButton as MuiIconButton } from "@mui/material";
import { sortBy } from "lodash";
import { memo, useCallback, useMemo, useRef } from "react";
import shallowequal from "shallowequal";
import { makeStyles } from "tss-react/mui";

import Autocomplete, { IAutocomplete } from "@foxglove/studio-base/components/Autocomplete";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { FollowMode } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { CoordinateFrame, IImmutableTransformTree, IImmutableCoordinateFrame } from "./transforms";

type TfTreeNode = {
  tf: IImmutableCoordinateFrame;
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

const buildTfTree = (transforms: IImmutableCoordinateFrame[]): TfTree => {
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
    const parentId = tf.parent()?.id;
    if (parentId) {
      tree.nodes[parentId]?.children.push(node);
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
  transforms: IImmutableTransformTree;
  followTf?: string;
  followMode: FollowMode;
  onFollowChange: (tfId?: string, followMode?: FollowMode) => void;
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
  if (!nextProps.followTf) {
    const tfTree = buildTfTree(Array.from(nextProps.transforms.frames().values()));
    const allNodes = Array.from(getDescendants(tfTree.roots));
    // As a result of various refactors this code does not make sense anymore and is in need of
    // cleanup. An original version can be found at
    // https://github.com/cruise-automation/webviz/blob/7407ef1687e19615a43194c003aec6608c4f7c51/packages/webviz-core/src/panels/ThreeDimensionalViz/FollowTFControl.js#L113
    const nodesWithoutDefaultFollowTfFrame = allNodes.length;
    if (nodesWithoutDefaultFollowTfFrame !== 0) {
      return false;
    }
  }
  return shallowequal(prevProps, nextProps);
};

type StyleProps = {
  followTf?: Props["followTf"];
};

const useStyles = makeStyles<StyleProps>()((theme, { followTf }) => ({
  root: {
    pointerEvents: "auto",
  },
  row: {
    display: "flex",
    flexGrow: 1,
    alignItems: "center",
    // see also ExpandingToolbar styles
    color: followTf ? undefined : theme.palette.text.disabled,
    position: "relative",
  },
  icon: {
    fontSize: "16px !important",
  },
}));

const FollowTFControl = memo<Props>(function FollowTFControl(props: Props) {
  const { transforms, followTf, followMode, onFollowChange } = props;
  const theme = useTheme();
  const { classes } = useStyles({ followTf });

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

  const tfTree = buildTfTree(Array.from(transforms.frames().values()));
  const allNodes = Array.from(getDescendants(tfTree.roots));

  const autocomplete = useRef<IAutocomplete>(ReactNull);

  const followButtonTooltipContent = useMemo(() => {
    switch (followMode) {
      case "follow":
        return "Following position - click to follow orientation";
      case "follow-orientation":
        return "Following orientation - click to stop following";
      case "no-follow":
        return "Not following - click to follow position";
    }
  }, [followMode]);

  const toggleFollowMode = useCallback(() => {
    switch (followMode) {
      case "follow":
        onFollowChange(followTf, "follow-orientation");
        break;
      case "follow-orientation":
        onFollowChange(followTf, "no-follow");
        break;
      case "no-follow":
        onFollowChange(followTf, "follow");
        break;
    }
  }, [followMode, followTf, onFollowChange]);

  const onSelectFrame = useCallback(
    (id: string) => {
      onFollowChange(id, followMode);
      autocomplete.current?.blur();
    },
    [onFollowChange, followMode],
  );

  const openFrameList = useCallback(() => {
    autocomplete.current?.focus();
  }, [autocomplete]);

  const selectedItem = {
    tf: new CoordinateFrame(followTf ?? "(empty)", undefined),
    children: [],
    depth: 0,
  };

  const frameListButton = useTooltip({ contents: "Select a frame to follow…" });

  // The control is active only if there are transform frames.
  // With no transform frames we show a disabled state.
  const active = useMemo(() => transforms.frames().size > 0, [transforms]);

  return (
    <Paper className={classes.root} square={false} elevation={4}>
      <div className={classes.row}>
        {active && (
          <Autocomplete
            ref={autocomplete}
            items={allNodes}
            getItemValue={treeNodeToTfId}
            getItemText={getItemText}
            selectedItem={selectedItem}
            placeholder={followTf ?? "(empty)"}
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
          />
        )}
        {frameListButton.tooltip}
        {active && (
          <IconButton
            elementRef={frameListButton.ref}
            onClick={openFrameList}
            iconProps={{ iconName: "MenuDown" }}
            styles={{
              ...iconButtonStyles,
              root: { width: 16 },
            }}
          />
        )}
        <MuiIconButton
          className={classes.icon}
          disabled={!active}
          title={followButtonTooltipContent}
          color={followMode !== "no-follow" ? "info" : "inherit"}
          onClick={toggleFollowMode}
        >
          {followMode === "follow-orientation" ? (
            <NavigationIcon fontSize="inherit" />
          ) : (
            <MyLocationIcon fontSize="inherit" />
          )}
        </MuiIconButton>
      </div>
    </Paper>
  );
}, arePropsEqual);

export default FollowTFControl;

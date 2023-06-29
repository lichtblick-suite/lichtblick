// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { MosaicNode, MosaicWithoutDragDropContext } from "react-mosaic-component";
import { makeStyles } from "tss-react/mui";

import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import Stack from "@foxglove/studio-base/components/Stack";

import { Sidebar, SidebarItem } from "./Sidebar";

import "react-mosaic-component/react-mosaic-component.css";

type LayoutNode = "leftbar" | "children" | "rightbar";

const useStyles = makeStyles()({
  mosaicWrapper: {
    flex: "1 1 100%",

    // Root drop targets in this top level sidebar mosaic interfere with drag/mouse events from the
    // PanelList. We don't allow users to edit the mosaic since it's just used for the sidebar, so we
    // can hide the drop targets.
    "& > .mosaic > .drop-target-container": {
      display: "none !important",
    },
  },
});

/**
 * Extract existing left split percentage from a layout node or return the default.
 */
function mosiacLeftSidebarSplitPercentage(node: MosaicNode<LayoutNode>): number | undefined {
  if (typeof node !== "object") {
    return undefined;
  }
  if (node.first === "leftbar") {
    return node.splitPercentage;
  } else {
    return (
      mosiacLeftSidebarSplitPercentage(node.first) ?? mosiacLeftSidebarSplitPercentage(node.second)
    );
  }
}

/**
 * Extract existing right split percentage from a layout node or return the default.
 */
function mosiacRightSidebarSplitPercentage(node: MosaicNode<LayoutNode>): number | undefined {
  if (typeof node !== "object") {
    return undefined;
  }
  if (node.second === "rightbar") {
    return node.splitPercentage;
  } else {
    return (
      mosiacRightSidebarSplitPercentage(node.first) ??
      mosiacRightSidebarSplitPercentage(node.second)
    );
  }
}

type SidebarProps<LeftKey, RightKey> = PropsWithChildren<{
  leftItems: Map<LeftKey, SidebarItem>;
  selectedLeftKey: LeftKey | undefined;
  onSelectLeftKey: (key: LeftKey | undefined) => void;
  leftSidebarSize: number | undefined;
  setLeftSidebarSize: (size: number | undefined) => void;

  rightItems: Map<RightKey, SidebarItem>;
  selectedRightKey: RightKey | undefined;
  onSelectRightKey: (key: RightKey | undefined) => void;
  rightSidebarSize: number | undefined;
  setRightSidebarSize: (size: number | undefined) => void;
}>;

export function Sidebars<LeftKey extends string, RightKey extends string>(
  props: SidebarProps<LeftKey, RightKey>,
): JSX.Element {
  const {
    children,
    leftItems,
    selectedLeftKey,
    onSelectLeftKey,
    leftSidebarSize,
    setLeftSidebarSize,
    rightItems,
    selectedRightKey,
    onSelectRightKey,
    rightSidebarSize,
    setRightSidebarSize,
  } = props;

  const [mosaicValue, setMosaicValue] = useState<MosaicNode<LayoutNode>>("children");
  const { classes } = useStyles();

  const leftSidebarOpen = selectedLeftKey != undefined && leftItems.has(selectedLeftKey);
  const rightSidebarOpen = selectedRightKey != undefined && rightItems.has(selectedRightKey);

  useEffect(() => {
    const leftTargetWidth = 320;
    const rightTargetWidth = 320;
    const defaultLeftPercentage = 100 * (leftTargetWidth / window.innerWidth);
    const defaultRightPercentage = 100 * (1 - rightTargetWidth / window.innerWidth);

    setMosaicValue((oldValue) => {
      let node: MosaicNode<LayoutNode> = "children";
      if (rightSidebarOpen) {
        node = {
          direction: "row",
          first: node,
          second: "rightbar",
          splitPercentage:
            rightSidebarSize ??
            mosiacRightSidebarSplitPercentage(oldValue) ??
            defaultRightPercentage,
        };
      }
      if (leftSidebarOpen) {
        node = {
          direction: "row",
          first: "leftbar",
          second: node,
          splitPercentage:
            leftSidebarSize ?? mosiacLeftSidebarSplitPercentage(oldValue) ?? defaultLeftPercentage,
        };
      }
      return node;
    });
  }, [leftSidebarSize, rightSidebarSize, leftSidebarOpen, rightSidebarOpen]);

  const onChangeMosaicValue = useCallback(
    (newValue: ReactNull | MosaicNode<LayoutNode>) => {
      if (newValue != undefined) {
        setMosaicValue(newValue);
        setLeftSidebarSize(mosiacLeftSidebarSplitPercentage(newValue));
        setRightSidebarSize(mosiacRightSidebarSplitPercentage(newValue));
      }
    },
    [setLeftSidebarSize, setRightSidebarSize],
  );

  return (
    <Stack direction="row" fullHeight overflow="hidden">
      {
        // By always rendering the mosaic, even if we are only showing children, we can prevent the
        // children from having to re-mount each time the sidebar is opened/closed.
      }
      <div className={classes.mosaicWrapper}>
        <MosaicWithoutDragDropContext<LayoutNode>
          className=""
          value={mosaicValue}
          onChange={onChangeMosaicValue}
          renderTile={(id) => {
            switch (id) {
              case "children":
                return <ErrorBoundary>{children as JSX.Element}</ErrorBoundary>;
              case "leftbar":
                return (
                  <ErrorBoundary>
                    <Sidebar<LeftKey>
                      anchor="left"
                      onClose={() => onSelectLeftKey(undefined)}
                      items={leftItems}
                      activeTab={selectedLeftKey}
                      setActiveTab={onSelectLeftKey}
                    />
                  </ErrorBoundary>
                );
              case "rightbar":
                return (
                  <ErrorBoundary>
                    <Sidebar<RightKey>
                      anchor="right"
                      onClose={() => onSelectRightKey(undefined)}
                      items={rightItems}
                      activeTab={selectedRightKey}
                      setActiveTab={onSelectRightKey}
                    />
                  </ErrorBoundary>
                );
            }
          }}
          resize={{ minimumPaneSizePercentage: 10 }}
        />
      </div>
    </Stack>
  );
}

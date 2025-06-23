// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { MosaicNode, MosaicWithoutDragDropContext } from "react-mosaic-component";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import ErrorBoundary from "@lichtblick/suite-base/components/ErrorBoundary";
import { LEFT_SIDEBAR_MIN_WIDTH_PX } from "@lichtblick/suite-base/components/Sidebars/constants";
import { useStyles } from "@lichtblick/suite-base/components/Sidebars/index.style";
import { LayoutNode, SidebarItem } from "@lichtblick/suite-base/components/Sidebars/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

import "react-mosaic-component/react-mosaic-component.css";
import { NewSidebar } from "./NewSidebar";

/**
 * Clamp a given percentage to the minimum width of the left sidebar.
 */
function clampLeftSidebarPercentage(percentage: number): number {
  const minPercentage = (LEFT_SIDEBAR_MIN_WIDTH_PX / window.innerWidth) * 100;
  return Math.max(percentage, minPercentage);
}

/**
 * Extract existing left split percentage from a layout node or return the default.
 */
function mosaicLeftSidebarSplitPercentage(node: MosaicNode<LayoutNode>): number | undefined {
  if (typeof node !== "object") {
    return undefined;
  }
  if (node.first === "leftbar") {
    return node.splitPercentage;
  } else {
    return (
      mosaicLeftSidebarSplitPercentage(node.first) ?? mosaicLeftSidebarSplitPercentage(node.second)
    );
  }
}

/**
 * Extract existing right split percentage from a layout node or return the default.
 */
function mosaicRightSidebarSplitPercentage(node: MosaicNode<LayoutNode>): number | undefined {
  if (typeof node !== "object") {
    return undefined;
  }
  if (node.second === "rightbar") {
    return node.splitPercentage;
  } else {
    return (
      mosaicRightSidebarSplitPercentage(node.first) ??
      mosaicRightSidebarSplitPercentage(node.second)
    );
  }
}

type SidebarProps<OldLeftKey, LeftKey, RightKey> = PropsWithChildren<{
  items: Map<OldLeftKey, SidebarItem>;
  bottomItems: Map<OldLeftKey, SidebarItem>;
  selectedKey: OldLeftKey | undefined;
  onSelectKey: (key: OldLeftKey | undefined) => void;

  leftItems: Map<LeftKey, SidebarItem>;
  selectedLeftKey: LeftKey | undefined;
  onSelectLeftKey: (item: LeftKey | undefined) => void;
  leftSidebarSize: number | undefined;
  setLeftSidebarSize: (size: number | undefined) => void;

  rightItems: Map<RightKey, SidebarItem>;
  selectedRightKey: RightKey | undefined;
  onSelectRightKey: (item: RightKey | undefined) => void;
  rightSidebarSize: number | undefined;
  setRightSidebarSize: (size: number | undefined) => void;
}>;

export default function Sidebars<
  OldLeftKey extends string,
  LeftKey extends string,
  RightKey extends string,
>(props: SidebarProps<OldLeftKey, LeftKey, RightKey>): React.JSX.Element {
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

  // Since we can't toggle the title bar on an electron window, keep the setting at its initial
  // value until the app is reloaded/relaunched.
  const [currentEnableNewTopNav = true] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_NEW_TOPNAV,
  );
  const [initialEnableNewTopNav] = useState(currentEnableNewTopNav);
  const enableNewTopNav = isDesktopApp() ? initialEnableNewTopNav : currentEnableNewTopNav;

  const [mosaicValue, setMosaicValue] = useState<MosaicNode<LayoutNode>>("children");
  const { classes } = useStyles();

  const leftSidebarOpen =
    enableNewTopNav && selectedLeftKey != undefined && leftItems.has(selectedLeftKey);
  const rightSidebarOpen =
    enableNewTopNav && selectedRightKey != undefined && rightItems.has(selectedRightKey);

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
            mosaicRightSidebarSplitPercentage(oldValue) ??
            defaultRightPercentage,
        };
      }
      if (leftSidebarOpen) {
        node = {
          direction: "row",
          first: "leftbar",
          second: node,
          splitPercentage: clampLeftSidebarPercentage(
            leftSidebarSize ?? mosaicLeftSidebarSplitPercentage(oldValue) ?? defaultLeftPercentage,
          ),
        };
      }
      return node;
    });
  }, [enableNewTopNav, leftSidebarSize, rightSidebarSize, leftSidebarOpen, rightSidebarOpen]);

  const onChangeMosaicValue = useCallback(
    (newValue: ReactNull | MosaicNode<LayoutNode>) => {
      if (newValue != undefined) {
        setMosaicValue(newValue);
        setRightSidebarSize(mosaicRightSidebarSplitPercentage(newValue));
        setLeftSidebarSize(mosaicLeftSidebarSplitPercentage(newValue));
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
                return <ErrorBoundary>{children as React.JSX.Element}</ErrorBoundary>;
              case "leftbar":
                return (
                  <ErrorBoundary>
                    <NewSidebar<LeftKey>
                      anchor="left"
                      onClose={() => {
                        onSelectLeftKey(undefined);
                      }}
                      items={leftItems}
                      activeTab={selectedLeftKey}
                      setActiveTab={onSelectLeftKey}
                    />
                  </ErrorBoundary>
                );
              case "rightbar":
                return (
                  <ErrorBoundary>
                    <NewSidebar<RightKey>
                      anchor="right"
                      onClose={() => {
                        onSelectRightKey(undefined);
                      }}
                      items={rightItems}
                      activeTab={selectedRightKey}
                      setActiveTab={onSelectRightKey}
                    />
                  </ErrorBoundary>
                );
            }
          }}
          resize={{ minimumPaneSizePercentage: clampLeftSidebarPercentage(10) }}
        />
      </div>
    </Stack>
  );
}

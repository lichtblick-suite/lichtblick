// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useState } from "react";
import { MosaicNode, MosaicWithoutDragDropContext } from "react-mosaic-component";

import ErrorBoundary from "@lichtblick/suite-base/components/ErrorBoundary";
import { useStyles } from "@lichtblick/suite-base/components/Sidebars/index.style";
import { LayoutNode, SidebarProps } from "@lichtblick/suite-base/components/Sidebars/types";
import {
  clampLeftSidebarPercentage,
  mosaicLeftSidebarSplitPercentage,
  mosaicRightSidebarSplitPercentage,
} from "@lichtblick/suite-base/components/Sidebars/utils";
import Stack from "@lichtblick/suite-base/components/Stack";

import "react-mosaic-component/react-mosaic-component.css";
import { NewSidebar } from "./NewSidebar";

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
  }, [leftSidebarSize, rightSidebarSize, leftSidebarOpen, rightSidebarOpen]);

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
    <Stack direction="row" fullHeight overflow="hidden" data-testid="sidebars-wrapper">
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

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

import ArrowLeftIcon from "@mdi/svg/svg/arrow-left.svg";
import ArrowRightIcon from "@mdi/svg/svg/arrow-right.svg";
import ChevronDownIcon from "@mdi/svg/svg/chevron-down.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import MagnifyIcon from "@mdi/svg/svg/magnify.svg";
import SwapHorizontalIcon from "@mdi/svg/svg/swap-horizontal.svg";
import SyncIcon from "@mdi/svg/svg/sync.svg";
import LessIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import MoreIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
import { clamp, groupBy } from "lodash";
import Tree from "rc-tree";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useResizeDetector } from "react-resize-detector";
import { CSSTransition } from "react-transition-group";
import styled from "styled-components";

import Dropdown from "@foxglove/studio-base/components/Dropdown";
import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";
import { Item } from "@foxglove/studio-base/components/Menu";
import useChangeDetector from "@foxglove/studio-base/hooks/useChangeDetector";
import useLinkedGlobalVariables from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import { syncBags, SYNC_OPTIONS } from "@foxglove/studio-base/panels/ThreeDimensionalViz/syncBags";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { Save3DConfig } from "../index";
import DiffModeSettings from "./DiffModeSettings";
import TopicTreeSwitcher, { SWITCHER_HEIGHT } from "./TopicTreeSwitcher";
import TopicViewModeSelector from "./TopicViewModeSelector";
import { ROW_HEIGHT, TREE_SPACING } from "./constants";
import NoMatchesSvg from "./noMatches.svg";
import renderTreeNodes, { SWITCHER_WIDTH } from "./renderTreeNodes";
import topicTreeTransition from "./topicTreeTransition.module.scss";
import {
  DerivedCustomSettingsByKey,
  GetIsNamespaceCheckedByDefault,
  GetIsTreeNodeVisibleInScene,
  GetIsTreeNodeVisibleInTree,
  NamespacesByTopic,
  OnNamespaceOverrideColorChange,
  SceneErrorsByKey,
  SetCurrentEditingTopic,
  TopicDisplayMode,
  TreeGroupNode,
  TreeNode,
  VisibleTopicsCountByKey,
} from "./types";

const CONTAINER_SPACING = 15;
const DEFAULT_WIDTH = 360;
const DEFAULT_XS_WIDTH = 240;
const SEARCH_BAR_HEIGHT = 40;
const SWITCHER_ICON_SIZE = 20;
const MAX_CONTAINER_WIDTH_RATIO = 0.9;

const STopicTreeWrapper = styled.div`
  position: absolute;
  top: ${CONTAINER_SPACING}px;
  left: ${CONTAINER_SPACING}px;
  z-index: 102;
  max-width: ${MAX_CONTAINER_WIDTH_RATIO * 100}%;

  // Allow clicks right above the TopicTree to close it
  pointer-events: none;
`;

const STopicTree = styled.div`
  position: relative;
  color: ${colors.TEXT};
  border-radius: 6px;
  background-color: ${colors.DARK2};
  padding-bottom: 6px;
  max-width: 100%;
  overflow: auto;
  pointer-events: auto;
  transition: opacity 0.15s linear, transform 0.15s linear;
`;

const STopicTreeInner = styled.div<{ isXSWidth: boolean }>`
  .rc-tree {
    li {
      ul {
        padding: 0 0 0 ${SWITCHER_WIDTH}px;
      }
    }
    .rc-tree-node-content-wrapper {
      cursor: unset;
    }
    /* Make the chevron icon transition nicely between pointing down and right. */
    .rc-tree-switcher {
      height: ${ROW_HEIGHT}px;
      transition: transform 80ms ease-in-out;
    }
    .rc-tree-switcher_close {
      transform: rotate(-90deg);
    }
    .rc-tree-switcher_open {
      transform: rotate(0deg);
    }
    /* Hide the chevron switcher icon when it's not usable. */
    .rc-tree-switcher-noop {
      visibility: hidden;
    }
    .rc-tree-treenode {
      display: flex;
      padding: 0 ${({ isXSWidth }) => (isXSWidth ? 0 : TREE_SPACING)}px;
      &:hover {
        background: ${colors.DARK4};
      }
      &.rc-tree-treenode-disabled {
        color: ${colors.TEXT_MUTED};
        cursor: unset;
        .rc-tree-node-content-wrapper {
          cursor: unset;
        }
      }
    }
    .rc-tree-indent {
      width: 100%;
    }
    .rc-tree-indent-unit {
      width: 24px;
    }
    .rc-tree-treenode-switcher-close,
    .rc-tree-treenode-switcher-open {
      .rc-tree-node-content-wrapper {
        padding: 0;
      }
    }
  }
`;

const STopicTreeHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  padding-left: 8px;
  align-items: center;
  background-color: ${colors.DARK5};
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
`;

const SFilter = styled.div`
  display: flex;
  padding: 8px 4px;
  align-items: center;
  flex: 1;
`;

const SInput = styled(LegacyInput)`
  height: 24px;
  background: transparent;
  flex: 1;
  overflow: auto;
  font-size: 12px;
  margin-left: 4px;
  padding: 4px 8px;
  min-width: 80px;
  border: none;
  :focus,
  :hover {
    outline: none;
    background: transparent;
  }
`;

const SSwitcherIcon = styled.div`
  width: ${SWITCHER_WIDTH}px;
  height: ${ROW_HEIGHT}px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SNoMatches = styled.div`
  margin-top: 57px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 74px;
`;

const SNoMatchesText = styled.div`
  margin-top: 25px;
  font-size: 16px;
  width: 205px;
  text-align: center;
  line-height: 130%;
`;

type SharedProps = {
  allKeys: string[];
  availableNamespacesByTopic: NamespacesByTopic;
  checkedKeys: string[];
  settingsByKey: TopicSettingsCollection;
  derivedCustomSettingsByKey: DerivedCustomSettingsByKey;
  expandedKeys: string[];
  filterText: string;
  getIsNamespaceCheckedByDefault: GetIsNamespaceCheckedByDefault;
  getIsTreeNodeVisibleInScene: GetIsTreeNodeVisibleInScene;
  getIsTreeNodeVisibleInTree: GetIsTreeNodeVisibleInTree;
  hasFeatureColumn: boolean;
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
  pinTopics: boolean;
  diffModeEnabled: boolean;
  rootTreeNode: TreeNode;
  saveConfig: Save3DConfig;
  sceneErrorsByKey: SceneErrorsByKey;
  setCurrentEditingTopic: SetCurrentEditingTopic;
  setFilterText: (arg0: string) => void;
  setShowTopicTree: (arg0: boolean | ((arg0: boolean) => boolean)) => void;
  shouldExpandAllKeys: boolean;
  showTopicTree: boolean;
  topicDisplayMode: TopicDisplayMode;
  visibleTopicsCountByKey: VisibleTopicsCountByKey;
};

type Props = SharedProps & {
  containerHeight: number;
  containerWidth: number;
  onExitTopicTreeFocus: () => void;
};

type BaseProps = SharedProps & {
  treeWidth: number;
  treeHeight: number;
};

function TopicTree({
  allKeys,
  availableNamespacesByTopic,
  checkedKeys,
  settingsByKey,
  derivedCustomSettingsByKey,
  expandedKeys,
  filterText,
  getIsNamespaceCheckedByDefault,
  getIsTreeNodeVisibleInScene,
  getIsTreeNodeVisibleInTree,
  hasFeatureColumn,
  onNamespaceOverrideColorChange,
  pinTopics,
  diffModeEnabled,
  rootTreeNode,
  saveConfig,
  sceneErrorsByKey,
  setCurrentEditingTopic,
  setFilterText,
  setShowTopicTree,
  shouldExpandAllKeys,
  showTopicTree,
  topicDisplayMode,
  treeHeight,
  treeWidth,
  visibleTopicsCountByKey,
}: BaseProps) {
  const renderTopicTree = pinTopics || showTopicTree;
  const scrollContainerRef = useRef<HTMLDivElement>(ReactNull);
  const checkedKeysSet = useMemo(() => new Set(checkedKeys), [checkedKeys]);

  const filterTextFieldRef = useRef<HTMLInputElement>(ReactNull);

  // HACK: rc-tree does not auto expand dynamic tree nodes. Create a copy of expandedNodes
  // to ensure newly added nodes such as `uncategorized` are properly expanded:
  // https://github.com/ant-design/ant-design/issues/18012
  const expandedKeysRef = useRef(expandedKeys);
  const hasRootNodeChanged = useChangeDetector([rootTreeNode], false);
  expandedKeysRef.current = hasRootNodeChanged ? [...expandedKeys] : expandedKeys;

  useEffect(() => {
    // auto focus whenever first rendering the topic tree
    if (renderTopicTree && filterTextFieldRef.current) {
      const filterTextFieldEl: HTMLInputElement = filterTextFieldRef.current;
      filterTextFieldEl.focus();
      filterTextFieldEl.select();
    }
  }, [renderTopicTree]);

  const topLevelNodesCollapsed = useMemo(() => {
    const topLevelChildren = rootTreeNode.type === "group" ? rootTreeNode.children : [];
    const topLevelKeys = topLevelChildren.map(({ key }) => key);
    return topLevelKeys.every((key) => !expandedKeys.includes(key));
  }, [expandedKeys, rootTreeNode]);

  const showNoMatchesState = !getIsTreeNodeVisibleInTree(rootTreeNode.key);

  const isXSWidth = treeWidth < DEFAULT_XS_WIDTH;
  const headerRightIconStyle = { margin: `4px ${(isXSWidth ? 0 : TREE_SPACING) + 2}px 4px 0px` };

  const { linkedGlobalVariables } = useLinkedGlobalVariables();
  const linkedGlobalVariablesByTopic = groupBy(linkedGlobalVariables, ({ topic }) => topic);

  // Close the TopicTree if the user hits the "Escape" key
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape" && document.activeElement) {
        (document.activeElement as HTMLInputElement).blur();
        setShowTopicTree(false);
      }
    },
    [setShowTopicTree],
  );

  return (
    <STopicTreeInner style={{ width: treeWidth }} isXSWidth={isXSWidth}>
      <STopicTreeHeader>
        <SFilter>
          <Icon style={{ color: "rgba(255,255,255, 0.3)" }}>
            <MagnifyIcon style={{ width: 16, height: 16 }} />
          </Icon>
          <SInput
            size={3}
            data-test="topic-tree-filter-input"
            value={filterText}
            placeholder="Type to filter"
            onChange={(event) => setFilterText(event.target.value)}
            onKeyDown={onKeyDown}
            ref={filterTextFieldRef}
          />
        </SFilter>
        {rootTreeNode.providerAvailable && (
          <TopicViewModeSelector
            isXSWidth={isXSWidth}
            saveConfig={saveConfig}
            topicDisplayMode={topicDisplayMode}
          />
        )}
        {filterText.length === 0 && (
          <Icon
            dataTest="expand-all-icon"
            tooltip={topLevelNodesCollapsed ? "Expand all" : "Collapse all"}
            size="small"
            fade
            onClick={() => {
              saveConfig({ expandedKeys: topLevelNodesCollapsed ? allKeys : [] });
            }}
            style={headerRightIconStyle}
          >
            {topLevelNodesCollapsed ? <MoreIcon /> : <LessIcon />}
          </Icon>
        )}
        {filterText.length > 0 && (
          <Icon
            dataTest="clear-filter-icon"
            size="small"
            fade
            style={headerRightIconStyle}
            onClick={() => setFilterText("")}
          >
            <CloseIcon />
          </Icon>
        )}
        <Dropdown
          toggleComponent={
            <Icon size="small" fade style={headerRightIconStyle} tooltip="Sync settings">
              <SyncIcon />
            </Icon>
          }
        >
          <Item
            icon={<ArrowRightIcon />}
            tooltip="Set bag 2's topic settings and selected topics to bag 1's"
            onClick={() =>
              saveConfig(syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.bag1ToBag2))
            }
          >
            Sync bag 1 to bag 2
          </Item>
          <Item
            icon={<ArrowLeftIcon />}
            tooltip="Set bag 1's topic settings and selected topics to bag 2's"
            onClick={() =>
              saveConfig(syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.bag2ToBag1))
            }
          >
            Sync bag 2 to bag 1
          </Item>
          <Item
            icon={<SwapHorizontalIcon />}
            tooltip="Swap topic settings and selected topics between bag 1 and bag 2"
            onClick={() =>
              saveConfig(syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.swapBag1AndBag2))
            }
          >
            Swap bags 1 and 2
          </Item>
        </Dropdown>
      </STopicTreeHeader>
      {hasFeatureColumn && <DiffModeSettings enabled={diffModeEnabled} saveConfig={saveConfig} />}
      <div ref={scrollContainerRef} style={{ overflow: "auto", width: treeWidth }}>
        {showNoMatchesState ? (
          <SNoMatches>
            <NoMatchesSvg />
            <SNoMatchesText>No results found. Try searching a different term.</SNoMatchesText>
          </SNoMatches>
        ) : (
          <Tree
            treeData={renderTreeNodes({
              availableNamespacesByTopic,
              checkedKeysSet,
              children: (rootTreeNode as TreeGroupNode).children,
              getIsTreeNodeVisibleInScene,
              getIsTreeNodeVisibleInTree,
              getIsNamespaceCheckedByDefault,
              hasFeatureColumn,
              isXSWidth,
              onNamespaceOverrideColorChange,
              sceneErrorsByKey,
              setCurrentEditingTopic,
              derivedCustomSettingsByKey,
              topicDisplayMode,
              visibleTopicsCountByKey,
              width: treeWidth,
              filterText,
              linkedGlobalVariablesByTopic,
              diffModeEnabled: hasFeatureColumn && diffModeEnabled,
            })}
            height={treeHeight}
            itemHeight={ROW_HEIGHT}
            // Disable motion because it seems to cause a bug in the `rc-tree` (used under the hood by `antd` for
            // the tree). This bug would result in nodes no longer being rendered after a search.
            // eslint-disable-next-line no-restricted-syntax
            motion={null}
            selectable={false}
            onExpand={(newExpandedKeys) => {
              if (!shouldExpandAllKeys) {
                saveConfig({ expandedKeys: newExpandedKeys as string[] });
              }
            }}
            expandedKeys={shouldExpandAllKeys ? allKeys : expandedKeysRef.current}
            autoExpandParent={
              false
              /* Set autoExpandParent to true when filtering */
            }
            switcherIcon={
              <SSwitcherIcon style={filterText.length > 0 ? { visibility: "hidden" } : {}}>
                <ChevronDownIcon
                  fill="currentColor"
                  style={{ width: SWITCHER_ICON_SIZE, height: SWITCHER_ICON_SIZE }}
                />
              </SSwitcherIcon>
            }
          />
        )}
      </div>
    </STopicTreeInner>
  );
}

// A wrapper that can be resized horizontally, and it dynamically calculates the width of the base topic tree component.
function TopicTreeWrapper({
  containerWidth,
  containerHeight,
  pinTopics,
  showTopicTree,
  sceneErrorsByKey,
  saveConfig,
  setShowTopicTree,
  ...rest
}: Props) {
  const defaultTreeWidth = clamp(containerWidth, DEFAULT_XS_WIDTH, DEFAULT_WIDTH);
  const renderTopicTree = pinTopics || showTopicTree;

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref: sizeRef } = useResizeDetector({
    handleHeight: false,
    refreshRate: 0,
    refreshMode: "debounce",
  });

  return (
    <STopicTreeWrapper
      style={{ height: containerHeight - CONTAINER_SPACING * 3 }}
      className="ant-component"
    >
      <div
        ref={sizeRef}
        style={{
          width: defaultTreeWidth,
          resize: renderTopicTree ? "horizontal" : "none",
          overflow: renderTopicTree ? "hidden auto" : "visible",
          minWidth: DEFAULT_XS_WIDTH,
          maxWidth: containerWidth - 100,
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <TopicTreeSwitcher
          showErrorBadge={!renderTopicTree && Object.keys(sceneErrorsByKey).length > 0}
          pinTopics={pinTopics}
          renderTopicTree={renderTopicTree}
          saveConfig={saveConfig}
          setShowTopicTree={setShowTopicTree}
        />
        <CSSTransition
          timeout={150}
          in={renderTopicTree}
          classNames={{ ...topicTreeTransition }}
          mountOnEnter
          unmountOnExit
        >
          <STopicTree onClick={(e) => e.stopPropagation()}>
            <TopicTree
              {...rest}
              sceneErrorsByKey={sceneErrorsByKey}
              saveConfig={saveConfig}
              setShowTopicTree={setShowTopicTree}
              pinTopics={pinTopics}
              showTopicTree={showTopicTree}
              treeWidth={width ?? 0}
              treeHeight={
                containerHeight - SEARCH_BAR_HEIGHT - SWITCHER_HEIGHT - CONTAINER_SPACING * 2
              }
            />
          </STopicTree>
        </CSSTransition>
      </div>
    </STopicTreeWrapper>
  );
}

export default React.memo<Props>(TopicTreeWrapper);

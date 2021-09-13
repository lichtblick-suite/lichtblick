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

import { mergeStyleSets } from "@fluentui/react";
import ArrowLeftIcon from "@mdi/svg/svg/arrow-left.svg";
import ArrowRightIcon from "@mdi/svg/svg/arrow-right.svg";
import ChevronDownIcon from "@mdi/svg/svg/chevron-down.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import MagnifyIcon from "@mdi/svg/svg/magnify.svg";
import SwapHorizontalIcon from "@mdi/svg/svg/swap-horizontal.svg";
import SyncIcon from "@mdi/svg/svg/sync.svg";
import LessIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import MoreIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
import cx from "classnames";
import { clamp, groupBy } from "lodash";
import Tree from "rc-tree";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useResizeDetector } from "react-resize-detector";
import { CSSTransition } from "react-transition-group";

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

const classes = mergeStyleSets({
  wrapper: {
    position: "absolute",
    top: CONTAINER_SPACING,
    left: CONTAINER_SPACING,
    zIndex: 102,
    maxEidth: `${MAX_CONTAINER_WIDTH_RATIO * 100}%`,
    pointerEvents: "none", // Allow clicks right above the TopicTree to close it
  },
  tree: {
    position: "relative",
    color: colors.TEXT,
    borderRadius: "6px",
    backgroundColor: colors.DARK2,
    paddingBottom: "6px",
    maxWidth: "100%",
    overflow: "auto",
    pointerEvents: "auto",
    transition: "opacity 0.15s linear, transform 0.15s linear",
  },
  inner: {
    "rc-tree li ul": {
      padding: 0,
      paddingLeft: SWITCHER_WIDTH,
    },
    ".rc-tree-node-content-wrapper": {
      cursor: "unset",
    },
    /* Make the chevron icon transition nicely between pointing down and right. */
    ".rc-tree-switcher": {
      height: ROW_HEIGHT,
      transition: "transform 80ms ease-in-out",
    },
    ".rc-tree-switcher_close": {
      transform: "rotate(-90deg)",
    },
    ".rc-tree-switcher_open": {
      transform: "rotate(0deg)",
    },
    /* Hide the chevron switcher icon when it's not usable. */
    ".rc-tree-switcher-noop": {
      visibility: "hidden",
    },
    ".rc-tree-treenode": {
      display: "flex",
      padding: 0,

      "&:hover": {
        background: colors.DARK4,
      },
      "&.rc-tree-treenode-disabled": {
        color: colors.TEXT_MUTED,
        cursor: "unset",

        ".rc-tree-node-content-wrapper": {
          cursor: "unset",
        },
      },
      ".isXSWidth &": {
        padding: `0 ${TREE_SPACING}px`,
      },
    },
    ".rc-tree-indent": {
      width: "100%",
    },
    ".rc-tree-indent-unit": {
      width: 24,
    },
    ".rc-tree-treenode-switcher-close, .rc-tree-treenode-switcher-open": {
      ".rc-tree-node-content-wrapper": {
        padding: 0,
      },
    },
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    display: "flex",
    paddingLeft: 8,
    alignItems: "center",
    backgroundColor: colors.DARK5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  filter: {
    display: "flex",
    padding: "8px 4px",
    alignItems: "center",
    flex: 1,
  },
  input: {
    height: 24,
    background: "transparent",
    flex: 1,
    overflow: "auto",
    fontSize: 12,
    marginLeft: 4,
    padding: "4px 8px",
    minWidth: 80,
    border: "none",

    ":focus, :hover": {
      outline: "none",
      background: "transparent",
    },
  },
  icon: {
    width: SWITCHER_WIDTH,
    height: ROW_HEIGHT,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  noMatches: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 57,
    marginBottom: 74,
  },
  noMatchesText: {
    marginTop: 25,
    fontSize: 16,
    width: 205,
    textAlign: "center",
    lineHeight: "130%",
  },
});

const transitionClasses = mergeStyleSets({
  enter: {
    opacity: 0,
    transform: "translateX(-20px)",
    pointerEvents: "none",
  },
  exitActive: {
    opacity: 0,
    transform: "translateX(-20px)",
    pointerEvents: "none",
  },
  enterActive: {
    opacity: 1,
    transform: "none",
  },
});

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
  // eslint-disable-next-line @foxglove/no-boolean-parameters
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
  const hasRootNodeChanged = useChangeDetector([rootTreeNode], { initiallyTrue: false });
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
    <div className={cx(classes.inner, { isXSWidth })} style={{ width: treeWidth }}>
      <header className={classes.header}>
        <div className={classes.filter}>
          <Icon style={{ color: "rgba(255,255,255, 0.3)" }}>
            <MagnifyIcon style={{ width: 16, height: 16 }} />
          </Icon>
          <LegacyInput
            className={classes.input}
            size={3}
            data-test="topic-tree-filter-input"
            value={filterText}
            placeholder="Type to filter"
            onChange={(event) => setFilterText(event.target.value)}
            onKeyDown={onKeyDown}
            ref={filterTextFieldRef}
          />
        </div>
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
      </header>
      {hasFeatureColumn && <DiffModeSettings enabled={diffModeEnabled} saveConfig={saveConfig} />}
      <div ref={scrollContainerRef} style={{ overflow: "auto", width: treeWidth }}>
        {showNoMatchesState ? (
          <div className={classes.noMatches}>
            <NoMatchesSvg />
            <div className={classes.noMatchesText}>
              No results found. Try searching a different term.
            </div>
          </div>
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
              <div
                className={classes.icon}
                style={filterText.length > 0 ? { visibility: "hidden" } : {}}
              >
                <ChevronDownIcon
                  fill="currentColor"
                  style={{ width: SWITCHER_ICON_SIZE, height: SWITCHER_ICON_SIZE }}
                />
              </div>
            }
          />
        )}
      </div>
    </div>
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
    <div
      style={{ height: containerHeight - CONTAINER_SPACING * 3 }}
      className={cx("ant-component", classes.wrapper)}
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
          classNames={transitionClasses}
          mountOnEnter
          unmountOnExit
        >
          <div className={classes.tree} onClick={(e) => e.stopPropagation()}>
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
          </div>
        </CSSTransition>
      </div>
    </div>
  );
}

export default React.memo<Props>(TopicTreeWrapper);

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

import {
  DefaultButton,
  IconButton,
  IContextualMenuItemStyles,
  Stack,
  Text,
  TextField,
  Toggle,
  ITheme,
  IStackStyles,
  ITextFieldStyles,
  IButtonStyles,
  makeStyles,
  mergeStyleSets,
  useTheme,
} from "@fluentui/react";
import { clamp, groupBy } from "lodash";
import Tree from "rc-tree";
import React, { useCallback, useMemo, useRef } from "react";
import { useResizeDetector } from "react-resize-detector";
import { CSSTransition } from "react-transition-group";

import useChangeDetector from "@foxglove/studio-base/hooks/useChangeDetector";
import { Save3DConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz";
import useLinkedGlobalVariables from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import DiffModeIcon from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/DiffModeIcon";
import TopicTreeSwitcher, {
  SWITCHER_HEIGHT,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/TopicTreeSwitcher";
import {
  ROW_HEIGHT,
  TREE_SPACING,
  TOPIC_DISPLAY_MODES,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import NoMatchesSvg from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/noMatches.svg";
import renderTreeNodes, {
  SWITCHER_WIDTH,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/renderTreeNodes";
import { TopicDisplayMode } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/types";
import { syncBags, SYNC_OPTIONS } from "@foxglove/studio-base/panels/ThreeDimensionalViz/syncBags";

import {
  DerivedCustomSettingsByKey,
  GetIsNamespaceCheckedByDefault,
  GetIsTreeNodeVisibleInScene,
  GetIsTreeNodeVisibleInTree,
  NamespacesByTopic,
  OnNamespaceOverrideColorChange,
  SceneErrorsByKey,
  SetCurrentEditingTopic,
  TreeGroupNode,
  TreeNode,
  VisibleTopicsCountByKey,
} from "./types";

const CONTAINER_SPACING = 15;
const DEFAULT_WIDTH = 360;
const DEFAULT_XS_WIDTH = 240;
const SEARCH_BAR_HEIGHT = 40;
const MAX_CONTAINER_WIDTH_RATIO = 0.9;

const useStyles = makeStyles((theme) => ({
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
    color: theme.semanticColors.bodyText,
    borderRadius: theme.effects.roundedCorner4,
    backgroundColor: theme.semanticColors.bodyBackground,
    paddingBottom: theme.spacing.s1,
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

      ":hover": {
        background: theme.semanticColors.buttonBackgroundHovered,
      },
      ".isXSWidth &": {
        padding: `0 ${TREE_SPACING}px`,
      },
    },
    ".rc-tree-treenode.rc-tree-treenode-disabled": {
      color: theme.semanticColors.buttonTextDisabled,

      cursor: "unset",

      ".rc-tree-node-content-wrapper": {
        cursor: "unset",
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
}));

const useComponentStyles = (theme: ITheme) =>
  useMemo(
    () => ({
      header: {
        root: {
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: theme.semanticColors.buttonBackgroundHovered,
          borderTopLeftRadius: theme.effects.roundedCorner4,
          borderTopRightRadius: theme.effects.roundedCorner4,
        },
      } as Partial<IStackStyles>,

      input: {
        root: {
          width: "100%",
        },
        icon: {
          lineHeight: 0,
          color: theme.semanticColors.inputText,
          left: theme.spacing.s1,
          right: "auto",
          fontSize: 18,

          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
        field: {
          fontSize: theme.fonts.small.fontSize,
          lineHeight: 30,
          padding: `0 ${theme.spacing.l2}`,

          "::placeholder": {
            opacity: 0.6,
            fontSize: theme.fonts.small.fontSize,
            lineHeight: 30,
          },
        },
        fieldGroup: {
          backgroundColor: theme.semanticColors.bodyStandoutBackground,
          borderColor: theme.semanticColors.bodyDivider,

          ":hover, :focus": {
            backgroundColor: theme.semanticColors.bodyBackground,
          },
        },
      } as Partial<ITextFieldStyles>,

      clearIcon: {
        root: {
          position: "absolute",
          right: 0,
          transform: "translateX(-100%d)",
          zIndex: 2,
        },
        rootHovered: { backgroundColor: "transparent" },
        rootPressed: { backgroundColor: "transparent" },
        rootDisabled: { backgroundColor: "transparent" },
        icon: {
          color: theme.semanticColors.bodySubtext,

          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
      } as Partial<IButtonStyles>,

      topicDisplayMode: {
        flexContainer: {
          justifyContent: "space-between",
        },
        root: {
          fontSize: theme.fonts.small.fontSize,
          minWidth: 96,
          borderColor: theme.semanticColors.bodyDivider,
          backgroundColor: "transparent",
          padding: `0 ${theme.spacing.s1}`,
        },
        label: {
          fontWeight: 400,
          textAlign: "left",
        },
        rootHovered: { backgroundColor: theme.semanticColors.buttonBackgroundPressed },
        rootDisabled: { backgroundColor: "transparent" },
        menuIcon: {
          fontSize: 8,

          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
      } as Partial<IButtonStyles>,

      topicDisplayModeMenuItem: {
        root: {
          height: "auto",
          lineHeight: 32,
        },
        label: {
          fontSize: theme.fonts.small.fontSize,
        },
      } as Partial<IContextualMenuItemStyles>,

      expandIcon: {
        rootHovered: { backgroundColor: "transparent" },
        rootPressed: { backgroundColor: "transparent" },
        rootDisabled: { backgroundColor: "transparent" },
        icon: {
          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
      } as Partial<IButtonStyles>,

      syncIcon: {
        rootHovered: { backgroundColor: "transparent" },
        rootPressed: { backgroundColor: "transparent" },
        rootDisabled: { backgroundColor: "transparent" },
        menuIcon: {
          fontSize: 8,
          color: "white",

          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
        icon: {
          color: "white",

          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
      } as Partial<IButtonStyles>,

      syncMenuItem: {
        root: {
          height: "auto",
          lineHeight: "1.3",
        },
        linkContent: {
          flexDirection: "column",
          alignItems: "flex-start",
          padding: theme.spacing.s1,
          paddingLeft: theme.spacing.l2,
          position: "relative",
        },
        label: {
          display: "block",
          margin: 0,
          fontSize: theme.fonts.smallPlus.fontSize,
        },
        secondaryText: {
          textAlign: "left",
          paddingLeft: 0,
          fontSize: theme.fonts.xSmall.fontSize,
        },
        icon: {
          position: "absolute",
          left: 2,
          top: "50%",
          marginTop: "-0.5em",
          color: "white",

          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
      } as Partial<IContextualMenuItemStyles>,

      switcherIcon: {
        root: {
          height: 24,
          width: 24,
          color: "currentColor",
        },
        rootHovered: { backgroundColor: "transparent", color: "currentColor" },
        rootPressed: { backgroundColor: "transparent", color: "currentColor" },
        rootDisabled: { visibility: "hidden" }, // using the disabled state to toggle visibility
        icon: {
          fontSize: 12,

          svg: {
            fill: "currentColor",
            height: "1em",
            width: "1em",
          },
        },
      } as Partial<IButtonStyles>,
    }),
    [theme],
  );

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
  diffModeEnabled: boolean;
  rootTreeNode: TreeNode;
  saveConfig: Save3DConfig;
  sceneErrorsByKey: SceneErrorsByKey;
  setCurrentEditingTopic: SetCurrentEditingTopic;
  setFilterText: (arg0: string) => void;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setShowTopicTree: (arg0: boolean | ((arg0: boolean) => boolean)) => void;
  shouldExpandAllKeys: boolean;
  topicDisplayMode: TopicDisplayMode;
  visibleTopicsCountByKey: VisibleTopicsCountByKey;
};

type WrapperProps = SharedProps & {
  pinTopics: boolean;
  showTopicTree: boolean;
  containerHeight: number;
  containerWidth: number;
  onExitTopicTreeFocus: () => void;
};

type TopicTreeProps = SharedProps & {
  treeWidth: number;
  treeHeight: number;
};

const dropdownOptions = (Object.keys(TOPIC_DISPLAY_MODES) as TopicDisplayMode[]).map((key) => ({
  label: TOPIC_DISPLAY_MODES[key].label,
  value: TOPIC_DISPLAY_MODES[key].value,
}));

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
  diffModeEnabled,
  rootTreeNode,
  saveConfig,
  sceneErrorsByKey,
  setCurrentEditingTopic,
  setFilterText,
  setShowTopicTree,
  shouldExpandAllKeys,
  topicDisplayMode,
  treeHeight,
  treeWidth,
  visibleTopicsCountByKey,
}: TopicTreeProps) {
  const theme = useTheme();
  const classes = useStyles();
  const styles = useComponentStyles(theme);
  const scrollContainerRef = useRef<HTMLDivElement>(ReactNull);
  const checkedKeysSet = useMemo(() => new Set(checkedKeys), [checkedKeys]);

  // HACK: rc-tree does not auto expand dynamic tree nodes. Create a copy of expandedNodes
  // to ensure newly added nodes such as `uncategorized` are properly expanded:
  // https://github.com/ant-design/ant-design/issues/18012
  const expandedKeysRef = useRef(expandedKeys);
  const hasRootNodeChanged = useChangeDetector([rootTreeNode], { initiallyTrue: false });
  expandedKeysRef.current = hasRootNodeChanged ? [...expandedKeys] : expandedKeys;

  const topLevelNodesCollapsed = useMemo(() => {
    const topLevelChildren = rootTreeNode.type === "group" ? rootTreeNode.children : [];
    const topLevelKeys = topLevelChildren.map(({ key }) => key);
    return topLevelKeys.every((key) => !expandedKeys.includes(key));
  }, [expandedKeys, rootTreeNode]);

  const showNoMatchesState = !getIsTreeNodeVisibleInTree(rootTreeNode.key);

  const isXSWidth = treeWidth < DEFAULT_XS_WIDTH;

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
    <Stack className={classes.inner} styles={{ root: { width: treeWidth } }}>
      <Stack
        horizontal
        verticalAlign="center"
        styles={styles.header}
        tokens={{
          childrenGap: theme.spacing.s2,
          padding: theme.spacing.s2,
        }}
      >
        <Stack horizontal grow styles={{ root: { position: "relative" } }}>
          <TextField
            iconProps={{ iconName: "Search" }}
            data-test="topic-tree-filter-input"
            value={filterText}
            placeholder="Type to filter" // FIX ME: this should be "Search by Topic or Filter by topic"
            onChange={(_, newValue) => setFilterText(newValue ?? "")}
            onKeyDown={onKeyDown}
            autoFocus
            styles={styles.input}
          />
          {filterText.length > 0 && (
            <IconButton
              iconProps={{ iconName: "Close" }}
              data-test="clear-filter-icon"
              onClick={() => setFilterText("")}
              styles={styles.clearIcon}
            />
          )}
        </Stack>
        <DefaultButton
          disabled={!rootTreeNode.providerAvailable}
          menuIconProps={{ iconName: "CaretSolidDown" }}
          menuProps={{
            items: dropdownOptions.map(({ label, value }) => ({
              key: value,
              text: label,
              onClick: () => saveConfig({ topicDisplayMode: value }),
              checked: true,
            })),
            useTargetWidth: true,
            styles: { subComponentStyles: { menuItem: styles.topicDisplayModeMenuItem } },
          }}
          styles={styles.topicDisplayMode}
          text={TOPIC_DISPLAY_MODES[topicDisplayMode].label}
        />
        <IconButton
          data-test="expand-all-icon"
          disabled={!rootTreeNode.providerAvailable || filterText.length !== 0}
          iconProps={{ iconName: topLevelNodesCollapsed ? "UnfoldMore" : "UnfoldLess" }}
          onClick={() => {
            saveConfig({ expandedKeys: topLevelNodesCollapsed ? allKeys : [] });
          }}
          styles={styles.expandIcon}
          title={topLevelNodesCollapsed ? "Expand all" : "Collapse all"}
        />
        {hasFeatureColumn && (
          <IconButton
            iconProps={{ iconName: "Sync" }}
            menuIconProps={{ iconName: "CaretSolidDown" }}
            menuProps={{
              items: [
                {
                  key: "bag1ToBag2",
                  text: "Sync bag 1 to bag 2",
                  secondaryText: "Set bag 2's topic settings and selected topics to bag 1's",
                  iconProps: { iconName: "ArrowStepLeft" },
                  onClick: () =>
                    saveConfig(syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.bag1ToBag2)),
                },
                {
                  key: "bag2ToBag1",
                  text: "Sync bag 2 to bag 1",
                  secondaryText: "Set bag 1's topic settings and selected topics to bag 2's",
                  iconProps: { iconName: "ArrowStepRight" },
                  onClick: () =>
                    saveConfig(syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.bag2ToBag1)),
                },
                {
                  key: "swapBag1AndBag2",
                  text: "Swap bags 1 and 2",
                  secondaryText: "Swap topic settings and selected topics between bag 1 and bag 2",
                  iconProps: { iconName: "SwapHorizontal" },
                  onClick: () =>
                    saveConfig(
                      syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.swapBag1AndBag2),
                    ),
                },
              ],
              styles: {
                subComponentStyles: {
                  menuItem: styles.syncMenuItem,
                },
              },
            }}
            styles={styles.syncIcon}
          />
        )}
      </Stack>
      {hasFeatureColumn && (
        <Stack
          horizontal
          horizontalAlign="space-between"
          verticalAlign="center"
          tokens={{ padding: `${theme.spacing.s2} ${theme.spacing.s1}` }}
        >
          <Toggle
            onChange={() => saveConfig({ diffModeEnabled: !diffModeEnabled })}
            checked={diffModeEnabled}
            label="Show diff"
            inlineLabel
            styles={{
              label: { marginLeft: theme.spacing.s1 },
              root: { marginBottom: 0 },
            }}
          />
          {diffModeEnabled && <DiffModeIcon />}
        </Stack>
      )}
      <div ref={scrollContainerRef} style={{ overflow: "auto", width: treeWidth }}>
        {showNoMatchesState ? (
          <Stack
            verticalAlign="center"
            horizontalAlign="center"
            tokens={{
              padding: `${theme.spacing.l2} 0 ${theme.spacing.l1}`,
              childrenGap: theme.spacing.m,
            }}
          >
            <NoMatchesSvg />
            <Text variant="smallPlus" styles={{ root: { textAlign: "center", lineHeight: "1.3" } }}>
              No results found.
              <br />
              Try searching a different term.
            </Text>
          </Stack>
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
              // Set autoExpandParent to true when filtering
            }
            switcherIcon={
              <IconButton
                disabled={filterText.length > 0}
                iconProps={{ iconName: "ChevronDownSmall" }}
                styles={styles.switcherIcon}
              />
            }
          />
        )}
      </div>
    </Stack>
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
}: WrapperProps) {
  const classes = useStyles();
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
    <div className={classes.wrapper} style={{ height: containerHeight - CONTAINER_SPACING * 3 }}>
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

export default React.memo<WrapperProps>(TopicTreeWrapper);

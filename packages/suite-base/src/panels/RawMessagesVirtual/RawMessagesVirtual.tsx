// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { Checkbox, FormControlLabel, Typography, useTheme } from "@mui/material";
import * as _ from "lodash-es";
import { useCallback, useMemo, useRef } from "react";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import Stack from "@lichtblick/suite-base/components/Stack";
import MaybeCollapsedValue from "@lichtblick/suite-base/panels/RawMessagesCommon/MaybeCollapsedValue";
import Metadata from "@lichtblick/suite-base/panels/RawMessagesCommon/Metadata";
import { Toolbar } from "@lichtblick/suite-base/panels/RawMessagesCommon/Toolbar";
import {
  CUSTOM_METHOD,
  PATH_NAME_AGGREGATOR,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import getDiff from "@lichtblick/suite-base/panels/RawMessagesCommon/getDiff";
import { useStylesRawMessagesVirtual } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import {
  NodeState,
  PropsRawMessagesVirtual,
  TreeNode,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import { useFontSizeSettings } from "@lichtblick/suite-base/panels/RawMessagesCommon/useFontSizeSettings";
import {
  useRenderDiffLabel,
  useValueRenderer,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/useRenderers";
import { useSharedRawMessagesLogic } from "@lichtblick/suite-base/panels/RawMessagesCommon/useSharedRawMessagesLogic";
import {
  dataWithoutWrappingArray,
  getSingleValue,
  getValueString,
  isSingleElemArray,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/utils";
import { VirtualizedTree } from "@lichtblick/suite-base/panels/RawMessagesVirtual/VirtualizedTree";

const RawMessagesVirtual = (props: PropsRawMessagesVirtual): React.JSX.Element => {
  const {
    palette: { mode: _themePreference },
  } = useTheme();
  const { classes } = useStylesRawMessagesVirtual();
  const { config, saveConfig } = props;
  const { openSiblingPanel } = usePanelContext();
  const { topicPath, diffMethod, diffTopicPath, diffEnabled, showFullMessageForDiff, fontSize } =
    config;
  const { datatypes } = useDataSourceInfo();

  const {
    topic,
    rootStructureItem,
    baseItem,
    diffItem,
    expansion,
    canExpandAll,
    onTopicPathChange,
    onDiffTopicPathChange,
    onToggleDiff,
    onToggleExpandAll,
    onLabelClick,
  } = useSharedRawMessagesLogic({
    config,
    saveConfig,
  });

  const valueRenderer = useValueRenderer({
    datatypes,
    hoverObserverClassName: classes.hoverObserver,
    onTopicPathChange,
    openSiblingPanel,
  });

  const renderDiffLabel = useRenderDiffLabel({
    onTopicPathChange,
    openSiblingPanel,
  });

  // VirtualizedTree-specific logic
  const handleToggleExpand = useCallback(
    (keyPath: string) => {
      onLabelClick(
        keyPath.split(PATH_NAME_AGGREGATOR).map((key) => {
          const num = Number(key);
          return Number.isNaN(num) ? key : num;
        }),
      );
    },
    [onLabelClick],
  );
  const baseItemRef = useRef(baseItem);
  baseItemRef.current = baseItem;

  const expandedNodesSet = useMemo(() => {
    if (expansion === "all") {
      if (!baseItemRef.current) {
        return new Set<string>();
      }

      const data = dataWithoutWrappingArray(
        baseItemRef.current.queriedData.map(({ value }) => value),
      );

      const allNodes = new Set<string>();

      const generatePaths = (obj: unknown, prefix: string = "") => {
        if (obj == undefined || typeof obj !== "object") {
          return;
        }
        const entries = Array.isArray(obj)
          ? obj.map((item, index) => [index, item] as [number, unknown])
          : Object.entries(obj);

        for (const [key, value] of entries) {
          const nodePath = prefix ? `${key}${PATH_NAME_AGGREGATOR}${prefix}` : String(key);
          allNodes.add(nodePath);

          if (value != undefined && typeof value === "object" && !ArrayBuffer.isView(value)) {
            generatePaths(value, nodePath);
          }
        }
      };

      generatePaths(data);

      return allNodes;
    }

    if (expansion === "none") {
      return new Set<string>();
    }

    const expanded = new Set<string>();
    if (typeof expansion === "object") {
      for (const [key, state] of Object.entries(expansion)) {
        if (state === NodeState.Expanded) {
          expanded.add(key);
        }
      }
    }
    return expanded;
  }, [expansion]);

  const hideWrappingArrayRef = useRef(false);

  const memoizedRenderValue = useCallback(
    (node: TreeNode, data: unknown) => {
      const valueString = getValueString(node.value);

      if (diffEnabled) {
        return renderDiffLabel(valueString, node.value);
      }

      return valueRenderer(
        rootStructureItem,
        hideWrappingArrayRef.current ? [data] : (data as unknown[]),
        baseItem?.queriedData ?? [],
        valueString,
        node.value,
        ...node.keyPath,
        ...(hideWrappingArrayRef.current ? [0] : []),
      );
    },
    [diffEnabled, renderDiffLabel, valueRenderer, rootStructureItem, baseItem],
  );

  const renderSingleTopicOrDiffOutput = useCallback(() => {
    if (topicPath.length === 0) {
      return <EmptyState>No topic selected</EmptyState>;
    }
    if (diffEnabled && diffMethod === CUSTOM_METHOD && (!baseItem || !diffItem)) {
      return (
        <EmptyState>{`Waiting to diff next messages from "${topicPath}" and "${diffTopicPath}"`}</EmptyState>
      );
    }

    if (!baseItem) {
      return <EmptyState>Waiting for next message…</EmptyState>;
    }

    const { messageEvent, queriedData } = baseItem;

    const data = dataWithoutWrappingArray(queriedData.map(({ value }) => value));

    hideWrappingArrayRef.current =
      queriedData.length === 1 && typeof queriedData[0]?.value === "object";

    const shouldDisplaySingleVal =
      (data != undefined && typeof data !== "object") ||
      (isSingleElemArray(data) && data[0] != undefined && typeof data[0] !== "object");

    const singleVal = getSingleValue(data, queriedData);

    const diffData =
      diffItem && dataWithoutWrappingArray(diffItem.queriedData.map(({ value }) => value));

    const diff = diffEnabled
      ? getDiff({
          before: data,
          after: diffData,
          idLabel: undefined,
          showFullMessageForDiff,
        })
      : {};

    const renderContent = () => {
      if (shouldDisplaySingleVal) {
        return (
          <Typography
            variant="body1"
            fontSize={fontSize}
            whiteSpace="pre-wrap"
            style={{ wordWrap: "break-word" }}
          >
            <MaybeCollapsedValue itemLabel={String(singleVal)} />
          </Typography>
        );
      }

      if (diffEnabled && _.isEqual({}, diff)) {
        return <EmptyState>No difference found</EmptyState>;
      }

      return (
        <>
          {diffEnabled && (
            <FormControlLabel
              disableTypography
              checked={showFullMessageForDiff}
              control={
                <Checkbox
                  size="small"
                  defaultChecked
                  onChange={() => {
                    saveConfig({ showFullMessageForDiff: !showFullMessageForDiff });
                  }}
                />
              }
              label="Show full message"
            />
          )}
          <VirtualizedTree
            data={diffEnabled ? diff : data}
            expandedNodes={expandedNodesSet}
            onToggleExpand={handleToggleExpand}
            fontSize={fontSize}
            renderValue={(node: TreeNode) => memoizedRenderValue(node, data)}
          />
        </>
      );
    };

    return (
      <Stack
        className={classes.topic}
        flex="auto"
        overflowX="hidden"
        paddingLeft={0.75}
        data-testid="panel-scroll-container"
      >
        <Metadata
          data={data}
          diffData={diffData}
          diff={diff}
          message={messageEvent}
          {...(topic ? { datatype: topic.schemaName } : undefined)}
          {...(diffItem ? { diffMessage: diffItem.messageEvent } : undefined)}
        />
        {renderContent()}
      </Stack>
    );
  }, [
    baseItem,
    classes.topic,
    fontSize,
    diffEnabled,
    diffItem,
    diffMethod,
    diffTopicPath,
    expandedNodesSet,
    handleToggleExpand,
    memoizedRenderValue,
    saveConfig,
    showFullMessageForDiff,
    topic,
    topicPath,
  ]);

  // Setup font size settings in panel settings tree
  useFontSizeSettings(fontSize, saveConfig);

  return (
    <Stack flex="auto" overflow="hidden" position="relative">
      <Toolbar
        canExpandAll={canExpandAll}
        diffEnabled={diffEnabled}
        diffMethod={diffMethod}
        diffTopicPath={diffTopicPath}
        onDiffTopicPathChange={onDiffTopicPathChange}
        onToggleDiff={onToggleDiff}
        onToggleExpandAll={onToggleExpandAll}
        onTopicPathChange={onTopicPathChange}
        saveConfig={saveConfig}
        topicPath={topicPath}
      />
      {renderSingleTopicOrDiffOutput()}
    </Stack>
  );
};

export default RawMessagesVirtual;

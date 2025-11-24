// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Checkbox, FormControlLabel, Typography, useTheme } from "@mui/material";
import * as _ from "lodash-es";
import { useCallback, useEffect, useMemo } from "react";

import { SettingsTreeAction } from "@lichtblick/suite";
import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import Panel from "@lichtblick/suite-base/components/Panel";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import Stack from "@lichtblick/suite-base/components/Stack";
import MaybeCollapsedValue from "@lichtblick/suite-base/panels/RawMessagesCommon/MaybeCollapsedValue";
import Metadata from "@lichtblick/suite-base/panels/RawMessagesCommon/Metadata";
import { Toolbar } from "@lichtblick/suite-base/panels/RawMessagesCommon/Toolbar";
import {
  CUSTOM_METHOD,
  FONT_SIZE_OPTIONS,
  PATH_NAME_AGGREGATOR,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import getDiff from "@lichtblick/suite-base/panels/RawMessagesCommon/getDiff";
import { useStylesRawMessagesTwo } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import {
  NodeState,
  PropsRawMessagesTwo,
  RawMessagesTwoPanelConfig,
  TreeNode,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
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
import { VirtualizedTree } from "@lichtblick/suite-base/panels/RawMessagesTwo/VirtualizedTree";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";

function RawMessagesTwo(props: PropsRawMessagesTwo) {
  const {
    palette: { mode: _themePreference },
  } = useTheme();
  const { classes } = useStylesRawMessagesTwo();
  const { config, saveConfig } = props;
  const { openSiblingPanel } = usePanelContext();
  const { topicPath, diffMethod, diffTopicPath, diffEnabled, showFullMessageForDiff, fontSize } =
    config;
  const { datatypes } = useDataSourceInfo();
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

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
  const expandedNodesSet = useMemo(() => {
    if (expansion === "all") {
      if (baseItem) {
        const data = dataWithoutWrappingArray(baseItem.queriedData.map(({ value }) => value));
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
      return new Set<string>();
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
  }, [expansion, baseItem]);

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

    const data = dataWithoutWrappingArray(baseItem.queriedData.map(({ value }) => value));
    const hideWrappingArray =
      baseItem.queriedData.length === 1 && typeof baseItem.queriedData[0]?.value === "object";
    const shouldDisplaySingleVal =
      (data != undefined && typeof data !== "object") ||
      (isSingleElemArray(data) && data[0] != undefined && typeof data[0] !== "object");
    const singleVal = getSingleValue(data, baseItem.queriedData);

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
          message={baseItem.messageEvent}
          {...(topic ? { datatype: topic.schemaName } : undefined)}
          {...(diffItem ? { diffMessage: diffItem.messageEvent } : undefined)}
        />
        {shouldDisplaySingleVal ? (
          <Typography
            variant="body1"
            fontSize={fontSize}
            whiteSpace="pre-wrap"
            style={{ wordWrap: "break-word" }}
          >
            <MaybeCollapsedValue itemLabel={String(singleVal)} />
          </Typography>
        ) : diffEnabled && _.isEqual({}, diff) ? (
          <EmptyState>No difference found</EmptyState>
        ) : (
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
                label="Show full msg"
              />
            )}
            <VirtualizedTree
              data={diffEnabled ? diff : data}
              expandedNodes={expandedNodesSet}
              onToggleExpand={(keyPath) => {
                onLabelClick(
                  keyPath.split(PATH_NAME_AGGREGATOR).map((k) => {
                    const num = Number(k);
                    return Number.isNaN(num) ? k : num;
                  }),
                );
              }}
              fontSize={fontSize}
              renderValue={(node: TreeNode) => {
                const valueString = getValueString(node.value);

                if (diffEnabled) {
                  return renderDiffLabel(valueString, node.value);
                }
                if (hideWrappingArray) {
                  return valueRenderer(
                    rootStructureItem,
                    [data],
                    baseItem.queriedData,
                    valueString,
                    node.value,
                    ...node.keyPath,
                    0,
                  );
                }
                return valueRenderer(
                  rootStructureItem,
                  data as unknown[],
                  baseItem.queriedData,
                  valueString,
                  node.value,
                  ...node.keyPath,
                );
              }}
            />
          </>
        )}
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
    onLabelClick,
    renderDiffLabel,
    rootStructureItem,
    saveConfig,
    showFullMessageForDiff,
    topic,
    topicPath,
    valueRenderer,
  ]);

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        if (action.payload.path[0] === "general") {
          if (action.payload.path[1] === "fontSize") {
            saveConfig({
              fontSize:
                action.payload.value != undefined ? (action.payload.value as number) : undefined,
            });
          }
        }
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: {
        general: {
          label: "General",
          fields: {
            fontSize: {
              label: "Font size",
              input: "select",
              options: [
                { label: "auto", value: undefined },
                ...FONT_SIZE_OPTIONS.map((value) => ({
                  label: `${value} px`,
                  value,
                })),
              ],
              value: fontSize,
            },
          },
        },
      },
    });
  }, [actionHandler, fontSize, updatePanelSettingsTree]);

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
}

const defaultConfig: RawMessagesTwoPanelConfig = {
  diffEnabled: false,
  diffMethod: CUSTOM_METHOD,
  diffTopicPath: "",
  showFullMessageForDiff: false,
  topicPath: "",
  fontSize: undefined,
};

export default Panel(
  Object.assign(RawMessagesTwo, {
    panelType: "RawMessagesTwo",
    defaultConfig,
  }),
);

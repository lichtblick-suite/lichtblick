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

import DiffIcon from "@mui/icons-material/Difference";
import DiffOutlinedIcon from "@mui/icons-material/DifferenceOutlined";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  useTheme,
  Typography,
} from "@mui/material";
import { Immutable } from "immer";
// eslint-disable-next-line no-restricted-imports
import { first, isEqual, get, last, padStart } from "lodash";
import { useState, useCallback, useMemo, useEffect } from "react";
import ReactHoverObserver from "react-hover-observer";
import Tree from "react-json-tree";
import { useLatest } from "react-use";
import { makeStyles } from "tss-react/mui";

import { SettingsTreeAction } from "@foxglove/studio";
import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import useGetItemStringWithTimezone from "@foxglove/studio-base/components/JsonTree/useGetItemStringWithTimezone";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import {
  RosPath,
  MessagePathStructureItem,
} from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import {
  messagePathStructures,
  traverseStructure,
} from "@foxglove/studio-base/components/MessagePathSyntax/messagePathsForDatatype";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { MessagePathDataItem } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessageDataItem } from "@foxglove/studio-base/components/MessagePathSyntax/useMessageDataItem";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import getDiff, {
  diffLabels,
  diffLabelsByLabelText,
  DiffObject,
} from "@foxglove/studio-base/panels/RawMessages/getDiff";
import { Topic } from "@foxglove/studio-base/players/types";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";
import { enumValuesByDatatypeAndField } from "@foxglove/studio-base/util/selectors";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import DiffSpan from "./DiffSpan";
import MaybeCollapsedValue from "./MaybeCollapsedValue";
import Metadata from "./Metadata";
import Value from "./Value";
import {
  ValueAction,
  getValueActionForValue,
  getStructureItemForPath,
} from "./getValueActionForValue";
import helpContent from "./index.help.md";
import { buildSettingsTree } from "./settings";
import { RawMessagesPanelConfig } from "./types";
import { DATA_ARRAY_PREVIEW_LIMIT, generateDeepKeyPaths, getItemStringForDiff } from "./utils";

export const CUSTOM_METHOD = "custom";
export const PREV_MSG_METHOD = "previous message";

type Props = {
  config: Immutable<RawMessagesPanelConfig>;
  saveConfig: SaveConfig<RawMessagesPanelConfig>;
};

const isSingleElemArray = (obj: unknown): obj is unknown[] => {
  if (!Array.isArray(obj)) {
    return false;
  }
  return obj.filter((a) => a != undefined).length === 1;
};
const dataWithoutWrappingArray = (data: unknown) => {
  return isSingleElemArray(data) && typeof data[0] === "object" ? data[0] : data;
};

// lazy messages don't have own properties so we need to invoke "toJSON" to get the message
// as a regular object
function maybeDeepParse(val: unknown) {
  if (typeof val === "object" && val != undefined && "toJSON" in val) {
    return (val as { toJSON: () => unknown }).toJSON();
  }
  return val;
}

const useStyles = makeStyles()((theme) => ({
  iconButton: {
    "&.MuiIconButton-root": {
      padding: theme.spacing(0.25),
    },
  },
  topic: {
    fontFamily: fonts.SANS_SERIF,
    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, "zero"`,
  },
  hoverObserver: {
    display: "inline-flex",
    alignItems: "center",
  },
}));

function RawMessages(props: Props) {
  const {
    palette: { mode: themePreference },
  } = useTheme();
  const { classes } = useStyles();
  const jsonTreeTheme = useJsonTreeTheme();
  const { config, saveConfig } = props;
  const { openSiblingPanel } = usePanelContext();
  const { topicPath, diffMethod, diffTopicPath, diffEnabled, showFullMessageForDiff } = config;
  const { topics, datatypes } = useDataSourceInfo();

  const defaultGetItemString = useGetItemStringWithTimezone();
  const getItemString = useMemo(
    () =>
      diffEnabled
        ? (type: string, data: DiffObject, itemType: React.ReactNode) =>
            getItemStringForDiff({
              type,
              data,
              itemType,
              isInverted: themePreference === "dark",
            })
        : defaultGetItemString,
    [defaultGetItemString, diffEnabled, themePreference],
  );

  const topicRosPath: RosPath | undefined = useMemo(() => parseRosPath(topicPath), [topicPath]);
  const topic: Topic | undefined = useMemo(
    () => topicRosPath && topics.find(({ name }) => name === topicRosPath.topicName),
    [topicRosPath, topics],
  );
  const rootStructureItem: MessagePathStructureItem | undefined = useMemo(() => {
    if (!topic || !topicRosPath) {
      return;
    }
    return traverseStructure(
      messagePathStructures(datatypes)[topic.datatype],
      topicRosPath.messagePath,
    ).structureItem;
  }, [datatypes, topic, topicRosPath]);

  // When expandAll is unset, we'll use expandedFields to get expanded info
  const [expandAll, setExpandAll] = useState<boolean | undefined>(config.autoExpandMode === "all");
  const [expandedFields, setExpandedFields] = useState(new Set<string>());

  const matchedMessages = useMessageDataItem(topicPath, { historySize: 2 });
  const diffMessages = useMessageDataItem(diffEnabled ? diffTopicPath : "");

  const diffTopicObj = diffMessages[0];
  const currTickObj = matchedMessages[matchedMessages.length - 1];
  const prevTickObj = matchedMessages[matchedMessages.length - 2];

  const inTimetickDiffMode = diffEnabled && diffMethod === PREV_MSG_METHOD;
  const baseItem = inTimetickDiffMode ? prevTickObj : currTickObj;
  const diffItem = inTimetickDiffMode ? currTickObj : diffTopicObj;

  const latestExpandedFields = useLatest(expandedFields);

  useEffect(() => {
    if (latestExpandedFields.current.size === 0 && baseItem && config.autoExpandMode === "auto") {
      const data = dataWithoutWrappingArray(baseItem.queriedData.map(({ value }) => value));
      const newExpandedFields = generateDeepKeyPaths(maybeDeepParse(data), 5);
      setExpandedFields(newExpandedFields);
      setExpandAll(undefined);
    } else if (config.autoExpandMode === "all") {
      setExpandedFields(new Set());
      setExpandAll(true);
    }
  }, [baseItem, config.autoExpandMode, latestExpandedFields]);

  const updateSettingsTree = usePanelSettingsTreeUpdate();

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      if (action.payload.input === "select") {
        saveConfig({
          autoExpandMode: action.payload.value as RawMessagesPanelConfig["autoExpandMode"],
        });
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updateSettingsTree({
      actionHandler: settingsActionHandler,
      nodes: buildSettingsTree(config),
    });
  }, [config, settingsActionHandler, updateSettingsTree]);

  const onTopicPathChange = useCallback(
    (newTopicPath: string) => {
      saveConfig({ topicPath: newTopicPath });
    },
    [saveConfig],
  );

  const onDiffTopicPathChange = useCallback(
    (newDiffTopicPath: string) => {
      saveConfig({ diffTopicPath: newDiffTopicPath });
    },
    [saveConfig],
  );

  const onToggleDiff = useCallback(() => {
    saveConfig({ diffEnabled: !diffEnabled });
  }, [diffEnabled, saveConfig]);

  const onToggleExpandAll = useCallback(() => {
    setExpandedFields(new Set());
    setExpandAll((currVal) => !(currVal ?? false));
  }, []);

  const onLabelClick = useCallback(
    (keypath: (string | number)[]) => {
      // Create a unique key according to the keypath / raw
      const key = keypath.join("~");
      const expandedFieldsCopy = new Set(expandedFields);
      if (expandedFieldsCopy.has(key)) {
        expandedFieldsCopy.delete(key);
        setExpandedFields(expandedFieldsCopy);
      } else {
        expandedFieldsCopy.add(key);
        setExpandedFields(expandedFieldsCopy);
      }
      setExpandAll(undefined);
    },
    [expandedFields],
  );

  const getValueLabels = useCallback(
    ({
      constantName,
      label,
      itemValue,
      keyPath,
    }: {
      constantName: string | undefined;
      label: string;
      itemValue: unknown;
      keyPath: ReadonlyArray<number | string>;
    }): { arrLabel: string; itemLabel: string } => {
      let itemLabel = label;
      if (typeof itemValue === "bigint") {
        itemLabel = itemValue.toString();
      }
      // output preview for the first x items if the data is in binary format
      // sample output: Int8Array(331776) [-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, ...]
      let arrLabel = "";
      if (ArrayBuffer.isView(itemValue)) {
        const array = itemValue as Uint8Array;
        const itemPart = array.slice(0, DATA_ARRAY_PREVIEW_LIMIT).join(", ");
        const length = array.length;
        arrLabel = `(${length}) [${itemPart}${length >= DATA_ARRAY_PREVIEW_LIMIT ? ", ..." : ""}] `;
        itemLabel = itemValue.constructor.name;
      }
      if (constantName != undefined) {
        itemLabel = `${itemLabel} (${constantName})`;
      }

      // When we encounter a nsec field (nanosecond) that is a number, we ensure the label displays 9 digits.
      // This helps when visually scanning time values from `sec` and `nsec` fields.
      // A nanosecond label of 099999999 makes it easier to realize this is 0.09 seconds compared to
      // 99999999 which requires some counting to reamize this is also 0.09
      if (keyPath[0] === "nsec" && typeof itemValue === "number") {
        itemLabel = padStart(itemLabel, 9, "0");
      }

      return { arrLabel, itemLabel };
    },
    [],
  );

  const renderDiffLabel = useCallback(
    (label: string, itemValue: unknown) => {
      let constantName: string | undefined;
      const { arrLabel, itemLabel } = getValueLabels({
        constantName,
        label,
        itemValue,
        keyPath: [],
      });
      return (
        <Value
          arrLabel={arrLabel}
          basePath=""
          itemLabel={itemLabel}
          itemValue={itemValue}
          valueAction={undefined}
          onTopicPathChange={onTopicPathChange}
          openSiblingPanel={openSiblingPanel}
        />
      );
    },
    [getValueLabels, onTopicPathChange, openSiblingPanel],
  );

  const valueRenderer = useCallback(
    (
      structureItem: MessagePathStructureItem | undefined,
      data: unknown[],
      queriedData: MessagePathDataItem[],
      label: string,
      itemValue: unknown,
      ...keyPath: (number | string)[]
    ) => (
      <ReactHoverObserver className={classes.hoverObserver}>
        {({ isHovering }: { isHovering: boolean }) => {
          const lastKeyPath = last(keyPath) as number;
          let valueAction: ValueAction | undefined;
          if (isHovering && structureItem) {
            valueAction = getValueActionForValue(
              data[lastKeyPath],
              structureItem,
              keyPath.slice(0, -1).reverse(),
            );
          }

          let constantName: string | undefined;
          if (structureItem) {
            const childStructureItem = getStructureItemForPath(
              structureItem,
              keyPath.slice(0, -1).reverse().join(","),
            );
            if (childStructureItem) {
              const field = keyPath[0];
              if (typeof field === "string") {
                const enumMapping = enumValuesByDatatypeAndField(datatypes);
                const datatype = childStructureItem.datatype;
                constantName = enumMapping[datatype]?.[field]?.[String(itemValue)];
              }
            }
          }
          const basePath = queriedData[lastKeyPath]?.path ?? "";
          const { arrLabel, itemLabel } = getValueLabels({
            constantName,
            label,
            itemValue,
            keyPath,
          });

          return (
            <Value
              arrLabel={arrLabel}
              basePath={basePath}
              itemLabel={itemLabel}
              itemValue={itemValue}
              valueAction={valueAction}
              onTopicPathChange={onTopicPathChange}
              openSiblingPanel={openSiblingPanel}
            />
          );
        }}
      </ReactHoverObserver>
    ),
    [classes.hoverObserver, datatypes, getValueLabels, onTopicPathChange, openSiblingPanel],
  );

  const renderSingleTopicOrDiffOutput = useCallback(() => {
    const shouldExpandNode = (keypath: (string | number)[]) => {
      if (expandAll != undefined) {
        return expandAll;
      }

      return expandedFields.has(keypath.join("~"));
    };

    if (topicPath.length === 0) {
      return <EmptyState>No topic selected</EmptyState>;
    }
    if (diffEnabled && diffMethod === CUSTOM_METHOD && (!baseItem || !diffItem)) {
      return (
        <EmptyState>{`Waiting to diff next messages from "${topicPath}" and "${diffTopicPath}"`}</EmptyState>
      );
    }

    if (!baseItem) {
      return <EmptyState>Waiting for next message</EmptyState>;
    }

    const data = dataWithoutWrappingArray(baseItem.queriedData.map(({ value }) => value));
    const hideWrappingArray =
      baseItem.queriedData.length === 1 && typeof baseItem.queriedData[0]?.value === "object";
    const shouldDisplaySingleVal =
      (data != undefined && typeof data !== "object") ||
      (isSingleElemArray(data) && data[0] != undefined && typeof data[0] !== "object");
    const singleVal = isSingleElemArray(data) ? data[0] : data;

    const diffData =
      diffItem && dataWithoutWrappingArray(diffItem.queriedData.map(({ value }) => value));

    // json parse/stringify round trip is used to deep parse data and diff data which may be lazy messages
    // lazy messages have non-enumerable getters but do have a toJSON method to turn themselves into an object
    const diff = diffEnabled
      ? getDiff({
          before: maybeDeepParse(data),
          after: maybeDeepParse(diffData),
          idLabel: undefined,
          showFullMessageForDiff,
        })
      : {};

    return (
      <Stack className={classes.topic} flex="auto" overflowX="hidden" paddingLeft={0.75}>
        <Metadata
          data={data}
          diffData={diffData}
          diff={diff}
          message={baseItem.messageEvent}
          {...(topic ? { datatype: topic.datatype } : undefined)}
          {...(diffItem ? { diffMessage: diffItem.messageEvent } : undefined)}
        />
        {shouldDisplaySingleVal ? (
          <Typography
            variant="h1"
            fontWeight="bold"
            whiteSpace="pre-line"
            style={{ wordWrap: "break-word" }}
          >
            <MaybeCollapsedValue itemLabel={String(singleVal)} />
          </Typography>
        ) : diffEnabled && isEqual({}, diff) ? (
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
                    onChange={() => saveConfig({ showFullMessageForDiff: !showFullMessageForDiff })}
                  />
                }
                label="Show full msg"
              />
            )}
            <Tree
              labelRenderer={(raw) => (
                <>
                  <DiffSpan>{first(raw)}</DiffSpan>
                  {/* https://stackoverflow.com/questions/62319014/make-text-selection-treat-adjacent-elements-as-separate-words */}
                  <span style={{ fontSize: 0 }}>&nbsp;</span>
                </>
              )}
              shouldExpandNode={shouldExpandNode}
              onExpand={(_data, _level, keyPath) => {
                onLabelClick(keyPath);
              }}
              onCollapse={(_data, _level, keyPath) => {
                onLabelClick(keyPath);
              }}
              hideRoot
              invertTheme={false}
              getItemString={getItemString}
              valueRenderer={(valueAsString: string, value, ...keyPath) => {
                if (diffEnabled) {
                  return renderDiffLabel(valueAsString, value);
                }
                if (hideWrappingArray) {
                  // When the wrapping array is hidden, put it back here.
                  return valueRenderer(
                    rootStructureItem,
                    [data],
                    baseItem.queriedData,
                    valueAsString,
                    value,
                    ...keyPath,
                    0,
                  );
                }

                return valueRenderer(
                  rootStructureItem,
                  data as unknown[],
                  baseItem.queriedData,
                  valueAsString,
                  value,
                  ...keyPath,
                );
              }}
              postprocessValue={(rawVal: unknown) => {
                if (rawVal == undefined) {
                  return rawVal;
                }
                const idValue = (rawVal as Record<string, unknown>)[diffLabels.ID.labelText];
                const addedValue = (rawVal as Record<string, unknown>)[diffLabels.ADDED.labelText];
                const changedValue = (rawVal as Record<string, unknown>)[
                  diffLabels.CHANGED.labelText
                ];
                const deletedValue = (rawVal as Record<string, unknown>)[
                  diffLabels.DELETED.labelText
                ];
                if (
                  (addedValue != undefined ? 1 : 0) +
                    (changedValue != undefined ? 1 : 0) +
                    (deletedValue != undefined ? 1 : 0) ===
                    1 &&
                  idValue == undefined
                ) {
                  return addedValue ?? changedValue ?? deletedValue;
                }
                return maybeDeepParse(rawVal);
              }}
              theme={{
                ...jsonTreeTheme,
                tree: { margin: 0 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                nestedNode: ({ style }, keyPath: any) => {
                  const baseStyle = {
                    ...style,
                    paddingTop: 2,
                    paddingBottom: 2,
                    marginTop: 2,
                    textDecoration: "inherit",
                  };
                  if (!diffEnabled) {
                    return { style: baseStyle };
                  }
                  let backgroundColor;
                  let textDecoration;
                  if (diffLabelsByLabelText[keyPath[0]]) {
                    backgroundColor =
                      themePreference === "dark"
                        ? // @ts-expect-error backgroundColor is not a property?
                          diffLabelsByLabelText[keyPath[0]].invertedBackgroundColor
                        : // @ts-expect-error backgroundColor is not a property?
                          diffLabelsByLabelText[keyPath[0]].backgroundColor;
                    textDecoration =
                      keyPath[0] === diffLabels.DELETED.labelText ? "line-through" : "none";
                  }
                  const nestedObj = get(diff, keyPath.slice().reverse(), {});
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                  const nestedObjKey = Object.keys(nestedObj)[0];
                  if (nestedObjKey != undefined && diffLabelsByLabelText[nestedObjKey]) {
                    backgroundColor =
                      themePreference === "dark"
                        ? // @ts-expect-error backgroundColor is not a property?
                          diffLabelsByLabelText[nestedObjKey].invertedBackgroundColor
                        : // @ts-expect-error backgroundColor is not a property?
                          diffLabelsByLabelText[nestedObjKey].backgroundColor;
                    textDecoration =
                      nestedObjKey === diffLabels.DELETED.labelText ? "line-through" : "none";
                  }
                  return {
                    style: {
                      ...baseStyle,
                      backgroundColor,
                      textDecoration: textDecoration ?? "inherit",
                    },
                  };
                },
                nestedNodeLabel: ({ style }) => ({
                  style: { ...style, textDecoration: "inherit" },
                }),
                nestedNodeChildren: ({ style }) => ({
                  style: { ...style, textDecoration: "inherit" },
                }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value: ({ style }, _nodeType, keyPath: any) => {
                  const baseStyle = { ...style, textDecoration: "inherit" };
                  if (!diffEnabled) {
                    return { style: baseStyle };
                  }
                  let backgroundColor;
                  let textDecoration;
                  const nestedObj = get(diff, keyPath.slice().reverse(), {});
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                  const nestedObjKey = Object.keys(nestedObj)[0];
                  if (nestedObjKey != undefined && diffLabelsByLabelText[nestedObjKey]) {
                    backgroundColor =
                      themePreference === "dark"
                        ? // @ts-expect-error backgroundColor is not a property?
                          diffLabelsByLabelText[nestedObjKey].invertedBackgroundColor
                        : // @ts-expect-error backgroundColor is not a property?
                          diffLabelsByLabelText[nestedObjKey].backgroundColor;
                    textDecoration =
                      nestedObjKey === diffLabels.DELETED.labelText ? "line-through" : "none";
                  }
                  return {
                    style: {
                      ...baseStyle,
                      backgroundColor,
                      textDecoration: textDecoration ?? "inherit",
                    },
                  };
                },
                label: { textDecoration: "inherit" },
              }}
              data={diffEnabled ? diff : data}
            />
          </>
        )}
      </Stack>
    );
  }, [
    topicPath,
    diffEnabled,
    diffMethod,
    baseItem,
    diffItem,
    showFullMessageForDiff,
    classes.topic,
    topic,
    getItemString,
    jsonTreeTheme,
    expandAll,
    expandedFields,
    diffTopicPath,
    saveConfig,
    onLabelClick,
    valueRenderer,
    rootStructureItem,
    renderDiffLabel,
    themePreference,
  ]);

  return (
    <Stack flex="auto" overflow="hidden" position="relative">
      <PanelToolbar helpContent={helpContent}>
        <IconButton
          className={classes.iconButton}
          title="Toggle diff"
          onClick={onToggleDiff}
          color={diffEnabled ? "default" : "inherit"}
          size="small"
        >
          {diffEnabled ? <DiffIcon fontSize="small" /> : <DiffOutlinedIcon fontSize="small" />}
        </IconButton>
        <IconButton
          className={classes.iconButton}
          title={expandAll ?? false ? "Collapse all" : "Expand all"}
          onClick={onToggleExpandAll}
          data-testid="expand-all"
          size="small"
        >
          {expandAll ?? false ? (
            <UnfoldLessIcon fontSize="small" />
          ) : (
            <UnfoldMoreIcon fontSize="small" />
          )}
        </IconButton>
        <Stack fullWidth paddingLeft={0.25}>
          <MessagePathInput
            index={0}
            path={topicPath}
            onChange={onTopicPathChange}
            inputStyle={{ height: 20 }}
          />
          {diffEnabled && (
            <Stack direction="row" flex="auto">
              <Select
                variant="filled"
                size="small"
                title="Diff method"
                value={diffMethod}
                MenuProps={{ MenuListProps: { dense: true } }}
                onChange={(event: SelectChangeEvent) =>
                  saveConfig({
                    diffMethod: event.target.value as RawMessagesPanelConfig["diffMethod"],
                  })
                }
              >
                <MenuItem value={PREV_MSG_METHOD}>{PREV_MSG_METHOD}</MenuItem>
                <MenuItem value={CUSTOM_METHOD}>custom</MenuItem>
              </Select>
              {diffMethod === CUSTOM_METHOD && (
                <MessagePathInput
                  index={1}
                  path={diffTopicPath}
                  onChange={onDiffTopicPathChange}
                  inputStyle={{ height: "100%" }}
                  {...(topic ? { prioritizedDatatype: topic.datatype } : {})}
                />
              )}
            </Stack>
          )}
        </Stack>
      </PanelToolbar>
      {renderSingleTopicOrDiffOutput()}
    </Stack>
  );
}

const defaultConfig: RawMessagesPanelConfig = {
  autoExpandMode: "auto",
  diffEnabled: false,
  diffMethod: CUSTOM_METHOD,
  diffTopicPath: "",
  showFullMessageForDiff: false,
  topicPath: "",
};

export default Panel(
  Object.assign(RawMessages, {
    panelType: "RawMessages",
    defaultConfig,
  }),
);

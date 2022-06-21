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

import { useTheme } from "@fluentui/react";
import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import PlusMinusIcon from "@mdi/svg/svg/plus-minus.svg";
import LessIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import MoreIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
import { MenuItem, Select, SelectChangeEvent, Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { Immutable } from "immer";
// eslint-disable-next-line no-restricted-imports
import { first, isEqual, get, last } from "lodash";
import { useState, useCallback, useMemo, useEffect } from "react";
import ReactHoverObserver from "react-hover-observer";
import Tree from "react-json-tree";
import { useLatest } from "react-use";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Icon from "@foxglove/studio-base/components/Icon";
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
import { SettingsTreeAction } from "@foxglove/studio-base/components/SettingsTreeEditor/types";
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

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    flex: "auto",
    overflow: "hidden",
    position: "relative",
  },
  topic: {
    display: "flex",
    flexDirection: "column",
    flex: "auto",
    overflow: "hidden auto",
    paddingLeft: theme.spacing(0.75),
    fontFamily: fonts.SANS_SERIF,
    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, "zero"`,
  },
  diff: {
    display: "flex",
    flex: "auto",
  },
  iconWrapper: {
    display: "inline",
    paddingRight: 40, // To make it so the icons appear when you move the mouse somewhat close.
  },
  singleVal: {
    fontSize: "2.5em",
    wordWrap: "break-word",
    fontWeight: "bold",
    whiteSpace: "pre-line",
  },
  topicInputs: {
    width: "100%",
    lineHeight: "20px",
  },
  invisibleSpace: {
    // https://stackoverflow.com/questions/62319014/make-text-selection-treat-adjacent-elements-as-separate-words
    fontSize: 0,
  },
}));

function RawMessages(props: Props) {
  const theme = useTheme();
  const classes = useStyles();
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
            getItemStringForDiff({ type, data, itemType, isInverted: theme.isInverted })
        : defaultGetItemString,
    [defaultGetItemString, diffEnabled, theme.isInverted],
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
    if (
      latestExpandedFields.current.keys.length === 0 &&
      baseItem &&
      config.autoExpandMode === "auto"
    ) {
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
      roots: buildSettingsTree(config),
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
    }: {
      constantName: string | undefined;
      label: string;
      itemValue: unknown;
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
      return { arrLabel, itemLabel };
    },
    [],
  );

  const renderDiffLabel = useCallback(
    (label: string, itemValue: unknown) => {
      let constantName: string | undefined;
      const { arrLabel, itemLabel } = getValueLabels({ constantName, label, itemValue });
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
      <ReactHoverObserver className={classes.iconWrapper}>
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
          const { arrLabel, itemLabel } = getValueLabels({ constantName, label, itemValue });
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
    [classes, datatypes, getValueLabels, onTopicPathChange, openSiblingPanel],
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

    const CheckboxComponent = showFullMessageForDiff
      ? CheckboxMarkedIcon
      : CheckboxBlankOutlineIcon;

    return (
      <div className={classes.topic}>
        <Metadata
          data={data}
          diffData={diffData}
          diff={diff}
          message={baseItem.messageEvent}
          {...(topic ? { datatype: topic.datatype } : undefined)}
          {...(diffItem ? { diffMessage: diffItem.messageEvent } : undefined)}
        />
        {shouldDisplaySingleVal ? (
          <div className={classes.singleVal}>
            <MaybeCollapsedValue itemLabel={String(singleVal)} />
          </div>
        ) : diffEnabled && isEqual({}, diff) ? (
          <EmptyState>No difference found</EmptyState>
        ) : (
          <>
            {diffEnabled && (
              <div
                style={{ cursor: "pointer", fontSize: "11px" }}
                onClick={() => saveConfig({ showFullMessageForDiff: !showFullMessageForDiff })}
              >
                <Icon style={{ verticalAlign: "middle" }}>
                  <CheckboxComponent />
                </Icon>{" "}
                Show full msg
              </div>
            )}
            <Tree
              labelRenderer={(raw) => (
                <>
                  <DiffSpan>{first(raw)}</DiffSpan>
                  <span className={classes.invisibleSpace}>&nbsp;</span>
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
                    padding: "2px 0 2px 0",
                    marginTop: 2,
                    textDecoration: "inherit",
                  };
                  if (!diffEnabled) {
                    return { style: baseStyle };
                  }
                  let backgroundColor;
                  let textDecoration;
                  if (diffLabelsByLabelText[keyPath[0]]) {
                    backgroundColor = theme.isInverted
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
                    backgroundColor = theme.isInverted
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
                    backgroundColor = theme.isInverted
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
      </div>
    );
  }, [
    topicPath,
    diffEnabled,
    diffMethod,
    baseItem,
    diffItem,
    showFullMessageForDiff,
    topic,
    classes,
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
    theme,
  ]);

  return (
    <div className={classes.root}>
      <PanelToolbar helpContent={helpContent}>
        <Icon tooltip="Toggle diff" size="medium" fade onClick={onToggleDiff} active={diffEnabled}>
          <PlusMinusIcon />
        </Icon>
        <Icon
          tooltip={expandAll ?? false ? "Collapse all" : "Expand all"}
          size="medium"
          fade
          dataTest="expand-all"
          onClick={onToggleExpandAll}
          style={{ position: "relative", top: 1 }}
        >
          {expandAll ?? false ? <LessIcon /> : <MoreIcon />}
        </Icon>
        <div className={classes.topicInputs}>
          <MessagePathInput
            index={0}
            path={topicPath}
            onChange={onTopicPathChange}
            inputStyle={{ height: 20 }}
          />
          {diffEnabled && (
            <div className={classes.diff}>
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
              {diffMethod === CUSTOM_METHOD ? (
                <MessagePathInput
                  index={1}
                  path={diffTopicPath}
                  onChange={onDiffTopicPathChange}
                  inputStyle={{ height: "100%" }}
                  {...(topic ? { prioritizedDatatype: topic.datatype } : {})}
                />
              ) : undefined}
            </div>
          )}
        </div>
      </PanelToolbar>
      {renderSingleTopicOrDiffOutput()}
    </div>
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

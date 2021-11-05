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

import { mergeStyleSets, useTheme } from "@fluentui/react";
import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import PlusMinusIcon from "@mdi/svg/svg/plus-minus.svg";
import LessIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import MoreIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
// eslint-disable-next-line no-restricted-imports
import { first, isEqual, get, last } from "lodash";
import { useState, useCallback, useMemo } from "react";
import ReactHoverObserver from "react-hover-observer";
import Tree from "react-json-tree";

import { useDataSourceInfo, useMessagesByTopic } from "@foxglove/studio-base/PanelAPI";
import Dropdown from "@foxglove/studio-base/components/Dropdown";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Flex from "@foxglove/studio-base/components/Flex";
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
import {
  useCachedGetMessagePathDataItems,
  MessagePathDataItem,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useLatestMessageDataItem } from "@foxglove/studio-base/components/MessagePathSyntax/useLatestMessageDataItem";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import getDiff, {
  diffLabels,
  diffLabelsByLabelText,
  DiffObject,
} from "@foxglove/studio-base/panels/RawMessages/getDiff";
import { Topic } from "@foxglove/studio-base/players/types";
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
import { DATA_ARRAY_PREVIEW_LIMIT, getItemStringForDiff } from "./utils";

export const CUSTOM_METHOD = "custom";
export const PREV_MSG_METHOD = "previous message";
export type RawMessagesConfig = {
  topicPath: string;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  diffEnabled: boolean;
  showFullMessageForDiff: boolean;
};

type Props = {
  config: RawMessagesConfig;
  saveConfig: (arg0: Partial<RawMessagesConfig>) => void;
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

const classes = mergeStyleSets({
  container: {
    paddingLeft: "0.5em",
    fontFamily: fonts.SANS_SERIF,
    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, "zero"`,
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
});

function RawMessages(props: Props) {
  const theme = useTheme();
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
  const [expandAll, setExpandAll] = useState<boolean | undefined>(false);
  const [expandedFields, setExpandedFields] = useState(() => new Set());

  const topicName = topicRosPath?.topicName ?? "";
  const consecutiveMsgs = useMessagesByTopic({
    topics: [topicName],
    historySize: 2,
  })[topicName];
  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems([topicPath]);
  const prevTickMsg = consecutiveMsgs?.[consecutiveMsgs.length - 2];
  const [prevTickObj, currTickObj] = [
    prevTickMsg && {
      message: prevTickMsg,
      queriedData: cachedGetMessagePathDataItems(topicPath, prevTickMsg) ?? [],
    },
    useLatestMessageDataItem(topicPath),
  ];

  const diffTopicObj = useLatestMessageDataItem(diffEnabled ? diffTopicPath : "");

  const inTimetickDiffMode = diffEnabled && diffMethod === PREV_MSG_METHOD;
  const baseItem = inTimetickDiffMode ? prevTickObj : currTickObj;
  const diffItem = inTimetickDiffMode ? currTickObj : diffTopicObj;

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
    [datatypes, getValueLabels, onTopicPathChange, openSiblingPanel],
  );

  const renderSingleTopicOrDiffOutput = useCallback(() => {
    let shouldExpandNode;
    if (expandAll != undefined) {
      shouldExpandNode = () => expandAll;
    } else {
      shouldExpandNode = (keypath: (string | number)[]) => {
        return expandedFields.has(keypath.join("~"));
      };
    }

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
      <Flex col clip scroll className={classes.container}>
        <Metadata
          data={data}
          diffData={diffData}
          diff={diff}
          message={baseItem.message}
          {...(topic ? { datatype: topic.datatype } : undefined)}
          {...(diffItem ? { diffMessage: diffItem.message } : undefined)}
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
                <DiffSpan onClick={() => onLabelClick(raw)}>{first(raw)}</DiffSpan>
              )}
              shouldExpandNode={shouldExpandNode}
              hideRoot
              invertTheme={false}
              getItemString={getItemString}
              valueRenderer={(valueAsString, value, ...keyPath) => {
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
                nestedNode: ({ style }, keyPath) => {
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
                value: ({ style }, _nodeType, keyPath) => {
                  const baseStyle = { ...style, textDecoration: "inherit" };
                  if (!diffEnabled) {
                    return { style: baseStyle };
                  }
                  let backgroundColor;
                  let textDecoration;
                  const nestedObj = get(diff, keyPath.slice().reverse(), {});
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
      </Flex>
    );
  }, [
    expandAll,
    topicPath,
    diffEnabled,
    diffMethod,
    baseItem,
    diffItem,
    showFullMessageForDiff,
    topic,
    getItemString,
    jsonTreeTheme,
    expandedFields,
    diffTopicPath,
    saveConfig,
    onLabelClick,
    valueRenderer,
    rootStructureItem,
    renderDiffLabel,
    theme.isInverted,
  ]);

  return (
    <Flex col clip style={{ position: "relative" }}>
      <PanelToolbar helpContent={helpContent}>
        <Icon tooltip="Toggle diff" size="medium" fade onClick={onToggleDiff} active={diffEnabled}>
          <PlusMinusIcon />
        </Icon>
        <Icon
          tooltip={expandAll ?? false ? "Collapse all" : "Expand all"}
          size="medium"
          fade
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
            inputStyle={{ height: "100%" }}
          />
          {diffEnabled && (
            <Flex>
              <Tooltip contents="Diff method" placement="top">
                <>
                  <Dropdown
                    value={diffMethod}
                    onChange={(newDiffMethod) => saveConfig({ diffMethod: newDiffMethod })}
                    noPortal
                    btnStyle={{ padding: "4px 10px" }}
                  >
                    <DropdownItem value={PREV_MSG_METHOD}>
                      <span>{PREV_MSG_METHOD}</span>
                    </DropdownItem>
                    <DropdownItem value={CUSTOM_METHOD}>
                      <span>custom</span>
                    </DropdownItem>
                  </Dropdown>
                </>
              </Tooltip>
              {diffMethod === CUSTOM_METHOD ? (
                <MessagePathInput
                  index={1}
                  path={diffTopicPath}
                  onChange={onDiffTopicPathChange}
                  inputStyle={{ height: "100%" }}
                  {...(topic ? { prioritizedDatatype: topic.datatype } : {})}
                />
              ) : undefined}
            </Flex>
          )}
        </div>
      </PanelToolbar>
      {renderSingleTopicOrDiffOutput()}
    </Flex>
  );
}

const defaultConfig: RawMessagesConfig = {
  topicPath: "",
  diffTopicPath: "",
  diffMethod: CUSTOM_METHOD,
  diffEnabled: false,
  showFullMessageForDiff: false,
};

export default Panel(
  Object.assign(RawMessages, {
    panelType: "RawMessages",
    defaultConfig,
    supportsStrictMode: false,
  }),
);

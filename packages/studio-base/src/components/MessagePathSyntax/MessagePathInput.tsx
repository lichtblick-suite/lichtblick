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
  IButtonStyles,
  IconButton,
  Stack,
  makeStyles,
  useTheme,
} from "@fluentui/react";
import { flatten, flatMap, partition } from "lodash";
import { CSSProperties, useCallback, useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import Autocomplete, { IAutocomplete } from "@foxglove/studio-base/components/Autocomplete";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { getTopicNames, getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

import { RosPath, RosPrimitive } from "./constants";
import {
  traverseStructure,
  messagePathStructures,
  messagePathsForDatatype,
  validTerminatingStructureItem,
} from "./messagePathsForDatatype";
import parseRosPath from "./parseRosPath";

const useStyles = makeStyles({
  helpTooltip: {
    margin: 0,
    lineHeight: "1.3",

    dd: {
      margin: "2px 0",
    },
    dt: {
      fontWeight: 700,
      marginTop: 6,

      ":first-of-type": {
        marginTop: 0,
      },
    },
  },
});

// To show an input field with an autocomplete so the user can enter message paths, use:
//
//  <MessagePathInput path={this.state.path} onChange={path => this.setState({ path })} />
//
// To limit the autocomplete items to only certain types of values, you can use
//
//  <MessagePathInput types={["message", "array", "primitives"]} />
//
// Or use actual ROS primitive types:
//
//  <MessagePathInput types={["uint16", "float64"]} />
//
// If you don't use timestamps, you might want to hide the warning icon that we show when selecting
// a topic that has no header: `<MessagePathInput hideTimestampWarning>`.
//
// If you are rendering many input fields, you might want to use `<MessagePathInput index={5}>`,
// which gets passed down to `<MessagePathInput onChange>` as the second parameter, so you can
// avoid creating anonymous functions on every render (which will prevent the component from
// rendering unnecessarily).

function topicHasNoHeaderStamp(topic: Topic, datatypes: RosDatatypes): boolean {
  const structureTraversalResult = traverseStructure(
    messagePathStructures(datatypes)[topic.datatype],
    [
      { type: "name", name: "header" },
      { type: "name", name: "stamp" },
    ],
  );

  return (
    !structureTraversalResult.valid ||
    !validTerminatingStructureItem(structureTraversalResult.structureItem, ["time"])
  );
}

// Get a list of Message Path strings for all of the fields (recursively) in a list of topics
function getFieldPaths(topics: readonly Topic[], datatypes: RosDatatypes): string[] {
  const output: string[] = [];
  for (const topic of topics) {
    addFieldPathsForType(topic.name, topic.datatype, datatypes, output);
  }
  return output;
}

function addFieldPathsForType(
  curPath: string,
  typeName: string,
  datatypes: RosDatatypes,
  output: string[],
): void {
  const msgdef = datatypes.get(typeName);
  if (msgdef) {
    for (const field of msgdef.definitions) {
      if (field.isConstant !== true) {
        output.push(`${curPath}.${field.name}`);
        if (field.isComplex === true) {
          addFieldPathsForType(`${curPath}.${field.name}`, field.type, datatypes, output);
        }
      }
    }
  }
}

export function tryToSetDefaultGlobalVar(
  variableName: string,
  setGlobalVariables: (arg0: GlobalVariables) => void,
): boolean {
  const defaultGlobalVars = new Map<string, GlobalVariables>();
  const defaultVar = defaultGlobalVars.get(variableName);
  if (defaultVar) {
    setGlobalVariables({ [variableName]: defaultVar });
    return true;
  }
  return false;
}

export function getFirstInvalidVariableFromRosPath(
  rosPath: RosPath,
  globalVariables: GlobalVariables,
  setGlobalVariables: (arg0: GlobalVariables) => void,
): { variableName: string; loc: number } | undefined {
  const { messagePath } = rosPath;
  const globalVars = Object.keys(globalVariables);
  return flatMap(messagePath, (path) => {
    const messagePathParts = [];
    if (
      path.type === "filter" &&
      typeof path.value === "object" &&
      !globalVars.includes(path.value.variableName)
    ) {
      const [variableName, loc] = [path.value.variableName, path.valueLoc];
      messagePathParts.push({ variableName, loc });
    } else if (path.type === "slice") {
      if (typeof path.start === "object" && !globalVars.includes(path.start.variableName)) {
        const [variableName, loc] = [path.start.variableName, path.start.startLoc];
        messagePathParts.push({ variableName, loc });
      }
      if (
        path.end != undefined &&
        typeof path.end === "object" &&
        !globalVars.includes(path.end.variableName)
      ) {
        const [variableName, loc] = [path.end.variableName, path.end.startLoc];
        messagePathParts.push({ variableName, loc });
      }
    }
    return messagePathParts;
  }).filter(({ variableName }) => !tryToSetDefaultGlobalVar(variableName, setGlobalVariables))[0];
}

function getExamplePrimitive(primitiveType: RosPrimitive) {
  switch (primitiveType) {
    case "string":
      return '""';
    case "bool":
      return "true";
    case "float32":
    case "float64":
    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
    case "int8":
    case "int16":
    case "int32":
    case "int64":
      return "0";
    case "duration":
    case "time":
    case "json":
      return "";
  }
}

type MessagePathInputBaseProps = {
  supportsMathModifiers?: boolean;
  path: string; // A path of the form `/topic.some_field[:]{id==42}.x`
  index?: number; // Optional index field which gets passed to `onChange` (so you don't have to create anonymous functions)
  onChange: (value: string, index?: number) => void;
  validTypes?: string[]; // Valid types, like "message", "array", or "primitive", or a ROS primitive like "float64"
  noMultiSlices?: boolean; // Don't suggest slices with multiple values `[:]`, only single values like `[0]`.
  autoSize?: boolean;
  placeholder?: string;
  inputStyle?: CSSProperties;
  disableAutocomplete?: boolean; // Treat this as a normal input, with no autocomplete.
  prioritizedDatatype?: string;
  timestampMethod?: TimestampMethod;
  onTimestampMethodChange?: (arg0: TimestampMethod, index?: number) => void;
};

export default React.memo<MessagePathInputBaseProps>(function MessagePathInput(
  props: MessagePathInputBaseProps,
) {
  const classes = useStyles();
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const { datatypes, topics } = PanelAPI.useDataSourceInfo();
  const theme = useTheme();

  const dropdownStyles: Partial<IButtonStyles> = useMemo(
    () => ({
      root: {
        backgroundColor: "transparent",
        color: theme.semanticColors.disabledText,
        borderColor: "transparent",
        fontSize: 12,
        height: 24,
        padding: "0 2px 0 4px",
        cursor: "pointer",
        minWidth: 120,
      },
      rootHovered: {
        color: theme.semanticColors.buttonText,
        padding: "0 2px 0 4px",
        backgroundColor: theme.semanticColors.buttonBackgroundHovered,
      },
      rootPressed: { backgroundColor: theme.semanticColors.buttonBackgroundPressed },
      label: { fontWeight: 400 },
      menuIcon: {
        fontSize: "1em",
        height: "1em",
        color: "inherit",
        marginLeft: 0,

        svg: {
          fill: "currentColor",
          height: "1em",
          width: "1em",
          display: "block",
        },
      },
    }),
    [theme],
  );

  const iconButtonStyles: Partial<IButtonStyles> = useMemo(
    () => ({
      root: {
        backgroundColor: "transparent",
        fontSize: 20,
        height: 24,
        width: 24,
        cursor: "pointer",
        color: theme.semanticColors.disabledText,
      },
      rootHovered: {
        backgroundColor: theme.semanticColors.buttonBackgroundHovered,
        color: theme.semanticColors.buttonTextHovered,
      },
      rootPressed: { backgroundColor: theme.semanticColors.buttonBackgroundPressed },
      iconHovered: { color: "inherit" },
      icon: {
        color: "inherit",

        svg: {
          height: "1em",
          width: "1em",
          display: "block",
          fill: "currentColor",
        },
      },
    }),
    [theme],
  );

  const {
    supportsMathModifiers,
    path,
    prioritizedDatatype,
    validTypes,
    autoSize,
    placeholder,
    noMultiSlices,
    timestampMethod,
    inputStyle,
    disableAutocomplete = false,
  } = props;

  const onChangeProp = props.onChange;
  const onChange = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>, rawValue: string) => {
      // When typing a "{" character, also  insert a "}", so you get an
      // autocomplete window immediately for selecting a filter name.
      let value = rawValue;
      if ((event.nativeEvent as InputEvent).data === "{") {
        const target = event.target as HTMLInputElement;
        const newCursorPosition = target.selectionEnd ?? 0;
        value = `${value.slice(0, newCursorPosition)}}${value.slice(newCursorPosition)}`;

        setImmediate(() => target.setSelectionRange(newCursorPosition, newCursorPosition));
      }
      onChangeProp(value, props.index);
    },
    [onChangeProp, props.index],
  );

  const onSelect = useCallback(
    (
      rawValue: string,
      autocomplete: IAutocomplete,
      autocompleteType: ("topicName" | "messagePath" | "globalVariables") | undefined,
      autocompleteRange: { start: number; end: number },
    ) => {
      let value = rawValue;
      // If we're dealing with a topic name, and we cannot validly end in a message type,
      // add a "." so the user can keep typing to autocomplete the message path.
      const keepGoingAfterTopicName =
        autocompleteType === "topicName" &&
        validTypes != undefined &&
        !validTypes.includes("message");
      if (keepGoingAfterTopicName) {
        value += ".";
      }
      onChangeProp(
        path.substr(0, autocompleteRange.start) + value + path.substr(autocompleteRange.end),
        props.index,
      );
      // We want to continue typing if we're dealing with a topic name,
      // or if we just autocompleted something with a filter (because we might want to
      // edit that filter), or if the autocomplete already has a filter (because we might
      // have just autocompleted a name inside that filter).
      if (keepGoingAfterTopicName || value.includes("{") || path.includes("{")) {
        const newCursorPosition = autocompleteRange.start + value.length;
        setImmediate(() => autocomplete.setSelectionRange(newCursorPosition, newCursorPosition));
      } else {
        autocomplete.blur();
      }
    },
    [onChangeProp, path, props.index, validTypes],
  );

  const onTimestampMethodChangeProp = props.onTimestampMethodChange;

  const onTimestampMethodChange = useCallback(
    (value: TimestampMethod) => {
      onTimestampMethodChangeProp?.(value, props.index);
    },
    [onTimestampMethodChangeProp, props.index],
  );

  const rosPath = useMemo(() => parseRosPath(path), [path]);

  const topic = useMemo(() => {
    if (!rosPath) {
      return undefined;
    }

    const { topicName } = rosPath;
    return topics.find(({ name }) => name === topicName);
  }, [rosPath, topics]);

  const structureTraversalResult = useMemo(() => {
    if (!topic || !rosPath?.messagePath) {
      return undefined;
    }

    return traverseStructure(messagePathStructures(datatypes)[topic.datatype], rosPath.messagePath);
  }, [datatypes, rosPath?.messagePath, topic]);

  const invalidGlobalVariablesVariable = useMemo(() => {
    if (!rosPath) {
      return undefined;
    }
    return getFirstInvalidVariableFromRosPath(rosPath, globalVariables, setGlobalVariables);
  }, [globalVariables, rosPath, setGlobalVariables]);

  const topicNamesAutocompleteItems = useMemo(() => getTopicNames(topics), [topics]);

  const topicNamesAndFieldsAutocompleteItems = useMemo(
    () => topicNamesAutocompleteItems.concat(getFieldPaths(topics, datatypes)),
    [topicNamesAutocompleteItems, topics, datatypes],
  );

  const [enableFieldMatching = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_FIELD_MATCHING,
  );

  const autocompleteType = useMemo(() => {
    if (!rosPath) {
      return "topicName";
    } else if (!topic) {
      return "topicName";
    } else if (
      !structureTraversalResult ||
      !structureTraversalResult.valid ||
      !validTerminatingStructureItem(structureTraversalResult.structureItem, validTypes)
    ) {
      return "messagePath";
    }

    if (invalidGlobalVariablesVariable) {
      return "globalVariables";
    }

    return undefined;
  }, [invalidGlobalVariablesVariable, structureTraversalResult, validTypes, rosPath, topic]);

  const { autocompleteItems, autocompleteFilterText, autocompleteRange } = useMemo(() => {
    if (disableAutocomplete) {
      return {
        autocompleteItems: [],
        autocompleteFilterText: "",
        autocompleteRange: { start: 0, end: Infinity },
      };
    } else if (autocompleteType === "topicName") {
      // If the path is empty, return topic names only to show the full list of topics. Otherwise,
      // use the full set of topic names and field paths to autocomplete
      return {
        autocompleteItems:
          enableFieldMatching && path
            ? topicNamesAndFieldsAutocompleteItems
            : topicNamesAutocompleteItems,
        autocompleteFilterText: path,
        autocompleteRange: { start: 0, end: Infinity },
      };
    } else if (autocompleteType === "messagePath" && topic && rosPath) {
      if (
        structureTraversalResult &&
        !structureTraversalResult.valid &&
        structureTraversalResult.msgPathPart?.type === "filter" &&
        structureTraversalResult.structureItem?.structureType === "message"
      ) {
        const { msgPathPart } = structureTraversalResult;

        const items: string[] = [];

        // Provide filter suggestions for primitive values, since they're the only kinds of values
        // that can be filtered on.
        // TODO: add support for nested paths to primitives, such as "/some_topic{foo.bar==3}".
        for (const name of Object.keys(structureTraversalResult.structureItem.nextByName)) {
          const item = structureTraversalResult.structureItem.nextByName[name];
          if (item?.structureType === "primitive") {
            items.push(`${name}==${getExamplePrimitive(item.primitiveType)}`);
          }
        }

        const filterText = msgPathPart.path.join(".");

        return {
          autocompleteItems: items,
          autocompleteFilterText: filterText,
          autocompleteRange: {
            start: msgPathPart.nameLoc,
            end: msgPathPart.nameLoc + filterText.length,
          },
        };
      } else {
        // Exclude any initial filters ("/topic{foo=='bar'}") from the range that will be replaced
        // when the user chooses a new message path.
        const initialFilterLength =
          rosPath.messagePath[0]?.type === "filter" ? rosPath.messagePath[0].repr.length + 2 : 0;

        return {
          autocompleteItems: messagePathsForDatatype(topic.datatype, datatypes, {
            validTypes,
            noMultiSlices,
            messagePath: rosPath.messagePath,
          }).filter(
            // .header.seq is pretty useless but shows up everryyywhere.
            (msgPath) => msgPath !== "" && !msgPath.endsWith(".header.seq"),
          ),

          autocompleteRange: { start: topic.name.length + initialFilterLength, end: Infinity },
          // Filter out filters (hah!) in a pretty crude way, so autocomplete still works
          // when already having specified a filter and you want to see what other object
          // names you can complete it with. Kind of an edge case, and this doesn't work
          // ideally (because it will remove your existing filter if you actually select
          // the autocomplete item), but it's easy to do for now, and nice to have.
          autocompleteFilterText: path.substr(topic.name.length).replace(/\{[^}]*\}/g, ""),
        };
      }
    } else if (invalidGlobalVariablesVariable) {
      return {
        autocompleteItems: Object.keys(globalVariables).map((key) => `$${key}`),
        autocompleteRange: {
          start: invalidGlobalVariablesVariable.loc,
          end:
            invalidGlobalVariablesVariable.loc +
            invalidGlobalVariablesVariable.variableName.length +
            1,
        },
        autocompleteFilterText: invalidGlobalVariablesVariable.variableName,
      };
    }

    return {
      autocompleteItems: [],
      autocompleteFilterText: "",
      autocompleteRange: { start: 0, end: Infinity },
    };
  }, [
    disableAutocomplete,
    autocompleteType,
    topic,
    rosPath,
    invalidGlobalVariablesVariable,
    enableFieldMatching,
    path,
    topicNamesAutocompleteItems,
    topicNamesAndFieldsAutocompleteItems,
    structureTraversalResult,
    datatypes,
    validTypes,
    noMultiSlices,
    globalVariables,
  ]);

  const noHeaderStamp = useMemo(() => {
    return topic ? topicHasNoHeaderStamp(topic, datatypes) : false;
  }, [datatypes, topic]);

  const orderedAutocompleteItems = useMemo(() => {
    if (prioritizedDatatype == undefined) {
      return autocompleteItems;
    }

    return flatten(
      partition(
        autocompleteItems,
        (item) => getTopicsByTopicName(topics)[item]?.datatype === prioritizedDatatype,
      ),
    );
  }, [autocompleteItems, prioritizedDatatype, topics]);

  const usesUnsupportedMathModifier =
    (supportsMathModifiers == undefined || !supportsMathModifiers) && path.includes(".@");

  const hasError =
    usesUnsupportedMathModifier ||
    (autocompleteType != undefined && !disableAutocomplete && path.length > 0);

  const timestampButton = useTooltip({
    contents: noHeaderStamp
      ? "header.stamp is not present in this topic"
      : "Timestamp used for x-axis",
    placement: "top",
  });

  const helpButton = useTooltip({
    contents: (
      <dl className={classes.helpTooltip}>
        <dt>receive time</dt>
        <dd>ROS-time at which the message was received and recorded.</dd>

        <dt>header.stamp</dt>
        <dd>
          Value of the header.stamp field. Can mean different things for different topics. Be sure
          you know what this value means before using it.
        </dd>
      </dl>
    ),
    placement: "top",
  });

  return (
    <Stack
      horizontal
      horizontalAlign="space-between"
      verticalAlign="center"
      grow
      disableShrink
      styles={{ root: { minWidth: 0, ".ms-layer:empty": { margin: 0 } } }}
      tokens={{ childrenGap: 2 }}
    >
      <Stack.Item grow>
        <Autocomplete
          items={orderedAutocompleteItems}
          filterText={autocompleteFilterText}
          value={path}
          onChange={onChange}
          onSelect={(value: string, _item: unknown, autocomplete: IAutocomplete) =>
            onSelect(value, autocomplete, autocompleteType, autocompleteRange)
          }
          hasError={hasError}
          autocompleteKey={autocompleteType}
          placeholder={
            placeholder != undefined && placeholder !== ""
              ? placeholder
              : "/some/topic.msgs[0].field"
          }
          autoSize={autoSize}
          inputStyle={inputStyle} // Disable autoselect since people often construct complex queries, and it's very annoying
          // to have the entire input selected whenever you want to make a change to a part it.
          disableAutoSelect
        />
      </Stack.Item>
      {timestampMethod != undefined && (
        <>
          <Stack.Item>
            {timestampButton.tooltip}
            <DefaultButton
              elementRef={timestampButton.ref}
              checked={timestampMethod === "headerStamp" && noHeaderStamp}
              text={timestampMethod === "receiveTime" ? "(receive time)" : "(header.stamp)"}
              menuIconProps={{ iconName: "MenuDown" }}
              menuProps={{
                styles: {
                  subComponentStyles: {
                    menuItem: {
                      root: { height: 24 },
                      label: { fontSize: theme.fonts.small.fontSize },
                      secondaryText: { fontSize: theme.fonts.small.fontSize },
                    },
                  },
                },
                items: [
                  {
                    key: "receiveTime",
                    text: "receive time",
                    onClick: () => onTimestampMethodChange("receiveTime"),
                  },
                  {
                    key: "headerStamp",
                    text: "header.stamp",
                    onClick: () => onTimestampMethodChange("headerStamp"),
                  },
                ],
              }}
              styles={dropdownStyles}
            />
          </Stack.Item>
          <Stack.Item>
            {helpButton.tooltip}
            <IconButton
              elementRef={helpButton.ref}
              iconProps={{ iconName: "HelpCircle" }}
              styles={iconButtonStyles}
            />
          </Stack.Item>
        </>
      )}
    </Stack>
  );
});

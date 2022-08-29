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

import { Stack } from "@mui/material";
import { flatten, flatMap, partition } from "lodash";
import { CSSProperties, useCallback, useMemo } from "react";

import { RosMsgField } from "@foxglove/rosmsg";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import Autocomplete, { IAutocomplete } from "@foxglove/studio-base/components/Autocomplete";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";

import { RosPath, RosPrimitive } from "./constants";
import {
  traverseStructure,
  messagePathStructures,
  messagePathsForDatatype,
  validTerminatingStructureItem,
} from "./messagePathsForDatatype";
import parseRosPath, { quoteFieldNameIfNeeded, quoteTopicNameIfNeeded } from "./parseRosPath";

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
// If you are rendering many input fields, you might want to use `<MessagePathInput index={5}>`,
// which gets passed down to `<MessagePathInput onChange>` as the second parameter, so you can
// avoid creating anonymous functions on every render (which will prevent the component from
// rendering unnecessarily).

// Get a list of Message Path strings for all of the fields (recursively) in a list of topics
function getFieldPaths(
  topics: readonly Topic[],
  datatypes: RosDatatypes,
): Map<string, RosMsgField> {
  const output = new Map<string, RosMsgField>();
  for (const topic of topics) {
    addFieldPathsForType(quoteTopicNameIfNeeded(topic.name), topic.datatype, datatypes, [], output);
  }
  return output;
}

function addFieldPathsForType(
  curPath: string,
  typeName: string,
  datatypes: RosDatatypes,
  seenTypes: string[],
  output: Map<string, RosMsgField>,
): void {
  const msgdef = datatypes.get(typeName);
  if (msgdef) {
    for (const field of msgdef.definitions) {
      if (seenTypes.includes(field.type)) {
        continue;
      }
      if (field.isConstant !== true) {
        const fieldPath = `${curPath}.${quoteFieldNameIfNeeded(field.name)}`;
        output.set(fieldPath, field);
        if (field.isComplex === true) {
          addFieldPathsForType(
            fieldPath,
            field.type,
            datatypes,
            [...seenTypes, field.type],
            output,
          );
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
      if (typeof path.end === "object" && !globalVars.includes(path.end.variableName)) {
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
    case "json":
      return "";
  }
}

type MessagePathInputBaseProps = {
  supportsMathModifiers?: boolean;
  path: string; // A path of the form `/topic.some_field[:]{id==42}.x`
  index?: number; // Optional index field which gets passed to `onChange` (so you don't have to create anonymous functions)
  onChange: (value: string, index?: number) => void;
  validTypes?: readonly string[]; // Valid types, like "message", "array", or "primitive", or a ROS primitive like "float64"
  noMultiSlices?: boolean; // Don't suggest slices with multiple values `[:]`, only single values like `[0]`.
  autoSize?: boolean;
  placeholder?: string;
  inputStyle?: CSSProperties;
  disabled?: boolean;
  disableAutocomplete?: boolean; // Treat this as a normal input, with no autocomplete.
  readOnly?: boolean;
  prioritizedDatatype?: string;
};

export default React.memo<MessagePathInputBaseProps>(function MessagePathInput(
  props: MessagePathInputBaseProps,
) {
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const { datatypes, topics } = PanelAPI.useDataSourceInfo();

  const {
    supportsMathModifiers,
    path,
    prioritizedDatatype,
    validTypes,
    autoSize,
    placeholder,
    noMultiSlices,
    inputStyle,
    disableAutocomplete = false,
  } = props;

  const topicFields = useMemo(() => getFieldPaths(topics, datatypes), [datatypes, topics]);

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
      const completeStart = path.slice(0, autocompleteRange.start);
      const completeEnd = path.slice(autocompleteRange.end);

      // Check if accepting this completion would result in a path to a non-complex field.
      const completedPath = completeStart + rawValue + completeEnd;
      const completedField = topicFields.get(completedPath);
      const isSimpleField = completedField != undefined && completedField.isComplex !== true;

      // If we're dealing with a topic name, and we cannot validly end in a message type,
      // add a "." so the user can keep typing to autocomplete the message path.
      const messageIsValidType = validTypes == undefined || validTypes.includes("message");
      const keepGoingAfterTopicName =
        autocompleteType === "topicName" && !messageIsValidType && !isSimpleField;
      const value = keepGoingAfterTopicName ? rawValue + "." : rawValue;

      onChangeProp(completeStart + value + completeEnd, props.index);

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
    [onChangeProp, path, props.index, topicFields, validTypes],
  );

  const rosPath = useMemo(() => parseRosPath(path), [path]);

  const topic = useMemo(() => {
    if (!rosPath) {
      return undefined;
    }

    const { topicName } = rosPath;
    return topics.find(({ name }) => name === topicName);
  }, [rosPath, topics]);

  const messagePathStructuresForDataype = useMemo(
    () => messagePathStructures(datatypes),
    [datatypes],
  );

  const structureTraversalResult = useMemo(() => {
    if (!topic || !rosPath?.messagePath) {
      return undefined;
    }

    return traverseStructure(messagePathStructuresForDataype[topic.datatype], rosPath.messagePath);
  }, [messagePathStructuresForDataype, rosPath?.messagePath, topic]);

  const invalidGlobalVariablesVariable = useMemo(() => {
    if (!rosPath) {
      return undefined;
    }
    return getFirstInvalidVariableFromRosPath(rosPath, globalVariables, setGlobalVariables);
  }, [globalVariables, rosPath, setGlobalVariables]);

  const topicNamesAutocompleteItems = useMemo(
    () => topics.map(({ name }) => quoteTopicNameIfNeeded(name)),
    [topics],
  );

  const topicNamesAndFieldsAutocompleteItems = useMemo(
    () => topicNamesAutocompleteItems.concat(Array.from(topicFields.keys())),
    [topicFields, topicNamesAutocompleteItems],
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
        autocompleteItems: path
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

          autocompleteRange: {
            start: rosPath.topicNameRepr.length + initialFilterLength,
            end: Infinity,
          },
          // Filter out filters (hah!) in a pretty crude way, so autocomplete still works
          // when already having specified a filter and you want to see what other object
          // names you can complete it with. Kind of an edge case, and this doesn't work
          // ideally (because it will remove your existing filter if you actually select
          // the autocomplete item), but it's easy to do for now, and nice to have.
          autocompleteFilterText: path
            .substring(rosPath.topicNameRepr.length)
            .replace(/\{[^}]*\}/g, ""),
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
    path,
    topicNamesAutocompleteItems,
    topicNamesAndFieldsAutocompleteItems,
    structureTraversalResult,
    datatypes,
    validTypes,
    noMultiSlices,
    globalVariables,
  ]);

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

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      flexGrow={1}
      flexShrink={0}
      spacing={0.25}
    >
      <Autocomplete
        items={orderedAutocompleteItems}
        disabled={props.disabled}
        readOnly={props.readOnly}
        filterText={autocompleteFilterText}
        value={path}
        onChange={onChange}
        onSelect={(value, _item, autocomplete) =>
          onSelect(value, autocomplete, autocompleteType, autocompleteRange)
        }
        hasError={hasError}
        autocompleteKey={autocompleteType}
        placeholder={
          placeholder != undefined && placeholder !== "" ? placeholder : "/some/topic.msgs[0].field"
        }
        autoSize={autoSize}
        inputStyle={inputStyle} // Disable autoselect since people often construct complex queries, and it's very annoying
        // to have the entire input selected whenever you want to make a change to a part it.
        disableAutoSelect
      />
    </Stack>
  );
});

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
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import { basicDatatypes } from "@foxglove/studio-base/util/basicDatatypes";

import MessagePathInput from "./MessagePathInput";
import { MessagePathInputStoryFixture } from "./fixture";

let manyTopics: Topic[] = [];
for (let i = 0; i < 10; i++) {
  manyTopics = manyTopics.concat(
    Array.from(basicDatatypes.keys()).map(
      (schemaName): Topic => ({ name: `/${schemaName.toLowerCase()}/${i}`, schemaName }),
    ),
  );
}

const heavyFixture: Fixture = {
  datatypes: basicDatatypes,
  topics: manyTopics,
  frame: {},
  globalVariables: { global_var_1: 42, global_var_2: 10 },
};

const clickInput = (el: HTMLDivElement) => {
  const firstInput = el.querySelector("input");
  if (firstInput) {
    firstInput.focus();
  }
};

function MessagePathInputStory(props: {
  path: string;
  prioritizedDatatype?: string;
  validTypes?: string[];
}) {
  const [path, setPath] = React.useState(props.path);

  return (
    <PanelSetup fixture={MessagePathInputStoryFixture} onMount={clickInput}>
      <Stack direction="row" flex="auto" margin={1.25}>
        <MessagePathInput
          autoSize={false}
          path={path}
          validTypes={props.validTypes}
          prioritizedDatatype={props.prioritizedDatatype}
          onChange={(newPath) => setPath(newPath)}
        />
      </Stack>
    </PanelSetup>
  );
}

function MessagePathPerformanceStory(props: { path: string; prioritizedDatatype?: string }) {
  const [path, setPath] = React.useState(props.path);

  return (
    <PanelSetup fixture={heavyFixture} onMount={clickInput}>
      <Stack direction="row" flex="auto" margin={1.25}>
        <MessagePathInput
          autoSize={false}
          path={path}
          prioritizedDatatype={props.prioritizedDatatype}
          onChange={(newPath) => setPath(newPath)}
        />
      </Stack>
    </PanelSetup>
  );
}

export default {
  title: "components/MessagePathInput",

  parameters: {
    colorScheme: "dark",
  },
};

function makePathAndSelectionAction(path: undefined | string, item: number) {
  return async () => {
    const user = userEvent.setup();
    if (path != undefined) {
      const input = await screen.findByPlaceholderText("/some/topic.msgs[0].field");
      await user.click(input);
      await user.keyboard(path);
    }
    const options = await waitFor(() => document.querySelectorAll("[data-test-auto-item]"));
    await user.click(options[item]!);
  };
}

export const PathWithHeaderFields = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.header.stamp.sec" />;
};
PathWithHeaderFields.storyName = "path with header fields";

export const AutocompleteTopics = (): JSX.Element => {
  return <MessagePathInputStory path="/" />;
};
AutocompleteTopics.storyName = "autocomplete topics";

export const AutocompleteScalarFromTopicAndEmptyPath = (): JSX.Element => {
  return <MessagePathInputStory path="" validTypes={["int32"]} />;
};
AutocompleteScalarFromTopicAndEmptyPath.play = makePathAndSelectionAction(undefined, 2);

AutocompleteScalarFromTopicAndEmptyPath.storyName = "autocomplete scalar from topic and empty path";

export const AutocompleteScalarFromTopic = (): JSX.Element => {
  return <MessagePathInputStory path="" validTypes={["int32"]} />;
};
AutocompleteScalarFromTopic.play = makePathAndSelectionAction("/some_logs_", 1);
AutocompleteScalarFromTopic.storyName = "autocomplete scalar from topic";

export const AutocompleteScalarFromFullTopic = (): JSX.Element => {
  return <MessagePathInputStory path="" validTypes={["int32"]} />;
};
AutocompleteScalarFromFullTopic.play = makePathAndSelectionAction("/some_logs_topic", 0);
AutocompleteScalarFromFullTopic.storyName = "autocomplete scalar from full topic";

export const AutocompleteMessagePath = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/location.po" />;
};
AutocompleteMessagePath.storyName = "autocomplete messagePath";

export const AutocompleteMessagePathLight = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/location.po" />;
};
AutocompleteMessagePathLight.storyName = "autocomplete messagePath light";
AutocompleteMessagePathLight.parameters = { colorScheme: "light" };

export const AutocompleteFilter = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[:]{}" />;
};
AutocompleteFilter.storyName = "autocomplete filter";

export const AutocompleteTopLevelFilter = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state{}" />;
};
AutocompleteTopLevelFilter.storyName = "autocomplete top level filter";

export const AutocompleteForGlobalVariablesVariables = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state{foo_id==0}.items[:]{id==$}" />;
};
AutocompleteForGlobalVariablesVariables.storyName = "autocomplete for globalVariables variables";

export const PathWithValidGlobalVariablesVariable = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}" />;
};
PathWithValidGlobalVariablesVariable.storyName = "path with valid globalVariables variable";

export const PathWithInvalidGlobalVariablesVariable = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_3}" />;
};
PathWithInvalidGlobalVariablesVariable.storyName = "path with invalid globalVariables variable";

export const PathWithIncorrectlyPrefixedGlobalVariablesVariable = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[:]{id==global_var_2}" />;
};
PathWithIncorrectlyPrefixedGlobalVariablesVariable.storyName =
  "path with incorrectly prefixed globalVariables variable";

export const AutocompleteForPathWithGlobalVariablesVariableInSliceSingleIdx = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[$]" />;
};
AutocompleteForPathWithGlobalVariablesVariableInSliceSingleIdx.storyName =
  "autocomplete for path with globalVariables variable in slice (single idx)";

export const AutocompleteForPathWithGlobalVariablesVariableInSliceStartIdx = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[$:]" />;
};
AutocompleteForPathWithGlobalVariablesVariableInSliceStartIdx.storyName =
  "autocomplete for path with globalVariables variable in slice (start idx)";

export const AutocompleteForPathWithGlobalVariablesVariableInSliceEndIdx = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[:$]" />;
};
AutocompleteForPathWithGlobalVariablesVariableInSliceEndIdx.storyName =
  "autocomplete for path with globalVariables variable in slice (end idx)";

export const AutocompleteForPathWithGlobalVariablesVariablesInSliceStartAndEndIdx =
  (): JSX.Element => {
    return <MessagePathInputStory path="/some_topic/state.items[$global_var_2:$]" />;
  };
AutocompleteForPathWithGlobalVariablesVariablesInSliceStartAndEndIdx.storyName =
  "autocomplete for path with globalVariables variables in slice (start and end idx)";

export const PathWithInvalidMathModifier = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/location.pose.x.@negative" />;
};
PathWithInvalidMathModifier.storyName = "path with invalid math modifier";

export const AutocompleteWhenPrioritizedDatatypeIsAvailable = (): JSX.Element => {
  return <MessagePathInputStory path="/" prioritizedDatatype="msgs/State" />;
};
AutocompleteWhenPrioritizedDatatypeIsAvailable.storyName =
  "autocomplete when prioritized datatype is available";

export const AutocompleteForMessageWithJsonField = (): JSX.Element => {
  return <MessagePathInputStory path="/some_logs_topic." />;
};
AutocompleteForMessageWithJsonField.storyName = "autocomplete for message with json field";

export const AutocompleteForPathWithExistingFilter = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[:]{id==1}." />;
};
AutocompleteForPathWithExistingFilter.storyName = "autocomplete for path with existing filter";

export const AutocompleteForPathWithExistingFilterUsingAGlobalVariable = (): JSX.Element => {
  return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}." />;
};
AutocompleteForPathWithExistingFilterUsingAGlobalVariable.storyName =
  "autocomplete for path with existing filter using a global variable";

export const PathForFieldInsideJsonObject = (): JSX.Element => {
  return <MessagePathInputStory path="/some_logs_topic.myJson" />;
};
PathForFieldInsideJsonObject.storyName = "path for field inside json object";

export const PathForMultipleLevelsOfNestedFieldsInsideJsonObject = (): JSX.Element => {
  return <MessagePathInputStory path="/some_logs_topic.myJson.a.b.c" />;
};
PathForMultipleLevelsOfNestedFieldsInsideJsonObject.storyName =
  "path for multiple levels of nested fields inside json object";

export const PerformanceTesting = (): JSX.Element => {
  return <MessagePathPerformanceStory path="." />;
};
PerformanceTesting.storyName = "performance testing";

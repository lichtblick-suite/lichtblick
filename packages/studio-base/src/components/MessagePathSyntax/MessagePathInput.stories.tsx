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
import { StoryObj } from "@storybook/react";
import { screen, waitFor, userEvent } from "@storybook/testing-library";

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
    if (path != undefined) {
      const input = await screen.findByPlaceholderText("/some/topic.msgs[0].field");
      userEvent.click(input);
      userEvent.keyboard(path);
    }
    const options = await waitFor(() => document.querySelectorAll("[data-test-auto-item]"));
    userEvent.click(options[item]!);
  };
}

export const PathWithHeaderFields: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.header.stamp.sec" />;
  },

  name: "path with header fields",
};

export const AutocompleteTopics: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/" />;
  },

  name: "autocomplete topics",
};

export const AutocompleteScalarFromTopicAndEmptyPath: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="" validTypes={["int32"]} />;
  },

  play: makePathAndSelectionAction(undefined, 2),
  name: "autocomplete scalar from topic and empty path",
};

export const AutocompleteScalarFromTopic: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="" validTypes={["int32"]} />;
  },

  play: makePathAndSelectionAction("/some_logs_", 1),
  name: "autocomplete scalar from topic",
};

export const AutocompleteScalarFromFullTopic: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="" validTypes={["int32"]} />;
  },

  play: makePathAndSelectionAction("/some_logs_topic", 0),
  name: "autocomplete scalar from full topic",
};

export const AutocompleteMessagePath: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/location.po" />;
  },

  name: "autocomplete messagePath",
};

export const AutocompleteMessagePathLight: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/location.po" />;
  },

  name: "autocomplete messagePath light",
  parameters: { colorScheme: "light" },
};

export const AutocompleteFilter: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[:]{}" />;
  },

  name: "autocomplete filter",
};

export const AutocompleteTopLevelFilter: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state{}" />;
  },

  name: "autocomplete top level filter",
};

export const AutocompleteForGlobalVariablesVariables: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state{foo_id==0}.items[:]{id==$}" />;
  },

  name: "autocomplete for globalVariables variables",
};

export const PathWithValidGlobalVariablesVariable: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}" />;
  },

  name: "path with valid globalVariables variable",
};

export const PathWithInvalidGlobalVariablesVariable: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_3}" />;
  },

  name: "path with invalid globalVariables variable",
};

export const PathWithIncorrectlyPrefixedGlobalVariablesVariable: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==global_var_2}" />;
  },

  name: "path with incorrectly prefixed globalVariables variable",
};

export const AutocompleteForPathWithGlobalVariablesVariableInSliceSingleIdx: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[$]" />;
  },

  name: "autocomplete for path with globalVariables variable in slice (single idx)",
};

export const AutocompleteForPathWithGlobalVariablesVariableInSliceStartIdx: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[$:]" />;
  },

  name: "autocomplete for path with globalVariables variable in slice (start idx)",
};

export const AutocompleteForPathWithGlobalVariablesVariableInSliceEndIdx: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[:$]" />;
  },

  name: "autocomplete for path with globalVariables variable in slice (end idx)",
};

export const AutocompleteForPathWithGlobalVariablesVariablesInSliceStartAndEndIdx: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[$global_var_2:$]" />;
  },

  name: "autocomplete for path with globalVariables variables in slice (start and end idx)",
};

export const PathWithInvalidMathModifier: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/location.pose.x.@negative" />;
  },

  name: "path with invalid math modifier",
};

export const AutocompleteWhenPrioritizedDatatypeIsAvailable: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/" prioritizedDatatype="msgs/State" />;
  },

  name: "autocomplete when prioritized datatype is available",
};

export const AutocompleteForPathWithExistingFilter: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==1}." />;
  },

  name: "autocomplete for path with existing filter",
};

export const AutocompleteForPathWithExistingFilterUsingAGlobalVariable: StoryObj = {
  render: function Story() {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}." />;
  },

  name: "autocomplete for path with existing filter using a global variable",
};

export const PerformanceTesting: StoryObj = {
  render: function Story() {
    return <MessagePathPerformanceStory path="." />;
  },

  name: "performance testing",
};

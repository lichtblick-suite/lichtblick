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
import { fireEvent, screen, userEvent, waitFor, within } from "@storybook/testing-library";
import { useState } from "react";

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

const clickInput: StoryObj["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  fireEvent.click(await canvas.findByTestId("autocomplete-textfield"));
};

function MessagePathInputStory(props: {
  path: string;
  prioritizedDatatype?: string;
  validTypes?: string[];
  heavy?: boolean;
}): JSX.Element {
  const [path, setPath] = useState(props.path);

  return (
    <PanelSetup fixture={props.heavy ?? false ? heavyFixture : MessagePathInputStoryFixture}>
      <Stack direction="row" flex="auto" margin={1.25}>
        <MessagePathInput
          autoSize={false}
          path={path}
          validTypes={props.validTypes}
          prioritizedDatatype={props.prioritizedDatatype}
          onChange={(newPath) => {
            setPath(newPath);
          }}
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

type MsgPathInputStoryObj = StoryObj<typeof MessagePathInputStory>;

export const PathWithHeaderFields: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.header.stamp.sec" },
  play: clickInput,
};

export const AutocompleteTopics: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/" },
  play: clickInput,
};

export const AutocompleteScalarFromTopicAndEmptyPath: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "", validTypes: ["int32"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    fireEvent.click(await canvas.findByTestId("autocomplete-textfield"));
    const options = await waitFor(() => screen.queryAllByTestId("autocomplete-item"));
    fireEvent.click(options[2]!);
  },
};

export const AutocompleteScalarFromTopic: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "", validTypes: ["int32"] },
  play: async ({ canvasElement }) => {
    const { keyboard } = userEvent.setup();
    const canvas = within(canvasElement);
    const input = await canvas.findByTestId("autocomplete-textfield");

    fireEvent.click(input);
    await keyboard("/some_logs_");

    const options = await waitFor(() => screen.queryAllByTestId("autocomplete-item"));
    fireEvent.click(options[1]!);
  },
};

export const AutocompleteScalarFromFullTopic: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "", validTypes: ["int32"] },
  play: async ({ canvasElement }) => {
    const { keyboard } = userEvent.setup();
    const canvas = within(canvasElement);
    const input = await canvas.findByTestId("autocomplete-textfield");

    fireEvent.click(input);
    await keyboard("/some_logs_topic");

    const options = await waitFor(() => screen.queryAllByTestId("autocomplete-item"));
    fireEvent.click(options[0]!);
  },
};

export const AutocompleteMessagePath: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/location.po" },
  name: "Autocomplete messagePath",
  play: clickInput,
};

export const AutocompleteMessagePathLight: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/location.po" },
  name: "Autocomplete messagePath light",
  parameters: { colorScheme: "light" },
  play: clickInput,
};

export const AutocompleteFilter: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[:]{}" },
  play: clickInput,
};

export const AutocompleteTopLevelFilter: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state{}" },
  play: clickInput,
};

export const AutocompleteForGlobalVariablesVariables: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state{foo_id==0}.items[:]{id==$}" },
  name: "Autocomplete for globalVariables variables",
  play: clickInput,
};

export const PathWithValidGlobalVariablesVariable: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[:]{id==$global_var_2}" },
  name: "Path with valid globalVariables variable",
  play: clickInput,
};

export const PathWithInvalidGlobalVariablesVariable: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[:]{id==$global_var_3}" },
  name: "Path with invalid globalVariables variable",
  play: clickInput,
};

export const PathWithIncorrectlyPrefixedGlobalVariablesVariable: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[:]{id==global_var_2}" },
  name: "Path with incorrectly prefixed globalVariables variable",
  play: clickInput,
};

export const AutocompleteForPathWithGlobalVariablesVariableInSliceSingleIdx: MsgPathInputStoryObj =
  {
    render: MessagePathInputStory,
    args: { path: "/some_topic/state.items[$]" },
    name: "Autocomplete for path with globalVariables variable in slice (single idx)",
    play: clickInput,
  };

export const AutocompleteForPathWithGlobalVariablesVariableInSliceStartIdx: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[$:]" },
  name: "Autocomplete for path with globalVariables variable in slice (start idx)",
  play: clickInput,
};

export const AutocompleteForPathWithGlobalVariablesVariableInSliceEndIdx: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[:$]" },
  name: "Autocomplete for path with globalVariables variable in slice (end idx)",
  play: clickInput,
};

export const AutocompleteForPathWithGlobalVariablesVariablesInSliceStartAndEndIdx: MsgPathInputStoryObj =
  {
    render: MessagePathInputStory,
    args: { path: "/some_topic/state.items[$global_var_2:$]" },
    name: "Autocomplete for path with globalVariables variables in slice (start and end idx)",
    play: clickInput,
  };

export const PathWithInvalidMathModifier: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/location.pose.x.@negative" },
  play: clickInput,
};

export const AutocompleteWhenPrioritizedDatatypeIsAvailable: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/", prioritizedDatatype: "msgs/State" },
  play: clickInput,
};

export const AutocompleteForPathWithExistingFilter: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[:]{id==1}." },
  play: clickInput,
};

export const AutocompleteForPathWithExistingFilterUsingAGlobalVariable: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: "/some_topic/state.items[:]{id==$global_var_2}." },
  play: clickInput,
};

export const PerformanceTesting: MsgPathInputStoryObj = {
  render: MessagePathInputStory,
  args: { path: ".", heavy: true },
  play: clickInput,
};

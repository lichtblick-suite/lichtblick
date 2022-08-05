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
import { storiesOf } from "@storybook/react";
import TestUtils from "react-dom/test-utils";

import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import { basicDatatypes } from "@foxglove/studio-base/util/basicDatatypes";

import MessagePathInput from "./MessagePathInput";
import { MessagePathInputStoryFixture } from "./fixture";

let manyTopics: Topic[] = [];
for (let i = 0; i < 10; i++) {
  manyTopics = manyTopics.concat(
    Array.from(basicDatatypes.keys()).map(
      (datatype): Topic => ({ name: `/${datatype.toLowerCase()}/${i}`, datatype }),
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

const clickInputAndSelectNthResult = (el: HTMLDivElement, selectIndex: number) => {
  clickInput(el);
  setTimeout(() => {
    const select: HTMLDivElement | undefined = document.querySelectorAll("[data-test-auto-item]")[
      selectIndex
    ] as any;
    if (select) {
      TestUtils.Simulate.click(select);
    }
  });
};

function MessagePathInputStory(props: { path: string; prioritizedDatatype?: string }) {
  const [path, setPath] = React.useState(props.path);

  return (
    <MockPanelContextProvider>
      <PanelSetup fixture={MessagePathInputStoryFixture} onMount={clickInput}>
        <Stack direction="row" flex="auto" margin={1.25}>
          <MessagePathInput
            autoSize={false}
            path={path}
            prioritizedDatatype={props.prioritizedDatatype}
            onChange={(newPath) => setPath(newPath)}
          />
        </Stack>
      </PanelSetup>
    </MockPanelContextProvider>
  );
}

function MessagePathInputSelectionStory(props: {
  path: string;
  validTypes: string[];
  selectInput: number;
}) {
  const [path, setPath] = React.useState(props.path);

  const onMount = (el: HTMLDivElement) => {
    clickInputAndSelectNthResult(el, props.selectInput);
  };

  return (
    <MockPanelContextProvider>
      <PanelSetup fixture={MessagePathInputStoryFixture} onFirstMount={onMount}>
        <Stack direction="row" flex="auto" margin={1.25}>
          <MessagePathInput
            autoSize={false}
            path={path}
            validTypes={props.validTypes}
            onChange={(newPath) => setPath(newPath)}
          />
        </Stack>
      </PanelSetup>
    </MockPanelContextProvider>
  );
}

function MessagePathPerformanceStory(props: { path: string; prioritizedDatatype?: string }) {
  const [path, setPath] = React.useState(props.path);

  return (
    <MockPanelContextProvider>
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
    </MockPanelContextProvider>
  );
}

storiesOf("components/MessagePathInput", module)
  .addParameters({ colorScheme: "dark" })
  .add("path with header fields", () => {
    return <MessagePathInputStory path="/some_topic/state.header.stamp.sec" />;
  })
  .add("autocomplete topics", () => {
    return <MessagePathInputStory path="/" />;
  })
  .add("autocomplete scalar from topic", () => {
    return (
      <MessagePathInputSelectionStory path="/some_logs_" validTypes={["int32"]} selectInput={1} />
    );
  })
  .add("autocomplete scalar from full topic", () => {
    return (
      <MessagePathInputSelectionStory
        path="/some_logs_topic"
        validTypes={["int32"]}
        selectInput={0}
      />
    );
  })
  .add("autocomplete messagePath", () => {
    return <MessagePathInputStory path="/some_topic/location.po" />;
  })
  .add(
    "autocomplete messagePath light",
    () => {
      return <MessagePathInputStory path="/some_topic/location.po" />;
    },
    { colorScheme: "light" },
  )
  .add("autocomplete filter", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{}" />;
  })
  .add("autocomplete top level filter", () => {
    return <MessagePathInputStory path="/some_topic/state{}" />;
  })
  .add("autocomplete for globalVariables variables", () => {
    return <MessagePathInputStory path="/some_topic/state{foo_id==0}.items[:]{id==$}" />;
  })
  .add("path with valid globalVariables variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}" />;
  })
  .add("path with invalid globalVariables variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_3}" />;
  })
  .add("path with incorrectly prefixed globalVariables variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==global_var_2}" />;
  })
  .add("autocomplete for path with globalVariables variable in slice (single idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[$]" />;
  })
  .add("autocomplete for path with globalVariables variable in slice (start idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[$:]" />;
  })
  .add("autocomplete for path with globalVariables variable in slice (end idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:$]" />;
  })
  .add("autocomplete for path with globalVariables variables in slice (start and end idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[$global_var_2:$]" />;
  })
  .add("path with invalid math modifier", () => {
    return <MessagePathInputStory path="/some_topic/location.pose.x.@negative" />;
  })
  .add("autocomplete when prioritized datatype is available", () => {
    return <MessagePathInputStory path="/" prioritizedDatatype="msgs/State" />;
  })
  .add("autocomplete for message with json field", () => {
    return <MessagePathInputStory path="/some_logs_topic." />;
  })
  .add("autocomplete for path with existing filter", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==1}." />;
  })
  .add("autocomplete for path with existing filter using a global variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}." />;
  })
  .add("path for field inside json object", () => {
    return <MessagePathInputStory path="/some_logs_topic.myJson" />;
  })
  .add("path for multiple levels of nested fields inside json object", () => {
    return <MessagePathInputStory path="/some_logs_topic.myJson.a.b.c" />;
  })
  .add("performance testing", () => {
    return <MessagePathPerformanceStory path="." />;
  });

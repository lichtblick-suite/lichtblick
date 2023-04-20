// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { StoryObj } from "@storybook/react";

import RawMessages, { PREV_MSG_METHOD } from "@foxglove/studio-base/panels/RawMessages";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import {
  enumAdvancedFixture,
  enumFixture,
  fixture,
  multipleMessagesFilter,
  multipleNumberMessagesFixture,
  topicsToDiffFixture,
  topicsWithIdsToDiffFixture,
  withMissingData,
} from "./fixture";

const noDiffConfig = {
  expansion: "off",
  diffMethod: "custom",
  diffTopicPath: "",
  diffEnabled: false,
  showFullMessageForDiff: false,
};
const diffConfig = {
  topicPath: "/baz/enum_advanced",
  diffMethod: "custom",
  diffTopicPath: "/another/baz/enum_advanced",
  diffEnabled: true,
};

const scrollToBottom = () => {
  const scrollContainer = document.querySelectorAll(".Flex-module__scroll___3l7to")[0]!;
  scrollContainer.scrollTop = scrollContainer.scrollHeight;
};

export default {
  title: "panels/RawMessages",
};

export const Default: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/msgs/big_topic", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "default",
};

export const Schemaless: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={{
          topics: [{ name: "foo", schemaName: undefined }],
          datatypes: new Map(),
          frame: {
            ["foo"]: [
              {
                topic: "foo",
                schemaName: "",
                message: { bar: 1 },
                receiveTime: { sec: 0, nsec: 0 },
                sizeInBytes: 0,
              },
            ],
          },
        }}
      >
        <RawMessages overrideConfig={{ topicPath: "foo", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "schemaless",
};

export const Collapsed: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages
          overrideConfig={
            { topicPath: "/msgs/big_topic", ...noDiffConfig, expansion: "none" } as any
          }
        />
      </PanelSetup>
    );
  },

  name: "collapsed",
};

export const Expanded: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages
          overrideConfig={
            { topicPath: "/msgs/big_topic", ...noDiffConfig, expansion: "all" } as any
          }
        />
      </PanelSetup>
    );
  },

  name: "expanded",
};

export const Overridden: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture} includeSettings>
        <RawMessages
          overrideConfig={
            {
              topicPath: "/msgs/big_topic",
              ...noDiffConfig,
              expansion: { LotsOfStuff: "c", timestamp_array: "e" },
            } as any
          }
        />
      </PanelSetup>
    );
  },

  name: "overridden",
};

export const WithReceiveTime: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/foo", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "with receiveTime",
};

export const DisplayBigValueNum: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/num.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display big value - num",
};

export const DisplayMessageWithBigintValue: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/bigint", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display message with bigint value",
};

export const DisplayBigintValue: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/bigint.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display bigint value",
};

export const DisplayBigValueText: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/text.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display big value - text",
};

export const DisplayBigValueTextTruncated: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture} onMount={() => setImmediate(scrollToBottom)}>
        <RawMessages
          overrideConfig={{ topicPath: "/baz/text.value_long", ...noDiffConfig } as any}
        />
      </PanelSetup>
    );
  },

  name: "display big value - text truncated",
};

export const DisplayBigValueTextWithNewlines: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture} onMount={() => setImmediate(scrollToBottom)}>
        <RawMessages
          overrideConfig={{ topicPath: "/baz/text.value_with_newlines", ...noDiffConfig } as any}
        />
      </PanelSetup>
    );
  },

  name: "display big value - text with newlines",
};

export const DisplayBigValueSingleElementArray: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/array.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display big value - single element array",
};

export const DisplaySingleObjectArray: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages
          overrideConfig={{ topicPath: "/baz/array/obj.value", ...noDiffConfig } as any}
        />
      </PanelSetup>
    );
  },

  name: "display single object array",
};

export const DisplayBasicEnum: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={enumFixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/enum", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display basic enum",
};

export const DisplayAdvancedEnumUsage: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={enumAdvancedFixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/enum_advanced", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display advanced enum usage",
};

export const WithMissingData: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={withMissingData}>
        <RawMessages overrideConfig={{ topicPath: "/baz/missing_data", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "with missing data",
};

export const WithATruncatedLongString: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/baz/text", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "with a truncated long string",
};

export const DisplayGeometryTypesLength: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages overrideConfig={{ topicPath: "/geometry/types", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  },

  name: "display geometry types - length",
};

export const DisplayDiff: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={topicsToDiffFixture}>
        <RawMessages
          overrideConfig={{ ...diffConfig, expansion: "all", showFullMessageForDiff: false } as any}
        />
      </PanelSetup>
    );
  },

  name: "display diff",
};

export const DisplayFullDiff: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={topicsToDiffFixture}>
        <RawMessages
          overrideConfig={{ ...diffConfig, expansion: "all", showFullMessageForDiff: true } as any}
        />
      </PanelSetup>
    );
  },

  name: "display full diff",
};

export const DisplayDiffWithIdFields: StoryObj = {
  render: () => {
    const config = {
      ...diffConfig,
      topicPath: "/baz/enum_advanced_array.value",
      diffTopicPath: "/another/baz/enum_advanced_array.value",
      showFullMessageForDiff: false,
      expansion: "all",
    };
    return (
      <PanelSetup fixture={topicsWithIdsToDiffFixture}>
        <RawMessages overrideConfig={config as any} />
      </PanelSetup>
    );
  },

  name: "display diff with ID fields",
};

export const EmptyDiffMessage: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={{ topics: [], frame: {} }}>
        <RawMessages overrideConfig={{ ...diffConfig, showFullMessageForDiff: false } as any} />
      </PanelSetup>
    );
  },

  name: "empty diff message",
};

export const DiffSameMessages: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages
          overrideConfig={{
            topicPath: "/foo",
            diffMethod: "custom",
            diffTopicPath: "/foo",
            diffEnabled: true,
            showFullMessageForDiff: false,
          }}
        />
      </PanelSetup>
    );
  },

  name: "diff same messages",
};

export const DiffConsecutiveMessages: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages
          overrideConfig={{
            topicPath: "/foo",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
            expansion: "all",
          }}
        />
      </PanelSetup>
    );
  },

  name: "diff consecutive messages",
};

export const DiffConsecutiveMessagesWithFilter: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={multipleMessagesFilter}>
        <RawMessages
          overrideConfig={{
            topicPath: "/foo{type==2}",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
            expansion: "all",
          }}
        />
      </PanelSetup>
    );
  },

  name: "diff consecutive messages with filter",
};

export const DiffConsecutiveMessagesWithBigint: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages
          overrideConfig={{
            topicPath: "/baz/bigint",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
            expansion: "all",
          }}
        />
      </PanelSetup>
    );
  },

  name: "diff consecutive messages with bigint",
};

export const DisplayCorrectMessageWhenDiffIsDisabledEvenWithDiffMethodTopicSet: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <RawMessages
          overrideConfig={{
            topicPath: "/foo",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "/another/baz/enum_advanced",
            diffEnabled: false,
            showFullMessageForDiff: true,
            expansion: "all",
          }}
        />
      </PanelSetup>
    );
  },

  name: "display correct message when diff is disabled, even with diff method & topic set",
};

export const MultipleMessagesWithTopLevelFilter: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={multipleNumberMessagesFixture}>
        <RawMessages
          overrideConfig={
            {
              topicPath: "/multiple_number_messages{value==2}",
              ...noDiffConfig,
            } as any
          }
        />
      </PanelSetup>
    );
  },

  name: "multiple messages with top-level filter",
};

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

import { StoryFn } from "@storybook/react";

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

export const Default: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/msgs/big_topic", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

Default.storyName = "default";

export const Schemaless: StoryFn = () => {
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
};

Schemaless.storyName = "schemaless";

export const Collapsed: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{ topicPath: "/msgs/big_topic", ...noDiffConfig, expansion: "none" } as any}
      />
    </PanelSetup>
  );
};

Collapsed.storyName = "collapsed";

export const Expanded: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages
        overrideConfig={{ topicPath: "/msgs/big_topic", ...noDiffConfig, expansion: "all" } as any}
      />
    </PanelSetup>
  );
};

Expanded.storyName = "expanded";

export const Overridden: StoryFn = () => {
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
};

Overridden.storyName = "overridden";

export const WithReceiveTime: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/foo", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

WithReceiveTime.storyName = "with receiveTime";

export const DisplayBigValueNum: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/num.value", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayBigValueNum.storyName = "display big value - num";

export const DisplayMessageWithBigintValue: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/bigint", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayMessageWithBigintValue.storyName = "display message with bigint value";

export const DisplayBigintValue: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/bigint.value", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayBigintValue.storyName = "display bigint value";

export const DisplayBigValueText: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/text.value", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayBigValueText.storyName = "display big value - text";

export const DisplayBigValueTextTruncated: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture} onMount={() => setImmediate(scrollToBottom)}>
      <RawMessages overrideConfig={{ topicPath: "/baz/text.value_long", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayBigValueTextTruncated.storyName = "display big value - text truncated";

export const DisplayBigValueTextWithNewlines: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture} onMount={() => setImmediate(scrollToBottom)}>
      <RawMessages
        overrideConfig={{ topicPath: "/baz/text.value_with_newlines", ...noDiffConfig } as any}
      />
    </PanelSetup>
  );
};

DisplayBigValueTextWithNewlines.storyName = "display big value - text with newlines";

export const DisplayBigValueSingleElementArray: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/array.value", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayBigValueSingleElementArray.storyName = "display big value - single element array";

export const DisplaySingleObjectArray: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/array/obj.value", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplaySingleObjectArray.storyName = "display single object array";

export const DisplayBasicEnum: StoryFn = () => {
  return (
    <PanelSetup fixture={enumFixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/enum", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayBasicEnum.storyName = "display basic enum";

export const DisplayAdvancedEnumUsage: StoryFn = () => {
  return (
    <PanelSetup fixture={enumAdvancedFixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/enum_advanced", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayAdvancedEnumUsage.storyName = "display advanced enum usage";

export const WithMissingData: StoryFn = () => {
  return (
    <PanelSetup fixture={withMissingData}>
      <RawMessages overrideConfig={{ topicPath: "/baz/missing_data", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

WithMissingData.storyName = "with missing data";

export const WithATruncatedLongString: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/baz/text", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

WithATruncatedLongString.storyName = "with a truncated long string";

export const DisplayGeometryTypesLength: StoryFn = () => {
  return (
    <PanelSetup fixture={fixture}>
      <RawMessages overrideConfig={{ topicPath: "/geometry/types", ...noDiffConfig } as any} />
    </PanelSetup>
  );
};

DisplayGeometryTypesLength.storyName = "display geometry types - length";

export const DisplayDiff: StoryFn = () => {
  return (
    <PanelSetup fixture={topicsToDiffFixture}>
      <RawMessages
        overrideConfig={{ ...diffConfig, expansion: "all", showFullMessageForDiff: false } as any}
      />
    </PanelSetup>
  );
};

DisplayDiff.storyName = "display diff";

export const DisplayFullDiff: StoryFn = () => {
  return (
    <PanelSetup fixture={topicsToDiffFixture}>
      <RawMessages
        overrideConfig={{ ...diffConfig, expansion: "all", showFullMessageForDiff: true } as any}
      />
    </PanelSetup>
  );
};

DisplayFullDiff.storyName = "display full diff";

export const DisplayDiffWithIdFields: StoryFn = () => {
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
};

DisplayDiffWithIdFields.storyName = "display diff with ID fields";

export const EmptyDiffMessage: StoryFn = () => {
  return (
    <PanelSetup fixture={{ topics: [], frame: {} }}>
      <RawMessages overrideConfig={{ ...diffConfig, showFullMessageForDiff: false } as any} />
    </PanelSetup>
  );
};

EmptyDiffMessage.storyName = "empty diff message";

export const DiffSameMessages: StoryFn = () => {
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
};

DiffSameMessages.storyName = "diff same messages";

export const DiffConsecutiveMessages: StoryFn = () => {
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
};

DiffConsecutiveMessages.storyName = "diff consecutive messages";

export const DiffConsecutiveMessagesWithFilter: StoryFn = () => {
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
};

DiffConsecutiveMessagesWithFilter.storyName = "diff consecutive messages with filter";

export const DiffConsecutiveMessagesWithBigint: StoryFn = () => {
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
};

DiffConsecutiveMessagesWithBigint.storyName = "diff consecutive messages with bigint";

export const DisplayCorrectMessageWhenDiffIsDisabledEvenWithDiffMethodTopicSet: StoryFn = () => {
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
};

DisplayCorrectMessageWhenDiffIsDisabledEvenWithDiffMethodTopicSet.storyName =
  "display correct message when diff is disabled, even with diff method & topic set";

export const MultipleMessagesWithTopLevelFilter: StoryFn = () => {
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
};

MultipleMessagesWithTopLevelFilter.storyName = "multiple messages with top-level filter";

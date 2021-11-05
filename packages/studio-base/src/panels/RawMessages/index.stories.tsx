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

import { storiesOf } from "@storybook/react";

import RawMessages, { PREV_MSG_METHOD } from "@foxglove/studio-base/panels/RawMessages";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import {
  fixture,
  enumFixture,
  enumAdvancedFixture,
  withMissingData,
  topicsToDiffFixture,
  topicsWithIdsToDiffFixture,
  multipleNumberMessagesFixture,
} from "./fixture";

const noDiffConfig = {
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
const expandAll = () => {
  const allLabels = document.querySelectorAll("label");
  for (const label of allLabels) {
    label.click();
  }
};
const scrollToBottom = () => {
  const scrollContainer = document.querySelectorAll(".Flex-module__scroll___3l7to")[0]!;
  scrollContainer.scrollTop = scrollContainer.scrollHeight;
};

storiesOf("panels/RawMessages", module)
  .add("folded", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/msgs/big_topic", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("with receiveTime", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/foo", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display big value – num", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/num.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display message with bigint value", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/bigint", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display bigint value", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/bigint.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display big value – text", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/text.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display big value – text truncated", () => {
    return (
      <PanelSetup
        fixture={fixture}
        style={{ width: 380 }}
        onMount={() => setImmediate(scrollToBottom)}
      >
        <RawMessages
          overrideConfig={{ topicPath: "/baz/text.value_long", ...noDiffConfig } as any}
        />
      </PanelSetup>
    );
  })
  .add("display big value – text with newlines", () => {
    return (
      <PanelSetup
        fixture={fixture}
        style={{ width: 380 }}
        onMount={() => setImmediate(scrollToBottom)}
      >
        <RawMessages
          overrideConfig={{ topicPath: "/baz/text.value_with_newlines", ...noDiffConfig } as any}
        />
      </PanelSetup>
    );
  })
  .add("display big value – single element array", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/array.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display single object array", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages
          overrideConfig={{ topicPath: "/baz/array/obj.value", ...noDiffConfig } as any}
        />
      </PanelSetup>
    );
  })
  .add("display basic enum", () => {
    return (
      <PanelSetup fixture={enumFixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/enum", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display advanced enum usage", () => {
    return (
      <PanelSetup fixture={enumAdvancedFixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/enum_advanced", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("with missing data", () => {
    return (
      <PanelSetup fixture={withMissingData} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/missing_data", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("with a truncated long string", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/baz/text", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display geometry types - length", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ topicPath: "/geometry/types", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display diff", () => {
    return (
      <PanelSetup fixture={topicsToDiffFixture} style={{ width: 500 }} onMount={expandAll}>
        <RawMessages overrideConfig={{ ...diffConfig, showFullMessageForDiff: false } as any} />
      </PanelSetup>
    );
  })
  .add("display full diff", () => {
    return (
      <PanelSetup fixture={topicsToDiffFixture} style={{ width: 500 }} onMount={expandAll}>
        <RawMessages overrideConfig={{ ...diffConfig, showFullMessageForDiff: true } as any} />
      </PanelSetup>
    );
  })
  .add("display diff with ID fields", () => {
    const config = {
      ...diffConfig,
      topicPath: "/baz/enum_advanced_array.value",
      diffTopicPath: "/another/baz/enum_advanced_array.value",
      showFullMessageForDiff: false,
    };
    return (
      <PanelSetup fixture={topicsWithIdsToDiffFixture} style={{ width: 380 }} onMount={expandAll}>
        <RawMessages overrideConfig={config as any} />
      </PanelSetup>
    );
  })
  .add("empty diff message", () => {
    return (
      <PanelSetup fixture={{ topics: [], frame: {} }} style={{ width: 380 }}>
        <RawMessages overrideConfig={{ ...diffConfig, showFullMessageForDiff: false } as any} />
      </PanelSetup>
    );
  })
  .add("diff same messages", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }}>
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
  })
  .add("diff consecutive messages", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }} onMount={expandAll}>
        <RawMessages
          overrideConfig={{
            topicPath: "/foo",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("diff consecutive messages with bigint", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }} onMount={expandAll}>
        <RawMessages
          overrideConfig={{
            topicPath: "/baz/bigint",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("display correct message when diff is disabled, even with diff method & topic set", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 380 }} onMount={expandAll}>
        <RawMessages
          overrideConfig={{
            topicPath: "/foo",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "/another/baz/enum_advanced",
            diffEnabled: false,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("multiple messages with top-level filter", () => {
    return (
      <PanelSetup fixture={multipleNumberMessagesFixture} style={{ width: 380 }}>
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
  });

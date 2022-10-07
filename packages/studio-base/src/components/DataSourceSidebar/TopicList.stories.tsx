// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { TopicStats } from "@foxglove/studio-base/players/types";

import { TopicList } from "./TopicList";

function Wrapper(StoryFn: Story): JSX.Element {
  return (
    <MockMessagePipelineProvider
      topics={[
        {
          name: "/topic_1",
          schemaName: "std_msgs/String",
        },
        {
          name: '"/topic_2"',
          schemaName: "std_msgs/String",
        },
      ]}
      topicStats={
        new Map<string, TopicStats>([
          [
            "/topic_1",
            {
              numMessages: 1234,
              firstMessageTime: { sec: 1, nsec: 0 },
              lastMessageTime: { sec: 2, nsec: 0 },
            },
          ],
          [
            '"/topic_2"',
            {
              numMessages: 3456,
              firstMessageTime: { sec: 1, nsec: 0 },
              lastMessageTime: { sec: 2, nsec: 0 },
            },
          ],
        ])
      }
    >
      <StoryFn />
    </MockMessagePipelineProvider>
  );
}

export default {
  component: TopicList,
  title: "components/TopicList",
  decorators: [Wrapper],
};

export function Default(): JSX.Element {
  return <TopicList />;
}

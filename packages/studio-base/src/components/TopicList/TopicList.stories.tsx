// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Meta, StoryObj } from "@storybook/react";
import { fireEvent, userEvent, within, waitFor } from "@storybook/testing-library";
import * as _ from "lodash-es";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { ros2humble } from "@foxglove/rosmsg-msgs-common";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { PlayerCapabilities, TopicStats } from "@foxglove/studio-base/players/types";

import { TopicList } from "./TopicList";

const topics = [
  { name: "/topic_1", schemaName: "std_msgs/String" },
  { name: "/topic_2", schemaName: "std_msgs/String" },
];

const topicStats = new Map<string, TopicStats>([
  [
    "/topic_1",
    {
      numMessages: 1234,
      firstMessageTime: { sec: 1, nsec: 0 },
      lastMessageTime: { sec: 2, nsec: 0 },
    },
  ],
  [
    "/topic_2",
    {
      numMessages: 3456,
      firstMessageTime: { sec: 1, nsec: 0 },
      lastMessageTime: { sec: 2, nsec: 0 },
    },
  ],
]);

export default {
  title: "components/TopicList",
  args: {
    capabilities: [PlayerCapabilities.playbackControl],
    topics,
    datatypes: new Map(Object.entries(ros2humble)),
    topicStats,
  },
  render: (args) => (
    <DndProvider backend={HTML5Backend}>
      <MockMessagePipelineProvider {...args}>
        <TopicList />
      </MockMessagePipelineProvider>
    </DndProvider>
  ),
} as Meta<typeof MockMessagePipelineProvider>;

async function findAllByTextContent(canvasElement: HTMLElement, str: string, count: number) {
  return await waitFor(async () => {
    const items = await within(canvasElement).findAllByText(
      (_content, element) => element instanceof HTMLSpanElement && element.textContent === str,
    );
    if (items.length !== count) {
      throw new Error(`Expected ${count} items, found ${items.length}`);
    }
    return items;
  });
}

type Story = StoryObj<typeof MockMessagePipelineProvider>;

export const Default: Story = {};

export const Empty: Story = {
  args: { topics: [] },
};
export const EmptyChinese: Story = {
  args: { topics: [] },
  parameters: { forceLanguage: "zh" },
};
export const EmptyJapanese: Story = {
  args: { topics: [] },
  parameters: { forceLanguage: "ja" },
};

export const ContextMenuSingleTopic: Story = {
  play: async ({ canvasElement }) => {
    for (const item of await findAllByTextContent(canvasElement, "/topic_1", 2)) {
      fireEvent.contextMenu(item, {
        clientX: item.getBoundingClientRect().left + 100,
        clientY: item.getBoundingClientRect().top + 20,
      });
    }
  },
};

export const ContextMenuMultipleTopics: Story = {
  play: async ({ canvasElement }) => {
    const topic1s = await findAllByTextContent(canvasElement, "/topic_1", 2);
    const topic2s = await findAllByTextContent(canvasElement, "/topic_2", 2);
    for (const [topic1, topic2] of _.zip(topic1s, topic2s)) {
      if (!topic1 || !topic2) {
        continue;
      }
      fireEvent.click(topic1);
      fireEvent.click(topic2, { metaKey: true });
      fireEvent.contextMenu(topic1, {
        clientX: topic1.getBoundingClientRect().left + 100,
        clientY: topic1.getBoundingClientRect().top + 20,
      });
    }
  },
};

export const ContextMenuSinglePath: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "data");
    }

    const pathItems = await findAllByTextContent(canvasElement, ".data", 4);

    for (const item of pathItems) {
      fireEvent.contextMenu(item, {
        clientX: item.getBoundingClientRect().left + 100,
        clientY: item.getBoundingClientRect().top + 20,
      });
    }
  },
};

export const ContextMenuMultiplePaths: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "data");
    }

    const topic1Items = await findAllByTextContent(canvasElement, "/topic_1", 2);
    const pathItems = await findAllByTextContent(canvasElement, ".data", 4);

    for (const item of topic1Items) {
      fireEvent.click(item);
    }
    for (const item of pathItems) {
      fireEvent.click(item, { shiftKey: true });
    }
    for (const item of topic1Items) {
      fireEvent.contextMenu(item, {
        clientX: item.getBoundingClientRect().left + 100,
        clientY: item.getBoundingClientRect().top + 20,
      });
    }
  },
};

export const FilterByTopicName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "/topic_1");
    }
  },
};

export const FilterBySchemaName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "std_msgs/String");
    }
  },
};

export const FilterByFieldName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "data");
    }
  },
};

export const FilterByMessagePath: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await userEvent.type(input, "to1da");
    }
  },
};

export const FilterTextCleared: Story = {
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");

    for (const input of filterInputs) {
      await user.type(input, "/topic_1");
    }

    const clearButtons = await canvas.findAllByTitle("Clear filter");

    for (const button of clearButtons) {
      await user.click(button);
    }
  },
};

export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    const canvas = within(canvasElement);
    const filterInputs = await canvas.findAllByTestId("topic-filter");
    for (const input of filterInputs) {
      await user.type(input, "asdfasdf");
    }
  },
};

export const NoResultsChinese: Story = {
  ...NoResults,
  parameters: { forceLanguage: "zh" },
};
export const NoResultsJapanese: Story = {
  ...NoResults,
  parameters: { forceLanguage: "ja" },
};

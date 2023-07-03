// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj, StoryFn, Meta } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";

import { CreateEventDialog } from "./CreateEventDialog";

export default {
  component: CreateEventDialog,
  title: "components/CreateEventDialog",
  args: { onClose: () => {} },
  decorators: [
    (Wrapped: StoryFn): JSX.Element => {
      return (
        <EventsProvider>
          <MockMessagePipelineProvider>
            <Wrapped />
          </MockMessagePipelineProvider>
        </EventsProvider>
      );
    },
  ],
  parameters: {
    colorScheme: "light",
  },
} as Meta<typeof CreateEventDialog>;

export const Empty: StoryObj = {};

export const Normal: StoryObj = {
  play: async () => {
    const { click, keyboard } = userEvent.setup();
    const firstKey = await screen.findByPlaceholderText("Key (string)");
    await click(firstKey);
    await keyboard("1");

    const firstValue = await screen.findByPlaceholderText("Value (string)");
    await click(firstValue);
    await keyboard("2");

    const firstPlus = await screen.findByTestId("add");
    await click(firstPlus);

    const secondKey = await screen.findAllByPlaceholderText("Key (string)");
    await click(secondKey[1]!);
    await keyboard("3");

    const secondValue = await screen.findAllByPlaceholderText("Value (string)");
    await click(secondValue[1]!);
    await keyboard("4");
  },
};

export const WithDuplicates: StoryObj = {
  play: async () => {
    const { click, keyboard } = userEvent.setup();
    const firstKey = await screen.findByPlaceholderText("Key (string)");
    await click(firstKey);
    await keyboard("1");

    const firstValue = await screen.findByPlaceholderText("Value (string)");
    await click(firstValue);
    await keyboard("2");

    const firstPlus = await screen.findByTestId("add");
    await click(firstPlus);

    const secondKey = await screen.findAllByPlaceholderText("Key (string)");
    await click(secondKey[1]!);
    await keyboard("1");

    const secondValue = await screen.findAllByPlaceholderText("Value (string)");
    await click(secondValue[1]!);
    await keyboard("2");
  },
};

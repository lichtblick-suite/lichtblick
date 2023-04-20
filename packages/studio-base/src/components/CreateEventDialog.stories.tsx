// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj, StoryFn } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";

import { CreateEventDialog } from "./CreateEventDialog";

export default {
  component: CreateEventDialog,
  title: "components/CreateEventDialog",
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
};

export const Empty: StoryObj = {
  render: () => {
    return <CreateEventDialog onClose={() => undefined} />;
  },
};

export const Normal: StoryObj = {
  render: () => {
    return <CreateEventDialog onClose={() => {}} />;
  },

  play: async () => {
    const firstKey = await screen.findByPlaceholderText("Key (string)");
    userEvent.click(firstKey);
    userEvent.keyboard("1");

    const firstValue = await screen.findByPlaceholderText("Value (string)");
    userEvent.click(firstValue);
    userEvent.keyboard("2");

    const firstPlus = await screen.findByTestId("add");
    userEvent.click(firstPlus);

    const secondKey = await screen.findAllByPlaceholderText("Key (string)");
    userEvent.click(secondKey[1]!);
    userEvent.keyboard("3");

    const secondValue = await screen.findAllByPlaceholderText("Value (string)");
    userEvent.click(secondValue[1]!);
    userEvent.keyboard("4");
  },
};

export const WithDuplicates: StoryObj = {
  render: () => {
    return <CreateEventDialog onClose={() => {}} />;
  },

  play: async () => {
    const firstKey = await screen.findByPlaceholderText("Key (string)");
    userEvent.click(firstKey);
    userEvent.keyboard("1");

    const firstValue = await screen.findByPlaceholderText("Value (string)");
    userEvent.click(firstValue);
    userEvent.keyboard("2");

    const firstPlus = await screen.findByTestId("add");
    userEvent.click(firstPlus);

    const secondKey = await screen.findAllByPlaceholderText("Key (string)");
    userEvent.click(secondKey[1]!);
    userEvent.keyboard("1");

    const secondValue = await screen.findAllByPlaceholderText("Value (string)");
    userEvent.click(secondValue[1]!);
    userEvent.keyboard("2");
  },
};

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";

import { CreateEventDialog } from "./CreateEventDialog";

export default {
  component: CreateEventDialog,
  title: "components/CreateEventDialog",
  decorators: [
    (StoryFn: Story): JSX.Element => {
      return (
        <EventsProvider>
          <MockMessagePipelineProvider>
            <StoryFn />
          </MockMessagePipelineProvider>
        </EventsProvider>
      );
    },
  ],
  parameters: {
    colorScheme: "light",
  },
};

export function Empty(): JSX.Element {
  return <CreateEventDialog onClose={() => undefined} />;
}

export const Normal: Story = () => {
  return <CreateEventDialog onClose={() => {}} />;
};

Normal.play = async () => {
  const user = userEvent.setup();

  const firstKey = await screen.findByPlaceholderText("Key (string)");
  await user.click(firstKey);
  await user.keyboard("1");

  const firstValue = await screen.findByPlaceholderText("Value (string)");
  await user.click(firstValue);
  await user.keyboard("2");

  const firstPlus = await screen.findByTestId("add");
  await user.click(firstPlus);

  const secondKey = await screen.findAllByPlaceholderText("Key (string)");
  await user.click(secondKey[1]!);
  await user.keyboard("3");

  const secondValue = await screen.findAllByPlaceholderText("Value (string)");
  await user.click(secondValue[1]!);
  await user.keyboard("4");
};

export const WithDuplicates: Story = () => {
  return <CreateEventDialog onClose={() => {}} />;
};

WithDuplicates.play = async () => {
  const user = userEvent.setup();

  const firstKey = await screen.findByPlaceholderText("Key (string)");
  await user.click(firstKey);
  await user.keyboard("1");

  const firstValue = await screen.findByPlaceholderText("Value (string)");
  await user.click(firstValue);
  await user.keyboard("2");

  const firstPlus = await screen.findByTestId("add");
  await user.click(firstPlus);

  const secondKey = await screen.findAllByPlaceholderText("Key (string)");
  await user.click(secondKey[1]!);
  await user.keyboard("1");

  const secondValue = await screen.findAllByPlaceholderText("Value (string)");
  await user.click(secondValue[1]!);
  await user.keyboard("2");
};

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";
import { useEffect } from "react";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { useEvents } from "@foxglove/studio-base/context/EventsContext";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";
import { makeMockEvents } from "@foxglove/studio-base/test/mocks/makeMockEvents";

import { EventsList } from "./EventsList";

function Wrapper(Child: Story): JSX.Element {
  return (
    <MockMessagePipelineProvider>
      <EventsProvider>
        <Child />
      </EventsProvider>
    </MockMessagePipelineProvider>
  );
}

export default {
  title: "components/EventsList",
  component: EventsList,
  decorators: [Wrapper],
};

export function Default(): JSX.Element {
  const setEvents = useEvents((store) => store.setEvents);
  useEffect(() => {
    setEvents({ loading: false, value: makeMockEvents(20) });
  }, [setEvents]);

  return <EventsList />;
}

export function Selected(): JSX.Element {
  const setEvents = useEvents((store) => store.setEvents);
  const selectEvent = useEvents((store) => store.selectEvent);

  useEffect(() => {
    const events = makeMockEvents(20);

    setEvents({ loading: false, value: events });
  }, [selectEvent, setEvents]);

  return <EventsList />;
}
Selected.play = async () => {
  const events = await screen.findAllByTestId("sidebar-event");
  userEvent.click(events[1]!);
};
Selected.parameters = {
  colorScheme: "light",
};

export function WithError(): JSX.Element {
  const setEvents = useEvents((store) => store.setEvents);
  useEffect(() => {
    setEvents({ loading: false, error: new Error("Error loading events") });
  }, [setEvents]);

  return <EventsList />;
}

export function Loading(): JSX.Element {
  const setEvents = useEvents((store) => store.setEvents);
  useEffect(() => {
    setEvents({ loading: true });
  }, [setEvents]);

  return <EventsList />;
}

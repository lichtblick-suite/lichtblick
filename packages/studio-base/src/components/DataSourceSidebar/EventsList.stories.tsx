// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { range } from "lodash";
import { useEffect } from "react";

import { toNanoSec } from "@foxglove/rostime";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { useEvents } from "@foxglove/studio-base/context/EventsContext";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";

import { EventsList } from "./EventsList";

function Wrapper(Child: Story, ctx: StoryContext): JSX.Element {
  return (
    <MockMessagePipelineProvider
      urlState={{
        sourceId: "foxglove-data-platform",
        parameters: { eventId: ctx.parameters.targetEventId },
      }}
    >
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

function makeEvents(count: number) {
  return range(0, count).map((idx) => ({
    id: `event_${idx + 1}`,
    timestampNanos: toNanoSec({ sec: idx + 100, nsec: 123456789 }).toString(),
    metadata: {
      type: ["type A", "type B", "type C"][idx % 3]!,
      state: ["🤖", "🚎", "🚜"][idx % 3]!,
    },
    createdAt: new Date(2020, 1, 1).toISOString(),
    updatedAt: new Date(2020, 1, 1).toISOString(),
    deviceId: `device_${idx + 1}`,
    durationNanos: "100",
  }));
}

export function Default(): JSX.Element {
  const setEvents = useEvents((store) => store.setEvents);
  useEffect(() => {
    setEvents({ loading: false, value: makeEvents(20) });
  }, [setEvents]);

  return <EventsList />;
}

export function Filtered(): JSX.Element {
  const setEvents = useEvents((store) => store.setEvents);
  useEffect(() => {
    setEvents({ loading: false, value: makeEvents(20) });
  }, [setEvents]);

  return <EventsList />;
}
Filtered.play = async () => {
  const user = userEvent.setup();
  const filter = await screen.findByPlaceholderText("Filter event metadata");
  await user.click(filter);
  await user.keyboard("type a");
};
Filtered.parameters = {
  colorScheme: "light",
};

export function Selected(): JSX.Element {
  const setEvents = useEvents((store) => store.setEvents);
  const selectEvent = useEvents((store) => store.selectEvent);

  useEffect(() => {
    const events = makeEvents(20);

    setEvents({ loading: false, value: events });
  }, [selectEvent, setEvents]);

  return <EventsList />;
}
Selected.play = async () => {
  const user = userEvent.setup();
  const events = await screen.findAllByTestId("sidebar-event");
  await user.click(events[1]!);
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

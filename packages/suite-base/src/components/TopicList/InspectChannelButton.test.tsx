/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";

import { Channel } from "@lichtblick/suite";

import { InspectChannelButton } from "./InspectChannelButton";

const mockAddPanel = jest.fn();
jest.mock("@lichtblick/suite-base/hooks/useAddPanel", () => ({
  __esModule: true,
  default: () => mockAddPanel,
}));

it.each([
  "first",
  "second",
  "virtual-output",
])("opens exactly channel %s under its source topic", (id) => {
  const channel: Channel = {
    id,
    topic: "/shared",
    schemaName: "Message",
    source: { kind: "native" },
  };
  render(<InspectChannelButton channel={channel} />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
  expect(mockAddPanel).toHaveBeenLastCalledWith({
    type: "RawMessagesVirtual",
    config: { topicPath: "/shared", channelId: id },
  });
});

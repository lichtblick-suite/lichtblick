/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { Channel } from "@lichtblick/suite";

import { ChannelPicker } from "./ChannelPicker";

const channels: Channel[] = [
  {
    id: "first",
    topic: "/shared",
    schemaName: "Message",
    source: { kind: "native" },
  },
  {
    id: "second",
    topic: "/shared",
    schemaName: "Message",
    source: { kind: "native" },
  },
  {
    id: "converted-first",
    topic: "/shared",
    schemaName: "Output",
    source: { kind: "converted", inputChannelId: "first", converterId: "A" },
  },
  {
    id: "converted-second",
    topic: "/shared",
    schemaName: "Output",
    source: { kind: "converted", inputChannelId: "second", converterId: "A" },
  },
];
jest.mock("@lichtblick/suite-base/hooks/useChannels", () => ({
  useChannels: () => channels,
}));

it("lists same-topic channels distinctly and returns the exact selected producer", () => {
  const onChange = jest.fn();
  render(<ChannelPicker topic="/shared" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Channel" }));
  const options = screen.getAllByRole("menuitem");
  expect(options).toHaveLength(4);
  expect(new Set(options.map((option) => option.textContent)).size).toBe(4);
  fireEvent.click(options[1]!);
  expect(onChange).toHaveBeenLastCalledWith(channels[1]);
  fireEvent.click(screen.getByRole("button", { name: "Channel" }));
  fireEvent.click(screen.getAllByRole("menuitem")[3]!);
  expect(onChange).toHaveBeenLastCalledWith(channels[3]);
});

it("shows an unavailable saved channel without silently selecting a different stream", () => {
  render(<ChannelPicker topic="/shared" channelId="missing" onChange={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Channel" })).toHaveTextContent("Unavailable: missing");
});

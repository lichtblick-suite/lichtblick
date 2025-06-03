/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import { TopicList } from "./TopicList";

// Mock dependencies
jest.mock("@lichtblick/suite-base/components/MessagePipeline");
jest.mock("./useTopicListSearch");
jest.mock("./useMultiSelection", () => ({
  useMultiSelection: jest.fn().mockReturnValue({ selectedIndexes: [] }),
}));

// Mock for useMessagePipeline
const mockUseMessagePipeline = (playerPresence: PlayerPresence) => {
  (useMessagePipeline as jest.Mock).mockReturnValue(playerPresence);
};
// Helper to render TopicList with default mocks
const setup = (playerPresence: PlayerPresence) => {
  mockUseMessagePipeline(playerPresence);
  return render(<TopicList />);
};

describe("TopicList Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders EmptyState when playerPresence is NOT_PRESENT", () => {
    const { getByText } = setup(PlayerPresence.NOT_PRESENT);
    expect(getByText("No data source selected")).toBeInTheDocument();
  });

  it("renders EmptyState when playerPresence is ERROR", () => {
    const { getByText } = setup(PlayerPresence.ERROR);
    expect(getByText("An error occurred")).toBeInTheDocument();
  });

  it("renders loading state when playerPresence is INITIALIZING", () => {
    const { getByPlaceholderText, getAllByRole } = setup(PlayerPresence.INITIALIZING);
    expect(getByPlaceholderText("Waiting for data…")).toBeInTheDocument();
    expect(getAllByRole("listitem")).toHaveLength(16);
  });
});

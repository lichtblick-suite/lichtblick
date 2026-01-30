/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { FzfResultItem } from "fzf";

import { Topic } from "@lichtblick/suite-base/players/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import { TopicRow } from "./TopicRow";
import { useTopicMessageNavigation } from "./useTopicMessageNavigation";

const mockUseMessagePipeline = jest.fn();
jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipeline: (selector: unknown) => mockUseMessagePipeline(selector),
}));

jest.mock("@lichtblick/suite-base/services/messagePathDragging", () => ({
  useMessagePathDrag: jest.fn().mockReturnValue({
    connectDragSource: jest.fn(),
    connectDragPreview: jest.fn(),
    cursor: "default",
    isDragging: false,
    draggedItemCount: 0,
  }),
}));

jest.mock("./useTopicMessageNavigation");

interface SetupOptions {
  topicName?: string;
  isNavigating?: boolean;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
}

function setup(options: SetupOptions = {}) {
  const {
    topicName = `/${BasicBuilder.string()}`,
    isNavigating = false,
    canNavigateNext = true,
    canNavigatePrevious = true,
  } = options;

  const handleNextMessage = jest.fn().mockResolvedValue(undefined);
  const handlePreviousMessage = jest.fn().mockResolvedValue(undefined);

  mockUseMessagePipeline.mockReturnValue([{ topic: topicName }]);

  (useTopicMessageNavigation as jest.Mock).mockReturnValue({
    handleNextMessage,
    handlePreviousMessage,
    isNavigating,
    canNavigateNext,
    canNavigatePrevious,
  });

  const topicResult: FzfResultItem<Topic> = {
    item: { name: topicName, schemaName: "test/Schema" },
    start: 0,
    end: topicName.length,
    score: 1,
    positions: new Set<number>(),
  };

  render(
    <TopicRow
      topicResult={topicResult}
      style={{}}
      selected={true}
      onClick={jest.fn()}
      onContextMenu={jest.fn()}
    />,
  );

  return { handleNextMessage, handlePreviousMessage, topicName };
}

describe("TopicRow navigation buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders navigation buttons", () => {
    // Given / When
    setup();

    // Then
    expect(screen.getByRole("button", { name: "Previous message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next message" })).toBeInTheDocument();
  });

  it("calls handleNextMessage when next button is clicked", () => {
    // Given
    const { handleNextMessage } = setup();

    // When
    fireEvent.click(screen.getByRole("button", { name: "Next message" }));

    // Then
    expect(handleNextMessage).toHaveBeenCalledTimes(1);
  });

  it("calls handlePreviousMessage when previous button is clicked", () => {
    // Given
    const { handlePreviousMessage } = setup();

    // When
    fireEvent.click(screen.getByRole("button", { name: "Previous message" }));

    // Then
    expect(handlePreviousMessage).toHaveBeenCalledTimes(1);
  });

  it("passes correct props to useTopicMessageNavigation", () => {
    // Given
    const topicName = `/${BasicBuilder.string()}`;

    // When
    setup({ topicName });

    // Then
    expect(useTopicMessageNavigation).toHaveBeenCalledWith({
      topicName,
      selected: true,
      isTopicSubscribed: true,
    });
  });

  it("disables both navigation buttons when isNavigating is true", () => {
    // Given / When
    setup({ isNavigating: true });

    // Then
    expect(screen.getByRole("button", { name: "Previous message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next message" })).toBeDisabled();
  });

  it("disables next button when canNavigateNext is false", () => {
    // Given / When
    setup({ canNavigateNext: false });

    // Then
    expect(screen.getByRole("button", { name: "Previous message" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next message" })).toBeDisabled();
  });

  it("disables previous button when canNavigatePrevious is false", () => {
    // Given / When
    setup({ canNavigatePrevious: false });

    // Then
    expect(screen.getByRole("button", { name: "Previous message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next message" })).toBeEnabled();
  });
});

/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { getDraggedMessagePath } from "@lichtblick/suite-base/components/TopicList/getDraggedMessagePath";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { MessagePathSelectionProvider } from "@lichtblick/suite-base/services/messagePathDragging/MessagePathSelectionProvider";

import { TopicList } from "./TopicList";
import { useMultiSelection } from "./useMultiSelection";
import { TopicListItem, useTopicListSearch } from "./useTopicListSearch";

// Mock dependencies
vi.mock("@lichtblick/suite-base/components/MessagePipeline");
vi.mock("./useTopicListSearch");
vi.mock("./useMultiSelection", async () => ({
  useMultiSelection: vi.fn().mockReturnValue({
    selectedIndexes: new Set(),
    onSelect: vi.fn(),
    getSelectedIndexes: vi.fn().mockReturnValue(new Set()),
  }),
}));
vi.mock("@lichtblick/suite-base/components/TopicList/getDraggedMessagePath");
vi.mock("@lichtblick/suite-base/services/messagePathDragging/MessagePathSelectionProvider", async () => ({
    MessagePathSelectionProvider: vi.fn(({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    )),
  }),
);
vi.mock("@lichtblick/suite-base/components/DirectTopicStatsUpdater", async () => ({
  DirectTopicStatsUpdater: () => undefined,
}));

const mockUseMessagePipeline = (playerPresence: PlayerPresence) => {
  (useMessagePipeline as Mock).mockReturnValue(playerPresence);
};

const setup = (playerPresence: PlayerPresence) => {
  mockUseMessagePipeline(playerPresence);
  return render(<TopicList />);
};

describe("TopicList Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

describe("getSelectedItemsAsDraggedMessagePaths", () => {
  const createTopicItem = (name: string, schemaName: string): TopicListItem => ({
    type: "topic" as const,
    item: {
      item: { name, schemaName },
      score: 0,
      positions: new Set<number>(),
      start: 0,
      end: 0,
    },
  });

  const createDraggedPath = (topicName: string): DraggedMessagePath => ({
    path: topicName,
    rootSchemaName: "TestSchema",
    isTopic: true,
    isLeaf: false,
    topicName,
  });

  const getCapturedGetSelectedItems = (): (() => DraggedMessagePath[]) => {
    const mockCalls = (MessagePathSelectionProvider as unknown as Mock).mock.calls;
    const lastCallProps = mockCalls[mockCalls.length - 1]![0] as {
      getSelectedItems: () => DraggedMessagePath[];
    };
    return lastCallProps.getSelectedItems;
  };

  const setupSelectedItems = ({
    treeItems,
    selectedIndexes,
  }: {
    treeItems: TopicListItem[];
    selectedIndexes: Set<number>;
  }) => {
    (useTopicListSearch as Mock).mockReturnValue(treeItems);
    (useMultiSelection as Mock).mockReturnValue({
      selectedIndexes,
      onSelect: vi.fn(),
      getSelectedIndexes: vi.fn().mockReturnValue(selectedIndexes),
    });
    setup(PlayerPresence.PRESENT);
    return getCapturedGetSelectedItems();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no indexes are selected", () => {
    const treeItems: TopicListItem[] = [createTopicItem("/topic1", "Schema1")];

    const getSelectedItems = setupSelectedItems({
      treeItems,
      selectedIndexes: new Set<number>(),
    });

    expect(getSelectedItems()).toEqual([]);
  });

  it("returns DraggedMessagePaths for selected indexes in sorted order", () => {
    const treeItems: TopicListItem[] = [
      createTopicItem("/topic1", "Schema1"),
      createTopicItem("/topic2", "Schema2"),
      createTopicItem("/topic3", "Schema3"),
    ];
    const draggedPath0 = createDraggedPath("/topic1");
    const draggedPath2 = createDraggedPath("/topic3");

    (getDraggedMessagePath as Mock).mockImplementation((item: TopicListItem) => {
      if (item === treeItems[0]) {
        return draggedPath0;
      }
      if (item === treeItems[2]) {
        return draggedPath2;
      }
      return undefined;
    });

    const getSelectedItems = setupSelectedItems({
      treeItems,
      selectedIndexes: new Set([2, 0]),
    });

    const result = getSelectedItems();
    expect(result).toEqual([draggedPath0, draggedPath2]);
  });

  it("filters out items when index is out of bounds", () => {
    const treeItems: TopicListItem[] = [createTopicItem("/topic1", "Schema1")];
    const draggedPath0 = createDraggedPath("/topic1");

    (getDraggedMessagePath as Mock).mockReturnValue(draggedPath0);

    const getSelectedItems = setupSelectedItems({
      treeItems,
      selectedIndexes: new Set([0, 5]),
    });

    const result = getSelectedItems();
    expect(result).toHaveLength(1);
    expect(result).toEqual([draggedPath0]);
  });
});

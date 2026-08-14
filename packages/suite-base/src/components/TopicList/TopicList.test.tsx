/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { DraggedMessagePath } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { getDraggedMessagePath } from "@lichtblick/suite-base/components/TopicList/getDraggedMessagePath";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { MessagePathSelectionProvider } from "@lichtblick/suite-base/services/messagePathDragging/MessagePathSelectionProvider";

import { TopicList } from "./TopicList";
import { useMultiSelection } from "./useMultiSelection";
import { TopicListItem, useTopicListSearch } from "./useTopicListSearch";

// Mock dependencies
jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: jest.fn().mockReturnValue({ topics: [], datatypes: {} }),
}));
jest.mock("@lichtblick/suite-base/components/MessagePipeline");
jest.mock("./useTopicListSearch");
jest.mock("./useMultiSelection", () => ({
  useMultiSelection: jest.fn().mockReturnValue({
    selectedIndexes: new Set(),
    onSelect: jest.fn(),
    getSelectedIndexes: jest.fn().mockReturnValue(new Set()),
  }),
}));
jest.mock("@lichtblick/suite-base/components/TopicList/getDraggedMessagePath");
jest.mock(
  "@lichtblick/suite-base/services/messagePathDragging/MessagePathSelectionProvider",
  () => ({
    MessagePathSelectionProvider: jest.fn(({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    )),
  }),
);
jest.mock("@lichtblick/suite-base/components/DirectTopicStatsUpdater", () => ({
  DirectTopicStatsUpdater: () => undefined,
}));
jest.mock("react-virtualized-auto-sizer", () => ({
  __esModule: true,
  default: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children({ width: 800, height: 600 })}</>,
}));
// Lightweight stand-ins so renderRow branches execute without full component trees
jest.mock("./TopicRow", () => ({
  TopicRow: ({
    topicResult,
    onClick,
    onContextMenu,
  }: {
    topicResult: { item: { name: string } };
    onClick?: React.MouseEventHandler;
    onContextMenu?: React.MouseEventHandler;
  }) => (
    <div data-testid="topic-row" onClick={onClick} onContextMenu={onContextMenu}>
      {topicResult.item.name}
    </div>
  ),
}));
jest.mock("./MessagePathRow", () => ({
  MessagePathRow: ({
    messagePathResult,
    onClick,
    onContextMenu,
  }: {
    messagePathResult: { item: { path: string } };
    onClick?: React.MouseEventHandler;
    onContextMenu?: React.MouseEventHandler;
  }) => (
    <div data-testid="schema-row" onClick={onClick} onContextMenu={onContextMenu}>
      {messagePathResult.item.path}
    </div>
  ),
}));
jest.mock("@lichtblick/suite-base/components/TopicList/ContextMenu", () => ({
  ContextMenu: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="context-menu">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

const mockUseMessagePipeline = (playerPresence: PlayerPresence) => {
  (useMessagePipeline as jest.Mock).mockReturnValue(playerPresence);
};

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

  it("renders EmptyState with 'no topics' when PRESENT and treeItems is empty", () => {
    (useTopicListSearch as jest.Mock).mockReturnValue([]);
    setup(PlayerPresence.PRESENT);
    expect(screen.getByText(/No topics available/)).toBeInTheDocument();
  });

  it("renders EmptyState with reconnecting message when RECONNECTING", () => {
    (useTopicListSearch as jest.Mock).mockReturnValue([]);
    setup(PlayerPresence.RECONNECTING);
    expect(screen.getByText(/Waiting for connection/)).toBeInTheDocument();
  });
  it("renders VirtualList with TopicRow when PRESENT and treeItems has topic items", () => {
    const topicItem: TopicListItem = {
      type: "topic",
      item: {
        item: { name: "/test/topic", schemaName: "std_msgs/String" },
        score: 0,
        positions: new Set<number>(),
        start: 0,
        end: 0,
      },
    };
    (useTopicListSearch as jest.Mock).mockReturnValue([topicItem]);
    setup(PlayerPresence.PRESENT);
    expect(screen.getByTestId("topic-row")).toBeInTheDocument();
    expect(screen.getByText("/test/topic")).toBeInTheDocument();
  });

  it("renders VirtualList with MessagePathRow when PRESENT and treeItems has schema items", () => {
    const schemaItem: TopicListItem = {
      type: "schema",
      item: {
        item: { path: "/test/topic.field", topic: "/test/topic" } as never,
        score: 0,
        positions: new Set<number>(),
        start: 0,
        end: 0,
      },
    };
    (useTopicListSearch as jest.Mock).mockReturnValue([schemaItem]);
    setup(PlayerPresence.PRESENT);
    expect(screen.getByTestId("schema-row")).toBeInTheDocument();
  });

  it("shows filter-no-match EmptyState when PRESENT with filter text and empty results", () => {
    (useTopicListSearch as jest.Mock).mockReturnValue([]);
    setup(PlayerPresence.PRESENT);

    const searchInput = screen.getByRole("textbox");
    fireEvent.change(searchInput, { target: { value: "nomatch" } });

    // undebouncedFilterText is set immediately; the EmptyState switches to the
    // filter-no-match message before the debounce fires.
    expect(screen.getByText(/No topics or datatypes matching/)).toBeInTheDocument();
  });

  it("calls onSelect when a topic row is clicked", () => {
    const onSelect = jest.fn();
    (useMultiSelection as jest.Mock).mockReturnValue({
      selectedIndexes: new Set(),
      onSelect,
      getSelectedIndexes: jest.fn().mockReturnValue(new Set()),
    });
    const topicItem: TopicListItem = {
      type: "topic",
      item: {
        item: { name: "/click/topic", schemaName: "std_msgs/String" },
        score: 0,
        positions: new Set<number>(),
        start: 0,
        end: 0,
      },
    };
    (useTopicListSearch as jest.Mock).mockReturnValue([topicItem]);
    setup(PlayerPresence.PRESENT);

    fireEvent.click(screen.getByTestId("topic-row"));

    expect(onSelect).toHaveBeenCalledWith({ index: 0, modKey: false, shiftKey: false });
  });

  it("opens context menu on right-click of a topic row", () => {
    const topicItem: TopicListItem = {
      type: "topic",
      item: {
        item: { name: "/ctx/topic", schemaName: "std_msgs/String" },
        score: 0,
        positions: new Set<number>(),
        start: 0,
        end: 0,
      },
    };
    (useTopicListSearch as jest.Mock).mockReturnValue([topicItem]);
    setup(PlayerPresence.PRESENT);

    fireEvent.contextMenu(screen.getByTestId("topic-row"));

    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("closes context menu when onClose is triggered", () => {
    const topicItem: TopicListItem = {
      type: "topic",
      item: {
        item: { name: "/ctx/topic", schemaName: "std_msgs/String" },
        score: 0,
        positions: new Set<number>(),
        start: 0,
        end: 0,
      },
    };
    (useTopicListSearch as jest.Mock).mockReturnValue([topicItem]);
    setup(PlayerPresence.PRESENT);

    fireEvent.contextMenu(screen.getByTestId("topic-row"));
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();

    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
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
    const mockCalls = (MessagePathSelectionProvider as unknown as jest.Mock).mock.calls;
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
    (useTopicListSearch as jest.Mock).mockReturnValue(treeItems);
    (useMultiSelection as jest.Mock).mockReturnValue({
      selectedIndexes,
      onSelect: jest.fn(),
      getSelectedIndexes: jest.fn().mockReturnValue(selectedIndexes),
    });
    setup(PlayerPresence.PRESENT);
    return getCapturedGetSelectedItems();
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    (getDraggedMessagePath as jest.Mock).mockImplementation((item: TopicListItem) => {
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

    (getDraggedMessagePath as jest.Mock).mockReturnValue(draggedPath0);

    const getSelectedItems = setupSelectedItems({
      treeItems,
      selectedIndexes: new Set([0, 5]),
    });

    const result = getSelectedItems();
    expect(result).toHaveLength(1);
    expect(result).toEqual([draggedPath0]);
  });
});

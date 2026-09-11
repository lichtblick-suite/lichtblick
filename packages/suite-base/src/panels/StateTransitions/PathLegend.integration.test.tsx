/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Integration test using the real react-dnd HTML5 backend (the same backend used by both the web
// and desktop apps) to verify the series label becomes a native drag source. This guards against
// the MUI Button ref not forwarding to a real DOM node on either platform.

import { render, screen } from "@testing-library/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { Topic } from "@lichtblick/suite-base/players/types";

import { PathLegend } from "./PathLegend";

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext");
jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions");
jest.mock("@lichtblick/suite-base/components/MessagePipeline");

describe("PathLegend drag source integration (real HTML5 backend)", () => {
  const topics: Topic[] = [{ name: "/foo", schemaName: "pkg/Foo" }];

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (useSelectedPanels as jest.Mock).mockReturnValue({ setSelectedPanelIds: jest.fn() });
    (useWorkspaceActions as jest.Mock).mockReturnValue({ openPanelSettings: jest.fn() });
    (useMessagePipeline as jest.Mock).mockImplementation(
      (selector: (ctx: MessagePipelineContext) => unknown) =>
        selector({ sortedTopics: topics } as unknown as MessagePipelineContext),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("makes the series label a native draggable element", () => {
    render(
      <DndProvider backend={HTML5Backend}>
        <MockPanelContextProvider id="panel-a">
          <PathLegend
            heightPerTopic={20}
            paths={[{ value: "/foo.bar", timestampMethod: "receiveTime" }]}
            saveConfig={jest.fn()}
            setFocusedPath={jest.fn()}
          />
        </MockPanelContextProvider>
      </DndProvider>,
    );

    const button = screen.getByTestId("edit-topic-button-0");
    expect(button.getAttribute("draggable")).toBe("true");
  });

  it("does not make the placeholder row draggable", () => {
    render(
      <DndProvider backend={HTML5Backend}>
        <MockPanelContextProvider id="panel-a">
          <PathLegend
            heightPerTopic={20}
            paths={[]}
            saveConfig={jest.fn()}
            setFocusedPath={jest.fn()}
          />
        </MockPanelContextProvider>
      </DndProvider>,
    );

    const button = screen.getByTestId("edit-topic-button-0");
    expect(button.getAttribute("draggable")).not.toBe("true");
  });
});

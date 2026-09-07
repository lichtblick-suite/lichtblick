/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { UserScriptLog } from "@lichtblick/suite-base/players/UserScriptPlayer/types";
import UserScriptBuilder from "@lichtblick/suite-base/testing/builders/UserScriptBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import LogsSection from "./LogsSection";

jest.mock("react-json-tree", () => ({
  __esModule: true,
  default: ({ data }: { data: unknown }) => (
    <div data-testid="json-tree">{JSON.stringify(data)}</div>
  ),
}));

function renderLogsSection(logs: readonly UserScriptLog[]) {
  const utils = render(
    <ThemeProvider isDark={false}>
      <LogsSection logs={logs} />
    </ThemeProvider>,
  );

  const rerenderLogs = (nextLogs: readonly UserScriptLog[]) => {
    utils.rerender(
      <ThemeProvider isDark={false}>
        <LogsSection logs={nextLogs} />
      </ThemeProvider>,
    );
  };

  return { ...utils, rerenderLogs };
}

function defineScrollMetrics(
  element: HTMLElement,
  { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight?: number },
) {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  if (clientHeight != undefined) {
    Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
  }
}

describe("LogsSection", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should display the empty state message when there are no logs", () => {
    // Given
    const logs: readonly UserScriptLog[] = [];

    // When
    renderLogsSection(logs);

    // Then
    expect(screen.getByText("No logs to display.")).toBeInTheDocument();
  });

  it("should render string log values as text", () => {
    // Given
    const value = BasicBuilder.string();
    const log = UserScriptBuilder.log({ value });

    // When
    renderLogsSection([log]);

    // Then
    expect(screen.getByText(value)).toBeInTheDocument();
  });

  it("should render the source for each log", () => {
    // Given
    const log = UserScriptBuilder.log({ source: "processMessage" });

    // When
    renderLogsSection([log]);

    // Then
    expect(screen.getByText("processMessage")).toBeInTheDocument();
  });

  it("should render one list item per log", () => {
    // Given
    const logs = UserScriptBuilder.logs(4);

    // When
    renderLogsSection(logs);

    // Then
    expect(screen.getAllByRole("listitem")).toHaveLength(logs.length);
  });

  it("should render object values using the json tree", () => {
    // Given
    const value = { foo: BasicBuilder.string() };
    const log = UserScriptBuilder.log({ value });

    // When
    renderLogsSection([log]);

    // Then
    expect(screen.getByTestId("json-tree")).toHaveTextContent(value.foo);
  });

  it("should render boolean false as its string representation", () => {
    // Given
    const log = UserScriptBuilder.log({ value: false });

    // When
    renderLogsSection([log]);

    // Then
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("should render undefined values as its string representation", () => {
    // Given
    const log: UserScriptLog = { ...UserScriptBuilder.log(), value: undefined };

    // When
    renderLogsSection([log]);

    // Then
    expect(screen.getByText("undefined")).toBeInTheDocument();
  });

  it("should auto-scroll to the bottom when new logs arrive", () => {
    // Given
    const { rerenderLogs } = renderLogsSection(UserScriptBuilder.logs(1));
    const list = screen.getByRole("list");
    defineScrollMetrics(list, { scrollHeight: 100 });

    // When
    rerenderLogs(UserScriptBuilder.logs(2));

    // Then
    expect(list.scrollTop).toBe(100);
  });

  it("should stop auto-scrolling when the user scrolls up", () => {
    // Given
    const { rerenderLogs } = renderLogsSection(UserScriptBuilder.logs(1));
    const list = screen.getByRole("list");
    defineScrollMetrics(list, { scrollHeight: 100 });

    // When
    fireEvent.wheel(list, { deltaY: -1 });
    list.scrollTop = 0;
    rerenderLogs(UserScriptBuilder.logs(2));

    // Then
    expect(list.scrollTop).toBe(0);
  });

  it("should resume auto-scrolling when the user scrolls down while content is above the viewport", () => {
    // Given
    const { rerenderLogs } = renderLogsSection(UserScriptBuilder.logs(1));
    const list = screen.getByRole("list");
    defineScrollMetrics(list, { scrollHeight: 100, clientHeight: 10 });
    fireEvent.wheel(list, { deltaY: -1 });
    list.scrollTop = 0;

    // When
    fireEvent.wheel(list, { deltaY: 1 });
    rerenderLogs(UserScriptBuilder.logs(2));

    // Then
    expect(list.scrollTop).toBe(100);
  });

  it("should stay stopped when the user scrolls down but content is not above the viewport", () => {
    // Given
    const { rerenderLogs } = renderLogsSection(UserScriptBuilder.logs(1));
    const list = screen.getByRole("list");
    defineScrollMetrics(list, { scrollHeight: 10, clientHeight: 100 });
    fireEvent.wheel(list, { deltaY: -1 });
    list.scrollTop = 0;

    // When
    fireEvent.wheel(list, { deltaY: 1 });
    rerenderLogs(UserScriptBuilder.logs(2));

    // Then
    expect(list.scrollTop).toBe(0);
  });
});

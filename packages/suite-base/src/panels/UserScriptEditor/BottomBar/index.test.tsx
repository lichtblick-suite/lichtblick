/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useUserScriptState } from "@lichtblick/suite-base/context/UserScriptStateContext";
import { Diagnostic, UserScriptLog } from "@lichtblick/suite-base/players/UserScriptPlayer/types";
import UserScriptBuilder from "@lichtblick/suite-base/testing/builders/UserScriptBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import BottomBar from "./index";

jest.mock("@lichtblick/suite-base/context/UserScriptStateContext", () => ({
  useUserScriptState: jest.fn(),
}));

jest.mock("./DiagnosticsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="diagnostics-section" />,
}));

jest.mock("./LogsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="logs-section" />,
}));

const mockClearUserScriptLogs = jest.fn();
const mockUseUserScriptState = useUserScriptState as jest.MockedFunction<typeof useUserScriptState>;

type SetupProps = {
  diagnostics?: readonly Diagnostic[];
  isSaved?: boolean;
  logs?: readonly UserScriptLog[];
  scriptId?: string;
  onChangeTab?: () => void;
  save?: () => void;
};

function setup(props: SetupProps = {}) {
  const onChangeTab = props.onChangeTab ?? jest.fn();
  const save = props.save ?? jest.fn();
  const scriptId = "scriptId" in props ? props.scriptId : BasicBuilder.string();

  const utils = render(
    <ThemeProvider isDark={false}>
      <BottomBar
        diagnostics={props.diagnostics ?? []}
        isSaved={props.isSaved ?? false}
        logs={props.logs ?? []}
        scriptId={scriptId}
        onChangeTab={onChangeTab}
        save={save}
      />
    </ThemeProvider>,
  );

  return { ...utils, onChangeTab, save };
}

describe("BottomBar", () => {
  beforeEach(() => {
    mockUseUserScriptState.mockReturnValue({
      clearUserScriptLogs: mockClearUserScriptLogs,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should render the diagnostics section by default", () => {
    // Given
    // default tab

    // When
    setup();

    // Then
    expect(screen.getByTestId("diagnostics-section")).toBeInTheDocument();
    expect(screen.queryByTestId("logs-section")).not.toBeInTheDocument();
  });

  it("should switch to the logs section when the logs tab is clicked", () => {
    // Given
    setup();

    // When
    fireEvent.click(screen.getByTestId("np-logs"));

    // Then
    expect(screen.getByTestId("logs-section")).toBeInTheDocument();
    expect(screen.queryByTestId("diagnostics-section")).not.toBeInTheDocument();
  });

  it("should call onChangeTab when a tab is clicked", () => {
    // Given
    const { onChangeTab } = setup();

    // When
    fireEvent.click(screen.getByTestId("np-logs"));

    // Then
    expect(onChangeTab).toHaveBeenCalledTimes(1);
  });

  it("should render the Save label when the script is not saved", () => {
    // Given
    // isSaved false

    // When
    setup({ isSaved: false });

    // Then
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("should render the Saved label and disable the button when the script is saved", () => {
    // Given
    // isSaved true

    // When
    setup({ isSaved: true });

    // Then
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("should save and clear logs when the Save button is clicked with a scriptId", () => {
    // Given
    const scriptId = BasicBuilder.string();
    const { save } = setup({ scriptId, isSaved: false });

    // When
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Then
    expect(save).toHaveBeenCalledTimes(1);
    expect(mockClearUserScriptLogs).toHaveBeenCalledWith(scriptId);
  });

  it("should not save when the Save button is clicked without a scriptId", () => {
    // Given
    const { save } = setup({ scriptId: undefined, isSaved: false });

    // When
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Then
    expect(save).not.toHaveBeenCalled();
    expect(mockClearUserScriptLogs).not.toHaveBeenCalled();
  });

  it("should disable the Clear logs button when there are no logs", () => {
    // Given
    setup({ logs: [] });

    // When
    fireEvent.click(screen.getByTestId("np-logs"));

    // Then
    expect(screen.getByRole("button", { name: "Clear logs" })).toBeDisabled();
  });

  it("should clear logs when the Clear logs button is clicked", () => {
    // Given
    const scriptId = BasicBuilder.string();
    setup({ scriptId, logs: UserScriptBuilder.logs() });

    // When
    fireEvent.click(screen.getByTestId("np-logs"));
    fireEvent.click(screen.getByRole("button", { name: "Clear logs" }));

    // Then
    expect(mockClearUserScriptLogs).toHaveBeenCalledWith(scriptId);
  });

  it("should show the diagnostics count as a badge", () => {
    // Given
    const diagnostics = UserScriptBuilder.diagnostics(2);

    // When
    setup({ diagnostics });

    // Then
    expect(screen.getByText(String(diagnostics.length))).toBeInTheDocument();
  });
});

/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api.js";

import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import { Sidebar } from "./index";

const GOTO_UTILS_PATH = "/utils/pointClouds.ts";

jest.mock("monaco-editor/esm/vs/editor/editor.api.js", () => ({
  Uri: { parse: jest.fn((value: string) => ({ path: value })) },
  editor: { getModel: jest.fn() },
}));

jest.mock("./ScriptsList", () => ({
  ScriptsList: () => <div data-testid="scripts-list-panel" />,
}));

jest.mock("./Templates", () => ({
  Templates: () => <div data-testid="templates-panel" />,
}));

jest.mock("./Utilities", () => ({
  Utilities: ({ gotoUtils }: { gotoUtils: (filePath: string) => void }) => (
    <button
      data-testid="goto-utils"
      onClick={() => {
        gotoUtils(GOTO_UTILS_PATH);
      }}
    />
  ),
}));

const mockGetModel = monacoApi.editor.getModel as jest.Mock;

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const setScriptOverride = props.setScriptOverride ?? jest.fn();

  render(
    <ThemeProvider isDark={false}>
      <Sidebar
        userScripts={props.userScripts ?? LayoutBuilder.userScripts()}
        selectScript={props.selectScript ?? jest.fn()}
        deleteScript={props.deleteScript ?? jest.fn()}
        setScriptOverride={setScriptOverride}
        setUserScripts={props.setUserScripts ?? jest.fn()}
        addNewScript={props.addNewScript ?? jest.fn()}
        selectedScriptId={props.selectedScriptId}
        selectedScript={props.selectedScript}
        script={props.script}
      />
    </ThemeProvider>,
  );

  return { setScriptOverride };
}

describe("Sidebar", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Reset only this mock's implementation so later tests fall back to Jest's default
    // undefined return value, while keeping the Uri.parse implementation from the mock factory.
    mockGetModel.mockReset();
  });

  it("should render the three explorer tabs", () => {
    // Given

    // When
    renderSidebar();

    // Then
    expect(screen.getByTestId("node-explorer")).toBeInTheDocument();
    expect(screen.getByTestId("utils-explorer")).toBeInTheDocument();
    expect(screen.getByTestId("templates-explorer")).toBeInTheDocument();
  });

  it("should not render any panel by default", () => {
    // Given

    // When
    renderSidebar();

    // Then
    expect(screen.queryByTestId("scripts-list-panel")).not.toBeInTheDocument();
  });

  it("should show the scripts list panel when the scripts tab is selected", () => {
    // Given
    renderSidebar();

    // When
    fireEvent.click(screen.getByTestId("node-explorer"));

    // Then
    expect(screen.getByTestId("scripts-list-panel")).toBeInTheDocument();
  });

  it("should show the templates panel when the templates tab is selected", () => {
    // Given
    renderSidebar();

    // When
    fireEvent.click(screen.getByTestId("templates-explorer"));

    // Then
    expect(screen.getByTestId("templates-panel")).toBeInTheDocument();
  });

  it("should close the active panel when the same tab is clicked again", () => {
    // Given
    renderSidebar();
    fireEvent.click(screen.getByTestId("node-explorer"));

    // When
    fireEvent.click(screen.getByTestId("node-explorer"));

    // Then
    expect(screen.queryByTestId("scripts-list-panel")).not.toBeInTheDocument();
  });

  it("should override the script when navigating to an existing utility model", () => {
    // Given
    const model = {
      uri: { path: BasicBuilder.string() },
      getValue: jest.fn().mockReturnValue(BasicBuilder.string()),
    };
    mockGetModel.mockReturnValue(model);
    const { setScriptOverride } = renderSidebar();
    fireEvent.click(screen.getByTestId("utils-explorer"));

    // When
    fireEvent.click(screen.getByTestId("goto-utils"));

    // Then
    expect(setScriptOverride).toHaveBeenCalledWith(
      {
        filePath: model.uri.path,
        code: model.getValue(),
        readOnly: true,
        selection: undefined,
      },
      2,
    );
  });

  it("should not override the script when the utility model does not exist", () => {
    // Given
    mockGetModel.mockReturnValue(undefined);
    const { setScriptOverride } = renderSidebar();
    fireEvent.click(screen.getByTestId("utils-explorer"));

    // When
    fireEvent.click(screen.getByTestId("goto-utils"));

    // Then
    expect(setScriptOverride).not.toHaveBeenCalled();
  });
});

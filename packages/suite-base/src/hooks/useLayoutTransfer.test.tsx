/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutNavigation } from "@lichtblick/suite-base/hooks/useLayoutNavigation";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import * as filePicker from "@lichtblick/suite-base/util/showOpenFilePicker";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useLayoutTransfer } from "./useLayoutTransfer";
import { useAnalytics } from "../context/AnalyticsContext";
import { useLayoutManager } from "../context/LayoutManagerContext";

const mockEnqueueSnackbar = jest.fn();

jest.mock("notistack", () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
  enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args),
}));

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutActions: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => ({
  useLayoutManager: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useLayoutNavigation", () => ({
  useLayoutNavigation: jest.fn(),
}));

jest.mock("../context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/util/showOpenFilePicker");

jest.mock("react-use", () => ({
  ...jest.requireActual("react-use"),
  useMountedState: () => () => true,
}));

describe("useLayoutTransfer", () => {
  const saveNewLayoutMock = jest.fn();
  const getCurrentLayoutStateMock = jest.fn();
  const onSelectLayoutMock = jest.fn();
  const promptForUnsavedChangesMock = jest.fn();
  const logEventMock = jest.fn();

  beforeEach(() => {
    (useLayoutManager as jest.Mock).mockReturnValue({
      saveNewLayout: saveNewLayoutMock,
    });

    (useCurrentLayoutActions as jest.Mock).mockReturnValue({
      getCurrentLayoutState: getCurrentLayoutStateMock,
    });

    (useLayoutNavigation as jest.Mock).mockReturnValue({
      promptForUnsavedChanges: promptForUnsavedChangesMock,
      onSelectLayout: onSelectLayoutMock,
    });

    (useAnalytics as jest.Mock).mockReturnValue({
      logEvent: logEventMock,
    });

    jest.clearAllMocks();
  });

  it("should import a layout and call onSelectLayout", async () => {
    promptForUnsavedChangesMock.mockResolvedValue(true);
    const content = JSON.stringify(LayoutBuilder.data()) ?? "";
    const mockFile = new File([content], "test-layout.json", {
      type: "application/json",
    });

    mockFile.text = async () => content;

    (filePicker.default as jest.Mock).mockResolvedValue([
      {
        getFile: async () => mockFile,
      },
    ]);

    saveNewLayoutMock.mockResolvedValue({
      id: "123",
      name: "test-layout",
      data: content,
    });

    const { result } = renderHook(() => useLayoutTransfer());

    await act(async () => {
      await result.current.importLayout();
    });

    expect(saveNewLayoutMock).toHaveBeenCalled();
    expect(onSelectLayoutMock).toHaveBeenCalled();
    expect(logEventMock).toHaveBeenCalled();
  });

  it("should not install a layout that fails validation", async () => {
    promptForUnsavedChangesMock.mockResolvedValue(true);
    // Missing required fields such as configById, globalVariables, etc.
    const content = JSON.stringify({ foo: BasicBuilder.string() }) ?? "";
    const mockFile = new File([content], "invalid-layout.json", {
      type: "application/json",
    });

    mockFile.text = async () => content;

    (filePicker.default as jest.Mock).mockResolvedValue([
      {
        getFile: async () => mockFile,
      },
    ]);

    const { result } = renderHook(() => useLayoutTransfer());

    await act(async () => {
      await result.current.importLayout();
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining("is not a valid layout"),
      { variant: "error" },
    );
    expect(saveNewLayoutMock).not.toHaveBeenCalled();
    expect(onSelectLayoutMock).not.toHaveBeenCalled();
  });
});

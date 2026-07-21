/** @vitest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutNavigation } from "@lichtblick/suite-base/hooks/useLayoutNavigation";
import * as filePicker from "@lichtblick/suite-base/util/showOpenFilePicker";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useLayoutTransfer } from "./useLayoutTransfer";
import { useAnalytics } from "../context/AnalyticsContext";
import { useLayoutManager } from "../context/LayoutManagerContext";

vi.mock("notistack", async () => ({
  useSnackbar: () => ({ enqueueSnackbar: vi.fn() }),
}));

vi.mock("@lichtblick/suite-base/context/CurrentLayoutContext", async () => ({
  useCurrentLayoutActions: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/LayoutManagerContext", async () => ({
  useLayoutManager: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks/useLayoutNavigation", async () => ({
  useLayoutNavigation: vi.fn(),
}));

vi.mock("../context/AnalyticsContext", async () => ({
  useAnalytics: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/util/showOpenFilePicker");

vi.mock("react-use", async () => ({
  ...await vi.importActual("react-use"),
  useMountedState: () => () => true,
}));

describe("useLayoutTransfer", () => {
  const saveNewLayoutMock = vi.fn();
  const getCurrentLayoutStateMock = vi.fn();
  const onSelectLayoutMock = vi.fn();
  const promptForUnsavedChangesMock = vi.fn();
  const logEventMock = vi.fn();

  beforeEach(() => {
    (useLayoutManager as Mock).mockReturnValue({
      saveNewLayout: saveNewLayoutMock,
    });

    (useCurrentLayoutActions as Mock).mockReturnValue({
      getCurrentLayoutState: getCurrentLayoutStateMock,
    });

    (useLayoutNavigation as Mock).mockReturnValue({
      promptForUnsavedChanges: promptForUnsavedChangesMock,
      onSelectLayout: onSelectLayoutMock,
    });

    (useAnalytics as Mock).mockReturnValue({
      logEvent: logEventMock,
    });

    vi.clearAllMocks();
  });

  it("should import a layout and call onSelectLayout", async () => {
    promptForUnsavedChangesMock.mockResolvedValue(true);
    const content = JSON.stringify({ data: BasicBuilder.string() }) ?? "";
    const mockFile = new File([content], "test-layout.json", {
      type: "application/json",
    });

    mockFile.text = async () => content;

    (filePicker.default as Mock).mockResolvedValue([
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
});

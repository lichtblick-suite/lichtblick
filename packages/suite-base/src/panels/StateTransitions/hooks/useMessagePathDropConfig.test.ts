/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";

import useMessagePathDropConfig from "./useMessagePathDropConfig";
import { StateTransitionConfig } from "../types";

jest.mock("@lichtblick/suite-base/components/PanelContext");

describe("useMessagePathDropConfig", () => {
  const setMessagePathDropConfig = jest.fn();
  const saveConfig = jest.fn();

  beforeEach(() => {
    (usePanelContext as jest.Mock).mockReturnValue({ setMessagePathDropConfig });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should set the drop config on mount", () => {
    renderHook(() => {
      useMessagePathDropConfig(saveConfig);
    });

    expect(setMessagePathDropConfig).toHaveBeenCalledWith({
      getDropStatus: expect.any(Function),
      handleDrop: expect.any(Function),
    });
  });

  it("should return canDrop false if any dragged path is not a leaf", () => {
    renderHook(() => {
      useMessagePathDropConfig(saveConfig);
    });

    const dropConfig = setMessagePathDropConfig.mock.calls[0][0];
    const draggedPaths = [{ isLeaf: false }];

    const result = dropConfig.getDropStatus(draggedPaths);

    expect(result).toEqual({ canDrop: false });
  });

  it("should return canDrop true and effect add if all dragged paths are leaves", () => {
    renderHook(() => {
      useMessagePathDropConfig(saveConfig);
    });

    const dropConfig = setMessagePathDropConfig.mock.calls[0][0];
    const draggedPaths = [{ isLeaf: true }];

    const result = dropConfig.getDropStatus(draggedPaths);

    expect(result).toEqual({ canDrop: true, effect: "add" });
  });

  it("should call saveConfig with updated paths on handleDrop", () => {
    renderHook(() => {
      useMessagePathDropConfig(saveConfig);
    });

    const dropConfig = setMessagePathDropConfig.mock.calls[0][0];
    const draggedPaths = [{ path: "path1", isLeaf: true }];

    dropConfig.handleDrop(draggedPaths);

    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));

    const updateConfig = saveConfig.mock.calls[0][0];
    const prevConfig: StateTransitionConfig = { paths: [], isSynced: true };
    const newConfig = updateConfig(prevConfig);

    expect(newConfig).toEqual({
      paths: [
        {
          value: "path1",
          enabled: true,
          timestampMethod: "receiveTime",
        },
      ],
      isSynced: true,
    });
  });
});

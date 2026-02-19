/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";
import { MutableRefObject } from "react";

import { LayoutState, LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import useUpdateSharedPanelState from "./useUpdateSharedPanelState";

describe("useUpdateSharedPanelState", () => {
  const panelType = BasicBuilder.string();
  const keyTest = BasicBuilder.string();
  const valueTest = BasicBuilder.string();
  const layoutStateRef: MutableRefObject<Readonly<LayoutState>> = {
    current: {
      sharedPanelState: {},
      selectedLayout: {
        id: BasicBuilder.string() as LayoutID,
        loading: BasicBuilder.boolean(),
        data: undefined,
        name: BasicBuilder.string(),
        edited: BasicBuilder.boolean(),
      },
    },
  };

  const setLayoutState = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not update state if selectedLayout.data is undefined", () => {
    const { result } = renderHook(() => useUpdateSharedPanelState(layoutStateRef, setLayoutState));

    act(() => {
      result.current.updateSharedPanelState(panelType, { [keyTest]: valueTest });
    });

    expect(setLayoutState).not.toHaveBeenCalled();
  });

  it("updates state when selectedLayout.data is defined", () => {
    layoutStateRef.current.selectedLayout!.data = {
      configById: {},
      layout: undefined,
      globalVariables: {},
      playbackConfig: { speed: BasicBuilder.number() },
      userNodes: {},
      version: BasicBuilder.number(),
    };

    const { result } = renderHook(() => useUpdateSharedPanelState(layoutStateRef, setLayoutState));

    act(() => {
      result.current.updateSharedPanelState(panelType, { [keyTest]: valueTest });
    });

    expect(setLayoutState).toHaveBeenCalledWith({
      ...layoutStateRef.current,
      sharedPanelState: {
        ...layoutStateRef.current.sharedPanelState,
        [panelType]: { [keyTest]: valueTest },
      },
    });
  });
});

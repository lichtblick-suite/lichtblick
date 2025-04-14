// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act } from "@testing-library/react";

import { useInstallingExtensionsStore } from "./useInstallingExtensionsStore";

describe("useInstallingExtensionsStore", () => {
  afterEach(() => {
    useInstallingExtensionsStore.getState().resetInstallingProgress();
  });

  it("starts installation progress", () => {
    act(() => {
      useInstallingExtensionsStore.getState().startInstallingProgress(5);
    });

    const state = useInstallingExtensionsStore.getState();
    expect(state.installingProgress).toEqual({
      installed: 0,
      total: 5,
      inProgress: true,
    });
  });

  it("sets installing progress correctly", () => {
    act(() => {
      useInstallingExtensionsStore.getState().setInstallingProgress((prev) => ({
        ...prev,
        installed: prev.installed + 2,
      }));
    });

    expect(useInstallingExtensionsStore.getState().installingProgress.installed).toBe(2);
  });

  it("resets installation progress", () => {
    act(() => {
      useInstallingExtensionsStore.getState().resetInstallingProgress();
    });

    expect(useInstallingExtensionsStore.getState().installingProgress).toEqual({
      installed: 0,
      total: 0,
      inProgress: false,
    });
  });
});

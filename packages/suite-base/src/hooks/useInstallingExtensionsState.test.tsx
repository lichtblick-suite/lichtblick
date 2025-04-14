/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { useSnackbar } from "notistack";

import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";

import { useInstallingExtensionsState } from "./useInstallingExtensionsState";
import * as installingStore from "./useInstallingExtensionsStore";

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));
jest.mock("./useInstallingExtensionsStore", () => ({
  useInstallingExtensionsStore: jest.fn(),
}));

jest.mock("notistack", () => ({
  useSnackbar: jest.fn(),
}));

describe("useInstallingExtensionsState", () => {
  const mockInstallExtensions = jest.fn();
  const mockStartInstallingProgress = jest.fn();
  const mockSetInstallingProgress = jest.fn();
  const mockResetInstallingProgress = jest.fn();
  const playMock = jest.fn();
  const enqueueSnackbar = jest.fn();
  const closeSnackbar = jest.fn();

  const mockedUseInstallingExtensionsStore =
    installingStore.useInstallingExtensionsStore as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    (useExtensionCatalog as jest.Mock).mockReturnValue(() => ({
      installExtensions: mockInstallExtensions,
    }));

    mockedUseInstallingExtensionsStore.mockImplementation((selector) =>
      selector({
        installingProgress: {
          installed: 0,
          total: 2,
          inProgress: true,
        },
        startInstallingProgress: mockStartInstallingProgress,
        setInstallingProgress: mockSetInstallingProgress,
        resetInstallingProgress: mockResetInstallingProgress,
      }),
    );

    (useSnackbar as jest.Mock).mockReturnValue({
      enqueueSnackbar,
      closeSnackbar,
    });
  });

  it("installs extensions and updates progress", async () => {
    const extensionsData = [new Uint8Array([1]), new Uint8Array([2])];

    mockInstallExtensions.mockResolvedValue([{ success: true }, { success: true }]);

    const { result } = renderHook(() =>
      useInstallingExtensionsState({
        isPlaying: true,
        playerEvents: { play: playMock },
      }),
    );

    await act(async () => {
      await result.current.installFoxeExtensions(extensionsData);
    });

    expect(mockStartInstallingProgress).toHaveBeenCalledWith(2);
    //expect(mockInstallExtensions).toHaveBeenCalled();
    expect(mockSetInstallingProgress).toHaveBeenCalledWith(expect.any(Function));
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining("Successfully"),
      expect.anything(),
    );
    expect(mockResetInstallingProgress).toHaveBeenCalled();
    expect(playMock).toHaveBeenCalled();
  });

  it("shows error snackbar on failure", async () => {
    const extensionsData = [new Uint8Array([1])];
    mockInstallExtensions.mockRejectedValue(new Error("Error"));

    const { result } = renderHook(() =>
      useInstallingExtensionsState({
        isPlaying: false,
        playerEvents: { play: playMock },
      }),
    );

    await act(async () => {
      await result.current.installFoxeExtensions(extensionsData);
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining("An error occurred"),
      expect.objectContaining({ variant: "error" }),
    );
  });
});

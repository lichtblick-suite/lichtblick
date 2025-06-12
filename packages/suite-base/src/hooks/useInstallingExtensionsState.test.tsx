/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { useSnackbar } from "notistack";

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import { useInstallingExtensionsState } from "./useInstallingExtensionsState";

const mockStartInstallingProgress = jest.fn();
const mockSetInstallingProgress = jest.fn();
const mockResetInstallingProgress = jest.fn();
const mockInstallExtensions = jest.fn();
const mockStore = {
  setInstallingProgress: mockSetInstallingProgress,
  startInstallingProgress: mockStartInstallingProgress,
  resetInstallingProgress: mockResetInstallingProgress,
  installingProgress: { installed: 0, total: 0, inProgress: false },
};

jest.mock("@lichtblick/suite-base/hooks/useInstallingExtensionsStore", () => ({
  useInstallingExtensionsStore: (selector: any) => selector(mockStore),
}));

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: (selector: any) =>
    selector({
      installExtensions: mockInstallExtensions,
    }),
}));

jest.mock("notistack", () => ({
  useSnackbar: jest.fn(),
}));

describe("useInstallingExtensionsState", () => {
  const playMock = jest.fn();
  const enqueueSnackbar = jest.fn();
  const closeSnackbar = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockStore.installingProgress = { installed: 0, total: 0, inProgress: false };

    (useSnackbar as jest.Mock).mockReturnValue({
      enqueueSnackbar,
      closeSnackbar,
    });
  });

  it("installs extensions and updates progress", async () => {
    const extensionsData = [
      new Uint8Array([BasicBuilder.number()]),
      new Uint8Array([BasicBuilder.number()]),
    ];

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
    expect(mockStartInstallingProgress).toHaveBeenCalledTimes(1);

    expect(mockInstallExtensions).toHaveBeenCalledTimes(2);
    expect(mockSetInstallingProgress).toHaveBeenCalled();

    expect(mockSetInstallingProgress).toHaveBeenCalledWith(expect.any(Function));
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining(`Successfully installed all ${extensionsData.length} extensions.`),
      expect.objectContaining({
        variant: "success",
        preventDuplicate: true,
      }),
    );
    expect(playMock).toHaveBeenCalled();
    expect(mockResetInstallingProgress).toHaveBeenCalled();
  });

  it("calls installExtensions and shows error snackbar on failure", async () => {
    const errorValue = new Error(BasicBuilder.string());
    const extensionsData = [new Uint8Array([BasicBuilder.number()])];
    mockInstallExtensions.mockRejectedValue(errorValue);

    const { result } = renderHook(() =>
      useInstallingExtensionsState({
        isPlaying: false,
        playerEvents: { play: playMock },
      }),
    );

    await act(async () => {
      await result.current.installFoxeExtensions(extensionsData);
    });

    expect(mockInstallExtensions).toHaveBeenCalledTimes(1);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining(
        `An error occurred during extension installation: ${errorValue.message}`,
      ),
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("shows progress snackbar when installation starts", () => {
    const extensionsToBeInstalled = BasicBuilder.number();
    const { rerender } = renderHook(() =>
      useInstallingExtensionsState({
        isPlaying: false,
        playerEvents: { play: playMock },
      }),
    );

    mockStore.installingProgress = {
      installed: 0,
      total: extensionsToBeInstalled,
      inProgress: true,
    };

    rerender();

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      `Installing ${extensionsToBeInstalled} extensions...`,
      expect.objectContaining({
        key: expect.anything(),
        variant: "info",
        persist: true,
        preventDuplicate: true,
      }),
    );
  });
});

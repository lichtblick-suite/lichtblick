/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { useSnackbar } from "notistack";

import {
  ExtensionData,
  InstallExtensionsResult,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
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
  ...jest.requireActual("@lichtblick/suite-base/context/ExtensionCatalogContext"),
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

  const createExtensionData = (count: number): ExtensionData[] => {
    return Array.from({ length: count }, () => ({
      buffer: new Uint8Array([BasicBuilder.number()]),
      namespace: "org" as const,
    }));
  };

  const createSuccessResult = (): InstallExtensionsResult => ({
    success: true,
    extensionName: BasicBuilder.string(),
    loaderResults: [
      { loaderType: "browser", success: true },
      { loaderType: "server", success: true },
    ],
  });

  const createPartialFailureResult = (): InstallExtensionsResult => ({
    success: true,
    extensionName: BasicBuilder.string(),
    error: new Error(),
    loaderResults: [
      { loaderType: "browser", success: true },
      { loaderType: "server", success: false, error: new Error("Network error") },
    ],
  });

  const createCompleteFailureResult = (): InstallExtensionsResult => ({
    success: false,
    extensionName: BasicBuilder.string(),
    error: new Error("All loaders failed"),
    loaderResults: [
      { loaderType: "browser", success: false, error: new Error("Cache error") },
      { loaderType: "server", success: false, error: new Error("Network error") },
    ],
  });

  describe("Complete Success Scenarios", () => {
    it("should show success message when all extensions install successfully", async () => {
      // Given
      const extensionsData = createExtensionData(3);
      mockInstallExtensions
        .mockResolvedValueOnce([createSuccessResult()])
        .mockResolvedValueOnce([createSuccessResult()])
        .mockResolvedValueOnce([createSuccessResult()]);

      const { result } = renderHook(() =>
        useInstallingExtensionsState({
          isPlaying: false,
          playerEvents: { play: playMock },
        }),
      );

      // When
      await act(async () => {
        await result.current.installFoxeExtensions(extensionsData);
      });

      // Then
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Successfully installed all 3 extensions.",
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  describe("Partial Success with Warnings Scenarios", () => {
    it("should show warning when extensions install but some fail to sync to server", async () => {
      // Given
      const extensionsData = createExtensionData(2);
      // Mock each individual call since INSTALL_EXTENSIONS_BATCH = 1
      mockInstallExtensions
        .mockResolvedValueOnce([createPartialFailureResult()])
        .mockResolvedValueOnce([createPartialFailureResult()]);

      const { result } = renderHook(() =>
        useInstallingExtensionsState({
          isPlaying: false,
          playerEvents: { play: playMock },
        }),
      );

      // When
      await act(async () => {
        await result.current.installFoxeExtensions(extensionsData);
      });

      // Then
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Successfully installed all 2 extensions with some warnings.",
        expect.objectContaining({ variant: "warning" }),
      );
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Note: 2 extensions saved locally but not synced to server (offline).",
        expect.objectContaining({
          variant: "info",
          persist: true,
        }),
      );
    });

    it("should show warning when extensions install but some fail to save to cache", async () => {
      // Given
      const extensionsData = createExtensionData(1);
      const resultWithCacheFailure: InstallExtensionsResult = {
        success: true,
        extensionName: BasicBuilder.string(),
        error: new Error(),
        loaderResults: [
          { loaderType: "browser", success: false, error: new Error("Cache error") },
          { loaderType: "server", success: true },
        ],
      };
      mockInstallExtensions.mockResolvedValueOnce([resultWithCacheFailure]);

      const { result } = renderHook(() =>
        useInstallingExtensionsState({
          isPlaying: false,
          playerEvents: { play: playMock },
        }),
      );

      // When
      await act(async () => {
        await result.current.installFoxeExtensions(extensionsData);
      });

      // Then
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Successfully installed all 1 extensions with some warnings.",
        expect.objectContaining({ variant: "warning" }),
      );
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Issues: 1 extension not saved to local cache.",
        expect.objectContaining({
          variant: "warning",
          persist: true,
        }),
      );
    });
  });

  describe("Complete Failure Scenarios", () => {
    it("should show failure message when all extensions fail completely", async () => {
      // Given
      const extensionsData = createExtensionData(2);
      mockInstallExtensions
        .mockResolvedValueOnce([createCompleteFailureResult()])
        .mockResolvedValueOnce([createCompleteFailureResult()]);

      const { result } = renderHook(() =>
        useInstallingExtensionsState({
          isPlaying: false,
          playerEvents: { play: playMock },
        }),
      );

      // When
      await act(async () => {
        await result.current.installFoxeExtensions(extensionsData);
      });

      // Then
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Failed to install all 2 extensions.",
        expect.objectContaining({ variant: "error" }),
      );
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        "Details: 2 could not be saved to cache, 2 could not be synced to server.",
        expect.objectContaining({
          variant: "error",
          persist: true,
        }),
      );
    });
  });

  describe("Progress and State Management", () => {
    it("should manage installation progress correctly", async () => {
      // Given
      const extensionsData = createExtensionData(2);
      mockInstallExtensions
        .mockResolvedValueOnce([createSuccessResult()])
        .mockResolvedValueOnce([createSuccessResult()]);

      const { result } = renderHook(() =>
        useInstallingExtensionsState({
          isPlaying: true,
          playerEvents: { play: playMock },
        }),
      );

      // When
      await act(async () => {
        await result.current.installFoxeExtensions(extensionsData);
      });

      // Then
      expect(mockStartInstallingProgress).toHaveBeenCalledWith(2);
      expect(mockSetInstallingProgress).toHaveBeenCalled();
      expect(playMock).toHaveBeenCalled();
      expect(mockResetInstallingProgress).toHaveBeenCalled();
    });

    it("should show progress snackbar when installation is in progress", () => {
      // Given
      const extensionsToBeInstalled = BasicBuilder.number();
      mockStore.installingProgress = {
        installed: 0,
        total: extensionsToBeInstalled,
        inProgress: true,
      };

      // When
      renderHook(() =>
        useInstallingExtensionsState({
          isPlaying: false,
          playerEvents: { play: playMock },
        }),
      );

      // Then
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        `Installing ${extensionsToBeInstalled} extensions...`,
        expect.objectContaining({
          variant: "info",
          persist: true,
          preventDuplicate: true,
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should show error message when installation process throws exception", async () => {
      // Given
      const errorMessage = BasicBuilder.string();
      const error = new Error(errorMessage);
      const extensionsData = createExtensionData(1);
      mockInstallExtensions.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useInstallingExtensionsState({
          isPlaying: false,
          playerEvents: { play: playMock },
        }),
      );

      // When
      await act(async () => {
        await result.current.installFoxeExtensions(extensionsData);
      });

      // Then
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        `An error occurred during extension installation: ${errorMessage}`,
        expect.objectContaining({ variant: "error" }),
      );
      expect(mockResetInstallingProgress).toHaveBeenCalled();
    });
  });
});

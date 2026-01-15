/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { IDataSourceFactory } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import {
  FILE_ACCEPT_TYPE,
  FILE_JSON_TYPE,
} from "@lichtblick/suite-base/context/Workspace/constants";
import { useHandleFiles } from "@lichtblick/suite-base/hooks/useHandleFiles";
import { useInstallingExtensionsState } from "@lichtblick/suite-base/hooks/useInstallingExtensionsState";
import { useLayoutTransfer } from "@lichtblick/suite-base/hooks/useLayoutTransfer";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useLayoutTransfer", () => ({
  useLayoutTransfer: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => ({
  useLayoutManager: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutActions: jest.fn(() => ({})),
  useCurrentLayoutSelector: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useInstallingExtensionsState", () => ({
  useInstallingExtensionsState: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useInstallingExtensionsStore", () => ({
  useInstallingExtensionsStore: (selector: any) =>
    selector({
      setInstallingProgress: jest.fn(),
      startInstallingProgress: jest.fn(),
      resetInstallingProgress: jest.fn(),
      installingProgress: { installed: 0, total: 0, inProgress: false },
    }),
}));

type Setup = {
  filesOverride?: File[];
  isLayout: boolean;
};

describe("useHandleFiles", () => {
  const mockLayoutManager = new MockLayoutManager();
  const installFoxeExtensionsMock = jest.fn();
  const parseAndInstallLayoutMock = jest.fn();
  const availableSources: IDataSourceFactory[] = [
    {
      id: BasicBuilder.string(),
      displayName: BasicBuilder.string(),
      type: "file",
      initialize: jest.fn(),
      supportedFileTypes: [".mcap"],
    },
  ];

  const selectSource = jest.fn();
  const isPlaying = BasicBuilder.boolean();
  const playerEvents = {
    play: jest.fn(),
    pause: jest.fn(),
  };

  const useHandleFilesProps = {
    availableSources,
    selectSource,
    isPlaying,
    playerEvents,
  };

  function fileBuilder(extension: string, type: string): File {
    return new File([BasicBuilder.string()], `${BasicBuilder.string()}.${extension}`, {
      type,
    });
  }

  function setup({ filesOverride, isLayout }: Setup = { isLayout: false }) {
    let files: File[] = [];
    if (isLayout) {
      files = filesOverride ?? [fileBuilder("json", FILE_JSON_TYPE)];
      files.forEach((file) => {
        file.text = async () => JSON.stringify({ some: BasicBuilder.string() })!;
      });
    } else {
      files = filesOverride ?? [fileBuilder("mcap", FILE_ACCEPT_TYPE)];
      files.forEach((file) => {
        file.arrayBuffer = async () =>
          await Promise.resolve(new TextEncoder().encode(BasicBuilder.string()).buffer);
      });
    }

    const { result } = renderHook(() => useHandleFiles(useHandleFilesProps));
    return {
      handleFiles: result.current.handleFiles,
      files,
    };
  }

  beforeEach(() => {
    (useLayoutManager as jest.Mock).mockReturnValue(mockLayoutManager);
    (useInstallingExtensionsState as jest.Mock).mockReturnValue({
      installFoxeExtensions: installFoxeExtensionsMock,
    });
    (useLayoutTransfer as jest.Mock).mockReturnValue({
      parseAndInstallLayout: parseAndInstallLayoutMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should call pause and install .foxe extension", async () => {
    const { handleFiles, files } = setup({
      filesOverride: [fileBuilder("foxe", FILE_ACCEPT_TYPE)],
      isLayout: false,
    });

    await act(async () => {
      await handleFiles(files);
    });

    expect(playerEvents.pause).toHaveBeenCalled();
    expect(installFoxeExtensionsMock).toHaveBeenCalled();
  });

  it("should call pause and parse .json layout file", async () => {
    const namespace = "local";
    const mockLayout = fileBuilder("json", FILE_JSON_TYPE);
    const { handleFiles, files } = setup({
      filesOverride: [mockLayout],
      isLayout: true,
    });

    await act(async () => {
      await handleFiles(files);
    });
    expect(playerEvents.pause).toHaveBeenCalled();
    expect(parseAndInstallLayoutMock).toHaveBeenCalledWith(mockLayout, namespace);
  });

  it("does nothing when passed an empty file array", async () => {
    const { handleFiles, files } = setup({ filesOverride: [], isLayout: false });

    await act(async () => {
      await handleFiles(files);
    });

    expect(playerEvents.pause).not.toHaveBeenCalled();
    expect(selectSource).not.toHaveBeenCalled();
  });

  it("logs error if reading a file fails", async () => {
    const brokenFile = fileBuilder("foxe", FILE_ACCEPT_TYPE);
    Object.defineProperty(brokenFile, "name", {
      value: "broken.foxe",
      writable: false,
    });

    const { handleFiles, files } = setup({ filesOverride: [brokenFile], isLayout: false });

    files.forEach((file) => {
      (file as any).arrayBuffer = () => {
        throw new Error("Read failed");
      };
    });

    const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await handleFiles(files);
    });

    expect(logSpy).toHaveBeenCalledWith(
      `Error reading file ${brokenFile.name}`,
      expect.objectContaining({ message: "Read failed" }),
    );

    logSpy.mockRestore();
  });

  it("handles and selects source for non-foxe files", async () => {
    const { handleFiles, files } = setup();

    await act(async () => {
      await handleFiles(files);
    });

    expect(selectSource).toHaveBeenCalled();
  });

  it("does not select source if no file type matches availableSources", async () => {
    const { handleFiles, files } = setup({
      filesOverride: [fileBuilder("csv", FILE_ACCEPT_TYPE)],
      isLayout: false,
    });

    await act(async () => {
      await handleFiles(files);
    });

    expect(selectSource).not.toHaveBeenCalled();
  });
});

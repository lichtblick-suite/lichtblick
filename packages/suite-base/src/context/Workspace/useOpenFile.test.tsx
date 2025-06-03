/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";
import { enqueueSnackbar } from "notistack";

import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { FILE_ACCEPT_TYPE } from "@lichtblick/suite-base/context/Workspace/constants";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import showOpenFilePicker from "@lichtblick/suite-base/util/showOpenFilePicker";

import { useOpenFile } from "./useOpenFile";

jest.mock("@lichtblick/suite-base/context/PlayerSelectionContext", () => ({
  usePlayerSelection: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/util/showOpenFilePicker", () => jest.fn());

jest.mock("notistack", () => ({
  enqueueSnackbar: jest.fn(),
}));

const SUPPORTED_FILE_TYPES = [".mcap"];

type Setup = {
  sourcesOverride?: IDataSourceFactory[];
  filesOverride?: File[];
};

describe("useOpenFile", () => {
  let selectSource: jest.Mock;

  beforeEach(() => {
    selectSource = jest.fn();
    (usePlayerSelection as jest.Mock).mockReturnValue({ selectSource });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function buildFile(extension: string, type: string): File {
    return new File([BasicBuilder.string()], `${BasicBuilder.string()}.${extension}`, {
      type,
    });
  }

  function setup({ filesOverride, sourcesOverride }: Setup = {}) {
    const sources: IDataSourceFactory[] = sourcesOverride ?? [
      {
        id: BasicBuilder.string(),
        type: "file",
        supportedFileTypes: SUPPORTED_FILE_TYPES,
      } as IDataSourceFactory,
    ];

    const fsHandles: FileSystemFileHandle[] = [];
    const files = filesOverride ?? [buildFile("mcap", FILE_ACCEPT_TYPE)];
    files.forEach((file) => {
      fsHandles.push({
        getFile: jest.fn().mockResolvedValue(file),
      } as unknown as FileSystemFileHandle);
    });

    (showOpenFilePicker as jest.Mock).mockResolvedValue(fsHandles);

    return {
      ...renderHook(() => useOpenFile(sources)),
      sources,
      files,
      fsHandles,
    };
  }

  it("should select a valid file source", async () => {
    const { result, sources, fsHandles } = setup();

    await result.current();

    expect(selectSource).toHaveBeenCalledWith(sources[0]?.id, {
      type: "file",
      handles: fsHandles,
    });
  });

  it("should show error if multiple file extensions are selected", async () => {
    const { result } = setup({
      filesOverride: [buildFile("mcap", FILE_ACCEPT_TYPE), buildFile("txt", "text/plain")],
    });

    await expect(result.current()).rejects.toThrow(
      "Multiple file extensions detected: .mcap, .txt. All files must have the same extension.",
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining("Multiple file extensions detected"),
      { variant: "error" },
    );
  });

  it("should show error if no matching source is found", async () => {
    const { result } = setup({
      sourcesOverride: [
        {
          id: BasicBuilder.string(),
          type: "file",
          supportedFileTypes: [".json"],
        } as IDataSourceFactory,
      ],
    });

    await expect(result.current()).rejects.toThrow(
      "Cannot find a source to handle files with extension .mcap",
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining("Cannot find a source to handle files"),
      { variant: "error" },
    );
  });

  it("should show error if multiple files are selected but not supported", async () => {
    const { result } = setup({
      sourcesOverride: [
        {
          id: BasicBuilder.string(),
          type: "file",
          supportedFileTypes: [".json"],
        } as IDataSourceFactory,
      ],
      filesOverride: [buildFile("json", "application/json"), buildFile("json", "application/json")],
    });

    await expect(result.current()).rejects.toThrow(
      "The application only support multiple files for MCAP extension.",
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining("The application only support multiple files"),
      { variant: "error" },
    );
  });
});

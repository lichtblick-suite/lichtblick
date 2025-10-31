// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as path from "path";

// Mock all dependencies before any imports
jest.mock("@lichtblick/log", () => ({
  getLogger: () => ({
    debug: jest.fn(),
  }),
}));

jest.mock("./fileUtils", () => ({
  isFileToOpen: jest.fn(),
}));

jest.mock("./injectFilesToOpen", () => jest.fn());

// Mock StudioWindow completely to avoid React dependencies
const mockLoad = jest.fn();
const mockGetBrowserWindow = jest.fn();

jest.mock("./StudioWindow", () => {
  return jest.fn().mockImplementation(() => ({
    load: mockLoad,
    getBrowserWindow: mockGetBrowserWindow,
  }));
});

// Import after mocks
// eslint-disable-next-line import/first
import StudioWindow from "./StudioWindow";
// eslint-disable-next-line import/first
import { createNewWindow } from "./createNewWindow";
// eslint-disable-next-line import/first
import { isFileToOpen } from "./fileUtils";
// eslint-disable-next-line import/first
import injectFilesToOpen from "./injectFilesToOpen";

const mockIsFileToOpen = isFileToOpen as jest.MockedFunction<typeof isFileToOpen>;
const mockInjectFilesToOpen = injectFilesToOpen as jest.MockedFunction<typeof injectFilesToOpen>;
const MockStudioWindow = StudioWindow as jest.MockedClass<typeof StudioWindow>;

describe("createNewWindow", () => {
  const mockWebContents = {
    once: jest.fn(),
    debugger: { mock: "debugger" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBrowserWindow.mockReturnValue({ webContents: mockWebContents });
  });

  it("should create a new window with deep links", () => {
    const argv = ["app", "lichtblick://test-link"];

    createNewWindow(argv);

    expect(MockStudioWindow).toHaveBeenCalledWith(["lichtblick://test-link"]);
    expect(mockLoad).toHaveBeenCalled();
  });

  it("should filter out flags and process files", () => {
    const argv = ["app", "--flag=value", "test.bag"];
    mockIsFileToOpen.mockReturnValue(true);

    createNewWindow(argv);

    expect(mockIsFileToOpen).toHaveBeenCalledWith("test.bag");
    expect(mockIsFileToOpen).not.toHaveBeenCalledWith("--flag=value");
    expect(MockStudioWindow).toHaveBeenCalledWith([]);
  });

  it("should setup file injection callback", async () => {
    const argv = ["app", "test.bag"];
    mockIsFileToOpen.mockReturnValue(true);

    let callback: (() => Promise<void>) | undefined;
    mockWebContents.once.mockImplementation((event: string, cb: () => Promise<void>) => {
      if (event === "did-finish-load") {
        callback = cb;
      }
    });

    createNewWindow(argv);

    expect(mockWebContents.once).toHaveBeenCalledWith("did-finish-load", expect.any(Function));

    // Simulate the callback execution
    await callback!();

    expect(mockInjectFilesToOpen).toHaveBeenCalledWith(mockWebContents.debugger, [
      path.resolve("test.bag"),
    ]);
  });

  it("should not inject files when no files are present", async () => {
    const argv = ["app", "lichtblick://link"];
    mockIsFileToOpen.mockReturnValue(false);

    let callback: (() => Promise<void>) | undefined;
    mockWebContents.once.mockImplementation((event: string, cb: () => Promise<void>) => {
      if (event === "did-finish-load") {
        callback = cb;
      }
    });

    createNewWindow(argv);

    // Simulate the callback execution
    await callback!();

    expect(mockInjectFilesToOpen).not.toHaveBeenCalled();
  });
});

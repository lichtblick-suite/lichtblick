// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { app, BrowserWindow } from "electron";

import { createNewWindow } from "./createNewWindow";
import { isFileToOpen } from "./fileUtils";
import { handleSecondInstance } from "./secondInstanceHandler";

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
  },
}));

jest.mock("./fileUtils", () => ({
  isFileToOpen: jest.fn(),
}));

jest.mock("./createNewWindow", () => ({
  createNewWindow: jest.fn(),
}));

jest.mock("electron", () => {
  const emit = jest.fn();
  const restore = jest.fn();
  const focus = jest.fn();
  const getAllWindows = jest.fn(() => [{ restore, focus }]);

  return {
    app: {
      emit,
    },
    BrowserWindow: {
      getAllWindows,
    },
  };
});

const mockIsFileToOpen = isFileToOpen as jest.MockedFunction<typeof isFileToOpen>;
const mockCreateNewWindow = createNewWindow as jest.MockedFunction<typeof createNewWindow>;
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockEmit = app.emit as jest.MockedFunction<typeof app.emit>;
const mockGetAllWindows = BrowserWindow.getAllWindows as jest.Mock;

describe("handleSecondInstance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call createNewWindow when --force-multiple-windows is passed", () => {
    const argv = ["app", "--force-multiple-windows"];
    handleSecondInstance({}, argv, "");
    expect(mockCreateNewWindow).toHaveBeenCalledWith(argv);
  });

  it("should emit open-url and open-file events for deeplinks and files", () => {
    const argv = ["app", "lichtblick://something", "file.bag"];
    mockIsFileToOpen.mockImplementation((file) => file.endsWith(".bag"));

    handleSecondInstance({}, argv, "");

    expect(mockEmit).toHaveBeenCalledWith("open-url", expect.anything(), "lichtblick://something");
    expect(mockEmit).toHaveBeenCalledWith("open-file", expect.anything(), "file.bag");
  });

  it("should bring app to front if no files or deeplinks", () => {
    const argv = ["app"];

    const restoreMock = jest.fn();
    const focusMock = jest.fn();
    mockGetAllWindows.mockReturnValue([{ restore: restoreMock, focus: focusMock }]);

    handleSecondInstance({}, argv, "");

    expect(restoreMock).toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalled();
  });

  it("should not emit open-file for non-file args", () => {
    const argv = ["app", "--not-a-file"];
    mockIsFileToOpen.mockReturnValue(false);

    handleSecondInstance({}, argv, "");

    expect(mockEmit).not.toHaveBeenCalledWith("open-file", expect.anything(), expect.anything());
  });

  it("should skip deepLinks or files if none present and no windows open", () => {
    mockGetAllWindows.mockReturnValueOnce([]);

    const argv = ["app"];
    expect(() => {
      handleSecondInstance({}, argv, "");
    }).not.toThrow();
  });
});

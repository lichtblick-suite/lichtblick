// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { loadDefaultLayouts } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/loadDefaultLayouts";
import { LayoutLoader } from "@lichtblick/suite-base/services/ILayoutLoader";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";

// Mock layout manager
const mockLayoutManager = new MockLayoutManager();

jest.mock("@lichtblick/suite-base/services/LayoutManager/LayoutManager", () =>
  jest.fn(() => mockLayoutManager),
);

describe("loadDefaultLayouts", () => {
  const mockLayoutLoader: jest.Mocked<LayoutLoader> = {
    fetchLayouts: jest.fn(),
    namespace: "local",
  };

  const consoleErrorMock = console.error as ReturnType<typeof jest.fn>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not proceed if loaders array is empty", async () => {
    await loadDefaultLayouts(mockLayoutManager, []);
    expect(mockLayoutManager.getLayouts).not.toHaveBeenCalled();
  });

  it("should not save layouts if fetched layouts are empty", async () => {
    mockLayoutLoader.fetchLayouts.mockResolvedValueOnce([]);
    mockLayoutManager.getLayouts.mockResolvedValueOnce([]);

    await loadDefaultLayouts(mockLayoutManager, [mockLayoutLoader]);

    expect(mockLayoutManager.getLayouts).toHaveBeenCalledTimes(1);
    expect(mockLayoutLoader.fetchLayouts).toHaveBeenCalledTimes(1);
    expect(mockLayoutManager.saveNewLayout).not.toHaveBeenCalled();
  });

  it("should save new layouts and log errors if there are rejections during fetch", async () => {
    const fetchError = new Error("Fetch failed");
    mockLayoutLoader.fetchLayouts.mockRejectedValueOnce(fetchError);
    mockLayoutManager.getLayouts.mockResolvedValueOnce([]);

    await loadDefaultLayouts(mockLayoutManager, [mockLayoutLoader]);

    expect(mockLayoutLoader.fetchLayouts).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).toHaveBeenCalledWith(
      `Failed to fetch layouts from loader: ${fetchError}`,
    );
    consoleErrorMock.mockClear();
  });

  it("should save only new layouts that are not in current layouts", async () => {
    const existingLayout = {
      from: "layout1.json",
      name: "existing-layout",
      data: {} as LayoutData,
    };
    const newLayout = { from: "layout2.json", name: "new-layout", data: {} as LayoutData };

    mockLayoutLoader.fetchLayouts.mockResolvedValueOnce([existingLayout, newLayout]);
    mockLayoutManager.getLayouts.mockResolvedValueOnce([existingLayout]);

    await loadDefaultLayouts(mockLayoutManager, [mockLayoutLoader]);

    expect(mockLayoutManager.getLayouts).toHaveBeenCalledTimes(1);
    expect(mockLayoutManager.saveNewLayout).toHaveBeenCalledTimes(1);
    expect(mockLayoutManager.saveNewLayout).toHaveBeenCalledWith(
      expect.objectContaining({ from: "layout2.json", name: "new-layout" }),
    );
  });

  it("should log errors if saving a layout fails", async () => {
    const newLayout = { from: "layout2.json", name: "new-layout", data: {} as LayoutData };
    const saveError = new Error("Save failed");

    mockLayoutLoader.fetchLayouts.mockResolvedValueOnce([newLayout]);
    mockLayoutManager.getLayouts.mockResolvedValueOnce([]);
    mockLayoutManager.saveNewLayout.mockRejectedValueOnce(saveError);

    await loadDefaultLayouts(mockLayoutManager, [mockLayoutLoader]);

    expect(mockLayoutLoader.fetchLayouts).toHaveBeenCalledTimes(1);
    expect(mockLayoutManager.saveNewLayout).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).toHaveBeenCalledWith(`Failed to save layout: ${saveError}`);
    consoleErrorMock.mockClear();
  });

  it("should handle multiple loaders and save new layouts from each", async () => {
    const loader1Layouts = [
      { from: "layout1.json", name: "layout1", data: {} as LayoutData },
      { from: "layout2.json", name: "layout2", data: {} as LayoutData },
    ];
    const loader2Layouts = [
      { from: "layout3.json", name: "layout3", data: {} as LayoutData },
      { from: "layout4.json", name: "layout4", data: {} as LayoutData },
    ];

    const loader1: jest.Mocked<LayoutLoader> = {
      fetchLayouts: jest.fn().mockResolvedValueOnce(loader1Layouts),
      namespace: "loader1",
    } as any;

    const loader2: jest.Mocked<LayoutLoader> = {
      fetchLayouts: jest.fn().mockResolvedValueOnce(loader2Layouts),
      namespace: "loader2",
    } as any;

    mockLayoutManager.getLayouts.mockResolvedValueOnce([]);

    await loadDefaultLayouts(mockLayoutManager, [loader1, loader2]);

    expect(loader1.fetchLayouts).toHaveBeenCalledTimes(1);
    expect(loader2.fetchLayouts).toHaveBeenCalledTimes(1);

    expect(mockLayoutManager.saveNewLayout).toHaveBeenCalledTimes(4);
  });

  it("should log a general error if an exception occurs in the try block", async () => {
    const errorMessage = "General loading error";
    const expectedError = `Loading default layouts failed: ${errorMessage}`;

    mockLayoutManager.getLayouts.mockRejectedValueOnce(errorMessage);

    await loadDefaultLayouts(mockLayoutManager, [mockLayoutLoader]);

    expect(consoleErrorMock).toHaveBeenCalledWith(expectedError);
    consoleErrorMock.mockClear();
  });
});

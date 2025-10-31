// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/unbound-method */

import { autoUpdater } from "electron-updater";

import StudioAppUpdater from "./StudioAppUpdater"; // ajuste o caminho se necessário
import { getAppSetting } from "./settings";

jest.mock("electron-updater", () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn(),
    isUpdaterActive: jest.fn().mockReturnValue(true),
  },
}));

jest.mock("./settings", () => ({
  getAppSetting: jest.fn(),
}));

// In order to advance timers in tests, we need to use fake timers
jest.useFakeTimers();

describe("StudioAppUpdater.#maybeCheckForUpdates", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  const getInstance = async (): Promise<StudioAppUpdater> => {
    const instance = StudioAppUpdater.Instance();
    instance.start();
    // Advance 600 seconds to trigger the update check
    jest.advanceTimersByTime(600_000);
    return instance;
  };

  it("should call checkForUpdatesAndNotify if updates are enabled", async () => {
    (getAppSetting as jest.Mock).mockReturnValue(true);

    await getInstance();

    expect(autoUpdater.checkForUpdatesAndNotify).toHaveBeenCalled();
  });

  it("should not call checkForUpdatesAndNotify if updates are disabled", async () => {
    (getAppSetting as jest.Mock).mockReturnValue(false);

    await getInstance();

    expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it("should not call checkForUpdatesAndNotify if updates setting is undefined", async () => {
    (getAppSetting as jest.Mock).mockReturnValue(undefined);

    await getInstance();

    expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });
});

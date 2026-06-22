// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/unbound-method */

import type { Mock } from "vitest";
import { autoUpdater } from "electron-updater";

import StudioAppUpdater from "./StudioAppUpdater"; // ajuste o caminho se necessário
import { getAppSetting } from "./settings";

vi.mock("electron-updater", async () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: vi.fn(),
    isUpdaterActive: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("./settings", async () => ({
  getAppSetting: vi.fn(),
}));

// In order to advance timers in tests, we need to use fake timers
vi.useFakeTimers();

describe("StudioAppUpdater.#maybeCheckForUpdates", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  const getInstance = async (): Promise<StudioAppUpdater> => {
    const instance = StudioAppUpdater.Instance();
    instance.start();
    // Advance 600 seconds to trigger the update check
    vi.advanceTimersByTime(600_000);
    return instance;
  };

  it("should call checkForUpdatesAndNotify if updates are enabled", async () => {
    (getAppSetting as Mock).mockReturnValue(true);

    await getInstance();

    expect(autoUpdater.checkForUpdatesAndNotify).toHaveBeenCalled();
  });

  it("should not call checkForUpdatesAndNotify if updates are disabled", async () => {
    (getAppSetting as Mock).mockReturnValue(false);

    await getInstance();

    expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it("should not call checkForUpdatesAndNotify if updates setting is undefined", async () => {
    (getAppSetting as Mock).mockReturnValue(undefined);

    await getInstance();

    expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });
});

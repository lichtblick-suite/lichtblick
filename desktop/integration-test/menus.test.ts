// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { signal } from "@foxglove/den/async";

import { AppType, launchApp } from "./launchApp";

describe("menus", () => {
  const closeDataSourceDialogAfterAppLaunch = async (app: AppType) => {
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(false);
  };

  it("should display the data source dialog when clicking File > Open", async () => {
    await using app = await launchApp();

    await closeDataSourceDialogAfterAppLaunch(app);

    await app.renderer.getByTestId("AppMenuButton").click();
    await app.renderer.getByTestId("app-menu-file").click();
    await app.renderer.getByTestId("menu-item-open").click();

    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
  }, 15_000);

  it("should display the Open Connection screen when clicking File > Open Connection", async () => {
    await using app = await launchApp();

    await closeDataSourceDialogAfterAppLaunch(app);

    await app.renderer.getByTestId("AppMenuButton").click();
    await app.renderer.getByTestId("app-menu-file").click();
    await app.renderer.getByTestId("menu-item-open-connection").click();

    await expect(app.renderer.getByTestId("OpenConnection").count()).resolves.toBe(1);
  }, 15_000);

  it("should open the file chooser when clicking File > Open Local File", async () => {
    await using app = await launchApp();

    await closeDataSourceDialogAfterAppLaunch(app);

    // The page is loaded as a file:// URL in the test, so showOpenFilePicker is not available and we need to mock it.
    // If it were available we could use `app.renderer.waitForEvent("filechooser")` instead.
    const openFilePickerCalled = signal<boolean>();
    await app.renderer.exposeFunction("showOpenFilePicker", async () => {
      openFilePickerCalled.resolve(true);
      return [];
    });

    await app.renderer.getByTestId("AppMenuButton").click();
    await app.renderer.getByTestId("app-menu-file").click();
    await app.renderer.getByTestId("menu-item-open-local-file").click();

    await expect(openFilePickerCalled).resolves.toBe(true);
  }, 15_000);
});

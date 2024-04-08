// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { signal } from "@foxglove/den/async";

import { launchApp } from "./launchApp";

describe("menus", () => {
  it("should display the data source dialog when clicking File > Open", async () => {
    await using app = await launchApp();
    // The Open dialog shows up automatically; close it
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
    await expect(app.renderer.getByTestId("DataSourceDialog").count()).resolves.toBe(0);

    // Click "File > Open" and the dialog should appear again
    await app.main.evaluate(async ({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      menu?.getMenuItemById("fileMenu")?.submenu?.getMenuItemById("open")?.click();
    });
    await app.renderer.waitForSelector('[data-testid="DataSourceDialog"]', { state: "visible" });
  }, 15_000);

  it("should display the Open Connection screen when clicking File > Open Connection", async () => {
    await using app = await launchApp();
    // The Open dialog shows up automatically; close it
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
    await expect(app.renderer.getByTestId("OpenConnection").count()).resolves.toBe(0);
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
    await expect(app.renderer.getByTestId("DataSourceDialog").count()).resolves.toBe(0);

    // Click "File > Open Connection" and the Open Connection screen should appear
    await app.main.evaluate(async ({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      menu?.getMenuItemById("fileMenu")?.submenu?.getMenuItemById("openConnection")?.click();
    });
    await app.renderer.waitForSelector('[data-testid="OpenConnection"]', { state: "visible" });
  }, 15_000);

  it("should open the file chooser when clicking File > Open Local File", async () => {
    await using app = await launchApp();

    // The page is loaded as a file:// URL in the test, so showOpenFilePicker is not available and we need to mock it.
    // If it were available we could use `app.renderer.waitForEvent("filechooser")` instead.
    const openFilePickerCalled = signal<boolean>();
    await app.renderer.exposeFunction("showOpenFilePicker", async () => {
      openFilePickerCalled.resolve(true);
      return [];
    });

    // Click "File > Open Connection" and the Open Connection screen should appear
    await app.main.evaluate(async ({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      menu?.getMenuItemById("fileMenu")?.submenu?.getMenuItemById("openLocalFile")?.click();
    });

    await expect(openFilePickerCalled).resolves.toBe(true);
  }, 15_000);
});

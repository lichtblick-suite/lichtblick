// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { launchApp } from "./launchApp";
import { loadFile } from "./utils/loadFile";

describe("Uninstall extension", () => {
  it("should display 'Uninstalling...' during uninstallation and 'Uninstall' when idle", async () => {
    await using app = await launchApp();

    /** Install the extension via file upload
     * This step is necessary to ensure the extension is installed before we try to uninstall it
     */
    await loadFile(
      app,
      "../../../packages/suite-base/src/test/fixtures/lichtblick.suite-extension-turtlesim-0.0.1.foxe",
    );

    /** End of installation */

    // Close the data source dialog if it appears
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

    await app.renderer.getByTestId("PersonIcon").click();
    await app.renderer.getByRole("menuitem", { name: "Extensions" }).click();
    const searchBar = app.renderer.getByPlaceholder("Search Extensions...");
    await searchBar.fill("turtlesim");
    const extensionListItem = app.renderer
      .locator('[data-testid="extension-list-entry"]')
      .filter({ hasText: "turtlesim" })
      .filter({ hasText: "0.0.1" });
    await extensionListItem.click();

    // Click on Uninstall and verifies if uninstalling occurs
    app.renderer.getByText("Uninstall");
    expect(await app.renderer.getByText("Uninstall").isVisible()).toBe(true);
    await app.renderer.getByText("Uninstall").click();

    expect(await app.renderer.getByText("Uninstalling...").isVisible()).toBe(true);
    expect(await app.renderer.getByText("Uninstalling...").isEnabled()).toBe(false);
  }, 60_000);
});

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, LayoutManager, Panels, Sidebar } from "../../../page-objects";

const CUSTOM_TITLE = "My Custom Panel Title";

/**
 * GIVEN Lichtblick is open with the default layout
 * AND a panel is present
 * WHEN the user opens the panel settings
 * AND changes the panel title to a custom string
 * THEN the custom title should be shown in the panel toolbar
 */
test("change a panel title and see it updated in the panel UI", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);
  const panels = new Panels(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();
  await mainWindow.getByTestId("create-new-layout").click();
  await layout.selectPanel("Indicator");

  // When
  await sidebar.openPanelSettingsTab();
  const settings = sidebar.getLeftSidebar();
  const titleField = settings.getByRole("textbox", { name: "Indicator" });
  await titleField.fill(CUSTOM_TITLE);
  await titleField.press("Enter");

  // Then
  await expect(
    panels.getWorkspacePanels().getByTestId("mosaic-drag-handle").getByText(CUSTOM_TITLE),
  ).toBeVisible();
});

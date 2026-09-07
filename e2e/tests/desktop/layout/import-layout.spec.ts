// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFromFilePicker } from "../../../fixtures/load-from-file-picker";
import { AppMenu, DataSourceDialog, LayoutManager, Sidebar } from "../../../page-objects";

const LAYOUT_FILE = "imported-layout.json";

test("Import a layout via layout tab > import layout", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();
  await loadFromFilePicker(mainWindow, LAYOUT_FILE);

  // When
  await layout.importLayout();

  // Then
  await expect(
    layout.getLayoutListItem().getByText("imported-layout", { exact: true }),
  ).toBeVisible();
});

test("Import a layout via menu > view > import layout", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);
  const appMenu = new AppMenu(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();
  await loadFromFilePicker(mainWindow, LAYOUT_FILE);

  // When
  await appMenu.importLayoutFromMenu();

  // Then
  await expect(
    layout.getLayoutListItem().getByText("imported-layout", { exact: true }),
  ).toBeVisible();
});

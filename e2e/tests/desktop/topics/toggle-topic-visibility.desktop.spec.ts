// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

/**
 * GIVEN a file with multiple topics is loaded
 * WHEN the user toggles topic visibility
 * THEN the filters "List all", "List visible", and "List invisible" should work as expected
 */
test("toggle topics visibility", async ({ mainWindow }) => {
  // Given
  const filename = "demo-shuffled.bag";
  await loadFile({
    mainWindow,
    filename,
  });

  // When
  await mainWindow.getByTestId("panel-settings-left").click();
  await mainWindow.getByText("3D").nth(0).click();
  const visibilityButtons = mainWindow.getByTitle("Toggle visibility");
  await visibilityButtons.nth(0).click();

  // Then
  expect(await visibilityButtons.count()).toBe(4);

  // Select only visibles
  await mainWindow.getByRole("button", { name: "List all" }).click();
  await mainWindow.locator("#menu-").getByText("List visible").click();
  expect(await mainWindow.getByTitle("Toggle visibility").count()).toBe(1);

  // Select only invisibles
  await mainWindow.getByRole("button", { name: "List visible" }).click();
  await mainWindow.locator("#menu-").getByText("List invisible").click();
  expect(await mainWindow.getByTitle("Toggle visibility").count()).toBe(3);

  // Select all
  await mainWindow.getByRole("button", { name: "List invisible" }).click();
  await mainWindow.locator("#menu-").getByText("List all").click();
  expect(await mainWindow.getByTitle("Toggle visibility").count()).toBe(4);
});

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

/**
 * GIVEN example.mcap file is loaded
 * THEN the player time should be 2025-02-26 10:37:15.547 AM WET
 * WHEN the user opens settings
 * And changes the step size to 400ms
 * And clicks on the seek forward button
 * THEN the player time should move 400ms forward
 * And be 2025-02-26 10:37:15.947 AM WET
 * WHEN the user clicks on the seek backward button
 * THEN the player time should go back to 2025-02-26 10:37:15.547 AM WET
 */
test("Display the open a new connection dialog when clicking File > Open... > Open connection", async ({
  mainWindow,
}) => {
  // Given
  const filename = "example.mcap";
  await loadFile({
    mainWindow,
    filename,
  });

  // Then
  const playerStartingTime = mainWindow.locator('input[value="2025-02-26 10:37:15.547 AM WET"]');
  expect(await playerStartingTime.inputValue()).toBe("2025-02-26 10:37:15.547 AM WET");

  //When
  await mainWindow.getByTestId("user-button").click();
  await mainWindow.getByText("Visualization settings").click();

  await mainWindow.locator("#stepSizeInput").fill("400");
  await mainWindow.getByText("Done").click();
  await mainWindow.getByTitle("Seek forward").click();

  // Then
  const playerForwardedTime = mainWindow.locator('input[value="2025-02-26 10:37:15.947 AM WET"]');
  expect(await playerForwardedTime.inputValue()).toBe("2025-02-26 10:37:15.947 AM WET");

  //When
  await mainWindow.getByTitle("Seek backward").click();

  // Then
  expect(await playerStartingTime.inputValue()).toBe("2025-02-26 10:37:15.547 AM WET");
});

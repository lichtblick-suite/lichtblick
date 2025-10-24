// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

import { changeToEpochFormat } from "../../../fixtures/change-to-epoch-format";
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

const MCAP_FILENAME = "example.mcap";

async function clickPlayblackSlider(mainWindow: Page, fraction: number) {
  const slider = mainWindow.getByTestId("playback-slider");
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const box = await slider.boundingBox();
  if (!box) {
    throw new Error("Slider bounding box not found");
  }

  // Add small offsets for edge cases to ensure click is within bounds
  const offset = 2; // pixels from edge
  const x = (() => {
    if (fraction === 0) {
      return box.x + offset;
    }
    if (fraction === 1) {
      return box.x + box.width - offset;
    }
    return box.x + box.width * fraction;
  })();
  const y = box.y + box.height / 2;

  await mainWindow.mouse.click(x, y);
  await waitTimestamp(timestamp);
}

async function waitTimestamp(timestamp: Locator): Promise<void> {
  let lastValue = -1;
  await expect
    .poll(
      async () => {
        const currentValue = Number(await timestamp.inputValue());
        const isStable = Math.abs(currentValue - lastValue) < 0.001;
        lastValue = currentValue;
        return isStable;
      },
      {
        timeout: 2000,
        intervals: [50],
      },
    )
    .toBe(true);
}

/**
 * GIVEN a .mcap file is loaded
 * WHEN seek forward button is clicked
 * THEN the playback time should advance
 */

test("should advance timestamp 100ms when seek forward button is clicked", async ({
  mainWindow,
}) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  const button = mainWindow.getByTestId("seek-forward-button");
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const startTime = Number(await timestamp.inputValue());

  // When
  await button.click(); // seek forwards

  await waitTimestamp(timestamp);
  // Then
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime); // 100ms
  expect(diff).toBeLessThanOrEqual(0.11); // 100ms + 10% tolerance
});

/**
 * GIVEN a .mcap file is loaded
 * And timestamp is in Epoch format
 * WHEN right arrow key is pressed
 * THEN the playback time should advance 100ms
 */

test("should advance timestamp 100ms when right arrow key is pressed", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  // When
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const startTime = Number(await timestamp.inputValue());

  await mainWindow.keyboard.press("ArrowRight"); // seek forwards
  await waitTimestamp(timestamp);

  // Then
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime);
  expect(diff).toBeLessThanOrEqual(0.11); // 100ms + 10% tolerance
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN alt + right arrow key is pressed
 * THEN the playback time should advance 500ms
 */

test("should advance timestamp 500ms when alt + right arrow key is pressed", async ({
  mainWindow,
}) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  // When
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const startTime = Number(await timestamp.inputValue());

  await mainWindow.keyboard.down("Alt");
  await mainWindow.keyboard.press("ArrowRight");
  await waitTimestamp(timestamp);

  // Then
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime);
  expect(diff).toBeLessThanOrEqual(0.55); // 500ms + 10% tolerance
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN timestamp is at middle of range
 * And seek backward button is clicked
 * THEN the playback time should regress 100ms
 */

test("should regress timestamp 100ms when seek forward backward is clicked", async ({
  mainWindow,
}) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);
  const button = mainWindow.getByTestId("seek-backward-button");

  // When
  await clickPlayblackSlider(mainWindow, 0.5); // move slider to middle

  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const startTime = Number(await timestamp.inputValue());

  await button.click();
  await waitTimestamp(timestamp);

  // Then
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime);
  expect(diff).toBeLessThanOrEqual(0.11); // 100ms + 10% tolerance
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN timestamp is at middle of range
 * And left arrow key is pressed
 * THEN the playback time should regress 100ms
 */

test("should regress timestamp 100ms when left arrow key is pressed", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  // When
  await clickPlayblackSlider(mainWindow, 0.5); // move slider to middle

  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const startTime = Number(await timestamp.inputValue());

  await mainWindow.keyboard.press("ArrowLeft"); // seek backwards
  await waitTimestamp(timestamp);

  // Then
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime);
  expect(diff).toBeLessThanOrEqual(0.11); // 100ms + 10% tolerance
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN timestamp is at middle of range
 * And alt + left arrow key is pressed
 * THEN the playback time should regress 500ms
 */

test("should regress timestamp 500ms when alt + left arrow key is pressed", async ({
  mainWindow,
}) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  // When
  await clickPlayblackSlider(mainWindow, 0.5); // move slider to middle

  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const startTime = Number(await timestamp.inputValue());

  await mainWindow.keyboard.down("Alt");
  await mainWindow.keyboard.press("ArrowLeft");

  // Then
  await waitTimestamp(timestamp);
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime);
  expect(diff).toBeLessThanOrEqual(0.55); // 500ms + 10% tolerance
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN timestamp is at beggining of range (edge case)
 * And alt + left arrow key is pressed
 * THEN the playback time should go to start
 */

test("should foward timestamp to end of slider when alt + right arrow key is pressed less than 500ms from the end", async ({
  mainWindow,
}) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  // When
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  await clickPlayblackSlider(mainWindow, 1); // move slider to end
  const startTime = Number(await timestamp.inputValue());

  await clickPlayblackSlider(mainWindow, 0.9); // move slider close to end

  await mainWindow.keyboard.down("Alt");
  await mainWindow.keyboard.press("ArrowRight");
  await waitTimestamp(timestamp);

  // Then
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime);
  expect(diff).toBeLessThanOrEqual(0.01);
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN timestamp is at beggining of range (edge case)
 * And alt + left arrow key is pressed
 * THEN the playback time should go to start
 */

test("should regress timestamp to start of slider alt + left arrow key is pressed less than 500ms from the start", async ({
  mainWindow,
}) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  // When
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  await clickPlayblackSlider(mainWindow, 0); // move slider to start
  const startTime = Number(await timestamp.inputValue());

  await clickPlayblackSlider(mainWindow, 0.1); // move slider close to start

  await mainWindow.keyboard.down("Alt");
  await mainWindow.keyboard.press("ArrowLeft");

  // Then
  await waitTimestamp(timestamp);
  const elapsedTimestamp = Number(await timestamp.inputValue());

  const diff = Math.abs(elapsedTimestamp - startTime);
  expect(diff).toBeLessThanOrEqual(0.01);
});

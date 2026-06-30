// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { expect, Locator, Page } from "@playwright/test";

export class PlayerControls {
  public constructor(private readonly page: Page) {}

  public async play(): Promise<void> {
    await this.getPlayButton().click();
  }

  public async pause(): Promise<void> {
    await this.getPlayButton().click();
  }

  public async togglePlayback(): Promise<void> {
    await this.page.keyboard.press("Space");
  }

  public async seekForward(): Promise<void> {
    await this.page.getByTestId("seek-forward-button").click();
  }

  public async seekBackward(): Promise<void> {
    await this.page.getByTestId("seek-backward-button").click();
  }

  public async setSpeed(speed: string): Promise<void> {
    await this.page.getByTestId("PlaybackSpeedControls-Dropdown").click();
    await this.page.getByRole("menuitem", { name: speed, exact: true }).click();
  }

  public async switchToEpochFormat(initialTimestamp: string): Promise<void> {
    const playerStartingTime = this.page.locator(`input[value="${initialTimestamp}"]`);
    await playerStartingTime.hover();
    const timestampDropdown = this.page.getByTestId("playback-time-display-toggle-button");
    await timestampDropdown.click();
    const newTimestampOption = this.page.getByTestId("playback-time-display-option-SEC");
    await newTimestampOption.click();
    await expect(newTimestampOption).toHaveCount(0);
  }

  public async getTimestampValue(): Promise<number> {
    return Number(await this.getTimestampInput().inputValue());
  }

  public async getTimestampText(): Promise<string> {
    return await this.getTimestampInput().inputValue();
  }

  public getPlayButton(): Locator {
    return this.page.getByTestId("play-button");
  }

  public getTimestampInput(): Locator {
    return this.page.getByTestId("PlaybackTime-text").locator("input");
  }

  public getSlider(): Locator {
    return this.page.getByTestId("playback-slider");
  }

  public getProgressPlot(): Locator {
    return this.page.getByTestId("progress-plot");
  }
}

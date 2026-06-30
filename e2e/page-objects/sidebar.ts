// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

export class Sidebar {
  public constructor(private readonly page: Page) {}

  public async toggleLeftSidebar(): Promise<void> {
    await this.page.getByTestId("left-sidebar-button").click();
  }

  public async toggleRightSidebar(): Promise<void> {
    await this.page.getByTestId("right-sidebar-button").click();
  }

  public async openLayoutsTab(): Promise<void> {
    await this.page.getByTestId("layouts-left").click();
  }

  public async openTopicsTab(): Promise<void> {
    await this.page.getByTestId("topics-left").click();
  }

  public async openPanelSettingsTab(): Promise<void> {
    await this.page.getByTestId("panel-settings-left").click();
  }

  public async openAlertsTab(): Promise<void> {
    await this.page.getByTestId("alerts-left").click();
  }

  public async openVariablesTab(): Promise<void> {
    await this.page.getByTestId("variables-right").click();
  }

  public getLeftSidebar(): Locator {
    return this.page.getByTestId("sidebar-left");
  }

  public getLayoutsTab(): Locator {
    return this.page.getByTestId("layouts-left");
  }

  public getTopicsTab(): Locator {
    return this.page.getByTestId("topics-left");
  }

  public getPanelSettingsTab(): Locator {
    return this.page.getByTestId("panel-settings-left");
  }

  public getAlertsTab(): Locator {
    return this.page.getByTestId("alerts-left");
  }

  public getVariablesTab(): Locator {
    return this.page.getByTestId("variables-right");
  }
}

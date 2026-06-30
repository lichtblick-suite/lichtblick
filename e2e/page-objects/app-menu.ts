// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

export class AppMenu {
  public constructor(private readonly page: Page) {}

  public async openFileMenu(): Promise<void> {
    await this.page.getByTestId("AppMenuButton").click();
    await this.page.getByTestId("app-menu-file").click();
  }

  public async openViewMenu(): Promise<void> {
    await this.page.getByTestId("AppMenuButton").click();
    await this.page.getByTestId("app-menu-view").click();
  }

  public async openFile(): Promise<void> {
    await this.openFileMenu();
    await this.page.getByTestId("menu-item-open").click();
  }

  public async importLayoutFromMenu(): Promise<void> {
    await this.openViewMenu();
    await this.page.getByText("Import layout from file…").click();
  }

  public async openDataSource(): Promise<void> {
    await this.openFileMenu();
    await this.page.getByText("Open data source").click();
  }

  public async openConnection(): Promise<void> {
    await this.openFileMenu();
    await this.page.getByText("Open connection").click();
  }

  public getMenuButton(): Locator {
    return this.page.getByTestId("AppMenuButton");
  }
}

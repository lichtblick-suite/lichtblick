// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

export class Panels {
  public constructor(private readonly page: Page) {}

  public async addPanel(panelName: string): Promise<void> {
    await this.page.getByTestId("AddPanelButton").click();
    await this.page.getByTestId(`panel-menu-item ${panelName}`).click();
  }

  public async addPanelFromSearch(panelName: string): Promise<void> {
    await this.page.getByTestId("AddPanelButton").click();
    await this.page.getByTestId("panel-list-textfield").locator("input").fill(panelName);
    await this.page.getByTestId(`panel-menu-item ${panelName}`).click();
  }

  public async setTopicPath(path: string): Promise<void> {
    await this.page.getByPlaceholder("/some/topic.msgs[0].field").fill(path);
  }

  public async openPanelMenu(): Promise<void> {
    await this.page.getByTestId("panel-menu").click();
  }

  public async splitPanelDown(): Promise<void> {
    await this.openPanelMenu();
    await this.page.getByRole("menuitem", { name: "Split down" }).click();
  }

  public getAddPanelButton(): Locator {
    return this.page.getByTestId("AddPanelButton");
  }

  public getWorkspacePanels(): Locator {
    return this.page.getByTestId("workspace-panels");
  }

  public getLogPanelRoot(): Locator {
    return this.page.getByTestId("log-panel-root");
  }

  public getScrollToBottomButton(): Locator {
    return this.page.getByTestId("scroll-to-bottom-button");
  }
}

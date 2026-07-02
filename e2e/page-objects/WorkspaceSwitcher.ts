// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

/**
 * Page object for the desktop AppBar workspace switcher. Wraps the dropdown button and its menu
 * actions (switch/create/rename/delete) so specs read as intent rather than raw selectors.
 */
export class WorkspaceSwitcher {
  public constructor(private readonly page: Page) {}

  public button(): Locator {
    return this.page.getByTestId("workspace-switcher-button");
  }

  public async open(): Promise<void> {
    await this.button().click();
  }

  public legacyItem(): Locator {
    return this.page.getByTestId("workspace-item-legacy");
  }

  public workspaceItem(name: string): Locator {
    return this.page.getByTestId("workspace-item").filter({ hasText: name });
  }

  public async switchToLegacy(): Promise<void> {
    await this.open();
    await this.legacyItem().click();
  }

  public async switchTo(name: string): Promise<void> {
    await this.open();
    await this.workspaceItem(name).click();
  }

  public async create(name: string): Promise<void> {
    await this.open();
    await this.page.getByTestId("create-personal-workspace").click();
    await this.page.getByRole("textbox").fill(name);
    await this.page.getByRole("button", { name: "OK" }).click();
  }

  public async rename(newName: string): Promise<void> {
    await this.open();
    await this.page.getByTestId("rename-workspace").click();
    const input = this.page.getByRole("textbox");
    await input.fill(newName);
    await this.page.getByRole("button", { name: "OK" }).click();
  }

  public async delete(): Promise<void> {
    await this.open();
    await this.page.getByTestId("delete-workspace").click();
    await this.page.getByRole("button", { name: "Delete" }).click();
  }

  public async currentLabel(): Promise<string> {
    return (await this.button().innerText()).trim();
  }
}

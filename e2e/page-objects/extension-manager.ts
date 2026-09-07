// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

export class ExtensionManager {
  public constructor(private readonly page: Page) {}

  public async open(): Promise<void> {
    await this.page.getByTestId("PersonIcon").click();
    await this.page.getByRole("menuitem", { name: "Extensions" }).click();
  }

  public async search(query: string): Promise<void> {
    await this.page.getByPlaceholder("Search Extensions...").fill(query);
  }

  public findExtension(name: string, version?: string): Locator {
    let entry = this.page.locator('[data-testid="extension-list-entry"]').filter({ hasText: name });

    if (version) {
      entry = entry.filter({ hasText: version });
    }

    return entry;
  }

  public async selectExtension(name: string, version?: string): Promise<void> {
    await this.findExtension(name, version).click();
  }

  public async uninstall(): Promise<void> {
    await this.page.getByText("Uninstall").click();
  }

  public getSearchBar(): Locator {
    return this.page.getByPlaceholder("Search Extensions...");
  }
}

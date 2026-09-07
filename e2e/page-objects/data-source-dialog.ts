// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

export class DataSourceDialog {
  private readonly dialog: Locator;

  public constructor(private readonly page: Page) {
    this.dialog = page.getByTestId("DataSourceDialog");
  }

  public async close(): Promise<void> {
    await this.dialog.getByTestId("CloseIcon").click();
  }

  public async isVisible(): Promise<boolean> {
    return await this.dialog.isVisible();
  }

  public async openConnection(): Promise<void> {
    await this.dialog.getByText("Open connection").click();
  }

  public getLocator(): Locator {
    return this.dialog;
  }
}

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

  /**
   * Dismisses the dialog only when it is currently shown. Switching workspaces remounts the app
   * subtree, which reopens the start dialog, so specs use this to dismiss it without failing when
   * the dialog is not present.
   */
  public async closeIfVisible(): Promise<void> {
    const closeIcon = this.dialog.getByTestId("CloseIcon");
    try {
      await closeIcon.waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      return;
    }
    await closeIcon.click();
    await this.dialog.waitFor({ state: "hidden" });
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

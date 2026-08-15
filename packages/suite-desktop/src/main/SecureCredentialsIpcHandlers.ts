// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { IpcMain, IpcMainInvokeEvent, WebContents } from "electron";

import SecureCredentialsService from "./SecureCredentialsService";
import type { SecureCredentialSetManyEntry } from "../common/types";

type RegisterSecureCredentialsIpcHandlersOptions = {
  ipcMain: Pick<IpcMain, "handle">;
  isAllowedSender: (sender: WebContents) => boolean;
  service: SecureCredentialsService;
};

function assertAllowedSender(
  event: IpcMainInvokeEvent,
  isAllowedSender: (sender: WebContents) => boolean,
): void {
  if (
    event.sender.isDestroyed() ||
    event.senderFrame == undefined ||
    event.senderFrame !== event.sender.mainFrame ||
    !isAllowedSender(event.sender)
  ) {
    throw new Error("Unauthorized secure credential request");
  }
}

export function registerSecureCredentialsIpcHandlers({
  ipcMain,
  isAllowedSender,
  service,
}: RegisterSecureCredentialsIpcHandlersOptions): void {
  ipcMain.handle("secureCredentials:get", async (event, key: unknown) => {
    assertAllowedSender(event, isAllowedSender);
    return await service.get(key);
  });
  ipcMain.handle("secureCredentials:set", async (event, key: unknown, value: unknown) => {
    assertAllowedSender(event, isAllowedSender);
    return await service.set(key, value);
  });
  ipcMain.handle("secureCredentials:setMany", async (event, entries: unknown) => {
    assertAllowedSender(event, isAllowedSender);
    return await service.setMany(entries as SecureCredentialSetManyEntry[]);
  });
  ipcMain.handle("secureCredentials:delete", async (event, key: unknown) => {
    assertAllowedSender(event, isAllowedSender);
    await service.delete(key);
  });
}

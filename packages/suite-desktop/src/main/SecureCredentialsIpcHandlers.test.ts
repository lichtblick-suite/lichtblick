// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type {
  IpcMain,
  IpcMainInvokeEvent,
  WebContents,
  WebFrameMain,
} from "electron";

import { registerSecureCredentialsIpcHandlers } from "./SecureCredentialsIpcHandlers";
import SecureCredentialsService from "./SecureCredentialsService";

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

function fakeEvent(
  id: number,
  { isMainFrame = true }: { isMainFrame?: boolean } = {},
): IpcMainInvokeEvent {
  const expectedFrame = {} as WebFrameMain;
  const sender = {
    id,
    isDestroyed: jest.fn(() => false),
    mainFrame: expectedFrame,
  } as unknown as WebContents;
  return {
    sender,
    senderFrame: isMainFrame ? expectedFrame : ({} as WebFrameMain),
  } as IpcMainInvokeEvent;
}

describe("registerSecureCredentialsIpcHandlers", () => {
  it("allows registered main-frame senders and forwards all operations", async () => {
    const handlers = new Map<string, IpcHandler>();
    const ipcMain = {
      handle: jest.fn((channel: string, handler: IpcHandler) => {
        handlers.set(channel, handler);
      }),
    } as unknown as Pick<IpcMain, "handle">;
    const deleteCredential = jest.fn().mockResolvedValue(undefined);
    const getCredential = jest.fn().mockResolvedValue({
      code: "insecure-backend",
      ok: true,
      value: "secret",
    });
    const setCredential = jest.fn().mockResolvedValue({ ok: true });
    const setManyCredentials = jest.fn().mockResolvedValue({ ok: true });
    const service = {
      delete: deleteCredential,
      get: getCredential,
      set: setCredential,
      setMany: setManyCredentials,
    } as unknown as SecureCredentialsService;
    const event = fakeEvent(101);
    const isAllowedSender = jest.fn(() => true);
    registerSecureCredentialsIpcHandlers({ ipcMain, isAllowedSender, service });

    await expect(
      handlers.get("secureCredentials:get")?.(event, "agent.llmApiKey"),
    ).resolves.toEqual({
      code: "insecure-backend",
      ok: true,
      value: "secret",
    });
    getCredential.mockResolvedValueOnce({
      code: "backend-unavailable",
      ok: false,
    });
    await expect(
      handlers.get("secureCredentials:get")?.(
        event,
        "agent.profile.profile-123.llmApiKey",
      ),
    ).resolves.toEqual({
      code: "backend-unavailable",
      ok: false,
    });
    await expect(
      handlers.get("secureCredentials:set")?.(
        event,
        "agent.llmApiKey",
        "new-secret",
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      handlers.get("secureCredentials:get")?.(
        event,
        "agent.profile.profile-123.llmApiKey",
      ),
    ).resolves.toEqual({
      code: "insecure-backend",
      ok: true,
      value: "secret",
    });
    const entries = [
      {
        expectedRevision: "old-revision",
        key: "agent.llmApiKey",
        value: "new-bundle",
      },
    ];
    await expect(
      handlers.get("secureCredentials:setMany")?.(event, entries),
    ).resolves.toEqual({
      ok: true,
    });
    setCredential.mockResolvedValueOnce({
      code: "insecure-backend",
      ok: false,
    });
    await expect(
      handlers.get("secureCredentials:set")?.(
        event,
        "agent.llmApiKey",
        "other-secret",
      ),
    ).resolves.toEqual({
      code: "insecure-backend",
      ok: false,
    });
    await expect(
      handlers.get("secureCredentials:delete")?.(event, "agent.llmApiKey"),
    ).resolves.toBeUndefined();
    expect(getCredential).toHaveBeenCalledWith("agent.llmApiKey");
    expect(getCredential).toHaveBeenCalledWith(
      "agent.profile.profile-123.llmApiKey",
    );
    expect(setCredential).toHaveBeenNthCalledWith(
      1,
      "agent.llmApiKey",
      "new-secret",
    );
    expect(setCredential).toHaveBeenNthCalledWith(
      2,
      "agent.llmApiKey",
      "other-secret",
    );
    expect(setManyCredentials).toHaveBeenCalledWith(entries);
    expect(deleteCredential).toHaveBeenCalledWith("agent.llmApiKey");
    expect(isAllowedSender).toHaveBeenCalledWith(event.sender);
  });

  it("rejects subframes and unregistered renderer senders", async () => {
    const handlers = new Map<string, IpcHandler>();
    const ipcMain = {
      handle: jest.fn((channel: string, handler: IpcHandler) => {
        handlers.set(channel, handler);
      }),
    } as unknown as Pick<IpcMain, "handle">;
    const getCredential = jest.fn();
    const service = {
      delete: jest.fn(),
      get: getCredential,
      set: jest.fn(),
      setMany: jest.fn(),
    } as unknown as SecureCredentialsService;
    const isAllowedSender = jest.fn(() => false);
    registerSecureCredentialsIpcHandlers({ ipcMain, isAllowedSender, service });
    const get = handlers.get("secureCredentials:get");

    await expect(
      get?.(fakeEvent(101, { isMainFrame: false }), "agent.llmApiKey"),
    ).rejects.toThrow("Unauthorized");
    await expect(get?.(fakeEvent(202), "agent.llmApiKey")).rejects.toThrow(
      "Unauthorized",
    );
    expect(getCredential).not.toHaveBeenCalled();
  });
});

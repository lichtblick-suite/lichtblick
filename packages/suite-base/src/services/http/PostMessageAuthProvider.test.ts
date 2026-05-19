/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PostMessageAuthProvider } from "./PostMessageAuthProvider";

describe("PostMessageAuthProvider", () => {
  const allowedOrigin = "https://host.example.com";
  let mockPostMessage: jest.Mock;

  beforeEach(() => {
    mockPostMessage = jest.fn();

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage: mockPostMessage },
    });
  });

  it("waits for the first token message before returning auth headers", async () => {
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });

    const headersPromise = provider.getAuthHeaders();

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "token-1" },
      }),
    );

    await expect(headersPromise).resolves.toEqual({ Authorization: "Bearer token-1" });

    provider.dispose();
  });

  it("requests an auth token immediately on construction", () => {
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: "auth-request" }, allowedOrigin);

    provider.dispose();
  });

  it("ignores messages from disallowed origins", async () => {
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://attacker.example.com",
        data: { type: "auth-token", token: "bad-token" },
      }),
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "good-token" },
      }),
    );

    await expect(provider.getAuthHeaders()).resolves.toEqual({
      Authorization: "Bearer good-token",
    });

    provider.dispose();
  });

  it("requests a refreshed token after a 401 response", () => {
    const provider = new PostMessageAuthProvider({
      allowedOrigins: [allowedOrigin],
      requestAuthMessageType: "refresh-token",
    });

    provider.handleUnauthorizedResponse({ status: 401 } as Response);

    expect(mockPostMessage).toHaveBeenCalledWith({ type: "refresh-token" }, allowedOrigin);

    provider.dispose();
  });
});

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
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("should return auth headers when first valid token message arrives", async () => {
    // Given
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });
    const headersPromise = provider.getAuthHeaders();
    // When
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "token-1" },
      }),
    );
    // Then
    await expect(headersPromise).resolves.toEqual({ Authorization: "Bearer token-1" });
    provider.dispose();
  });

  it("should send an auth-request message immediately on construction", () => {
    // Given / When
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });
    // Then
    expect(mockPostMessage).toHaveBeenCalledWith({ type: "auth-request" }, allowedOrigin);
    provider.dispose();
  });

  it("should ignore messages from disallowed origins and use the good token", async () => {
    // Given
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });
    // When
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
    // Then
    await expect(provider.getAuthHeaders()).resolves.toEqual({
      Authorization: "Bearer good-token",
    });
    provider.dispose();
  });

  it("should send a refresh-token request after a 401 response", () => {
    // Given
    const provider = new PostMessageAuthProvider({
      allowedOrigins: [allowedOrigin],
      requestAuthMessageType: "refresh-token",
    });
    // When
    provider.handleUnauthorizedResponse({ status: 401 } as Response);
    // Then
    expect(mockPostMessage).toHaveBeenCalledWith({ type: "refresh-token" }, allowedOrigin);
    provider.dispose();
  });

  it("should ignore messages from a different source window even if origin matches", async () => {
    // Given
    const trustedWindow = { postMessage: jest.fn() } as unknown as Window;
    const untrustedWindow = { postMessage: jest.fn() } as unknown as Window;
    const provider = new PostMessageAuthProvider({
      allowedOrigins: [allowedOrigin],
      sourceWindow: trustedWindow,
    });
    // When - dispatch event from the correct origin but wrong source window
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "spoofed-token" },
        source: untrustedWindow as unknown as WindowProxy,
      }),
    );
    // Also dispatch from the correct source to unblock the promise
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "valid-token" },
        source: trustedWindow as unknown as WindowProxy,
      }),
    );
    // Then - only the valid token is used
    await expect(provider.getAuthHeaders()).resolves.toEqual({
      Authorization: "Bearer valid-token",
    });
    provider.dispose();
  });

  it("should not throw and should ignore null event.data", async () => {
    // Given
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });
    // When - dispatch malformed event with null data, then a valid token
    expect(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: allowedOrigin,
          data: null,
        }),
      );
    }).not.toThrow();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "real-token" },
      }),
    );
    // Then - null payload was silently ignored, valid token used
    await expect(provider.getAuthHeaders()).resolves.toEqual({
      Authorization: "Bearer real-token",
    });
    provider.dispose();
  });

  it("should not throw and should ignore primitive string event.data", async () => {
    // Given
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });
    // When - dispatch malformed event (string data), then a valid token
    expect(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: allowedOrigin,
          data: "not-an-object",
        }),
      );
    }).not.toThrow();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "real-token" },
      }),
    );
    // Then
    await expect(provider.getAuthHeaders()).resolves.toEqual({
      Authorization: "Bearer real-token",
    });
    provider.dispose();
  });

  it("should not throw and should ignore event.data that is missing the expected shape", async () => {
    // Given
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });
    // When - dispatch an object without a matching type, then a valid token
    expect(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: allowedOrigin,
          data: { foo: "bar" },
        }),
      );
    }).not.toThrow();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: allowedOrigin,
        data: { type: "auth-token", token: "real-token" },
      }),
    );
    // Then
    await expect(provider.getAuthHeaders()).resolves.toEqual({
      Authorization: "Bearer real-token",
    });
    provider.dispose();
  });

  it("should return reject immediately when allowedOrigins is empty", async () => {
    // Given
    const provider = new PostMessageAuthProvider({ allowedOrigins: [] });
    // Then - resolves immediately without hanging
    await expect(provider.getAuthHeaders()).rejects.toThrow(
      "No allowed origins found. Please check your embedding configuration.",
    );
    provider.dispose();
  });

  it("should throw a meaningful error when the first token is not received within the timeout", async () => {
    // Given
    jest.useFakeTimers();
    const provider = new PostMessageAuthProvider({ allowedOrigins: [allowedOrigin] });
    const headersPromise = provider.getAuthHeaders();
    // When - advance time past the 5-second timeout without dispatching a token
    jest.advanceTimersByTime(5001);
    // Then
    await expect(headersPromise).rejects.toThrow(
      "Authentication timed out: no auth token was received from the parent window. " +
        "Please check your embedding configuration.",
    );
    provider.dispose();
  });
});

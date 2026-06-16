// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AuthProvider } from "@lichtblick/suite-base/services/http/AuthProvider";

type PostMessageAuthProviderOptions = {
  allowedOrigins: readonly string[];
  sourceWindow?: Window;
  tokenMessageType?: string;
  requestAuthMessageType?: string;
};

type TokenMessage = {
  type?: unknown;
  token?: unknown;
};

const DEFAULT_TOKEN_MESSAGE_TYPE = "auth-token";
const DEFAULT_REQUEST_AUTH_MESSAGE_TYPE = "auth-request";
const FIRST_TOKEN_TIMEOUT_MS = 5000;

// ts-prune-ignore-next
export class PostMessageAuthProvider implements AuthProvider {
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly sourceWindow?: Window;
  private readonly tokenMessageType: string;
  private readonly requestAuthMessageType: string;
  private readonly firstTokenPromise: Promise<void>;

  private resolveFirstToken?: () => void;
  private rejectFirstToken?: (error: Error) => void;
  private firstTokenReceived = false;
  private token?: string;
  private tokenTimeoutId?: ReturnType<typeof setTimeout>;

  public constructor(options: PostMessageAuthProviderOptions) {
    this.allowedOrigins = new Set(options.allowedOrigins);
    this.sourceWindow = options.sourceWindow;
    this.tokenMessageType = options.tokenMessageType ?? DEFAULT_TOKEN_MESSAGE_TYPE;
    this.requestAuthMessageType =
      options.requestAuthMessageType ?? DEFAULT_REQUEST_AUTH_MESSAGE_TYPE;

    this.firstTokenPromise = new Promise<void>((resolve, reject) => {
      this.resolveFirstToken = resolve;
      this.rejectFirstToken = reject;
    });

    if (this.allowedOrigins.size === 0) {
      this.rejectFirstToken?.(
        new Error("No allowed origins found. Please check your embedding configuration."),
      );
    } else {
      this.tokenTimeoutId = setTimeout(() => {
        this.rejectFirstToken?.(
          new Error(
            "Authentication timed out: no auth token was received from the parent window. " +
              "Please check your embedding configuration.",
          ),
        );
      }, FIRST_TOKEN_TIMEOUT_MS);
    }

    window.addEventListener("message", this.handleMessage);
    this.requestAuthToken();
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.firstTokenReceived) {
      await this.firstTokenPromise;
    }

    if (!this.token) {
      return {};
    }

    return { Authorization: `Bearer ${this.token}` };
  }

  public handleUnauthorizedResponse(response: Response): void {
    if (response.status === 401) {
      this.requestAuthToken();
    }
  }

  public dispose(): void {
    clearTimeout(this.tokenTimeoutId);
    window.removeEventListener("message", this.handleMessage);
    if (!this.firstTokenReceived) {
      this.firstTokenReceived = true;
      this.resolveFirstToken?.();
    }
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    if (!this.allowedOrigins.has(event.origin)) {
      return;
    }

    if (this.sourceWindow && event.source !== this.sourceWindow) {
      return;
    }

    const rawData: unknown = event.data;
    if (rawData == undefined || typeof rawData !== "object" || !("type" in rawData)) {
      return;
    }

    const data = rawData as TokenMessage;
    if (data.type !== this.tokenMessageType) {
      return;
    }

    if (typeof data.token === "string" && data.token.length > 0) {
      this.token = data.token;
    } else {
      this.token = undefined;
    }

    if (!this.firstTokenReceived) {
      this.firstTokenReceived = true;
      clearTimeout(this.tokenTimeoutId);
      this.resolveFirstToken?.();
    }
  };

  private requestAuthToken(): void {
    if (this.allowedOrigins.size === 0) {
      return;
    }

    const target = this.sourceWindow ?? window.parent;
    for (const origin of this.allowedOrigins) {
      target.postMessage({ type: this.requestAuthMessageType }, origin);
    }
  }
}

export type { PostMessageAuthProviderOptions };

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

// ts-prune-ignore-next
export class PostMessageAuthProvider implements AuthProvider {
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly sourceWindow?: Window;
  private readonly tokenMessageType: string;
  private readonly requestAuthMessageType: string;
  private readonly firstTokenPromise: Promise<void>;

  private resolveFirstToken?: () => void;
  private firstTokenReceived = false;
  private token?: string;

  public constructor(options: PostMessageAuthProviderOptions) {
    this.allowedOrigins = new Set(options.allowedOrigins);
    this.sourceWindow = options.sourceWindow;
    this.tokenMessageType = options.tokenMessageType ?? DEFAULT_TOKEN_MESSAGE_TYPE;
    this.requestAuthMessageType =
      options.requestAuthMessageType ?? DEFAULT_REQUEST_AUTH_MESSAGE_TYPE;

    this.firstTokenPromise = new Promise<void>((resolve) => {
      this.resolveFirstToken = resolve;
    });

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
    window.removeEventListener("message", this.handleMessage);
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    if (!this.allowedOrigins.has(event.origin)) {
      return;
    }

    if (this.sourceWindow && event.source !== this.sourceWindow) {
      return;
    }

    const data = event.data as TokenMessage;
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

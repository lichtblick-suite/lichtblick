// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type CurrentUser = {
  email: string;
};

type SigninArgs = {
  id_token: string;
  org_slug: string;
};

type Session = {
  bearer_token: string;
};

type Org = {
  id: string;
  slug: string;
  display_name?: string;
};

type DeviceCodeArgs = {
  client_id: string;
};

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type TokenArgs = {
  device_code: string;
  client_id: string;
};

type TokenResponse = {
  access_token: string;
  id_token: string;
};

class ConsoleApi {
  private _baseUrl: string;
  private _authHeader?: string;

  constructor(baseUrl: string) {
    this._baseUrl = baseUrl;
  }

  setAuthHeader(header: string): void {
    this._authHeader = header;
  }

  async orgs(): Promise<Org[]> {
    return this.get<Org[]>("/v1/orgs");
  }

  async me(): Promise<CurrentUser> {
    return this.get<CurrentUser>("/v1/me");
  }

  async signin(args: SigninArgs): Promise<Session> {
    return this.post<Session>("/v1/signin", args);
  }

  async signout(): Promise<void> {
    return this.post<void>("/v1/signout");
  }

  async deviceCode(args: DeviceCodeArgs): Promise<DeviceCodeResponse> {
    return this.post<DeviceCodeResponse>("/v1/auth/device-code", {
      client_id: args.client_id,
    });
  }

  async token(args: TokenArgs): Promise<TokenResponse> {
    return this.post<TokenResponse>("/v1/auth/token", {
      device_code: args.device_code,
      client_id: args.client_id,
    });
  }

  protected async get<T>(apiPath: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>(
      query == undefined ? apiPath : `${apiPath}?${new URLSearchParams(query).toString()}`,
      {
        method: "GET",
      },
    );
  }

  protected async post<T>(apiPath: string, body?: unknown): Promise<T> {
    return this.request<T>(apiPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  protected async request<T>(url: string, config?: RequestInit): Promise<T> {
    const fullUrl = `${this._baseUrl}${url}`;

    const headers: Record<string, string> = {};
    if (this._authHeader != undefined) {
      headers["Authorization"] = this._authHeader;
    }
    const fullConfig = { ...config, headers: { ...headers, ...config?.headers } };

    const res = await fetch(fullUrl, fullConfig);
    if (res.status !== 200) {
      try {
        const json = (await res.json()) as unknown;
        throw new Error((json as { error?: string }).error ?? "Request failed");
      } catch (err) {
        throw new Error(err.message ?? "Request failed");
      }
    }

    try {
      return res.json() as Promise<T>;
    } catch (err) {
      throw new Error("Request Failed.");
    }
  }
}

export type { CurrentUser, Org };
export default ConsoleApi;

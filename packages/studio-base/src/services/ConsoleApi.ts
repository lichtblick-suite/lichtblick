// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type User = {
  id: string;
  email: string;
  orgId: string;
  orgDisplayName: string | null; // eslint-disable-line no-restricted-syntax
  orgSlug: string;
  orgPaid: boolean | null; // eslint-disable-line no-restricted-syntax
};

type SigninArgs = {
  idToken: string;
};

type Session = {
  bearerToken: string;
};

type Org = {
  id: string;
  slug: string;
  displayName?: string;
};

type DeviceCodeArgs = {
  clientId: string;
};

type DeviceCodeResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

type TokenArgs = {
  deviceCode: string;
  clientId: string;
};

type TokenResponse = {
  accessToken: string;
  idToken: string;
};

type TopicResponse = {
  topic: string;
  encoding: string;
  schemaName: string;
  schema?: string;
  version: string;
};

type CoverageResponse = {
  deviceId: string;
  start: string;
  end: string;
};

export type LayoutID = string & { __brand: "LayoutID" };
export type ISO8601Timestamp = string & { __brand: "ISO8601Timestamp" };

export type ConsoleApiLayout = {
  id: LayoutID;
  name: string;
  createdAt: ISO8601Timestamp;
  updatedAt: ISO8601Timestamp;
  savedAt?: ISO8601Timestamp;
  permission: "CREATOR_WRITE" | "ORG_READ" | "ORG_WRITE";
  data?: Record<string, unknown>;
};

type ApiResponse<T> = { status: number; json: T };

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
    return await this.get<Org[]>("/v1/orgs");
  }

  async me(): Promise<User> {
    return await this.get<User>("/v1/me");
  }

  async signin(args: SigninArgs): Promise<Session> {
    return await this.post<Session>("/v1/signin", args);
  }

  async signout(): Promise<void> {
    return await this.post<void>("/v1/signout");
  }

  async deviceCode(args: DeviceCodeArgs): Promise<DeviceCodeResponse> {
    return await this.post<DeviceCodeResponse>("/v1/auth/device-code", {
      clientId: args.clientId,
    });
  }

  async token(args: TokenArgs): Promise<TokenResponse> {
    return await this.post<TokenResponse>("/v1/auth/token", {
      deviceCode: args.deviceCode,
      clientId: args.clientId,
    });
  }

  private async get<T>(apiPath: string, query?: Record<string, string>): Promise<T> {
    return (
      await this.request<T>(
        query == undefined ? apiPath : `${apiPath}?${new URLSearchParams(query).toString()}`,
        { method: "GET" },
      )
    ).json;
  }

  private async post<T>(apiPath: string, body?: unknown): Promise<T> {
    return (
      await this.request<T>(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json;
  }

  private async patch<T>(apiPath: string, body?: unknown): Promise<ApiResponse<T>> {
    return await this.request<T>(
      apiPath,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { allowedStatuses: [409] },
    );
  }

  private async delete<T>(
    apiPath: string,
    query?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    return await this.request<T>(
      query == undefined ? apiPath : `${apiPath}?${new URLSearchParams(query).toString()}`,
      { method: "DELETE" },
      { allowedStatuses: [404] },
    );
  }

  private async request<T>(
    url: string,
    config?: RequestInit,
    {
      allowedStatuses = [],
    }: {
      /** By default, status codes other than 200 will throw an error. */
      allowedStatuses?: number[];
    } = {},
  ): Promise<ApiResponse<T>> {
    const fullUrl = `${this._baseUrl}${url}`;

    const headers: Record<string, string> = {};
    if (this._authHeader != undefined) {
      headers["Authorization"] = this._authHeader;
    }
    const fullConfig: RequestInit = {
      ...config,
      credentials: "include",
      headers: { ...headers, ...config?.headers },
    };

    const res = await fetch(fullUrl, fullConfig);
    if (res.status !== 200 && !allowedStatuses.includes(res.status)) {
      const json = (await res.json().catch((err) => {
        throw new Error(`Status ${res.status}: ${err.message}`);
      })) as { message?: string };
      throw new Error(
        `Status ${res.status}${json.message != undefined ? `: ${json.message}` : ""}`,
      );
    }

    try {
      return { status: res.status, json: (await res.json()) as T };
    } catch (err) {
      throw new Error("Request Failed.");
    }
  }

  async getLayouts(options: { includeData: boolean }): Promise<readonly ConsoleApiLayout[]> {
    return await this.get<ConsoleApiLayout[]>("/v1/layouts", {
      includeData: options.includeData ? "true" : "false",
    });
  }

  async getLayout(
    id: LayoutID,
    options: { includeData: boolean },
  ): Promise<ConsoleApiLayout | undefined> {
    return await this.get<ConsoleApiLayout>(`/v1/layouts/${id}`, {
      includeData: options.includeData ? "true" : "false",
    });
  }

  async createLayout(layout: {
    id: LayoutID | undefined;
    savedAt: ISO8601Timestamp | undefined;
    name: string | undefined;
    permission: "CREATOR_WRITE" | "ORG_READ" | "ORG_WRITE" | undefined;
    data: Record<string, unknown> | undefined;
  }): Promise<ConsoleApiLayout> {
    return await this.post<ConsoleApiLayout>("/v1/layouts", layout);
  }

  async updateLayout(layout: {
    id: LayoutID;
    savedAt: ISO8601Timestamp;
    name: string | undefined;
    permission: "CREATOR_WRITE" | "ORG_READ" | "ORG_WRITE" | undefined;
    data: Record<string, unknown> | undefined;
  }): Promise<{ status: "success"; newLayout: ConsoleApiLayout } | { status: "conflict" }> {
    const { status, json: newLayout } = await this.patch<ConsoleApiLayout>(
      `/v1/layouts/${layout.id}`,
      layout,
    );
    if (status === 200) {
      return { status: "success", newLayout };
    } else {
      return { status: "conflict" };
    }
  }

  async deleteLayout(id: LayoutID): Promise<boolean> {
    return (await this.delete(`/v1/layouts/${id}`)).status === 200;
  }

  async coverage(params: {
    deviceId: string;
    start: string;
    end: string;
  }): Promise<CoverageResponse[]> {
    return await this.get<CoverageResponse[]>("/v1/data/coverage", params);
  }

  async topics(params: {
    deviceId: string;
    start: string;
    end: string;
    includeSchemas?: boolean;
  }): Promise<readonly TopicResponse[]> {
    return (
      await this.get<TopicResponse[]>("/v1/data/topics", {
        ...params,
        includeSchemas: params.includeSchemas ?? false ? "true" : "false",
      })
    ).map((topic) => ({
      ...topic,
      schema: topic.schema != undefined ? atob(topic.schema) : undefined,
    }));
  }

  async stream(params: {
    deviceId: string;
    start: string;
    end: string;
    topics: readonly string[];
  }): Promise<{ link: string }> {
    return await this.post<{ link: string }>("/v1/data/stream", params);
  }
}

export type { Org, DeviceCodeResponse, Session };
export default ConsoleApi;

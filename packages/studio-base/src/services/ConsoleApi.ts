// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";

import { add, fromNanoSec, Time, toSec } from "@foxglove/rostime";

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

type ExtensionResponse = {
  activeVersion: string;
  description?: string;
  foxe: string;
  id: string;
  name: string;
  publisher: string;
  sha256Sum?: string;
};

export type ConsoleEvent = {
  id: string;
  createdAt: string;
  deviceId: string;
  durationNanos: string;
  endTime: Time;
  endTimeInSeconds: number;
  metadata: Record<string, string>;
  startTime: Time;
  startTimeInSeconds: number;
  timestampNanos: string;
  updatedAt: string;
};

type EventsResponse = ConsoleEvent[];

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
  schemaEncoding: string;
  schema?: Uint8Array;
  version: string;
};
type RawTopicResponse = Omit<TopicResponse, "schema"> & { schema?: string };

type CoverageResponse = {
  deviceId: string;
  start: string;
  end: string;
};

type DeviceResponse = {
  id: string;
  name: string;
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

export type DataPlatformSourceParameters =
  | { type: "by-device"; deviceId: string; start: Time; end: Time }
  | { type: "by-import"; importId: string; start?: Time; end?: Time };

export type DataPlatformSourceRequest =
  | { deviceId: string; start: string; end: string }
  | { importId: string; start?: string; end?: string };

type ApiResponse<T> = { status: number; json: T };

class ConsoleApi {
  private _baseUrl: string;
  private _authHeader?: string;
  private _responseObserver: undefined | ((response: Response) => void);

  public constructor(baseUrl: string) {
    this._baseUrl = baseUrl;
  }

  public setAuthHeader(header: string): void {
    this._authHeader = header;
  }

  public setResponseObserver(observer: undefined | ((response: Response) => void)): void {
    this._responseObserver = observer;
  }

  public async orgs(): Promise<Org[]> {
    return await this.get<Org[]>("/v1/orgs");
  }

  public async me(): Promise<User> {
    return await this.get<User>("/v1/me");
  }

  public async signin(args: SigninArgs): Promise<Session> {
    return await this.post<Session>("/v1/signin", args);
  }

  public async signout(): Promise<void> {
    return await this.post<void>("/v1/signout");
  }

  public async deviceCode(args: DeviceCodeArgs): Promise<DeviceCodeResponse> {
    return await this.post<DeviceCodeResponse>("/v1/auth/device-code", {
      clientId: args.clientId,
    });
  }

  public async token(args: TokenArgs): Promise<TokenResponse> {
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

  public async getExtensions(): Promise<ExtensionResponse[]> {
    return await this.get<ExtensionResponse[]>("/v1/extensions");
  }

  public async getExtension(id: string): Promise<ExtensionResponse> {
    return await this.get<ExtensionResponse>(`/v1/extensions/${id}`);
  }

  public async getDevice(id: string): Promise<DeviceResponse> {
    return await this.get<DeviceResponse>(`/v1/devices/${id}`);
  }

  public async createEvent(params: {
    deviceId: string;
    timestamp: string;
    durationNanos: string;
    metadata: Record<string, string>;
  }): Promise<ConsoleEvent> {
    const rawEvent = await this.post<ConsoleEvent>(`/beta/device-events`, params);
    return rawEvent;
  }

  public async getEvents(params: {
    deviceId: string;
    start: string;
    end: string;
    query?: string;
  }): Promise<EventsResponse> {
    const rawEvents = await this.get<EventsResponse>(`/beta/device-events`, params);
    return rawEvents.map((event) => {
      const startTime = fromNanoSec(BigInt(event.timestampNanos));
      const endTime = add(startTime, fromNanoSec(BigInt(event.durationNanos)));
      return {
        ...event,
        endTime,
        endTimeInSeconds: toSec(endTime),
        startTime,
        startTimeInSeconds: toSec(startTime),
      };
    });
  }

  public async getLayouts(options: { includeData: boolean }): Promise<readonly ConsoleApiLayout[]> {
    return await this.get<ConsoleApiLayout[]>("/v1/layouts", {
      includeData: options.includeData ? "true" : "false",
    });
  }

  public async getLayout(
    id: LayoutID,
    options: { includeData: boolean },
  ): Promise<ConsoleApiLayout | undefined> {
    return await this.get<ConsoleApiLayout>(`/v1/layouts/${id}`, {
      includeData: options.includeData ? "true" : "false",
    });
  }

  public async createLayout(layout: {
    id: LayoutID | undefined;
    savedAt: ISO8601Timestamp | undefined;
    name: string | undefined;
    permission: "CREATOR_WRITE" | "ORG_READ" | "ORG_WRITE" | undefined;
    data: Record<string, unknown> | undefined;
  }): Promise<ConsoleApiLayout> {
    return await this.post<ConsoleApiLayout>("/v1/layouts", layout);
  }

  public async updateLayout(layout: {
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

  public async deleteLayout(id: LayoutID): Promise<boolean> {
    return (await this.delete(`/v1/layouts/${id}`)).status === 200;
  }

  public async coverage(params: DataPlatformSourceRequest): Promise<CoverageResponse[]> {
    return await this.get<CoverageResponse[]>("/v1/data/coverage", params);
  }

  public async topics(
    params: DataPlatformSourceRequest & { includeSchemas?: boolean },
  ): Promise<readonly TopicResponse[]> {
    return (
      await this.get<RawTopicResponse[]>("/v1/data/topics", {
        ...params,
        includeSchemas: params.includeSchemas ?? false ? "true" : "false",
      })
    ).map((topic) => {
      if (topic.schema == undefined) {
        return topic as Omit<RawTopicResponse, "schema">;
      }
      const decodedSchema = new Uint8Array(base64.length(topic.schema));
      base64.decode(topic.schema, decodedSchema, 0);
      return { ...topic, schema: decodedSchema };
    });
  }

  public async stream(
    params: DataPlatformSourceRequest & {
      topics: readonly string[];
      outputFormat?: "bag1" | "mcap0";
      replayPolicy?: "lastPerChannel" | "";
      replayLookbackSeconds?: number;
    },
  ): Promise<{ link: string }> {
    return await this.post<{ link: string }>("/v1/data/stream", params);
  }

  /// ----- private

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

    const headers: Record<string, string> = {
      // Include the version of studio in the request Useful when scraping logs to determine what
      // versions of the app are making requests.
      "fg-user-agent": FOXGLOVE_USER_AGENT,
    };
    if (this._authHeader != undefined) {
      headers["Authorization"] = this._authHeader;
    }
    const fullConfig: RequestInit = {
      ...config,
      credentials: "include",
      headers: { ...headers, ...config?.headers },
    };

    const res = await fetch(fullUrl, fullConfig);
    this._responseObserver?.(res);
    if (res.status !== 200 && !allowedStatuses.includes(res.status)) {
      if (res.status === 401) {
        throw new Error("Not logged in. Log in to your Foxglove account and try again.");
      } else if (res.status === 403) {
        throw new Error(
          "Unauthorized. Check that you are logged in to the correct Foxglove organization.",
        );
      }
      const json = (await res.json().catch((err) => {
        throw new Error(`Status ${res.status}: ${err.message}`);
      })) as { message?: string; error?: string };
      const message = json.message ?? json.error;
      throw new Error(`Status ${res.status}${message != undefined ? `: ${message}` : ""}`);
    }

    try {
      return { status: res.status, json: (await res.json()) as T };
    } catch (err) {
      throw new Error("Request Failed.");
    }
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
}

export type { Org, DeviceCodeResponse, Session, CoverageResponse };
export default ConsoleApi;

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  RemoteLayoutResponse,
  RemoteLayoutResponseData,
  SaveNewLayout,
  UpdateLayoutRequest,
  UpdateLayoutResponse,
} from "@lichtblick/suite-base/api/layouts/types";
import { ISO8601Timestamp } from "@lichtblick/suite-base/services/ILayoutStorage";
import {
  RemoteLayout,
  IRemoteLayoutStorage,
} from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";

export class LayoutsAPI implements IRemoteLayoutStorage {
  public readonly namespace: string;
  public readonly baseUrl: string = "layouts";

  public constructor(namespace: string) {
    this.namespace = namespace;
  }

  public async getLayouts(): Promise<RemoteLayout[]> {
    const layoutsResponse = await HttpService.get<RemoteLayoutResponse>(this.baseUrl, {
      namespace: this.namespace,
    });

    return layoutsResponse.data.map((layout) => ({
      id: layout.layoutId,
      externalId: layout.id,
      name: layout.name,
      data: layout.data,
      permission: layout.permission,
      savedAt: layout.updatedBy as ISO8601Timestamp | undefined,
    }));
  }

  public async getLayout(): Promise<RemoteLayout | undefined> {
    throw new Error("Method not implemented.");
  }

  public async saveNewLayout(params: SaveNewLayout): Promise<RemoteLayout> {
    const requestPayload = {
      ...params,
      layoutId: params.id,
      id: undefined,
      savedAt: undefined,
      namespace: this.namespace,
    };

    const response = await HttpService.post<RemoteLayoutResponse>(this.baseUrl, requestPayload);
    // Try to extract from response.data first, then fallback to direct access
    const responseData = response.data || response;

    const transformedLayout = {
      id: responseData.layoutId,
      externalId: responseData.id,
      name: responseData.name,
      data: responseData.data,
      permission: responseData.permission,
      savedAt: responseData.updatedBy as ISO8601Timestamp | undefined,
    };

    return transformedLayout;
  }

  public async updateLayout(params: UpdateLayoutRequest): Promise<UpdateLayoutResponse> {
    console.error(`🔴 LayoutsAPI.updateLayout called with:`, params);
    const response = await HttpService.put<RemoteLayoutResponseData>(
      `${this.baseUrl}/${params.externalId}`,
      {
        name: params.name,
        data: params.data,
        permission: params.permission,
      },
    );
    console.error(`🔴 LayoutsAPI.updateLayout HTTP response:`, response);

    // Transform the HTTP response into the expected UpdateLayoutResponse format
    const newLayout: RemoteLayout = {
      id: response.data.layoutId,
      externalId: response.data.id,
      name: response.data.name,
      data: response.data.data,
      permission: response.data.permission,
      savedAt: response.data.updatedBy as ISO8601Timestamp | undefined,
    };

    console.error(`🔴 LayoutsAPI.updateLayout transformed newLayout:`, newLayout);
    return { status: "success", newLayout };
  }

  public async deleteLayout(id: string): Promise<boolean> {
    return await HttpService.delete<boolean>(`${this.baseUrl}/${id}`);
  }
}

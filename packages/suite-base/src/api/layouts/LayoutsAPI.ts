// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  CreateLayoutRequest,
  LayoutApiResponse,
  WorkspaceLayoutResponse,
  SaveNewLayoutParams,
  UpdateLayoutRequest,
  UpdateLayoutRequestBody,
  UpdateLayoutResponse,
} from "@lichtblick/suite-base/api/layouts/types";
import { ISO8601Timestamp } from "@lichtblick/suite-base/services/ILayoutStorage";
import {
  IRemoteLayoutStorage,
  RemoteLayout,
} from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";

export class LayoutsAPI implements IRemoteLayoutStorage {
  public readonly workspace: string;
  public readonly workspacePath: string = "workspaces";
  public readonly layoutPath: string = "layouts";

  public constructor(workspace: string) {
    this.workspace = workspace;
  }

  public async getLayouts(): Promise<RemoteLayout[]> {
    const { data: layoutData } = await HttpService.get<LayoutApiResponse[]>(
      `${this.workspacePath}/${this.workspace}/${this.layoutPath}`,
    );

    return layoutData.map((layout) => ({
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

  public async saveNewLayout(params: SaveNewLayoutParams): Promise<RemoteLayout> {
    const requestPayload: CreateLayoutRequest = {
      layoutId: params.id,
      data: params.data,
      name: params.name,
      permission: params.permission,
    };

    const { data } = await HttpService.post<WorkspaceLayoutResponse>(
      `${this.workspacePath}/${this.workspace}/layout`,
      requestPayload,
    );

    const { layout: layoutData } = data;

    const transformedLayout = {
      id: layoutData.layoutId,
      externalId: layoutData.id,
      name: layoutData.name,
      data: layoutData.data,
      permission: layoutData.permission,
      savedAt: layoutData.updatedBy as ISO8601Timestamp | undefined,
    };

    return transformedLayout;
  }

  public async updateLayout(params: UpdateLayoutRequest): Promise<UpdateLayoutResponse> {
    const requestBody: UpdateLayoutRequestBody = {
      name: params.name,
      data: params.data,
      permission: params.permission,
    };

    const { data: layoutData } = await HttpService.put<LayoutApiResponse>(
      `${this.layoutPath}/${params.externalId}`,
      requestBody,
    );

    // Transform the HTTP response into the expected UpdateLayoutResponse format
    const newLayout: RemoteLayout = {
      id: layoutData.layoutId,
      externalId: layoutData.id,
      name: layoutData.name,
      data: layoutData.data,
      permission: layoutData.permission,
      savedAt: layoutData.updatedBy as ISO8601Timestamp | undefined,
    };

    return { status: "success", newLayout };
  }

  public async deleteLayout(id: string): Promise<boolean> {
    const deletedLayout = await HttpService.delete<RemoteLayout | undefined>(
      `${this.workspacePath}/${this.workspace}/layout/${id}`,
    );
    return deletedLayout.data != undefined;
  }
}

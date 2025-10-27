// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { GenericApiEntity } from "@lichtblick/suite-base/api/types";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

export interface IExtensionAPI {
  createOrUpdate(extension: ExtensionInfoWorkspace, file: File): Promise<StoredExtension>;
  get(id: string): Promise<StoredExtension | undefined>;
  loadContent(fileId: string): Promise<Uint8Array | undefined>;
  list(): Promise<ExtensionInfo[]>;
  remove(id: string): Promise<boolean>;
  readonly workspace: string;
}

export type ExtensionInfoWorkspace = Pick<StoredExtension, "info" | "workspace">;

export type ListExtensionsQueryParams = {
  workspace?: string;
};

type RemoteExtension = Pick<
  ExtensionInfo,
  | "changelog"
  | "description"
  | "displayName"
  | "homepage"
  | "keywords"
  | "license"
  | "name"
  | "publisher"
  | "qualifiedName"
  | "readme"
  | "version"
>;

export interface IExtensionApiResponse extends GenericApiEntity, RemoteExtension {
  extensionId: string;
  fileId: string;
  scope: Namespace;
}

export type CreateOrUpdateBody = RemoteExtension & {
  extensionId: string;
  scope: Namespace;
};

export type DownloadExtensionsInBatchBody = {
  ids: string[];
};

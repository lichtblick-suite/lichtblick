// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { CameraModelsMap } from "@lichtblick/den/image/types";
import { useGuaranteedContext } from "@lichtblick/hooks";
import {
  ExtensionPanelRegistration,
  Immutable,
  PanelSettings,
  RegisterMessageConverterArgs,
} from "@lichtblick/suite";
import { ExtensionSettings } from "@lichtblick/suite-base/components/PanelSettings/types";
import { TopicAliasFunctions } from "@lichtblick/suite-base/players/TopicAliasingPlayer/TopicAliasingPlayer";
import { TypeExtensionLoader } from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

export type ExtensionData = {
  buffer: Uint8Array;
  file?: File;
  namespace?: Namespace;
};

export type RegisteredPanel = {
  extensionId: string;
  extensionName: string;
  extensionNamespace?: Namespace;
  registration: ExtensionPanelRegistration;
};

export type InstallExtensionsResult = {
  success: boolean;
  info?: ExtensionInfo;
  error?: unknown;
  extensionName?: string;
  loaderResults?: (Pick<LoadExtensionsResult, "loaderType" | "success"> & { error?: unknown })[];
};

export type LoadExtensionsResult = {
  loaderType: TypeExtensionLoader;
  success: boolean;
  error?: Error;
  info?: ExtensionInfo;
};

export type UseInstallingExtensionsState = {
  installFoxeExtensions: (extensionsData: ExtensionData[]) => Promise<void>;
};

export type UseInstallingExtensionsStateProps = {
  isPlaying: boolean;
  playerEvents: {
    play: (() => void) | undefined;
  };
};

export type ExtensionSnackbar = {
  name: string;
  namespace: Namespace;
  error: string;
  success: string;
  warning: string;
};

export type ExtensionCatalog = Immutable<{
  downloadExtension: (url: string) => Promise<Uint8Array>;
  installExtensions: (
    namespace: Namespace,
    extensions: ExtensionData[],
  ) => Promise<InstallExtensionsResult[]>;
  isExtensionInstalled: (extensionId: string) => boolean;
  markExtensionAsInstalled: (extensionId: string) => void;
  mergeState: (info: ExtensionInfo, contributionPoints: ContributionPoints) => void;
  refreshAllExtensions: () => Promise<void>;
  uninstallExtension: (namespace: Namespace, id: string) => Promise<void>;
  unMarkExtensionAsInstalled: (extensionId: string) => void;

  loadedExtensions: Set<string>;
  installedExtensions: undefined | ExtensionInfo[];
  installedPanels: undefined | Record<string, RegisteredPanel>;
  installedMessageConverters: undefined | Omit<MessageConverter, "panelSettings">[];
  installedTopicAliasFunctions: undefined | TopicAliasFunctions;
  installedCameraModels: CameraModelsMap;
  panelSettings: undefined | ExtensionSettings;
}>;

export type MessageConverter = RegisterMessageConverterArgs<unknown> & {
  extensionNamespace?: Namespace;
  extensionId?: string;
};

export type ContributionPoints = {
  panels: Record<string, RegisteredPanel>;
  messageConverters: MessageConverter[];
  topicAliasFunctions: TopicAliasFunctions;
  panelSettings: ExtensionSettings;
  cameraModels: CameraModelsMap;
};

export const ExtensionCatalogContext = createContext<undefined | StoreApi<ExtensionCatalog>>(
  undefined,
);

export function useExtensionCatalog<T>(selector: (registry: ExtensionCatalog) => T): T {
  const context = useGuaranteedContext(ExtensionCatalogContext);
  return useStore(context, selector);
}

export function getExtensionPanelSettings(
  reg: ExtensionCatalog,
): Record<string, Record<string, PanelSettings<unknown>>> {
  return reg.panelSettings ?? {};
}

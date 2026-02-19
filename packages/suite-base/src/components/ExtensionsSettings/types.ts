// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ButtonProps } from "@mui/material";
import { AsyncState } from "react-use/lib/useAsyncFn";

import { Immutable } from "@lichtblick/suite";
import { OperationStatus } from "@lichtblick/suite-base/components/types";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

export type InstalledExtension = {
  id: string;
  installed: boolean;
  name: string;
  displayName: string;
  description: string;
  publisher: string;
  homepage?: string;
  license?: string;
  version: string;
  keywords?: string[];
  namespace: string;
  qualifiedName: string;
};

export type FocusedExtension = {
  installed: boolean;
  entry: Immutable<ExtensionMarketplaceDetail>;
};

export type EntryGroupedData = {
  namespace: string;
  entries: Immutable<ExtensionMarketplaceDetail>[];
};

export type UseExtensionSettingsHook = {
  setUndebouncedFilterText: (newFilterText: string) => void;
  marketplaceEntries: AsyncState<ExtensionMarketplaceDetail[]>;
  refreshMarketplaceEntries: () => Promise<ExtensionMarketplaceDetail[]>;
  undebouncedFilterText: string;
  namespacedData: EntryGroupedData[];
  groupedMarketplaceData: EntryGroupedData[];
  debouncedFilterText: string;
};

export type UseExtensionOperationsOptions = {
  onInstallSuccess?: (extensionId: string) => void;
  onUninstallSuccess?: (extensionId: string) => void;
};

export type UseExtensionOperationsReturnHook = {
  handleInstall: (extension: Immutable<ExtensionMarketplaceDetail>) => Promise<void>;
  handleUninstall: (extension: Immutable<ExtensionMarketplaceDetail>) => Promise<void>;
  operationStatus: OperationStatus;
  operatingExtensionId: string | undefined;
  isOperating: (extensionId: string) => boolean;
};

export type ExtensionActionButtonProps = {
  extension: Immutable<ExtensionMarketplaceDetail>;
  onAction: (extension: Immutable<ExtensionMarketplaceDetail>) => Promise<void>;
  isOperating: boolean;
  operationStatus: OperationStatus;
  className?: string;
  stopPropagation?: boolean;
  color?: ButtonProps["color"];
  variant?: ButtonProps["variant"];
  label: string;
  loadingLabel: string;
};

export const ExtensionActionsLabel = {
  INSTALL: "Install",
  UNINSTALL: "Uninstall",
};

export const ExtensionOperationStatusLabel = {
  INSTALLING: "Installing...",
  UNINSTALLING: "Uninstalling...",
};

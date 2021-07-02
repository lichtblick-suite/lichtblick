// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Bring in global modules and overrides required by studio source files
// This adds type declarations for scss, bag, etc imports
// This adds type declarations for global react
// See typings/index.d.ts for additional included references
/// <reference types="./typings" />

export { default as App } from "./App";
export type { NetworkInterface, OsContext } from "./OsContext";
export { default as ErrorBoundary } from "./components/ErrorBoundary";
export { default as MultiProvider } from "./components/MultiProvider";
export { default as AppConfigurationContext } from "./context/AppConfigurationContext";
export type {
  AppConfiguration,
  AppConfigurationValue,
  ChangeHandler,
} from "./context/AppConfigurationContext";
export { default as LayoutCacheContext, useLayoutCache } from "./context/LayoutCacheContext";
export type { CachedLayout, ILayoutCache } from "./services/ILayoutCache";
export type {
  Layout,
  LayoutMetadata,
  LayoutID,
  UserID,
  ISO8601Timestamp,
  ILayoutStorage,
} from "./services/ILayoutStorage";
export { default as NativeAppMenuContext } from "./context/NativeAppMenuContext";
export type { NativeAppMenu, NativeAppMenuEvent } from "./context/NativeAppMenuContext";
export type { PlayerSourceDefinition } from "./context/PlayerSelectionContext";
export { default as ThemeProvider } from "./theme/ThemeProvider";
export { default as installDevtoolsFormatters } from "./util/installDevtoolsFormatters";
export { default as overwriteFetch } from "./util/overwriteFetch";
export { default as waitForFonts } from "./util/waitForFonts";
export { default as UserProfileLocalStorageProvider } from "./providers/UserProfileLocalStorageProvider";
export { default as StudioToastProvider } from "./components/StudioToastProvider";
export { default as ExtensionLoaderContext } from "./context/ExtensionLoaderContext";
export type { ExtensionLoader, ExtensionInfo } from "./context/ExtensionLoaderContext";
export { default as LayoutStorageContext } from "./context/LayoutStorageContext";
export type {
  RemoteLayout,
  RemoteLayoutMetadata,
  IRemoteLayoutStorage,
} from "./services/IRemoteLayoutStorage";
export { default as CacheOnlyLayoutStorage } from "./services/CacheOnlyLayoutStorage";
export { default as CacheOnlyLayoutStorageProvider } from "./providers/CacheOnlyLayoutStorageProvider";
export { AppSetting } from "./AppSetting";
export { useAppConfigurationValue } from "./hooks/useAppConfigurationValue";
export type { PanelsState } from "./context/CurrentLayoutContext/actions";
export { default as OfflineLayoutStorage } from "@foxglove/studio-base/services/OfflineLayoutStorage";
export { default as LayoutStorageDebuggingContext } from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";

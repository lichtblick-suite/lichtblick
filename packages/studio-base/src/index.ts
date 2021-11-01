// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Bring in global modules and overrides required by studio source files
// This adds type declarations for bag, etc imports
// This adds type declarations for global react
// See typings/index.d.ts for additional included references
/// <reference types="./typings" />

export { default as ConsoleApi } from "@foxglove/studio-base/services/ConsoleApi";
export type { Session } from "@foxglove/studio-base/services/ConsoleApi";
export {
  default as ConsoleApiContext,
  useConsoleApi,
} from "@foxglove/studio-base/context/ConsoleApiContext";
export { default as ConsoleApiRemoteLayoutStorageProvider } from "@foxglove/studio-base/providers/ConsoleApiRemoteLayoutStorageProvider";
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
export { default as LayoutStorageContext, useLayoutStorage } from "./context/LayoutStorageContext";
export type { Layout, LayoutID, ISO8601Timestamp, ILayoutStorage } from "./services/ILayoutStorage";
export { migrateLayout } from "./services/ILayoutStorage";
export { default as NativeAppMenuContext } from "./context/NativeAppMenuContext";
export type { NativeAppMenu, NativeAppMenuEvent } from "./context/NativeAppMenuContext";
export { default as NativeWindowContext } from "./context/NativeWindowContext";
export type { NativeWindow } from "./context/NativeWindowContext";
export type { IDataSourceFactory } from "./context/PlayerSelectionContext";
export { default as ThemeProvider } from "./theme/ThemeProvider";
export { default as installDevtoolsFormatters } from "./util/installDevtoolsFormatters";
export { default as overwriteFetch } from "./util/overwriteFetch";
export { default as waitForFonts } from "./util/waitForFonts";
export { default as UserProfileLocalStorageProvider } from "./providers/UserProfileLocalStorageProvider";
export { default as StudioToastProvider } from "./components/StudioToastProvider";
export { default as ExtensionLoaderContext } from "./context/ExtensionLoaderContext";
export type { ExtensionLoader, ExtensionInfo } from "./context/ExtensionLoaderContext";
export { default as LayoutManagerContext } from "./context/LayoutManagerContext";
export { AppSetting } from "./AppSetting";
export { useAppConfigurationValue } from "./hooks/useAppConfigurationValue";
export type { PanelsState } from "./context/CurrentLayoutContext/actions";
export { default as LayoutStorageDebuggingContext } from "./context/LayoutStorageDebuggingContext";
export { default as CssBaseline } from "./components/CssBaseline";
export { default as GlobalCss } from "./components/GlobalCss";
export { default as CurrentUserContext } from "./context/CurrentUserContext";
export type { User } from "./context/CurrentUserContext";
export { default as DeviceCodeDialog } from "./components/DeviceCodeDialog";
export { default as FoxgloveDataPlatformDataSourceFactory } from "./dataSources/FoxgloveDataPlatformDataSourceFactory";
export { default as Ros1LocalBagDataSourceFactory } from "./dataSources/Ros1LocalBagDataSourceFactory";
export { default as Ros1RemoteBagDataSourceFactory } from "./dataSources/Ros1RemoteBagDataSourceFactory";
export { default as Ros1SocketDataSourceFactory } from "./dataSources/Ros1SocketDataSourceFactory";
export { default as Ros2LocalBagDataSourceFactory } from "./dataSources/Ros2LocalBagDataSourceFactory";
export { default as Ros2SocketDataSourceFactory } from "./dataSources/Ros2SocketDataSourceFactory";
export { default as RosbridgeDataSourceFactory } from "./dataSources/RosbridgeDataSourceFactory";
export { default as UlogLocalDataSourceFactory } from "./dataSources/UlogLocalDataSourceFactory";
export { default as VelodyneDataSourceFactory } from "./dataSources/VelodyneDataSourceFactory";

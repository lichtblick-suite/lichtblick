// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Bring in global modules and overrides required by studio source files
// This adds type declarations for bag, etc imports
// This adds type declarations for global react
// See typings/index.d.ts for additional included references
/// <reference types="./typings" />

export { SharedRoot } from "./SharedRoot";
export { StudioApp } from "./StudioApp";
export type { NetworkInterface, OsContext } from "./OsContext";
export type {
  IAppConfiguration,
  AppConfigurationValue,
  ChangeHandler,
} from "./context/AppConfigurationContext";
export { AppContext } from "./context/AppContext";
export type { IAppContext } from "./context/AppContext";
export { migratePanelsState } from "./services/migrateLayout";
export type { IDataSourceFactory } from "./context/PlayerSelectionContext";
export { default as installDevtoolsFormatters } from "./util/installDevtoolsFormatters";
export { default as overwriteFetch } from "./util/overwriteFetch";
export { default as waitForFonts } from "./util/waitForFonts";
export { initI18n } from "./i18n";
export type { ExtensionLoader } from "./services/ExtensionLoader";
export type { ExtensionInfo, ExtensionNamespace } from "./types/Extensions";
export { AppSetting } from "./AppSetting";
export { default as FoxgloveWebSocketDataSourceFactory } from "./dataSources/FoxgloveWebSocketDataSourceFactory";
export { default as Ros1LocalBagDataSourceFactory } from "./dataSources/Ros1LocalBagDataSourceFactory";
export { default as Ros2LocalBagDataSourceFactory } from "./dataSources/Ros2LocalBagDataSourceFactory";
export { default as RosbridgeDataSourceFactory } from "./dataSources/RosbridgeDataSourceFactory";
export { default as UlogLocalDataSourceFactory } from "./dataSources/UlogLocalDataSourceFactory";
export { default as RemoteDataSourceFactory } from "./dataSources/RemoteDataSourceFactory";
export { default as McapLocalDataSourceFactory } from "./dataSources/McapLocalDataSourceFactory";
export { default as SampleNuscenesDataSourceFactory } from "./dataSources/SampleNuscenesDataSourceFactory";
export { LaunchPreferenceValue } from "@foxglove/studio-base/types/LaunchPreferenceValue";
export { reportError, setReportErrorHandler } from "./reportError";
export { makeWorkspaceContextInitialState } from "./providers/WorkspaceContextProvider";
export type { AppBarProps } from "./components/AppBar";

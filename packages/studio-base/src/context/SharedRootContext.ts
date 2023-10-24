// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { AppBarProps } from "@foxglove/studio-base/components/AppBar";
import { CustomWindowControlsProps } from "@foxglove/studio-base/components/AppBar/CustomWindowControls";
import { IAppConfiguration } from "@foxglove/studio-base/context/AppConfigurationContext";
import { INativeAppMenu } from "@foxglove/studio-base/context/NativeAppMenuContext";
import { INativeWindow } from "@foxglove/studio-base/context/NativeWindowContext";
import { IDataSourceFactory } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";

interface ISharedRootContext {
  deepLinks: string[];
  appConfiguration?: IAppConfiguration;
  dataSources: IDataSourceFactory[];
  extensionLoaders: readonly ExtensionLoader[];
  nativeAppMenu?: INativeAppMenu;
  nativeWindow?: INativeWindow;
  enableLaunchPreferenceScreen?: boolean;
  enableGlobalCss?: boolean;
  appBarLeftInset?: number;
  extraProviders?: JSX.Element[];
  customWindowControlProps?: CustomWindowControlsProps;
  onAppBarDoubleClick?: () => void;
  AppBarComponent?: (props: AppBarProps) => JSX.Element;
}

const SharedRootContext = createContext<ISharedRootContext>({
  deepLinks: [],
  dataSources: [],
  extensionLoaders: [],
});
SharedRootContext.displayName = "SharedRootContext";

export function useSharedRootContext(): ISharedRootContext {
  return useContext(SharedRootContext);
}

export { SharedRootContext };
export type { ISharedRootContext };

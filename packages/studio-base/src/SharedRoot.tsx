// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import GlobalCss from "@foxglove/studio-base/components/GlobalCss";
import {
  ISharedRootContext,
  SharedRootContext,
} from "@foxglove/studio-base/context/SharedRootContext";

import { ColorSchemeThemeProvider } from "./components/ColorSchemeThemeProvider";
import CssBaseline from "./components/CssBaseline";
import ErrorBoundary from "./components/ErrorBoundary";
import AppConfigurationContext from "./context/AppConfigurationContext";

export function SharedRoot(props: ISharedRootContext & { children: JSX.Element }): JSX.Element {
  const {
    appConfiguration,
    dataSources,
    extensionLoaders,
    nativeAppMenu,
    nativeWindow,
    deepLinks,
    enableLaunchPreferenceScreen,
    enableGlobalCss = false,
    appBarLeftInset,
    extraProviders,
    onAppBarDoubleClick,
    AppMenuComponent,
    children,
  } = props;

  return (
    <AppConfigurationContext.Provider value={appConfiguration}>
      <ColorSchemeThemeProvider>
        {enableGlobalCss && <GlobalCss />}
        <CssBaseline>
          <ErrorBoundary>
            <SharedRootContext.Provider
              value={{
                appConfiguration,
                deepLinks,
                dataSources,
                extensionLoaders,
                nativeAppMenu,
                nativeWindow,
                enableLaunchPreferenceScreen,
                appBarLeftInset,
                extraProviders,
                onAppBarDoubleClick,
                AppMenuComponent,
              }}
            >
              {children}
            </SharedRootContext.Provider>
          </ErrorBoundary>
        </CssBaseline>
      </ColorSchemeThemeProvider>
    </AppConfigurationContext.Provider>
  );
}

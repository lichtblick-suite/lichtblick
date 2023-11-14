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
    appBarLeftInset,
    appConfiguration,
    onAppBarDoubleClick,
    AppBarComponent,
    children,
    customWindowControlProps,
    dataSources,
    deepLinks,
    enableGlobalCss = false,
    enableLaunchPreferenceScreen,
    extraProviders,
    nativeAppMenu,
    nativeWindow,
  } = props;

  return (
    <AppConfigurationContext.Provider value={appConfiguration}>
      <ColorSchemeThemeProvider>
        {enableGlobalCss && <GlobalCss />}
        <CssBaseline>
          <ErrorBoundary>
            <SharedRootContext.Provider
              value={{
                appBarLeftInset,
                AppBarComponent,
                appConfiguration,
                customWindowControlProps,
                dataSources,
                deepLinks,
                enableLaunchPreferenceScreen,
                extraProviders,
                nativeAppMenu,
                nativeWindow,
                onAppBarDoubleClick,
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

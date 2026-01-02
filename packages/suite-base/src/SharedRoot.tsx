// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import GlobalCss from "@lichtblick/suite-base/components/GlobalCss";
import {
  ISharedRootContext,
  SharedRootContext,
} from "@lichtblick/suite-base/context/SharedRootContext";
import AppParametersProvider from "@lichtblick/suite-base/providers/AppParametersProvider";

import { ColorSchemeThemeProvider } from "./components/ColorSchemeThemeProvider";
import CssBaseline from "./components/CssBaseline";
import ErrorBoundary from "./components/ErrorBoundary";
import AppConfigurationContext from "./context/AppConfigurationContext";

export function SharedRoot(
  props: ISharedRootContext & { children: React.JSX.Element },
): React.JSX.Element {
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
    extensionLoaders,
    extraProviders,
  } = props;

  return (
    <AppConfigurationContext.Provider value={appConfiguration}>
      <AppParametersProvider>
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
                  extensionLoaders,
                  extraProviders,
                  onAppBarDoubleClick,
                }}
              >
                {children}
              </SharedRootContext.Provider>
            </ErrorBoundary>
          </CssBaseline>
        </ColorSchemeThemeProvider>
      </AppParametersProvider>
    </AppConfigurationContext.Provider>
  );
}

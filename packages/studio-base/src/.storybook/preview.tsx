// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { ToastProvider } from "react-toast-notifications";

import { AppConfigurationContext } from "@foxglove/studio-base";
import CssBaseline from "@foxglove/studio-base/components/CssBaseline";
import GlobalCss from "@foxglove/studio-base/components/GlobalCss";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import { HoverValueProvider } from "@foxglove/studio-base/context/HoverValueContext";
import { UserNodeStateProvider } from "@foxglove/studio-base/context/UserNodeStateContext";
import ReadySignalContext from "@foxglove/studio-base/stories/ReadySignalContext";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { makeConfiguration } from "@foxglove/studio-base/util/makeConfiguration";
import signal from "@foxglove/studio-base/util/signal";
import waitForFonts from "@foxglove/studio-base/util/waitForFonts";

import "./styles.scss";

let loaded = false;

function WithContextProviders(Child: Story, ctx: StoryContext): JSX.Element {
  if (ctx.parameters?.useReadySignal) {
    const sig = signal();
    ctx.parameters.storyReady = sig;
    ctx.parameters.readySignal = () => {
      sig.resolve();
    };
  }

  const readySignal = ctx.parameters.readySignal;

  const config = makeConfiguration();

  const providers = [
    /* eslint-disable react/jsx-key */
    <AppConfigurationContext.Provider value={config} />,
    <ReadySignalContext.Provider value={readySignal} />,
    <ToastProvider>{undefined}</ToastProvider>,
    <HoverValueProvider />,
    <UserNodeStateProvider />,
    /* eslint-enable react/jsx-key */
  ];
  return (
    <ThemeProvider>
      <GlobalCss />
      <CssBaseline>
        <MultiProvider providers={providers}>
          <Child />
        </MultiProvider>
      </CssBaseline>
    </ThemeProvider>
  );
}

export const loaders = [
  async (): Promise<void> => {
    // These loaders are run once for each story when you switch between stories,
    // but the global config can't be safely loaded more than once.
    if (!loaded) {
      await waitForFonts();
      loaded = true;
    }
  },
];

export const decorators = [WithContextProviders];

export const parameters = {
  // Disable default padding around the page body
  layout: "fullscreen",
};

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";
import { useMemo, useRef } from "react";
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

import "./styles.css";

let loaded = false;

// When rendering 2 copies of a story for dark/light theme, the ready signal should be received from
// both before invoking the storybook ready signal. Each signal should be called at most once so
// rather than keeping a counter of total calls we keep two separate booleans.
function useCombinedReadySignal(
  readySignal: (() => void) | undefined,
): [(() => void) | undefined, (() => void) | undefined] {
  const ready1 = useRef(false);
  const ready2 = useRef(false);

  return useMemo(() => {
    function makeSignal(readyRef: typeof ready1) {
      if (!readySignal) {
        return undefined;
      }
      return () => {
        if (readyRef.current) {
          throw new Error("Ready signal called more than once");
        }
        readyRef.current = true;
        if (ready1.current && ready2.current) {
          readySignal();
        }
      };
    }
    return [makeSignal(ready1), makeSignal(ready2)];
  }, [readySignal]);
}

function WithContextProviders(Child: Story, ctx: StoryContext): JSX.Element {
  if (ctx.parameters?.useReadySignal === true) {
    const sig = signal();
    ctx.parameters.storyReady = sig;
    ctx.parameters.readySignal = () => {
      sig.resolve();
    };
  }

  const readySignal: (() => void) | undefined = ctx.parameters.readySignal;

  const config = makeConfiguration();

  const colorScheme: "dark" | "light" | "both-row" | "both-column" =
    ctx.parameters.colorScheme ?? "both-row";

  const needsCombinedReadySignal = colorScheme.startsWith("both");
  const [readySignal1, readySignal2] = useCombinedReadySignal(readySignal);

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
    <div
      style={{
        display: "flex",
        flexDirection: colorScheme === "both-column" ? "column" : "row",
        height: "100%",
        width: "100%",
      }}
    >
      {
        // We need to render exactly 1 copy of GlobalCss, so the body background and font color may
        // not match the theme when rendering both color schemes in one story. If this is a problem
        // for some story that depends on inheriting body styles, you can split the story into one
        // per color scheme.
        <ThemeProvider isDark={colorScheme === "dark" || colorScheme.startsWith("both")}>
          <GlobalCss />
        </ThemeProvider>
      }

      {(colorScheme === "light" || colorScheme.startsWith("both")) && (
        // Set a transform to make this the root for position:fixed elements
        <div style={{ position: "relative", transform: "scale(1)", flexGrow: 1 }}>
          <ReadySignalContext.Provider
            value={needsCombinedReadySignal ? readySignal1 : readySignal}
          >
            <ThemeProvider isDark={false}>
              <CssBaseline>
                <MultiProvider providers={providers}>
                  <Child />
                </MultiProvider>
              </CssBaseline>
            </ThemeProvider>
          </ReadySignalContext.Provider>
        </div>
      )}
      {(colorScheme === "dark" || colorScheme.startsWith("both")) && (
        // Set a transform to make this the root for position:fixed elements
        <div style={{ position: "relative", transform: "scale(1)", flexGrow: 1 }}>
          <ReadySignalContext.Provider
            value={needsCombinedReadySignal ? readySignal2 : readySignal}
          >
            <ThemeProvider isDark={true}>
              <CssBaseline>
                <MultiProvider providers={providers}>
                  <Child />
                </MultiProvider>
              </CssBaseline>
            </ThemeProvider>
          </ReadySignalContext.Provider>
        </div>
      )}
    </div>
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

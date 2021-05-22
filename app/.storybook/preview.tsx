// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";
import { ToastProvider } from "react-toast-notifications";

import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import waitForFonts from "@foxglove/studio-base/util/waitForFonts";

import { withMockSubscribeToNewsletter } from "./__mocks__/subscribeToNewsletter";

import "@foxglove/studio-base/styles/global.scss";
import "./styles.scss";

let loaded = false;

function withTheme(Child: Story): JSX.Element {
  return (
    <ThemeProvider>
      <Child />
    </ThemeProvider>
  );
}

function withToasts(Child: Story): JSX.Element {
  return (
    <ToastProvider>
      <Child />
    </ToastProvider>
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

export const decorators = [withTheme, withToasts, withMockSubscribeToNewsletter];

export const parameters = {
  // Disable default padding around the page body
  layout: "fullscreen",
};

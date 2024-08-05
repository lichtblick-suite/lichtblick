// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { GlobalStyles } from "tss-react";

import { BODY_PADDING } from "./styleConstants";

export function GlobalStyle(): JSX.Element {
  return (
    <GlobalStyles
      styles={{
        "*": {
          boxSizing: "border-box",
        },
        "body, html": {
          width: "100%",
          height: "100%",
          padding: 0,
          margin: 0,

          "@media (prefers-color-scheme: dark)": {
            background: "#333",
          },
        },
        body: {
          padding: `${BODY_PADDING}px !important`, // important for Storybook
          minWidth: 150,
          fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif",

          "@media (prefers-color-scheme: dark)": {
            color: "#fff",
          },
        },
        "pre, code, tt": {
          fontFamily: "ui-monospace, Menlo, Monaco, monospace",
        },
        a: {
          color: "#476ebd",

          "@media (prefers-color-scheme: dark)": {
            color: "#99b5ed",
          },
        },
      }}
    />
  );
}

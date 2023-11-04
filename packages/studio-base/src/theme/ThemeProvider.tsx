// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material";
import * as React from "react";
import { useEffect, useLayoutEffect, useMemo } from "react";

import { createMuiTheme } from "@foxglove/theme";

// Make sure mui styles are loaded first so that our makeStyles customizations
// take precedence.
const muiCache = createCache({ key: "mui", prepend: true });

// By default the ThemeProvider adds an extra div to the DOM tree. We can disable this with a
// custom `as` component to FluentThemeProvider. The component must support a `ref` property
// otherwise we get react warnings.
const ThemeContainer = React.forwardRef((props: React.PropsWithChildren, _ref) => (
  <>{props.children}</>
));
ThemeContainer.displayName = "ThemeContainer";

export default function ThemeProvider({
  children,
  isDark,
}: React.PropsWithChildren<{ isDark: boolean }>): React.ReactElement | ReactNull {
  useEffect(() => {
    // Trick CodeEditor into sync with our theme
    document.documentElement.setAttribute("data-color-mode", isDark ? "dark" : "light");

    // remove styles set to prevent browser flash on init
    document.querySelector("#loading-styles")?.remove();
  }, [isDark]);

  const muiTheme = useMemo(() => createMuiTheme(isDark ? "dark" : "light"), [isDark]);

  useLayoutEffect(() => {
    // Set the theme color to match the sidebar and playback bar
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = muiTheme.palette.background.paper;
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, [muiTheme]);

  return (
    <CacheProvider value={muiCache}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </CacheProvider>
  );
}

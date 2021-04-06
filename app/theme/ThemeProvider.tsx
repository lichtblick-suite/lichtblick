// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { ThemeProvider as FluentThemeProvider } from "@fluentui/react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import theme from "@foxglove-studio/app/theme";
import useIcons from "@foxglove-studio/app/theme/useIcons";

export default function ThemeProvider({
  children,
}: React.PropsWithChildren<unknown>): React.ReactElement {
  useIcons();
  return (
    <FluentThemeProvider
      // By default the ThemeProvider adds an extra div to the DOM tree. We can disable this with a
      // custom `as` component, but we get React warnings if our component doesn't support ref.
      // eslint-disable-next-line react/display-name
      as={React.forwardRef((props, _ref) => props.children)}
      applyTo="none" // skip default global styles for now
      theme={theme}
    >
      <StyledThemeProvider
        // Expose the same theme to styled-components - see types/styled-components.d.ts for type definitions
        theme={theme}
      >
        {children}
      </StyledThemeProvider>
    </FluentThemeProvider>
  );
}

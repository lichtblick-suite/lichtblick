// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { IContextualMenuStyles, IContextualMenuItemStyles, ILayerStyles } from "@fluentui/react";
import { createTheme } from "@fluentui/theme";

// https://aka.ms/themedesigner
export default createTheme({
  semanticColors: {
    menuBackground: "#242429",
    menuItemBackgroundHovered: "#2e2e39",
  },
  components: {
    ContextualMenu: {
      styles: {
        subComponentStyles: {
          menuItem: {
            // Improve menu item icon/text alignment - this may not be necessary if we choose a
            // different font in the future.
            icon: {
              marginTop: -4,
            },
          } as Partial<IContextualMenuItemStyles>,
        },
      } as IContextualMenuStyles,
    },
    // Prevent Layer from overriding root styles - similar to `applyTo="none"` on ThemeProvider.
    // https://github.com/microsoft/fluentui/issues/17701
    Layer: {
      styles: {
        root: {
          fontFamily: "",
          WebkitFontSmoothing: "",
          fontSize: "",
          fontWeight: "",
          color: "",
        },
        content: {
          fontFamily: "",
          WebkitFontSmoothing: "",
          fontSize: "",
          fontWeight: "",
          color: "",
        },
      } as ILayerStyles,
    },
  },
  isInverted: true,
  palette: {
    themePrimary: "#b093c4",
    themeLighterAlt: "#070608",
    themeLighter: "#1c181f",
    themeLight: "#352c3b",
    themeTertiary: "#6a5876",
    themeSecondary: "#9b82ad",
    themeDarkAlt: "#b79dca",
    themeDark: "#c2aad2",
    themeDarker: "#d1bfde",
    neutralLighterAlt: "#1a1a21",
    neutralLighter: "#22222a",
    neutralLight: "#2e2e39",
    neutralQuaternaryAlt: "#363642",
    neutralQuaternary: "#3c3c49",
    neutralTertiaryAlt: "#595968",
    neutralTertiary: "#8c8c8a",
    neutralSecondary: "#8c8c8a",
    neutralPrimaryAlt: "#fcfcf9",
    neutralPrimary: "#f7f7f3",
    neutralDark: "#fdfdfc",
    black: "#fefefd",
    blackTranslucent40: "#fefefd66",
    white: "#121217",
    whiteTranslucent40: "#12121766",
  },
});

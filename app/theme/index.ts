// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  IContextualMenuStyles,
  IContextualMenuItemStyles,
  ILayerStyles,
  IOverlayStyles,
  IModalStyles,
  IComboBoxStyles,
  ITooltipStyles,
  ITooltipStyleProps,
  IToggleStyles,
} from "@fluentui/react";
import { createTheme } from "@fluentui/theme";

import { SANS_SERIF } from "@foxglove-studio/app/styles/fonts";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

// https://aka.ms/themedesigner
export default createTheme({
  defaultFontStyle: {
    fontFamily: SANS_SERIF,
  },
  semanticColors: {
    menuBackground: "#242429",
    menuItemBackgroundHovered: "#2e2e39",
    errorBackground: colors.RED1,
    warningBackground: colors.YELLOW1,
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
    Overlay: {
      styles: {
        root: {
          "-webkit-app-region": "drag",
        },
      } as Partial<IOverlayStyles>,
    },
    Modal: {
      styles: {
        main: {
          "-webkit-app-region": "no-drag",
        },
      } as Partial<IModalStyles>,
    },
    ComboBox: {
      // Style hacks that can be removed when we eventually clean up our global styles from global.scss
      // which currently has margin: $control-margin;
      styles: {
        input: {
          margin: 0,
        },
        root: {
          ".ms-ComboBox-CaretDown-button": {
            margin: 0,
          },
        },
      } as Partial<IComboBoxStyles>,
    },
    Tooltip: {
      styles: ({ theme }: ITooltipStyleProps): Partial<ITooltipStyles> => ({
        root: {
          padding: 6,
          background: theme.palette.neutralDark,
        },
        content: {
          background: theme.palette.neutralDark,
          color: theme.palette.neutralLight,
        },
      }),
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
    Toggle: {
      styles: {
        container: {
          alignItems: "baseline",
        },
      } as IToggleStyles,
    },
  },
  isInverted: true,
  palette: {
    themePrimary: "#9a74f2",
    themeLighterAlt: "#fbf9fe",
    themeLighter: "#eee8fd",
    themeLight: "#e0d4fb",
    themeTertiary: "#c1aaf7",
    themeSecondary: "#a684f4",
    themeDarkAlt: "#8b69da",
    themeDark: "#7558b8",
    themeDarker: "#564188",
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

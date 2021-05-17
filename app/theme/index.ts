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
  IStyle,
} from "@fluentui/react";
import { createTheme } from "@fluentui/theme";

import { SANS_SERIF } from "@foxglove/studio-base/styles/fonts";
import styles from "@foxglove/studio-base/styles/variables.module.scss";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

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
    Titlebar: {
      styles: {
        root: {
          height: styles.topBarHeight,
        } as IStyle,
      },
    },
  },
  isInverted: true,
  palette: {
    themePrimary: "#b8aefd",
    themeLighterAlt: "#c0b7fd",
    themeLighter: "#c8c0fd",
    themeLight: "#d0c9fd",
    themeTertiary: "#d7d2fe",
    themeSecondary: "#dfdafe",
    themeDarkAlt: "#e7e3fe",
    themeDark: "#efecfe",
    themeDarker: "#f6f5ff",
    neutralLighterAlt: "#1a1a21",
    neutralLighter: "#22222a",
    neutralLight: "#2e2e39",
    neutralQuaternaryAlt: "#363642",
    neutralQuaternary: "#3c3c49",
    neutralTertiaryAlt: "#595968",
    neutralTertiary: "#f3f3f3",
    neutralSecondary: "#f5f5f5",
    neutralPrimaryAlt: "#f7f7f7",
    neutralPrimary: "#eeeeee",
    neutralDark: "#fbfbfb",
    black: "#fdfdfd",
    white: "#121217",
    blackTranslucent40: "#fdfdfd66",
    whiteTranslucent40: "#12121766",
  },
});

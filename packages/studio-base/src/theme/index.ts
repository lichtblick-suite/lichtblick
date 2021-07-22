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
  IColorPickerStyles,
  IToggleStyles,
  IStyle,
  ISpinnerStyles,
  IPalette,
  hsl2rgb,
  getColorFromRGBA,
} from "@fluentui/react";
import { createTheme } from "@fluentui/theme";

import { SANS_SERIF } from "@foxglove/studio-base/styles/fonts";
import styles from "@foxglove/studio-base/styles/variables.module.scss";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const THEME_HUE = 247;

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
    ColorPicker: {
      styles: {
        root: { maxWidth: 250 },
        colorRectangle: { minWidth: 100, minHeight: 100 },
        table: {
          // We need to remove table styles from global.scss, but for now, changing them
          // to e.g. "#root td" messes with the styling in various places because the
          // selector becomes more specific. So for now, just disable them directly here.
          "tr, th, td, tr:hover th, tr:hover td": {
            border: "none",
            background: "none",
            cursor: "unset",
          },
        },
      } as IColorPickerStyles,
    },
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
          minHeight: "unset",
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
    Spinner: {
      styles: {
        circle: {
          animationTimingFunction: "linear",
          borderWidth: 2,
        },
      } as Partial<ISpinnerStyles>,
    },

    // Custom (non-Fluent) components
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
    ...themeColors(),
    ...neutralColors(),
    black: "#fdfdfd",
    white: "#121217",
    blackTranslucent40: "#fdfdfd66",
    whiteTranslucent40: "#12121766",
  },
});

function themeColors(): Partial<IPalette> {
  const keys: (keyof IPalette)[] = [
    "themeDarker",
    "themeDark",
    "themeDarkAlt",
    "themePrimary",
    "themeSecondary",
    "themeTertiary",
    "themeLight",
    "themeLighter",
    "themeLighterAlt",
  ];
  keys.reverse(); // reverse because our theme is inverted

  const result: Partial<IPalette> = Object.fromEntries(
    keys.map((key, i) => {
      const ratio = i / (keys.length - 1);
      return [
        key,
        "#" +
          getColorFromRGBA(hsl2rgb(THEME_HUE, Math.min(20 + ratio * 75, 75), 40 + ratio * 57)).hex,
      ];
    }),
  );
  return result;
}

function neutralColors(): Partial<IPalette> {
  const keys: (keyof IPalette)[] = [
    "neutralDark",
    "neutralPrimary",
    "neutralPrimaryAlt",
    "neutralSecondary",
    "neutralSecondaryAlt",
    "neutralTertiary",
    "neutralTertiaryAlt",
    "neutralQuaternary",
    "neutralQuaternaryAlt",
    "neutralLight",
    "neutralLighter",
    "neutralLighterAlt",
  ];
  keys.reverse(); // reverse because our theme is inverted

  const result: Partial<IPalette> = Object.fromEntries(
    keys.map((key, i) => {
      const ratio = i / (keys.length - 1);
      return [key, "#" + getColorFromRGBA(hsl2rgb(THEME_HUE, 5, 16 + ratio * 80)).hex];
    }),
  );
  return result;
}

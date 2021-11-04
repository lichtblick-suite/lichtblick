// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  getColorFromRGBA,
  hsl2rgb,
  IColorPickerStyles,
  IComboBoxStyles,
  IContextualMenuItemStyles,
  IContextualMenuStyles,
  ILayerStyles,
  IModalStyles,
  IOverlayStyles,
  IPalette,
  ISpinnerStyles,
  IToggleStyles,
  ITooltipStyleProps,
  ITooltipStyles,
  PartialTheme,
} from "@fluentui/react";
import { createTheme } from "@fluentui/theme";

import { colors, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const THEME_HUE = 247;

// https://aka.ms/themedesigner
function getPartialTheme({ inverted }: { inverted: boolean }): PartialTheme {
  return {
    defaultFontStyle: {
      fontFamily: fonts.SANS_SERIF,
      fontFeatureSettings: fonts.SANS_SERIF_FEATURE_SETTINGS,
    },
    semanticColors: {
      menuBackground: inverted ? "#242424" : "#f3f3f3",
      menuItemBackgroundHovered: inverted ? "#2e2e2e" : "#e1e1e1",
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
            background: theme.palette.neutralLighter,
          },
          content: {
            background: theme.palette.neutralLighter,
            color: theme.palette.neutralDark,
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
    },
    isInverted: inverted,
    palette: {
      ...themeColors({ inverted }),
      ...neutralColors({ inverted }),
      white: inverted ? "#121217" : "#fdfdfd",
      black: inverted ? "#fdfdfd" : "#121217",
      whiteTranslucent40: inverted ? "#12121766" : "#fdfdfd66",
      blackTranslucent40: inverted ? "#fdfdfd66" : "#12121766",
    },
  };
}

export const lightTheme = createTheme(getPartialTheme({ inverted: false }));
export const darkTheme = createTheme(getPartialTheme({ inverted: true }));

function themeColors({ inverted }: { inverted: boolean }): Partial<IPalette> {
  // Generated from https://aka.ms/themedesigner
  return inverted
    ? {
        themePrimary: "#9480ed",
        themeLighterAlt: "#060509",
        themeLighter: "#181426",
        themeLight: "#2c2647",
        themeTertiary: "#594d8e",
        themeSecondary: "#8271d1",
        themeDarkAlt: "#9e8cef",
        themeDark: "#ad9df1",
        themeDarker: "#c1b6f5",
      }
    : {
        themePrimary: "#744ce0",
        themeLighterAlt: "#f9f7fe",
        themeLighter: "#e7e0fa",
        themeLight: "#d2c5f6",
        themeTertiary: "#a88fed",
        themeSecondary: "#8360e4",
        themeDarkAlt: "#6845ca",
        themeDark: "#583aab",
        themeDarker: "#412b7e",
      };
}

function neutralColors({ inverted }: { inverted: boolean }): Partial<IPalette> {
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
  if (inverted) {
    keys.reverse();
  }

  const result: Partial<IPalette> = Object.fromEntries(
    keys.map((key, i) => {
      const ratio = i / (keys.length - 1);
      return [key, "#" + getColorFromRGBA(hsl2rgb(THEME_HUE, 5, 16 + ratio * 80)).hex];
    }),
  );
  return result;
}

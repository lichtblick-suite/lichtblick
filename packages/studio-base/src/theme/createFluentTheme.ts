// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getColorFromRGBA, hsl2rgb, ITheme, createTheme, IPalette } from "@fluentui/react";

import { colors, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import fluentComponents from "./fluentComponents";

const THEME_HUE = 247;

export default function createFluentTheme({
  isInverted = false,
}: {
  isInverted?: boolean;
}): ITheme {
  return createTheme({
    ...{
      defaultFontStyle: {
        fontFamily: fonts.SANS_SERIF,
        fontFeatureSettings: fonts.SANS_SERIF_FEATURE_SETTINGS,
      },
      semanticColors: {
        bodyBackground: isInverted ? "#121217" : "#f4f4f5",
        menuBackground: isInverted ? "#242424" : "#f3f3f3",
        menuItemBackgroundHovered: isInverted ? "#2e2e2e" : "#e1e1e1",
        errorBackground: colors.RED1,
        warningBackground: colors.YELLOW1,
      },
      palette: {
        ...themeColors({ isInverted }),
        ...neutralColors({ isInverted }),
        white: isInverted ? "#121217" : "#fdfdfd",
        black: isInverted ? "#fdfdfd" : "#121217",
        whiteTranslucent40: isInverted ? "#12121766" : "#fdfdfd66",
        blackTranslucent40: isInverted ? "#fdfdfd66" : "#12121766",
      },
    },
    components: fluentComponents,
    isInverted,
  });
}

function themeColors({ isInverted }: { isInverted: boolean }): Partial<IPalette> {
  // Generated from https://aka.ms/themedesigner
  return isInverted
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

function neutralColors({ isInverted }: { isInverted: boolean }): Partial<IPalette> {
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
  if (isInverted) {
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

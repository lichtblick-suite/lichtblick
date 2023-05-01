// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ThemeOptions as MuiThemeOptions, TypographyStyle } from "@mui/material";

import { Language } from "@foxglove/studio-base/i18n";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

declare module "@mui/material/styles/createTypography" {
  interface Typography {
    fontFeatureSettings: string;
  }
  interface TypographyOptions {
    fontFeatureSettings: string;
  }
}

export function muiTypography({ locale }: { locale: Language }): MuiThemeOptions["typography"] {
  let fontFeatureSettings: string;
  switch (locale) {
    case "en":
      fontFeatureSettings = fonts.SANS_SERIF_FEATURE_SETTINGS;
      break;
    case "zh":
    case "ja":
      fontFeatureSettings = fonts.SANS_SERIF_FEATURE_SETTINGS_CJK;
      break;
  }
  const baseFontStyles: TypographyStyle = {
    fontFeatureSettings,
  };
  return {
    fontFamily: fonts.SANS_SERIF,
    fontSize: 12,
    fontFeatureSettings,
    body1: {
      ...baseFontStyles,
    },
    body2: {
      ...baseFontStyles,
    },
    button: {
      ...baseFontStyles,
      textTransform: "none",
      fontWeight: 700,
      letterSpacing: "-0.0125em",
    },
    overline: {
      ...baseFontStyles,
      letterSpacing: "0.05em",
      lineHeight: "1.5",
    },
    h1: { ...baseFontStyles, fontSize: "2rem" },
    h2: { ...baseFontStyles, fontSize: "1.8rem" },
    h3: { ...baseFontStyles, fontSize: "1.6rem" },
    h4: { ...baseFontStyles, fontSize: "1.2rem" },
    h5: { ...baseFontStyles, fontSize: "1.1rem" },
    h6: { ...baseFontStyles, fontSize: "1rem" },
  };
}

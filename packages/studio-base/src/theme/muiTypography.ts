// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ThemeOptions as MuiThemeOptions, TypographyStyle } from "@mui/material";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const baseFontStyles: TypographyStyle = {
  fontFeatureSettings: fonts.SANS_SERIF_FEATURE_SETTINGS,
};

const muiTypography: MuiThemeOptions["typography"] = {
  fontFamily: fonts.SANS_SERIF,
  fontSize: 12,
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

export default muiTypography;

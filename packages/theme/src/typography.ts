// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypographyOptions, TypographyStyle } from "@mui/material/styles/createTypography";

declare module "@mui/material/styles/createTypography" {
  interface Typography {
    fontMonospace: string;
    fontSansSerif: string;
    fontFeatureSettings: string;
  }
  interface TypographyOptions {
    fontMonospace: string;
    fontSansSerif: string;
    fontFeatureSettings: string;
  }
}

// We explicitly avoid fallback fonts (such as 'monospace') here to work around a bug in
// Chrome/Chromium on Windows that causes crashes when multiple Workers try to access fonts that
// have not yet been loaded. There is a race against the internal DirectWrite font cache which
// ends up crashing in DWriteFontFamily::GetFirstMatchingFont() or DWriteFont::Create().
//
// https://bugs.chromium.org/p/chromium/issues/detail?id=1261577
export const fontSansSerif = "'Inter'";
export const fontMonospace = "'IBM Plex Mono'";

export const fontFeatureSettings = "'tnum'";

const headingFontStyles: TypographyStyle = {
  fontFeatureSettings,
  letterSpacing: "-0.025em",
  fontWeight: 800,
};

const subtitleFontStyles: TypographyStyle = {
  fontFeatureSettings,
  fontWeight: 500,
};

export const typography: TypographyOptions = {
  fontMonospace,
  fontSansSerif,
  fontFamily: fontSansSerif,
  fontSize: 12,
  fontFeatureSettings: "'tnum'",
  body1: { fontFeatureSettings },
  body2: { fontFeatureSettings },
  button: {
    fontFeatureSettings,
    textTransform: "none",
    fontWeight: 700,
    letterSpacing: "-0.0125em",
  },
  overline: {
    fontFeatureSettings,
    letterSpacing: "0.05em",
    lineHeight: "1.5",
  },
  h1: { ...headingFontStyles, fontSize: "2rem" },
  h2: { ...headingFontStyles, fontSize: "1.8rem" },
  h3: { ...headingFontStyles, fontSize: "1.6rem" },
  h4: { ...headingFontStyles, fontSize: "1.2rem" },
  h5: { ...headingFontStyles, fontSize: "1.1rem" },
  h6: { ...headingFontStyles, fontSize: "1rem" },
  subtitle1: { ...subtitleFontStyles },
  subtitle2: { ...subtitleFontStyles },
};

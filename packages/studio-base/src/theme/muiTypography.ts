// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ThemeOptions as MuiThemeOptions } from "@mui/material";

const muiTypography: MuiThemeOptions["typography"] = {
  fontFamily: '"Inter", san-serif',
  fontSize: 12,
  button: {
    textTransform: "none",
    fontWeight: 700,
    letterSpacing: "-0.0125em",
  },
  overline: {
    letterSpacing: "0.05em",
  },
  h1: { fontSize: "2rem" },
  h2: { fontSize: "1.8rem" },
  h3: { fontSize: "1.6rem" },
  h4: { fontSize: "1.2rem" },
  h5: { fontSize: "1.1rem" },
  h6: { fontSize: "1rem" },
};

export default muiTypography;

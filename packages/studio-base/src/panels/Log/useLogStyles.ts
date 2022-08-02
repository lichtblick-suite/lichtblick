// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

export default makeStyles()(({ palette }) => ({
  fatal: {
    color: palette.error.main,
    fontWeight: "bold",
  },
  error: {
    color: palette.error.main,
  },
  warn: {
    color: palette.warning.main,
  },
  info: {
    color: palette.info.main,
  },
  debug: {
    color: palette.text.secondary,
  },
}));

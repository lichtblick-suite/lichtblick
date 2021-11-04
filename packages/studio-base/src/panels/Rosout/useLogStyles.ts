// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@fluentui/react";

const useLogStyles = makeStyles((theme) => ({
  fatal: {
    color: theme.semanticColors.errorText,
    fontWeight: "bold",
  },
  error: {
    color: theme.semanticColors.errorText,
  },
  warn: {
    color: theme.semanticColors.warningBackground,
  },
  info: {
    color: theme.semanticColors.bodyText,
  },
  debug: {
    color: theme.palette.neutralTertiary,
  },
}));

export default useLogStyles;

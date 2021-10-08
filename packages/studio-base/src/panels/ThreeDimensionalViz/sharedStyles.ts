// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyleSets } from "@fluentui/react";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const sharedStyles = mergeStyleSets({
  iconButton: {
    fontFamily: "sans-serif !important",
    backgroundColor: "transparent !important",
    border: "none !important",
    padding: "8px 4px !important",
    alignItems: "start !important",
    marginRight: "4px !important",
    marginLeft: "4px !important",
  },
  button: {
    backgroundColor: "transparent !important",
    border: "none !important",
    padding: "4px !important",
    alignItems: "start !important",
    marginRight: "4px !important",
    marginLeft: "4px !important",
  },
  buttons: {
    backgroundColor: `${colors.DARK3}`,
    borderRadius: "4px",
    boxShadow: "0 0px 32px rgba(8, 8, 10, 0.6)",
    overflow: "hidden",
    pointerEvents: "auto",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    padding: 0,
    marginBottom: 10,

    "& span.icon": {
      width: 18,
      height: 18,
      fontSize: 18,
      display: "inline-block",
    },
  },
});

export default sharedStyles;

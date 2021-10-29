// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyleSets } from "@fluentui/react";

const sharedStyles = mergeStyleSets({
  button: {
    backgroundColor: "transparent !important",
    border: "none !important",
    padding: "4px !important",
    alignItems: "start !important",
    marginRight: "4px !important",
    marginLeft: "4px !important",
  },
});

export default sharedStyles;

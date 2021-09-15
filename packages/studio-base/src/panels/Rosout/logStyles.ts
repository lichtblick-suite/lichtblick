// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyleSets } from "@fluentui/merge-styles";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const logStyles = mergeStyleSets({
  fatal: {
    color: colors.RED2,
    fontWeight: "bold",
  },
  error: {
    color: colors.RED2,
  },
  warn: {
    color: colors.ORANGE2,
  },
  info: {
    color: colors.GRAY3,
  },
  debug: {
    color: colors.GRAY,
  },
});

export default logStyles;

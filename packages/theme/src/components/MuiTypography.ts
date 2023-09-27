// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiTypography: OverrideComponentReturn<"MuiTypography"> = {
  defaultProps: {
    // Remap typography variants to be <div> elements to
    // avoid triggering react's validateDOMNesting error
    variantMapping: {
      h1: "div",
      h2: "div",
      h3: "div",
      h4: "div",
      h5: "div",
      h6: "div",
      subtitle1: "div",
      subtitle2: "div",
      body1: "div",
      body2: "div",
      inherit: "div",
    },
  },
};

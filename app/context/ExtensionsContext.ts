// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { Extensions } from "@foxglove/studio-base/Extensions";

const ExtensionsContext = createContext<Extensions | undefined>(undefined);

export function useExtensions(): Extensions {
  const extensions = useContext(ExtensionsContext);
  if (extensions == undefined) {
    throw new Error("An ExtensionsContext provider is required to useExtensions");
  }
  return extensions;
}

export default ExtensionsContext;

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import LayoutManagerContext from "@foxglove/studio-base/context/LayoutManagerContext";
import { useLayoutStorage } from "@foxglove/studio-base/context/LayoutStorageContext";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager";

export default function LayoutManagerProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const layoutStorage = useLayoutStorage();

  const layoutManager = useMemo(
    () => new LayoutManager({ storage: layoutStorage }),
    [layoutStorage],
  );

  return (
    <LayoutManagerContext.Provider value={layoutManager}>{children}</LayoutManagerContext.Provider>
  );
}

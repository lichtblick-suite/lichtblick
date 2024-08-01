// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CurrentLayoutLocalStorageSyncAdapter } from "@lichtblick/studio-base/components/CurrentLayoutLocalStorageSyncAdapter";
import { URLStateSyncAdapter } from "@lichtblick/studio-base/components/URLStateSyncAdapter";
import { useAppContext } from "@lichtblick/studio-base/context/AppContext";
import { useMemo } from "react";

export function SyncAdapters(): JSX.Element {
  // Sync adapters from app context override any local sync adapters
  const { syncAdapters } = useAppContext();

  return useMemo(() => {
    if (syncAdapters) {
      return <>{...syncAdapters}</>;
    }

    return (
      <>
        <URLStateSyncAdapter />
        <CurrentLayoutLocalStorageSyncAdapter />
      </>
    );
  }, [syncAdapters]);
}

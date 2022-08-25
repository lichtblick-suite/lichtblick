// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventsSyncAdapter } from "@foxglove/studio-base/components/EventsSyncAdapter";
import { OrgExtensionRegistrySyncAdapter } from "@foxglove/studio-base/components/OrgExtensionRegistrySyncAdapter";
import { URLStateSyncAdapter } from "@foxglove/studio-base/components/URLStateSyncAdapter";

export function SyncAdapters(): JSX.Element {
  return (
    <>
      <EventsSyncAdapter />
      <OrgExtensionRegistrySyncAdapter />
      <URLStateSyncAdapter />
    </>
  );
}

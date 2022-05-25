// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useStateToURLSynchronization } from "@foxglove/studio-base/hooks/useStateToURLSynchronization";

// This is in a simple subcomponent so it doesn't trigger rerenders of an entire expensive
// component like Workspace while it's listening for time values.
export function URLStateSyncAdapter(): ReactNull {
  useStateToURLSynchronization();

  return ReactNull;
}

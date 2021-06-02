// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { OsContext } from "@foxglove/studio-base/OsContext";

type GlobalWithCtx = typeof global & {
  ctxbridge?: OsContext;
};

/** Global singleton of the OsContext provided by the bridge */
const OsContextSingleton = (global as GlobalWithCtx).ctxbridge;
export default OsContextSingleton;

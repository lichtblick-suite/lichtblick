// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import BrowserHttpReader from "@foxglove/studio-base/randomAccessDataProviders/BrowserHttpReader";
import { isNonEmptyOrUndefined } from "@foxglove/studio-base/util/emptyOrUndefined";

// Get a globally unique ID for caching purposes for a remote URL, or `undefined`
// when none can be found.
export async function getRemoteBagGuid(url: string): Promise<string | undefined> {
  try {
    const identifier = (await new BrowserHttpReader(url).open()).identifier;
    // Combine the identifier (ETag or Last-Modified) with the actual URL to form a globally unique ID.
    return isNonEmptyOrUndefined(identifier) ? `${url}---${identifier}` : undefined;
  } catch (error) {
    return undefined;
  }
}

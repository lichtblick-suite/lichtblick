// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutInfo } from "@lichtblick/studio-base/types/layouts";

/**
 * LayoutLoader is an object used by lichtblick to load local layouts.
 */
export interface LayoutLoader {
  readonly namespace: "local";

  fetchLayouts: () => Promise<LayoutInfo[]>;
}

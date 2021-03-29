// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearBagCacheButton from "@foxglove-studio/app/components/ClearBagCacheButton";
import { FeatureDescriptions } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";

export default {
  diskBagCaching: {
    name: "Disk Bag Caching (requires reload)",
    description: (
      <>
        Cache bag data on disk when streaming to avoid re-downloading. This might result in an
        overall slower experience so we only recommend it if you’re on a slow network connection.
        Alternatively, you can download the bag to disk yourself, and load it as a file.
        <br />
        <ClearBagCacheButton />
      </>
    ),
    developmentDefault: false,
    productionDefault: false,
  },
  unlimitedMemoryCache: {
    name: "Unlimited in-memory cache (requires reload)",
    description: <>Fully buffer a bag into memory. This may use up a lot of system memory.</>,
    developmentDefault: false,
    productionDefault: false,
  },
} as FeatureDescriptions;

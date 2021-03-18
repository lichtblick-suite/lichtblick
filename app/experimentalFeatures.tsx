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
        When streaming bag data, persist it on disk, so that when reloading the page we don’t have
        to download the data again. However, this might result in an overall slower experience, and
        is generally experimental, so we only recommend it if you’re on a slow network connection.
        Alternatively, you can download the bag to disk manually, and drag it into Webviz.
        <br />
        <ClearBagCacheButton />
      </>
    ),
    developmentDefault: false,
    productionDefault: false,
  },
  unlimitedMemoryCache: {
    name: "Unlimited in-memory cache (requires reload)",
    description:
      "If you have a lot of memory in your computer, and you frequently have to play all the way through large bags, you can turn this on to fully buffer the bag into memory. However, use at your own risk, as this might crash the browser.",
    developmentDefault: false,
    productionDefault: false,
  },
  layoutManagement: {
    name: "Manage Layouts",
    description: `Manage layouts via the layout menu. Add/Remove/Copy layouts. Import/Export layouts to files.`,
    developmentDefault: false,
    productionDefault: false,
  },
} as FeatureDescriptions;
